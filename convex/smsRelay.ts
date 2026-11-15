// SMS relay: an Android app (SMS Forwarder / MacroDroid) or the iPhone Shortcuts
// automation POSTs each bank SMS to /receiveBankSms/<token>. The token is the
// store's secret; only its SHA-256 is stored. Accepted messages go through
// processBankMessage (payments.ts), the same matching path as bank emails.

import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  MAX_DETECTED_SMS_SENDERS,
  MAX_SMS_SENDERS,
  decideSms,
  normalizeSmsSenders,
  parseSmsSender,
} from "./lib/smsSenders";
import { processBankMessage } from "./payments";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60; // requests per token per minute
const DEDUPE_BUCKET_MS = 120_000; // identical sender+body inside one bucket = duplicate
const LOG_KEEP = 200; // smsRelayLog rows kept per store
export const SMS_STALE_MS = 24 * 60 * 60 * 1000;

// Plain-language reasons for the admin list (decideSms codes -> wording).
const DROP_REASON_LABEL: Record<string, string> = {
  otp: "OTP",
  promotional: "Promotional",
  government: "Government message",
  "sender not in SMS allowlist": "Sender not in your list",
  "not a credit SMS": "Not a credit",
};

export const SMS_PATH_PREFIX = "/receiveBankSms/";
/** 32 random bytes, base64url without padding = 43 chars. */
export const SMS_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Synchronous 53-bit string hash (cyrb53). Used only for the dedupe key, so it
// stays inside the mutation without async crypto.
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- Admin (store admins only) ----------

export const getStatus = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const relay = await ctx.db
      .query("smsRelays")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const org = await ctx.db.get(orgId);
    return {
      serverNow: Date.now(),
      relay: relay
        ? {
            active: relay.active,
            tokenLast4: relay.tokenLast4,
            createdAt: relay.createdAt,
            rotatedAt: relay.rotatedAt ?? null,
            revokedAt: relay.revokedAt ?? null,
            lastSmsAt: relay.lastSmsAt ?? null,
          }
        : null,
      allowedSmsSenders: org?.allowedSmsSenders ?? [],
      detectedSmsSenders: [...(org?.detectedSmsSenders ?? [])].sort(
        (a, b) => b.lastSeenAt - a.lastSeenAt,
      ),
    };
  },
});

/**
 * Creates the store's relay token, or rotates it (the old URL stops working at
 * once). Returns the full URL once; the server never returns it again.
 */
export const generateToken = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) throw new ConvexError({ code: "SMS_RELAY_NOT_CONFIGURED" });

    const token = newToken();
    const tokenHash = await sha256Hex(token);
    const tokenLast4 = token.slice(-4);
    const now = Date.now();
    const existing = await ctx.db
      .query("smsRelays")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tokenHash,
        tokenLast4,
        active: true,
        rotatedAt: now,
        revokedAt: undefined,
        rateWindowStart: undefined,
        rateCount: undefined,
      });
    } else {
      await ctx.db.insert("smsRelays", {
        orgId,
        tokenHash,
        tokenLast4,
        active: true,
        createdAt: now,
      });
    }

    await audit(ctx, {
      orgId,
      adminUserId: String(userId),
      action: existing ? "sms_relay.token_rotated" : "sms_relay.token_created",
      targetType: "smsRelay",
      targetId: String(orgId),
      payload: { tokenLast4 },
    });

    return {
      url: `${siteUrl.replace(/\/$/, "")}${SMS_PATH_PREFIX}${token}`,
      tokenLast4,
    };
  },
});

export const revokeToken = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    const relay = await ctx.db
      .query("smsRelays")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (!relay) throw new ConvexError({ code: "SMS_RELAY_NOT_FOUND" });
    await ctx.db.patch(relay._id, { active: false, revokedAt: Date.now() });
    await audit(ctx, {
      orgId,
      adminUserId: String(userId),
      action: "sms_relay.token_revoked",
      targetType: "smsRelay",
      targetId: String(orgId),
      payload: { tokenLast4: relay.tokenLast4 },
    });
    return { ok: true };
  },
});

export const setAllowedSmsSenders = mutation({
  args: { orgId: v.id("organizations"), senders: v.array(v.string()) },
  handler: async (ctx, { orgId, senders }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    if (senders.length > MAX_SMS_SENDERS) throw new ConvexError({ code: "TOO_MANY_SENDERS" });
    const normalized = normalizeSmsSenders(senders);
    if (normalized === null) throw new ConvexError({ code: "INVALID_SENDER" });
    await ctx.db.patch(orgId, { allowedSmsSenders: normalized });
    await audit(ctx, {
      orgId,
      adminUserId: String(userId),
      action: "sms_relay.senders_updated",
      targetType: "organization",
      targetId: String(orgId),
      payload: { count: normalized.length },
    });
    return { senders: normalized };
  },
});

// ---------- Recent messages (metadata log, live on the admin card) ----------

type LogEntry = {
  orgId: Id<"organizations">;
  at: number;
  sender: string;
  entity: string;
  suffix?: string;
  isPhone: boolean;
  outcome: "matched" | "credit_unmatched" | "ignored" | "duplicate";
  reason?: string;
  amountPaise?: number;
  orderId?: Id<"orders">;
  bankEmailId?: Id<"bankEmails">;
};

function senderFields(sender: string) {
  const p = parseSmsSender(sender);
  return { sender, entity: p.entity, suffix: p.suffix, isPhone: p.isPhone };
}

/** Writes one metadata row (never a body) and keeps only the latest LOG_KEEP rows. */
async function logSms(ctx: MutationCtx, entry: LogEntry) {
  await ctx.db.insert("smsRelayLog", entry);
  const overflow = await ctx.db
    .query("smsRelayLog")
    .withIndex("by_org_at", (q) => q.eq("orgId", entry.orgId))
    .order("desc")
    .take(LOG_KEEP + 1);
  for (const old of overflow.slice(LOG_KEEP)) await ctx.db.delete(old._id);
}

/** Maps the stored bank email row of an accepted SMS to a list outcome. */
function acceptedOutcome(
  row: Doc<"bankEmails"> | null,
): Pick<LogEntry, "outcome" | "reason" | "amountPaise" | "orderId" | "bankEmailId"> {
  if (!row) return { outcome: "ignored", reason: "Not recorded" };
  if (row.status === "duplicate") return { outcome: "duplicate" };
  if (row.status === "matched") {
    return {
      outcome: "matched",
      amountPaise: row.amountPaise,
      orderId: row.matchedOrderId,
      bankEmailId: row._id,
    };
  }
  if (row.status === "ignored") return { outcome: "ignored", reason: "No amount found" };
  const amount = row.amountPaise;
  return {
    outcome: "credit_unmatched",
    amountPaise: amount > 0 ? amount : undefined,
    reason:
      row.status === "quarantine_late"
        ? "Held for review"
        : amount > 0
          ? "No order with that exact amount"
          : "Amount not read",
    bankEmailId: row._id,
  };
}

/** Latest 20 SMS the relay received for this store, newest first. Admins only. */
export const recentMessages = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const rows = await ctx.db
      .query("smsRelayLog")
      .withIndex("by_org_at", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(20);
    const messages = await Promise.all(
      rows.map(async (r) => {
        const order = r.orderId ? await ctx.db.get(r.orderId) : null;
        // Body is shown only for accepted credits, read from the bank email row.
        const email =
          r.bankEmailId && (r.outcome === "matched" || r.outcome === "credit_unmatched")
            ? await ctx.db.get(r.bankEmailId)
            : null;
        return {
          _id: r._id,
          at: r.at,
          entity: r.entity,
          suffix: r.suffix ?? null,
          isPhone: r.isPhone,
          outcome: r.outcome,
          reason: r.reason ?? null,
          amountPaise: r.amountPaise ?? null,
          orderId: order?._id ?? null,
          orderNumber: order?.orderNumber ?? null,
          displayOrderId: order?.displayOrderId ?? null,
          body: email && email.orgId === orgId ? email.rawBody : null,
        };
      }),
    );
    return { serverNow: Date.now(), messages };
  },
});

// ---------- Webhook ingest (called by the http route after hashing the token) ----------

export const ingest = internalMutation({
  args: {
    tokenHash: v.string(),
    sender: v.string(),
    body: v.string(),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const relay = await ctx.db
      .query("smsRelays")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!relay || !relay.active) return { status: 401 as const };

    // Fixed-window rate limit per token. Also records lastSmsAt.
    const now = Date.now();
    let windowStart = relay.rateWindowStart ?? 0;
    let count = relay.rateCount ?? 0;
    if (now - windowStart >= RATE_WINDOW_MS) {
      windowStart = now;
      count = 0;
    }
    if (count >= RATE_MAX) return { status: 429 as const };
    await ctx.db.patch(relay._id, {
      rateWindowStart: windowStart,
      rateCount: count + 1,
      lastSmsAt: now,
    });

    // Dedupe: same sender+body in the same (or previous) 2-minute bucket.
    // Scoped by org so two stores receiving the same SMS do not collide.
    const orgId = relay.orgId;
    const who = senderFields(args.sender);
    const hash = cyrb53(`${args.sender}|${args.body}`);
    const bucket = Math.floor(args.receivedAt / DEDUPE_BUCKET_MS);
    const keyFor = (b: number) => `sms:${orgId}:${b}:${hash}`;
    for (const key of [keyFor(bucket - 1), keyFor(bucket)]) {
      const seen = await ctx.db
        .query("bankEmails")
        .withIndex("by_message_id", (q) => q.eq("gmailMessageId", key))
        .unique();
      if (seen) {
        await logSms(ctx, { orgId, at: now, ...who, outcome: "duplicate" });
        return { status: 200 as const, result: { duplicate: true, emailId: seen._id } };
      }
    }

    const org = await ctx.db.get(orgId);
    const decision = decideSms(args.sender, args.body, org?.allowedSmsSenders);

    if (!decision.accept) {
      // Privacy: no body is stored for anything dropped. Metadata-only rows keep
      // sender, suffix and reason so the admin can see what was skipped.
      await logSms(ctx, {
        orgId,
        at: now,
        ...who,
        outcome: "ignored",
        reason: DROP_REASON_LABEL[decision.reason] ?? decision.reason,
      });
      if (!decision.store) return { status: 200 as const, result: { ignored: true, reason: decision.reason } };
      const suffixNote = decision.suffix ? ` (suffix ${decision.suffix})` : "";
      const emailId = await ctx.db.insert("bankEmails", {
        orgId,
        gmailMessageId: keyFor(bucket),
        receivedAt: now,
        amountPaise: 0,
        senderEmail: args.sender,
        rawBody: "",
        status: "ignored",
        adminNote: `${decision.reason}${suffixNote}`,
        channel: "sms",
      });
      return { status: 200 as const, result: { ignored: true, reason: decision.reason, emailId } };
    }

    const result = await processBankMessage(ctx, {
      orgId,
      messageId: keyFor(bucket),
      channel: "sms",
      from: args.sender,
      body: args.body,
      senderAllowed: true,
      ignoredNote: "sender not in SMS allowlist",
    });

    const row = await ctx.db
      .query("bankEmails")
      .withIndex("by_message_id", (q) => q.eq("gmailMessageId", keyFor(bucket)))
      .first();

    // Learning: a parsed credit from a bank entity is recorded for the admin card.
    if (!decision.isPhone) {
      const parsedOk =
        row !== null &&
        row.amountPaise > 0 &&
        row.status !== "parse_failed" &&
        row.status !== "ignored" &&
        row.status !== "duplicate";
      if (parsedOk) await recordDetectedSender(ctx, orgId, decision.entity);
    }

    await logSms(ctx, { orgId, at: now, ...who, ...acceptedOutcome(row) });
    return { status: 200 as const, result };
  },
});

async function recordDetectedSender(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  entity: string,
) {
  const org = await ctx.db.get(orgId);
  if (!org) return;
  const now = Date.now();
  const list = [...(org.detectedSmsSenders ?? [])];
  const idx = list.findIndex((d) => d.entity === entity);
  if (idx >= 0) {
    list[idx] = { entity, count: list[idx].count + 1, lastSeenAt: now };
  } else {
    list.push({ entity, count: 1, lastSeenAt: now });
  }
  list.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  await ctx.db.patch(orgId, { detectedSmsSenders: list.slice(0, MAX_DETECTED_SMS_SENDERS) });
}
