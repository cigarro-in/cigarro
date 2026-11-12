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
import {
  assertTokenOrg,
  requireIdentity,
  requireOrgAdmin,
  safeReturnTo,
} from "./lib/auth";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import { mergeSenders } from "./appConfig";
import {
  buildOrderPollOffsets,
  isTerminalOrderStatus,
} from "./lib/pollSchedule";

// ---------- Gmail OAuth inbox checks — the event-driven payment-verification feed ----------
// One Gmail connection PER STORE (gmailConnections, one row per org). Each
// org's admin connects its own bank-alert inbox via OAuth; the refresh token
// is AES-GCM encrypted at rest (convex/lib/crypto.ts, key GMAIL_TOKEN_KEY).
// There is no permanent cron: every check is order-triggered (creation
// backoff, customer wake/refresh, post-expiry reconciliation) or a manual
// admin "Check inbox now". An org with no active connection skips Gmail; the
// forwarding path (POST /receiveBankEmail + bankInboxes) still works.
// Platform-wide secrets stay in Convex env:
//   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_TOKEN_KEY
//
// Design: stateless. Each check runs messages.list with a `from:` search query
// (paginated, capped) and ingests every hit; ingestBankEmail dedupes by
// gmailMessageId, so re-checking the same window is safe. No historyId cursor.
// Every non-manual check verifies pending work exists BEFORE touching the
// Gmail API, so idle orgs and terminal orders cost zero Gmail calls.

const SINGLETON = "singleton";
const WAKE_THROTTLE_MS = 30 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_LIST_PAGES = 5;
const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";

async function getConfig(ctx: any) {
  return await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q: any) => q.eq("key", SINGLETON))
    .unique();
}

async function getConnection(ctx: any, orgId: any) {
  return await ctx.db
    .query("gmailConnections")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .unique();
}

/** Redirect URI Google sends the code to. Same value on connect and exchange. */
export function gmailRedirectUri(): string {
  const site = process.env.CONVEX_SITE_URL;
  if (!site) throw new ConvexError({ code: "GMAIL_NOT_CONFIGURED" });
  return `${site.replace(/\/$/, "")}/gmailOAuthCallback`;
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string } | { error: string; invalidGrant?: boolean }> {
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
    // admin reconnects.
    if (body?.error === "invalid_grant")
      return { error: "invalid_grant: reconnect Gmail", invalidGrant: true };
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

async function recordCrash(
  ctx: any,
  orgId: any,
  operation: string,
  message: string,
  stack?: string,
) {
  await ctx
    .runMutation(internal.crashLogs.record, {
      orgId,
      reporter: "convex:gmail",
      report: {
        source: "convex",
        message: String(message).slice(0, 300),
        stack,
        operation,
      },
    })
    .catch(() => {});
}

/** Flip an org to needs_reconnect and log once per transition. */
async function markNeedsReconnect(ctx: any, orgId: any, error: string) {
  const r: any = await ctx.runMutation(internal.gmail.setNeedsReconnect, {
    orgId,
    error,
  });
  if (r?.transitioned) {
    await recordCrash(ctx, orgId, "gmail.needs_reconnect", error);
  }
  return r;
}

export const pollInbox = internalAction({
  args: {
    orgId: v.id("organizations"),
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

    // This org's connection only. No platform-wide inbox fallback.
    const conn: any = await ctx.runQuery(internal.gmail.getConnectionInternal, {
      orgId,
    });
    if (!conn || conn.status === "disconnected" || !conn.refreshTokenEnc)
      return { skipped: "gmail not connected" };
    // Stop polling this org until the admin reconnects.
    if (conn.status === "needs_reconnect")
      return { skipped: "gmail_needs_reconnect" };

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
        { orgId },
      );
      if (!anyWork) return { skipped: "no_pending_orders" };
    } else if (mode !== "manual") {
      const anyPending: boolean = await ctx.runQuery(
        internal.gmail.hasPendingOrders,
        { orgId },
      );
      if (!anyPending) return { skipped: "no_pending_orders" };
    }

    let refreshToken: string;
    try {
      refreshToken = await decryptSecret(conn.refreshTokenEnc);
    } catch (e: any) {
      const code = String(e?.data?.code ?? "GMAIL_TOKEN_CORRUPT");
      if (code === "GMAIL_TOKEN_CORRUPT") {
        // Wrong or rotated GMAIL_TOKEN_KEY: the stored token is unusable.
        await markNeedsReconnect(ctx, orgId, "stored token unreadable: reconnect Gmail");
        return { error: "stored token unreadable: reconnect Gmail", status: "needs_reconnect" };
      }
      // Missing/invalid key is an operator problem, not an auth failure.
      await ctx.runMutation(internal.gmail.notePollResult, { orgId, error: code });
      return { error: code };
    }

    const token = await refreshAccessToken(clientId, clientSecret, refreshToken);
    if (!("accessToken" in token)) {
      if (token.invalidGrant) {
        await markNeedsReconnect(ctx, orgId, token.error);
        return { error: token.error, status: "needs_reconnect" };
      }
      await ctx.runMutation(internal.gmail.notePollResult, {
        orgId,
        error: token.error,
      });
      return { error: token.error };
    }
    const accessToken = token.accessToken;

    const cfg: any = await ctx.runQuery(internal.gmail.getPollConfigInternal, {});
    const q = cfg?.query?.trim()
      ? cfg.query.trim()
      : buildPollQuery(cfg?.senders ?? []);
    const maxResults = String(Math.min(maxMessages ?? 20, 50));
    let processed = 0;
    let matched = 0;
    let duplicates = 0;
    let parseFailures = 0;
    let messageFailures = 0;

    const ids: string[] = [];
    try {
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_LIST_PAGES; page++) {
        const params: Record<string, string> = { q, maxResults };
        if (pageToken) params.pageToken = pageToken;
        const list: any = await gmail(accessToken, "/users/me/messages", params);
        for (const m of list?.messages ?? []) ids.push(String(m.id));
        pageToken = list?.nextPageToken ? String(list.nextPageToken) : undefined;
        if (!pageToken) break;
      }
    } catch (e: any) {
      await recordCrash(ctx, orgId, "gmail.pollInbox", String(e?.message || e), e?.stack);
      const error = String(e?.message || e).slice(0, 300);
      await ctx.runMutation(internal.gmail.notePollResult, { orgId, error });
      return { error };
    }

    for (const id of ids) {
      try {
        const full = await gmail(accessToken, `/users/me/messages/${id}`, {
          format: "full",
        });
        const r: any = await ctx.runMutation(internal.payments.ingestBankEmail, {
          orgId,
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
        messageFailures++;
        console.error("[gmail] message failed:", id, e?.message);
        await recordCrash(ctx, orgId, "gmail.pollInbox.message", String(e?.message || e), e?.stack);
      }
    }

    await ctx.runMutation(internal.gmail.notePollResult, {
      orgId,
      error: messageFailures
        ? `${messageFailures} message(s) failed to ingest`
        : undefined,
    });
    return {
      ok: true,
      reason: mode,
      fetched: processed,
      processed,
      matched,
      duplicates,
      parseFailures,
      failed: messageFailures,
    };
  },
});

// Manual trigger from Payment Settings ("Check inbox now"). Same path as the
// order-triggered checks, but always runs (no pending-work skip).
export const triggerPoll = action({
  args: {
    maxMessages: v.optional(v.number()),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<any> => {
    await ctx.runQuery(internal.gmail.assertPaymentsAdmin, { orgId: args.orgId });
    return await ctx.runAction(internal.gmail.pollInbox, {
      orgId: args.orgId,
      maxMessages: args.maxMessages ?? 20,
      reason: "manual",
    });
  },
});

// ---------- Connect / disconnect ----------
//
// Admin clicks "Connect with Google" → getOAuthUrl writes a single-use state
// row for THIS org and returns the Google consent URL (offline access, so
// Google issues a refresh token). Google redirects to /gmailOAuthCallback
// (http.ts), which consumes the state, exchanges the code, encrypts the token
// and upserts this org's gmailConnections row.

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
    orgId: v.id("organizations"),
    returnTo: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, returnTo }): Promise<{ url: string }> => {
    const adminUserId: string = await ctx.runQuery(
      internal.gmail.assertPaymentsAdmin,
      { orgId },
    );
    const clientId = process.env.GMAIL_CLIENT_ID;
    if (!clientId) throw new ConvexError({ code: "GMAIL_NOT_CONFIGURED" });

    const state = crypto.randomUUID();
    await ctx.runMutation(internal.gmail.saveOAuthState, {
      state,
      orgId,
      userId: adminUserId,
      returnTo: safeReturnTo(returnTo),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: gmailRedirectUri(),
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
    orgId: v.id("organizations"),
    userId: v.string(),
    returnTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gmailOAuthStates", {
      state: args.state,
      orgId: args.orgId,
      userId: args.userId,
      returnTo: args.returnTo,
      createdAt: Date.now(),
    });
  },
});

// Single-use: deletes the row whether or not it is still fresh. Returns null
// for unknown, already-used or expired states.
export const takeOAuthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (Date.now() - row.createdAt > OAUTH_STATE_TTL_MS) return null;
    return {
      orgId: row.orgId,
      userId: row.userId,
      returnTo: row.returnTo ?? null,
    };
  },
});

export const saveGmailConnection = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
    accountEmail: v.string(),
    refreshTokenEnc: v.string(),
  },
  handler: async (ctx, { orgId, userId, accountEmail, refreshTokenEnc }) => {
    const now = Date.now();
    const existing = await getConnection(ctx, orgId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        accountEmail,
        refreshTokenEnc,
        status: "active",
        connectedBy: userId,
        lastError: undefined,
        lastErrorAt: undefined,
        lastSuccessAt: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("gmailConnections", {
        orgId,
        accountEmail,
        refreshTokenEnc,
        status: "active",
        connectedBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const disconnectGmail = action({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<{ ok: true; revoked: boolean }> => {
    await ctx.runQuery(internal.gmail.assertPaymentsAdmin, { orgId });
    const conn: any = await ctx.runQuery(internal.gmail.getConnectionInternal, {
      orgId,
    });
    let revoked = false;
    if (conn?.refreshTokenEnc) {
      try {
        const token = await decryptSecret(conn.refreshTokenEnc);
        const res = await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          },
        );
        revoked = res.ok;
      } catch {
        // Google unreachable or key unreadable: still disconnect locally.
        // The UI points the admin at Google's permissions page.
      }
    }
    await ctx.runMutation(internal.gmail.markDisconnected, { orgId });
    return { ok: true as const, revoked };
  },
});

export const markDisconnected = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const conn = await getConnection(ctx, orgId);
    if (!conn) return;
    await ctx.db.patch(conn._id, {
      status: "disconnected",
      refreshTokenEnc: undefined,
      updatedAt: Date.now(),
    });
  },
});

// ---------- Internal reads / state writes ----------

export const getConnectionInternal = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => getConnection(ctx, orgId),
});

export const setNeedsReconnect = internalMutation({
  args: { orgId: v.id("organizations"), error: v.string() },
  handler: async (ctx, { orgId, error }) => {
    const conn = await getConnection(ctx, orgId);
    if (!conn) return { transitioned: false };
    const now = Date.now();
    const transitioned = conn.status !== "needs_reconnect";
    await ctx.db.patch(conn._id, {
      status: "needs_reconnect",
      lastError: error,
      lastErrorAt: now,
      lastPollAt: now,
      updatedAt: now,
    });
    return { transitioned };
  },
});

// Records a poll outcome. A failure sets lastError/lastErrorAt. A clean poll
// sets lastSuccessAt and clears the stale lastError, but never touches a
// needs_reconnect status (only the reconnect flow clears that).
export const notePollResult = internalMutation({
  args: {
    orgId: v.id("organizations"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, error }) => {
    const conn = await getConnection(ctx, orgId);
    if (!conn) return;
    const now = Date.now();
    const patch: Record<string, unknown> = { lastPollAt: now, updatedAt: now };
    if (error) {
      patch.lastError = error;
      patch.lastErrorAt = now;
    } else {
      patch.lastSuccessAt = now;
      if (conn.status !== "needs_reconnect") patch.lastError = undefined;
    }
    await ctx.db.patch(conn._id, patch);
  },
});

// One-time migration from the legacy single-slot appConfig token. Encrypts the
// token (appConfig.gmailRefreshToken, or env GMAIL_REFRESH_TOKEN if that is
// unset) into gmailConnections for appConfig.gmailOrgId, then clears the
// plaintext appConfig field. Idempotent: an existing org row is not overwritten.
export const migrateLegacyGmail = internalAction({
  args: {},
  handler: async (ctx): Promise<any> => {
    const legacy: any = await ctx.runQuery(internal.gmail.getLegacyGmail, {});
    const refreshToken =
      legacy?.refreshToken ?? process.env.GMAIL_REFRESH_TOKEN ?? null;
    if (!refreshToken) return { migrated: false, reason: "no legacy token" };
    if (!legacy?.orgId)
      return { migrated: false, reason: "appConfig.gmailOrgId not set" };
    const refreshTokenEnc = await encryptSecret(refreshToken);
    return await ctx.runMutation(internal.gmail.finishLegacyMigration, {
      orgId: legacy.orgId,
      refreshTokenEnc,
      accountEmail: legacy.accountEmail ?? "",
    });
  },
});

export const getLegacyGmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cfg = await getConfig(ctx);
    return {
      refreshToken: cfg?.gmailRefreshToken ?? null,
      orgId: cfg?.gmailOrgId ?? null,
      accountEmail: cfg?.gmailAccountEmail ?? null,
    };
  },
});

export const finishLegacyMigration = internalMutation({
  args: {
    orgId: v.id("organizations"),
    refreshTokenEnc: v.string(),
    accountEmail: v.string(),
  },
  handler: async (ctx, { orgId, refreshTokenEnc, accountEmail }) => {
    const now = Date.now();
    const existing = await getConnection(ctx, orgId);
    if (!existing) {
      await ctx.db.insert("gmailConnections", {
        orgId,
        accountEmail,
        refreshTokenEnc,
        status: "active",
        connectedBy: "legacy-migration",
        createdAt: now,
        updatedAt: now,
      });
    }
    const cfg = await getConfig(ctx);
    if (cfg?.gmailRefreshToken) {
      await ctx.db.patch(cfg._id, { gmailRefreshToken: undefined, updatedAt: now });
    }
    return { migrated: !existing };
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

// Platform-wide poll settings only (search query override, sender allowlist).
// Per-store credentials are read from gmailConnections, never here.
export const getPollConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cfg = await getConfig(ctx);
    return {
      query: cfg?.gmailQuery ?? null,
      senders: mergeSenders(cfg?.bankSenders),
    };
  },
});

// Admin-visible connection state for one org (Payment Settings). Null for
// non-admins and for orgs with no connection row.
export const getGmailStatus = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    try {
      await requireOrgAdmin(ctx, orgId);
    } catch {
      return null;
    }
    const conn = await getConnection(ctx, orgId);
    if (!conn) return null;
    return {
      status: conn.status,
      accountEmail: conn.accountEmail || null,
      lastPollAt: conn.lastPollAt ?? null,
      lastSuccessAt: conn.lastSuccessAt ?? null,
      lastError: conn.lastError ?? null,
      lastErrorAt: conn.lastErrorAt ?? null,
      configured: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET),
    };
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
    const orderOrg = await ctx.db.get(order.orgId);
    if (!orderOrg) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    assertTokenOrg(identity, orderOrg);
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
