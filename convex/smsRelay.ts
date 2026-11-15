// SMS relay: MacroDroid on the store owner's Android phone (or an iPhone
// Shortcuts automation) POSTs each incoming SMS to /receiveBankSms/<token>.
// The token is the store's secret; only its SHA-256 is stored. The merchant
// never sees the URL: "Connect phone" rotates the token and returns a ready
// MacroDroid file (convex/lib/macrodroid.ts). Bank credits go through
// processBankMessage (payments.ts), the same matching path as bank emails.
// Decision rules live in the super-admin pipeline config (convex/pipeline.ts).

import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { redactCodes } from "./lib/bankMessage";
import { MACRO_FILENAME, buildMacroFile } from "./lib/macrodroid";
import { decideSms, parseSmsSender } from "./lib/smsSenders";
import { processBankMessage } from "./payments";
import { loadPipelineConfig, recordPaymentMessage } from "./pipeline";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60; // requests per token per minute
const DEDUPE_BUCKET_MS = 120_000; // identical sender+body inside one bucket = duplicate
/** Phone silent this long = "open MacroDroid" warning on the merchant card. */
export const SMS_STALE_MS = 24 * 60 * 60 * 1000;
/** A setup error newer than this (and newer than the last good SMS) is shown. */
const SETUP_ERROR_SHOW_MS = 24 * 60 * 60 * 1000;

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

// ---------- Merchant (store admins only) ----------

export type PhoneState = "not_connected" | "waiting" | "connected" | "quiet" | "setup_error";

/**
 * Connection status only. No URL, senders or message details: those live in
 * the super admin. `state`:
 * - not_connected: never set up, or disconnected
 * - waiting: set up, no bank credit SMS yet
 * - connected: bank credit SMS seen; lastConfirmedAt = last order it confirmed
 * - quiet: the phone has sent nothing for a day
 * - setup_error: the phone sent template text (bad import), newer than any good SMS
 */
export const getStatus = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const relay = await ctx.db
      .query("smsRelays")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const now = Date.now();
    let state: PhoneState = "not_connected";
    if (relay && relay.active) {
      const setupAt = relay.rotatedAt ?? relay.createdAt;
      const lastGood = relay.lastCreditSmsAt ?? 0;
      if (
        relay.lastSetupErrorAt &&
        relay.lastSetupErrorAt > lastGood &&
        relay.lastSetupErrorAt >= setupAt &&
        now - relay.lastSetupErrorAt < SETUP_ERROR_SHOW_MS
      ) {
        state = "setup_error";
      } else if (relay.lastSmsAt && relay.lastSmsAt >= setupAt && now - relay.lastSmsAt > SMS_STALE_MS) {
        state = "quiet";
      } else if (!relay.lastCreditSmsAt || relay.lastCreditSmsAt < setupAt) {
        state = !relay.lastSmsAt && now - setupAt > SMS_STALE_MS ? "quiet" : "waiting";
      } else {
        state = "connected";
      }
    }
    return {
      serverNow: now,
      state,
      connectedAt: relay?.active ? (relay.rotatedAt ?? relay.createdAt) : null,
      lastSmsAt: relay?.active ? (relay.lastSmsAt ?? null) : null,
      lastConfirmedAt: relay?.active ? (relay.lastConfirmedAt ?? null) : null,
    };
  },
});

async function rotate(ctx: MutationCtx, orgId: Id<"organizations">, userId: string) {
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
      lastSetupErrorAt: undefined,
      lastSetupError: undefined,
    });
  } else {
    await ctx.db.insert("smsRelays", { orgId, tokenHash, tokenLast4, active: true, createdAt: now });
  }
  await audit(ctx, {
    orgId,
    adminUserId: userId,
    action: existing ? "sms_relay.token_rotated" : "sms_relay.token_created",
    targetType: "smsRelay",
    targetId: String(orgId),
    payload: { tokenLast4 },
  });
  return `${siteUrl.replace(/\/$/, "")}${SMS_PATH_PREFIX}${token}`;
}

/**
 * Connects (or reconnects) a phone: rotates the store's relay token (an older
 * phone stops at once) and returns the MacroDroid file with the new URL inside.
 * `url` is returned only for the iPhone "copy link" step; the UI never shows it.
 */
export const connectPhone = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    const url = await rotate(ctx, orgId, String(userId));
    return { macro: buildMacroFile(url), filename: MACRO_FILENAME, url };
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

// ---------- Webhook ingest (called by the http route after hashing the token) ----------

function messageMeta(sender: string) {
  const p = parseSmsSender(sender);
  return { senderEntity: p.entity, suffix: p.suffix };
}

export const ingest = internalMutation({
  args: {
    tokenHash: v.string(),
    sender: v.string(),
    body: v.string(),
    receivedAt: v.number(),
    /** Set by the http route when the phone sent template text or an incomplete SMS. */
    setupError: v.optional(v.string()),
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
    const orgId = relay.orgId;

    if (args.setupError) {
      await ctx.db.patch(relay._id, { lastSetupErrorAt: now, lastSetupError: args.setupError });
      await recordPaymentMessage(ctx, {
        orgId,
        channel: "sms",
        at: now,
        sender: args.sender || "(empty)",
        ...(args.sender ? messageMeta(args.sender) : {}),
        body: args.body,
        outcome: "setup_error",
        reason: args.setupError,
      });
      return { status: 200 as const, result: { setupError: true } };
    }

    // Dedupe: same sender+body in the same (or previous) 2-minute bucket
    // (MacroDroid retries). Scoped by org.
    const hash = cyrb53(`${args.sender}|${args.body}`);
    const bucket = Math.floor(args.receivedAt / DEDUPE_BUCKET_MS);
    const keyFor = (b: number) => `sms:${orgId}:${b}:${hash}`;
    for (const key of [keyFor(bucket - 1), keyFor(bucket)]) {
      const seen = await ctx.db
        .query("bankEmails")
        .withIndex("by_message_id", (q) => q.eq("gmailMessageId", key))
        .unique();
      if (seen) return { status: 200 as const, result: { duplicate: true, emailId: seen._id } };
    }

    const config = await loadPipelineConfig(ctx, orgId);
    const decision = decideSms(args.sender, args.body, config);

    if (!decision.accept) {
      // TEMPORARY (owner studies real data): every SMS body is kept in the
      // super-admin log, OTP codes masked. Nothing reaches matching.
      await recordPaymentMessage(ctx, {
        orgId,
        channel: "sms",
        at: now,
        sender: args.sender,
        ...messageMeta(args.sender),
        body: decision.code === "otp" ? redactCodes(args.body) : args.body,
        outcome: "ignored",
        reason: decision.reason,
      });
      return { status: 200 as const, result: { ignored: true, reason: decision.code } };
    }

    const result = await processBankMessage(ctx, {
      orgId,
      messageId: keyFor(bucket),
      channel: "sms",
      from: args.sender,
      body: args.body,
      senderAllowed: true,
      ignoredNote: "sender not accepted",
      config,
    });

    const row: Doc<"bankEmails"> | null = await ctx.db
      .query("bankEmails")
      .withIndex("by_message_id", (q) => q.eq("gmailMessageId", keyFor(bucket)))
      .first();
    const patch: Partial<Doc<"smsRelays">> = {};
    if (row && row.amountPaise > 0) patch.lastCreditSmsAt = now;
    if (row && row.status === "matched") patch.lastConfirmedAt = now;
    if (Object.keys(patch).length > 0) await ctx.db.patch(relay._id, patch);

    return { status: 200 as const, result };
  },
});
