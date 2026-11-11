import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  isSafeReturnTo,
  requireIdentity,
  requireOrgAdmin,
  safeReturnTo,
} from "./lib/auth";
import { mergeSenders } from "./appConfig";
import {
  buildOrderPollOffsets,
  isTerminalOrderStatus,
} from "./lib/pollSchedule";

// ---------- Gmail OAuth inbox checks — the event-driven payment-verification feed ----------
// One Google account (the founder's inbox receiving bank alerts). There is no
// permanent cron: every check is order-triggered (creation backoff, customer
// wake/refresh, post-expiry reconciliation) or a manual admin "Check inbox
// now". A connected inbox means checks can run — there is no enable toggle.
// Secrets stay in Convex env, never in the DB:
//   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
// Founder one-time dance: Google Cloud OAuth client + gmail.readonly scope,
// then one-click Connect stores the refresh token server-side.
//
// Design: stateless. Each check runs messages.list with a `from:` search query
// and ingests every hit; ingestBankEmail dedupes by gmailMessageId, so
// re-checking the same window is safe. No historyId cursor, nothing to seed or
// reseed (the old history.list approach needed constant plumbing: historyIds
// expire after ~7 days and history.list silently ignores the `q` filter).
// Every non-manual check verifies pending work exists BEFORE touching the
// Gmail API, so idle orgs and terminal orders cost zero Gmail calls.

const SINGLETON = "singleton";
const WAKE_THROTTLE_MS = 30 * 1000;

async function getConfig(ctx: any) {
  return await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q: any) => q.eq("key", SINGLETON))
    .unique();
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string } | { error: string }> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });
    const body: any = await res.json().catch(() => null);
    if (body?.access_token) return { accessToken: String(body.access_token) };
    // Revoked or expired grant: the stored refresh token is dead until the
    // admin reconnects. Recorded distinctly so Payment Settings says so.
    if (body?.error === "invalid_grant")
      return { error: "invalid_grant: reconnect Gmail" };
    return { error: "token refresh failed" };
  } catch {
    return { error: "token refresh failed" };
  }
}

function b64ToText(b64: string): string {
  try {
    const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function header(msg: any, name: string): string {
  const hs = msg?.payload?.headers ?? [];
  const h = hs.find((x: any) => String(x?.name || "").toLowerCase() === name);
  return String(h?.value || "");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .replace(/\[([^\]]{1,200}?)\]\s*\(\s*https?:[^)]+\)/g, "$1")
    .trim();
}

function extractBody(msg: any): string {
  const payload = msg?.payload;
  if (!payload) return String(msg?.snippet || "");
  const texts: string[] = [];
  const htmls: string[] = [];
  const walk = (part: any): void => {
    const mime = String(part?.mimeType || "");
    if (part?.body?.data) {
      if (mime.includes("text/plain")) texts.push(b64ToText(part.body.data));
      else if (mime.includes("text/html")) htmls.push(b64ToText(part.body.data));
    }
    for (const p of part?.parts ?? []) walk(p);
  };
  walk(payload);
  if (texts.length) {
    const plain = texts.join("\n").trim();
    // Truncated view-source variant: the snippet carries the tail the
    // stripped part lost (amount line sits past the cut).
    if (/Transaction Details:\s*[ab]\.?\s*$/i.test(plain) && msg?.snippet) {
      return `${plain}\n${String(msg.snippet)}`;
    }
    return plain;
  }
  if (payload?.body?.data) return b64ToText(payload.body.data);
  if (htmls.length) return htmlToText(htmls.join("\n"));
  return String(msg?.snippet || "");
}

async function gmail(
  accessToken: string,
  path: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1${path}`);
  for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gmail ${path}: ${res.status} ${detail.slice(0, 200)}`);
  }
  return res.json();
}

/** Build the Gmail search query: sender allowlist + recent window. */
export function buildPollQuery(senders: string[], extra?: string | null): string {
  const from =
    senders.length > 0 ? `{${senders.map((s) => `from:${s}`).join(" ")}} ` : "";
  return `${from}newer_than:2d${extra ? ` ${extra}` : ""}`.trim();
}

export const pollInbox = internalAction({
  args: {
    orgId: v.optional(v.id("organizations")),
    orderId: v.optional(v.id("orders")),
    maxMessages: v.optional(v.number()),
    // Poll epoch for scheduled chains: the creation chain schedules with the
    // order's generation, wake/refresh bumps it and reschedules. A stale
    // scheduled job exits before any Gmail call. Manual/reconcile never carry
    // one and always run (subject to their own guards).
    generation: v.optional(v.number()),
    reason: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("wake"),
        v.literal("refresh"),
        v.literal("manual"),
        v.literal("reconcile"),
      ),
    ),
  },
  handler: async (ctx, { orgId, orderId, maxMessages, generation, reason }): Promise<any> => {
    const mode = reason ?? "scheduled";
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      return { skipped: "gmail oauth not configured" };

    const cfg: any = await ctx.runQuery(internal.gmail.getPollConfigInternal, {});
    // One-click Connect stores the token in the DB; env var stays as fallback.
    // Connected inbox == event-driven checks can run. No enable toggle.
    const refreshToken = cfg?.refreshToken ?? process.env.GMAIL_REFRESH_TOKEN;
    if (!refreshToken) return { skipped: "gmail not connected" };
    const targetOrgId = orgId ?? cfg?.orgId;
    if (!targetOrgId) return { skipped: "no org bound" };

    // Order-scoped guard: terminal orders stop their chain before any Gmail
    // call. Reconcile checks intentionally run post-expiry (late-payment
    // catch); manual admin checks always run.
    if (orderId) {
      const st: any = await ctx.runQuery(internal.gmail.getOrderState, {
        orderId,
      });
      if (!st) return { skipped: "order_not_found" };
      if (
        isTerminalOrderStatus(st.status) &&
        mode !== "manual" &&
        mode !== "reconcile"
      ) {
        return { skipped: "order_terminal", status: st.status };
      }
      // Epoch invalidation: wake/refresh restarts the early backoff with a
      // fresh generation, so jobs from the superseded chain exit here — before
      // the pending-work check and well before any Gmail API call. Manual and
      // reconcile checks carry no generation and are unaffected.
      if (
        generation !== undefined &&
        mode !== "manual" &&
        mode !== "reconcile" &&
        (st.generation ?? 0) !== generation
      ) {
        return { skipped: "stale_generation", status: st.status };
      }
    }

    // No Gmail calls without pending work. Reconcile also covers
    // recently-expired orders inside the late-payment window.
    if (mode === "reconcile") {
      const anyWork: boolean = await ctx.runQuery(
        internal.gmail.hasReconcilableOrders,
        { orgId: targetOrgId },
      );
      if (!anyWork) return { skipped: "no_pending_orders" };
    } else if (mode !== "manual") {
      const anyPending: boolean = await ctx.runQuery(
        internal.gmail.hasPendingOrders,
        { orgId: targetOrgId },
      );
      if (!anyPending) return { skipped: "no_pending_orders" };
    }

    const token = await refreshAccessToken(clientId, clientSecret, refreshToken);
    if (!("accessToken" in token)) {
      await ctx.runMutation(internal.gmail.notePollResult, {
        error: token.error,
      });
      return { error: token.error };
    }
    const accessToken = token.accessToken;

    const q = cfg?.query?.trim()
      ? cfg.query.trim()
      : buildPollQuery(cfg?.senders ?? []);
    let processed = 0;
    let matched = 0;
    let duplicates = 0;
    let parseFailures = 0;

    try {
      const list = await gmail(accessToken, "/users/me/messages", {
        q,
        maxResults: String(Math.min(maxMessages ?? 20, 50)),
      });
      const messages: Array<{ id: string }> = list?.messages ?? [];

      for (const m of messages) {
        try {
          const full = await gmail(accessToken, `/users/me/messages/${m.id}`, {
            format: "full",
          });
          const r: any = await ctx.runMutation(internal.payments.ingestBankEmail, {
            orgId: targetOrgId,
            to: header(full, "delivered-to") || header(full, "to") || undefined,
            from: header(full, "from"),
            subject: header(full, "subject") || undefined,
            textBody: extractBody(full) || undefined,
            messageId: String(full.id),
          });
          processed++;
          if (r?.matched) matched++;
          else if (r?.duplicate) duplicates++;
          else if (r?.parsed === false) parseFailures++;
        } catch (e: any) {
          // Per-message failures must not stop the batch.
          console.error("[gmail] message failed:", m?.id, e?.message);
          await ctx.runMutation(internal.crashLogs.record, {
            orgId: targetOrgId, reporter: 'convex:gmail',
            report: { source: 'convex', message: String(e?.message || e), stack: e?.stack, operation: 'gmail.pollInbox.message' },
          }).catch(() => {});
        }
      }
    } catch (e: any) {
      await ctx.runMutation(internal.crashLogs.record, {
        orgId: targetOrgId, reporter: 'convex:gmail',
        report: { source: 'convex', message: String(e?.message || e), stack: e?.stack, operation: 'gmail.pollInbox' },
      }).catch(() => {});
      await ctx.runMutation(internal.gmail.notePollResult, {
        error: String(e?.message || e).slice(0, 300),
      });
      return { error: String(e?.message || e).slice(0, 300) };
    }

    await ctx.runMutation(internal.gmail.notePollResult, {});
    return { ok: true, reason: mode, fetched: processed, processed, matched, duplicates, parseFailures };
  },
});

// Manual trigger from Payment Settings ("Check inbox now"). Same path as the
// order-triggered checks, but always runs (no pending-work skip).
// Target org for every Gmail admin action: the org the inbox is bound to, or
// (when none is bound yet) the orgId the caller passes.
export const triggerPoll = action({
  args: {
    maxMessages: v.optional(v.number()),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args): Promise<any> => {
    const cfg: any = await ctx.runQuery(internal.gmail.getPollConfigInternal, {});
    const targetOrgId = cfg?.orgId ?? args.orgId;
    if (!targetOrgId) throw new ConvexError({ code: "ORG_REQUIRED" });
    await ctx.runQuery(internal.gmail.assertPaymentsAdmin, { orgId: targetOrgId });
    return await ctx.runAction(internal.gmail.pollInbox, {
      orgId: targetOrgId,
      maxMessages: args.maxMessages ?? 20,
      reason: "manual",
    });
  },
});

//
// Admin clicks "Connect with Google" → this returns the Google consent URL
// (offline access, so Google issues a refresh token). Google redirects back
// to /gmailOAuthCallback, which exchanges the code and stores the refresh
// token in appConfig. No env-var dance, no re-pasting.

const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

// Owner/admin of the given org only. Returns the caller's userId.
export const assertPaymentsAdmin = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    return userId;
  },
});

export const getOAuthUrl = action({
  args: {
    redirectUri: v.string(),
    returnTo: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { redirectUri, returnTo, orgId }): Promise<{ url: string }> => {
    const cfg: any = await ctx.runQuery(internal.gmail.getPollConfigInternal, {});
    const targetOrgId = cfg?.orgId ?? orgId;
    if (!targetOrgId) throw new ConvexError({ code: "ORG_REQUIRED" });
    const adminUserId: string = await ctx.runQuery(
      internal.gmail.assertPaymentsAdmin,
      { orgId: targetOrgId },
    );
    const clientId = process.env.GMAIL_CLIENT_ID;
    if (!clientId) throw new ConvexError({ code: "GMAIL_NOT_CONFIGURED" });
    if (!/^https:\/\/[a-z0-9-]+\.convex\.site\/gmailOAuthCallback$/.test(redirectUri))
      throw new ConvexError({ code: "BAD_REDIRECT_URI" });

    const state = crypto.randomUUID();
    await ctx.runMutation(internal.gmail.saveOAuthState, {
      state,
      redirectUri,
      returnTo: safeReturnTo(returnTo),
      adminUserId,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_READONLY,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  },
});

export const saveOAuthState = internalMutation({
  args: {
    state: v.string(),
    redirectUri: v.string(),
    returnTo: v.optional(v.string()),
    adminUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cfg = await getConfig(ctx);
    const patch = {
      pendingOAuthState: args.state,
      pendingOAuthBy: args.adminUserId,
      pendingOAuthUri: args.redirectUri,
      pendingOAuthReturnTo: args.returnTo,
      pendingOAuthAt: now,
      updatedAt: now,
    };
    if (!cfg) {
      await ctx.db.insert("appConfig", { key: SINGLETON, ...patch });
    } else {
      await ctx.db.patch(cfg._id, patch);
    }
  },
});

export const getOAuthState = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const cfg = await getConfig(ctx);
    if (!cfg || cfg.pendingOAuthState !== state) return null;
    return {
      redirectUri: cfg.pendingOAuthUri ?? null,
      returnTo: (cfg as any).pendingOAuthReturnTo ?? null,
      adminUserId: cfg.pendingOAuthBy ?? null,
      createdAt: cfg.pendingOAuthAt ?? 0,
    };
  },
});

export const finishOAuthConnect = internalMutation({
  args: {
    state: v.string(),
    refreshToken: v.string(),
    accountEmail: v.optional(v.string()),
  },
  handler: async (ctx, { state, refreshToken, accountEmail }) => {
    const cfg = await getConfig(ctx);
    if (!cfg || cfg.pendingOAuthState !== state)
      throw new ConvexError({ code: "OAUTH_STATE_MISMATCH" });
    if (Date.now() - (cfg.pendingOAuthAt ?? 0) > OAUTH_STATE_TTL_MS)
      throw new ConvexError({ code: "OAUTH_STATE_EXPIRED" });
    await ctx.db.patch(cfg._id, {
      gmailRefreshToken: refreshToken,
      gmailAccountEmail: accountEmail,
      pendingOAuthState: undefined,
      pendingOAuthBy: undefined,
      pendingOAuthUri: undefined,
      pendingOAuthReturnTo: undefined,
      pendingOAuthAt: undefined,
      gmailLastError: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true as const, accountEmail: accountEmail ?? null };
  },
});

export const disconnectGmail = mutation({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, { orgId }) => {
    const cfg = await getConfig(ctx);
    const targetOrgId = cfg?.gmailOrgId ?? orgId;
    if (!targetOrgId) throw new ConvexError({ code: "ORG_REQUIRED" });
    const { userId } = await requirePaymentsAdmin(ctx, targetOrgId);
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        gmailRefreshToken: undefined,
        gmailAccountEmail: undefined,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    }
    return { ok: true as const };
  },
});

// Customer "Refresh status" / wake-on-return from the Transaction page.
// Throttled per order; schedules a poll rather than polling inline (mutations
// can't call actions, and scheduling keeps the mutation fast).
export const wake = mutation({
  args: {
    orderId: v.id("orders"),
    source: v.union(v.literal("wake"), v.literal("refresh")),
  },
  handler: async (ctx, { orderId, source }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });

    const identity = await requireIdentity(ctx);
    if (order.userId !== identity.subject)
      throw new ConvexError({ code: "FORBIDDEN" });

    if (order.status !== "pending") {
      return { skipped: "not_pending", status: order.status };
    }

    const now = Date.now();
    const last = order.lastWakeAt ?? 0;
    if (now - last < WAKE_THROTTLE_MS) {
      return {
        throttled: true,
        retryAfterMs: WAKE_THROTTLE_MS - (now - last),
      };
    }

    // Fresh order (creation chain still inside its first throttle window):
    // that chain already covers every offset until expiry, so re-arming here
    // would just double-schedule. Run one immediate check on the current
    // epoch and leave the chain alone — no coverage lost, no fan-out.
    if (now - order.createdAt < WAKE_THROTTLE_MS) {
      await ctx.db.patch(orderId, { lastWakeAt: now });
      await ctx.scheduler.runAfter(0, internal.gmail.pollInbox, {
        orgId: order.orgId,
        orderId,
        reason: source,
        generation: order.pollGeneration ?? 0,
      });
      return { poked: true };
    }

    // Bumping the epoch retires any in-flight creation chain: its jobs carry
    // the old generation and exit as stale before touching the Gmail API.
    const nextGen = (order.pollGeneration ?? 0) + 1;
    await ctx.db.patch(orderId, { lastWakeAt: now, pollGeneration: nextGen });

    // Immediate check plus a full backoff (re)start bounded to the order's
    // remaining timeout, so returning from the UPI app or hitting refresh
    // re-arms fast verification AND keeps steady coverage to expiry. The
    // bumped generation retires the creation chain (stale jobs exit pre-API);
    // each scheduled check still skips (with zero Gmail calls) if the order
    // turns terminal. No offset exceeds the remaining timeout.
    const check = { orgId: order.orgId, orderId, reason: source, generation: nextGen } as const;
    await ctx.scheduler.runAfter(0, internal.gmail.pollInbox, { ...check });
    const org: any = await ctx.db.get(order.orgId);
    const timeoutMs = org?.slotTimeoutMs ?? 10 * 60 * 1000;
    const remaining = timeoutMs - (now - order.createdAt);
    if (remaining > 0) {
      for (const ms of buildOrderPollOffsets(remaining)) {
        await ctx.scheduler.runAfter(ms, internal.gmail.pollInbox, { ...check });
      }
    }

    return { poked: true };
  },
});

export const hasPendingOrders = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const row = await ctx.db
      .query("orders")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "pending"),
      )
      .first();
    return !!row;
  },
});

export const getOrderState = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    return { status: order.status, orgId: order.orgId, generation: order.pollGeneration ?? 0 };
  },
});

// True when a reconcile check could still match something: a pending order,
// or an order expired inside the late-payment (quarantine) window.
export const hasReconcilableOrders = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const pending = await ctx.db
      .query("orders")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "pending"),
      )
      .first();
    if (pending) return true;
    const org: any = await ctx.db.get(orgId);
    const quarantineMs = org?.quarantineMs ?? 20 * 60 * 1000;
    const cutoff = Date.now() - quarantineMs;
    const expired = await ctx.db
      .query("orders")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "expired"),
      )
      .order("desc")
      .first();
    return !!expired && (expired.terminalAt ?? 0) >= cutoff;
  },
});

export const getPollConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cfg = await getConfig(ctx);
    return {
      query: cfg?.gmailQuery ?? null,
      orgId: cfg?.gmailOrgId ?? null,
      senders: mergeSenders(cfg?.bankSenders),
      // Server-side only — never exposed to the client.
      refreshToken: cfg?.gmailRefreshToken ?? null,
    };
  },
});

// Admin-visible poll state (surfaced in Payment Settings).
// Returns null (not an error) when the caller is not owner/admin of the org
// the inbox is bound to, or when no org can be resolved.
export const getGmailStatus = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, { orgId }) => {
    const cfg = await getConfig(ctx);
    const targetOrgId = cfg?.gmailOrgId ?? orgId;
    if (!targetOrgId) return null;
    try {
      await requireOrgAdmin(ctx, targetOrgId);
    } catch {
      return null;
    }
    const senders = mergeSenders(cfg?.bankSenders);
    const hasDbToken = !!cfg?.gmailRefreshToken;
    const hasEnvToken = !!process.env.GMAIL_REFRESH_TOKEN;
    return {
      query: cfg?.gmailQuery ?? null,
      effectiveQuery: cfg?.gmailQuery?.trim()
        ? cfg.gmailQuery.trim()
        : buildPollQuery(senders),
      senders,
      boundOrgId: cfg?.gmailOrgId ?? null,
      lastPollAt: cfg?.gmailLastPollAt ?? null,
      lastError: cfg?.gmailLastError ?? null,
      connected: hasDbToken || hasEnvToken,
      connectedVia: hasDbToken ? ("google" as const) : hasEnvToken ? ("env" as const) : null,
      accountEmail: cfg?.gmailAccountEmail ?? null,
      configured: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET),
    };
  },
});

// Owner/admin of THAT org (never "admin of any org").
async function requirePaymentsAdmin(ctx: any, orgId: Id<"organizations">) {
  return await requireOrgAdmin(ctx, orgId);
}

export const setGmailConfig = mutation({
  args: {
    query: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const cfg = await getConfig(ctx);
    // Admin of the org being set, and of the org already bound (if different).
    const targets = new Set<Id<"organizations">>();
    if (args.orgId !== undefined) targets.add(args.orgId);
    if (cfg?.gmailOrgId) targets.add(cfg.gmailOrgId);
    if (targets.size === 0) throw new ConvexError({ code: "ORG_REQUIRED" });
    let actorId = "";
    for (const t of targets) actorId = (await requirePaymentsAdmin(ctx, t)).userId;
    const now = Date.now();
    const patch: any = { updatedAt: now, updatedBy: actorId };
    if (args.query !== undefined) patch.gmailQuery = args.query.trim() || undefined;
    if (args.orgId !== undefined) patch.gmailOrgId = args.orgId;
    if (!cfg) {
      await ctx.db.insert("appConfig", { key: SINGLETON, ...patch });
    } else {
      await ctx.db.patch(cfg._id, patch);
    }
    return { ok: true };
  },
});

export const notePollResult = internalMutation({
  args: {
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cfg = await getConfig(ctx);
    if (!cfg) {
      await ctx.db.insert("appConfig", {
        key: SINGLETON,
        gmailLastPollAt: now,
        gmailLastError: args.error,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.patch(cfg._id, {
      gmailLastPollAt: now,
      gmailLastError: args.error,
      updatedAt: now,
    });
  },
});
