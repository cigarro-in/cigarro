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
import { requireIdentity } from "./lib/auth";
import { mergeSenders } from "./appConfig";

// ---------- Gmail OAuth inbox poller — the single payment-verification feed ----------
// One Google account (the founder's inbox receiving bank alerts) polled on a
// cron. Secrets stay in Convex env, never in the DB:
//   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
// Founder one-time dance: Google Cloud OAuth client + gmail.readonly scope,
// paste the refresh token into BOTH Convex deployments' env.
//
// Design: stateless. Each poll runs messages.list with a `from:` search query
// and ingests every hit; ingestBankEmail dedupes by gmailMessageId, so
// re-polling the same window is safe. No historyId cursor, nothing to seed or
// reseed (the old history.list approach needed constant plumbing: historyIds
// expire after ~7 days and history.list silently ignores the `q` filter).

const SINGLETON = "singleton";
const WAKE_THROTTLE_MS = 3 * 60 * 1000;

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
): Promise<string | null> {
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
    const body = await res.json().catch(() => null);
    return body?.access_token ?? null;
  } catch {
    return null;
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

function extractBody(msg: any): string {
  const payload = msg?.payload;
  if (!payload) return String(msg?.snippet || "");
  const walk = (part: any): string[] => {
    const out: string[] = [];
    if (part?.body?.data && String(part?.mimeType || "").includes("text/plain"))
      out.push(b64ToText(part.body.data));
    for (const p of part?.parts ?? []) out.push(...walk(p));
    return out;
  };
  const texts = walk(payload);
  if (texts.length) return texts.join("\n");
  if (payload?.body?.data) return b64ToText(payload.body.data);
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
    maxMessages: v.optional(v.number()),
    reason: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("wake"),
        v.literal("refresh"),
        v.literal("manual"),
      ),
    ),
  },
  handler: async (ctx, { orgId, maxMessages, reason }): Promise<any> => {
    const mode = reason ?? "scheduled";
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      return { skipped: "gmail oauth not configured" };

    const cfg: any = await ctx.runQuery(internal.gmail.getPollConfigInternal, {});
    // One-click Connect stores the token in the DB; env var stays as fallback.
    const refreshToken = cfg?.refreshToken ?? process.env.GMAIL_REFRESH_TOKEN;
    if (!refreshToken) return { skipped: "gmail not connected" };
    const targetOrgId = orgId ?? cfg?.orgId;
    if (mode !== "manual" && !cfg?.enabled) return { skipped: "poll disabled" };
    if (!targetOrgId) return { skipped: "no org bound" };

    // Idle-skip scheduled polls when nothing is awaiting payment.
    if (mode === "scheduled") {
      const anyPending: boolean = await ctx.runQuery(
        internal.gmail.hasPendingOrders,
        { orgId: targetOrgId },
      );
      if (!anyPending) return { skipped: "no_pending_orders" };
    }

    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    if (!accessToken) {
      await ctx.runMutation(internal.gmail.notePollResult, {
        error: "token refresh failed",
      });
      return { error: "token refresh failed" };
    }

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
        }
      }
    } catch (e: any) {
      await ctx.runMutation(internal.gmail.notePollResult, {
        error: String(e?.message || e).slice(0, 300),
      });
      return { error: String(e?.message || e).slice(0, 300) };
    }

    await ctx.runMutation(internal.gmail.notePollResult, {});
    return { ok: true, reason: mode, fetched: processed, processed, matched, duplicates, parseFailures };
  },
});

// Manual trigger from Payment Settings ("Check inbox now"). Same path as cron.
export const triggerPoll = action({
  args: { maxMessages: v.optional(v.number()) },
  handler: async (ctx, args): Promise<any> => {
    await ctx.runQuery(internal.gmail.assertPaymentsAdmin, {});
    return await ctx.runAction(internal.gmail.pollInbox, {
      maxMessages: args.maxMessages ?? 20,
      reason: "manual",
    });
  },
});

// Only allow relative admin paths or https URLs — never javascript:/data:.
function isSafeReturnTo(url: string | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/admin/")) return true;
  if (/^https:\/\/[A-Za-z0-9.-]+(\/.*)?$/.test(url)) return true;
  if (/^http:\/\/localhost(:\d+)?(\/.*)?$/.test(url)) return true;
  return false;
}
//
// Admin clicks "Connect with Google" → this returns the Google consent URL
// (offline access, so Google issues a refresh token). Google redirects back
// to /gmailOAuthCallback, which exchanges the code and stores the refresh
// token in appConfig. No env-var dance, no re-pasting.

const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export const assertPaymentsAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) =>
        q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin")),
      )
      .first();
    if (!membership) throw new ConvexError({ code: "NOT_PAYMENTS_ADMIN" });
    return identity.subject;
  },
});

export const getOAuthUrl = action({
  args: { redirectUri: v.string(), returnTo: v.optional(v.string()) },
  handler: async (ctx, { redirectUri, returnTo }): Promise<{ url: string }> => {
    const adminUserId: string = await ctx.runQuery(
      internal.gmail.assertPaymentsAdmin,
      {},
    );
    const clientId = process.env.GMAIL_CLIENT_ID;
    if (!clientId) throw new ConvexError({ code: "GMAIL_NOT_CONFIGURED" });
    if (!/^https:\/\/[a-z0-9-]+\.convex\.site\/gmailOAuthCallback$/.test(redirectUri))
      throw new ConvexError({ code: "BAD_REDIRECT_URI" });

    const state = crypto.randomUUID();
    await ctx.runMutation(internal.gmail.saveOAuthState, {
      state,
      redirectUri,
      returnTo: isSafeReturnTo(returnTo) ? returnTo : undefined,
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
  args: {},
  handler: async (ctx) => {
    const identity = await requirePaymentsAdmin(ctx);
    const cfg = await getConfig(ctx);
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        gmailRefreshToken: undefined,
        gmailAccountEmail: undefined,
        gmailPollEnabled: false,
        updatedAt: Date.now(),
        updatedBy: identity.subject,
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

    await ctx.db.patch(orderId, { lastWakeAt: now });

    await ctx.scheduler.runAfter(0, internal.gmail.pollInbox, {
      orgId: order.orgId,
      reason: source,
    });
    await ctx.scheduler.runAfter(15_000, internal.gmail.pollInbox, {
      orgId: order.orgId,
      reason: source,
    });

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

export const getPollConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cfg = await getConfig(ctx);
    return {
      enabled: cfg?.gmailPollEnabled ?? false,
      query: cfg?.gmailQuery ?? null,
      orgId: cfg?.gmailOrgId ?? null,
      senders: mergeSenders(cfg?.bankSenders),
      // Server-side only — never exposed to the client.
      refreshToken: cfg?.gmailRefreshToken ?? null,
    };
  },
});

// Admin-visible poll state (surfaced in Payment Settings).
export const getGmailStatus = query({
  args: {},
  handler: async (ctx) => {
    const cfg = await getConfig(ctx);
    const senders = mergeSenders(cfg?.bankSenders);
    const hasDbToken = !!cfg?.gmailRefreshToken;
    const hasEnvToken = !!process.env.GMAIL_REFRESH_TOKEN;
    return {
      enabled: cfg?.gmailPollEnabled ?? false,
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

async function requirePaymentsAdmin(ctx: any) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
    .filter((q: any) =>
      q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin")),
    )
    .first();
  if (!membership) throw new ConvexError({ code: "NOT_PAYMENTS_ADMIN" });
  return identity;
}

export const setGmailConfig = mutation({
  args: {
    enabled: v.optional(v.boolean()),
    query: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await requirePaymentsAdmin(ctx);
    const now = Date.now();
    const cfg = await getConfig(ctx);
    const patch: any = { updatedAt: now, updatedBy: identity.subject };
    if (args.enabled !== undefined) patch.gmailPollEnabled = args.enabled;
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
