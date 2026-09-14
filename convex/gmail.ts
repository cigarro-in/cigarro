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

// ---------- Gmail OAuth inbox poller (replaces GAS per-org polling) ----------
// One Google account (the founder's inbox receiving bank alerts) polled on a
// cron. Secrets stay in Convex env, never in the DB:
//   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
// Founder one-time dance: Google Cloud OAuth client + gmail.readonly scope,
// paste the refresh token into BOTH Convex deployments' env.
// GAS + Email Worker paths stay as fallbacks (ingest is idempotent).

const SINGLETON = "singleton";

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
  if (!res.ok) throw new Error(`gmail ${path}: ${res.status}`);
  return res.json();
}

export const pollInbox = internalAction({
  args: { seedOnly: v.optional(v.boolean()), maxMessages: v.optional(v.number()) },
  handler: async (ctx, { seedOnly, maxMessages }): Promise<any> => {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken)
      return { skipped: "gmail oauth not configured" };

    const cfg: any = await ctx.runQuery(internal.gmail.getPollConfigInternal, {});
    if (!cfg?.enabled) return { skipped: "poll disabled" };
    if (!cfg?.orgId) return { skipped: "no org bound" };

    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    if (!accessToken) {
      await ctx.runMutation(internal.gmail.notePollResult, {
        error: "token refresh failed",
      });
      return { error: "token refresh failed" };
    }

    const labelIds = "INBOX";
    const q = cfg.query || undefined;
    let processed = 0;

    // First run: seed historyId without processing (never flood old mail).
    if (!cfg.historyId) {
      const list = await gmail(accessToken, "/users/me/messages", {
        ...(q ? { q } : {}),
        maxResults: "1",
      });
      void list;
      const profile = await gmail(accessToken, "/users/me/profile", {});
      await ctx.runMutation((internal as any).gmail.notePollResult, {
        historyId: String(profile.historyId),
      });
      return { seeded: true };
    }

    const history = await gmail(accessToken, "/users/me/history", {
      startHistoryId: cfg.historyId,
      historyTypes: "messageAdded",
      labelId: labelIds,
      maxResults: String(Math.min(maxMessages ?? 25, 50)),
      ...(q ? { q } : {}),
    }).catch(async (e: any) => {
      // Expired historyId (too old) → reseed.
      if (String(e?.message || "").includes("404")) {
        const profile = await gmail(accessToken, "/users/me/profile", {});
        await ctx.runMutation(internal.gmail.notePollResult, {
          historyId: String(profile.historyId),
        });
        return { reseeded: true };
      }
      throw e;
    });
    if ((history as any)?.reseeded) return history;

    const added: any[] = [];
    for (const h of (history as any)?.history ?? [])
      for (const m of h?.messagesAdded ?? []) added.push(m.message);

    for (const m of added.slice(0, maxMessages ?? 25)) {
      try {
        const full = await gmail(accessToken, `/users/me/messages/${m.id}`, {
          format: "full",
        });
        await ctx.runMutation(internal.payments.ingestBankEmail, {
          orgId: cfg.orgId,
          to: header(full, "delivered-to") || header(full, "to") || undefined,
          from: header(full, "from"),
          subject: header(full, "subject") || undefined,
          textBody: extractBody(full) || undefined,
          messageId: String(full.id),
        });
        processed++;
      } catch (e: any) {
        // Per-message failures must not stop the batch or lose historyId.
        console.error("[gmail] message failed:", m?.id, e?.message);
      }
    }

    await ctx.runMutation(internal.gmail.notePollResult, {
      historyId: String((history as any)?.historyId ?? cfg.historyId),
    });
    return { processed };
  },
});

// Manual trigger from Payment Settings (Test button). Same path as cron.
export const triggerPoll = action({
  args: { maxMessages: v.optional(v.number()) },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(internal.gmail.pollInbox, {
      maxMessages: args.maxMessages ?? 5,
    });
  },
});

export const getPollConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cfg = await getConfig(ctx);
    return {
      enabled: cfg?.gmailPollEnabled ?? false,
      historyId: cfg?.gmailHistoryId ?? null,
      query: cfg?.gmailQuery ?? null,
      orgId: cfg?.gmailOrgId ?? null,
    };
  },
});

// Admin-visible poll state (surfaced in Payment Settings).
export const getGmailStatus = query({
  args: {},
  handler: async (ctx) => {
    const cfg = await getConfig(ctx);
    return {
      enabled: cfg?.gmailPollEnabled ?? false,
      query: cfg?.gmailQuery ?? null,
      lastPollAt: cfg?.gmailLastPollAt ?? null,
      lastError: cfg?.gmailLastError ?? null,
      hasHistory: !!cfg?.gmailHistoryId,
      configured: !!(
        process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN
      ),
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
    if (args.query !== undefined) patch.gmailQuery = args.query || undefined;
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
    historyId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cfg = await getConfig(ctx);
    if (!cfg) {
      await ctx.db.insert("appConfig", {
        key: SINGLETON,
        gmailHistoryId: args.historyId,
        gmailLastPollAt: now,
        gmailLastError: args.error,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.patch(cfg._id, {
      ...(args.historyId !== undefined ? { gmailHistoryId: args.historyId } : {}),
      gmailLastPollAt: now,
      gmailLastError: args.error,
      updatedAt: now,
    });
  },
});
