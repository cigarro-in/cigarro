// SMS relay: MacroDroid on the store owner's Android phone (or an iPhone
// Shortcuts automation) POSTs each incoming SMS to /receiveBankSms/<token>.
// The token is the store's secret; only its SHA-256 is stored. The merchant
// never sees a token: "Connect phone" makes a one-time setup code (24 h) and
// returns a MacroDroid file that carries only the code (convex/lib/macrodroid.ts).
// The macro POSTs the code to /claimSmsRelay/<code>, which creates the token,
// returns it once, and burns the code. Until that claim, receiveBankSms rejects.
// Bank credits go through processBankMessage (payments.ts), the same matching
// path as bank emails. Decision rules live in convex/pipeline.ts.

import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePaymentsAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { redactCodes } from "./lib/bankMessage";
import { MACRO_FILENAME, buildMacroFile } from "./lib/macrodroid";
import { decideSms, parseSmsSender } from "./lib/smsSenders";
import { processBankMessage } from "./payments";
import { loadPipelineConfig, recordPaymentMessage } from "./pipeline";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60; // requests per token (or code) per minute
const DEDUPE_BUCKET_MS = 120_000; // identical sender+body inside one bucket = duplicate
/** Phone silent this long = "open MacroDroid" warning on the merchant card. */
export const SMS_STALE_MS = 24 * 60 * 60 * 1000;
/** A setup error newer than this (and newer than the last good SMS) is shown. */
const SETUP_ERROR_SHOW_MS = 24 * 60 * 60 * 1000;
/** A setup code works for this long after "Connect phone". */
export const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

export const SMS_PATH_PREFIX = "/receiveBankSms/";
export const CLAIM_PATH_PREFIX = "/claimSmsRelay/";
/** 32 random bytes, base64url without padding = 43 chars. Used for tokens and setup codes. */
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

export type PhoneState = "not_connected" | "waiting" | "connected" | "quiet" | "setup_error" | "setup_expired";

/** Unclaimed = a setup code is pending. Rows without one (every relay before claims) are claimed. */
function isUnclaimed(relay: Doc<"smsRelays">): boolean {
  return relay.claimCodeHash !== undefined;
}

/**
 * Connection status only. No URL, senders or message details: those live in
 * the super admin. `state`:
 * - not_connected: never set up, or disconnected
 * - waiting: set up, no bank credit SMS yet (also while the file is not yet run)
 * - connected: bank credit SMS seen; lastConfirmedAt = last order it confirmed
 * - quiet: the phone has sent nothing for a day
 * - setup_error: the phone sent template text (bad import), newer than any good SMS
 * - setup_expired: the setup code ran out (24 h) before the file was run
 */
// saToken: super admin, platform org only (lib/auth requirePaymentsAdmin).
export const getStatus = query({
  args: { orgId: v.id("organizations"), saToken: v.optional(v.string()) },
  handler: async (ctx, { orgId, saToken }) => {
    await requirePaymentsAdmin(ctx, orgId, saToken, "read");
    const relay = await ctx.db
      .query("smsRelays")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const now = Date.now();
    let state: PhoneState = "not_connected";
    if (relay && relay.active) {
      const setupAt = relay.rotatedAt ?? relay.createdAt;
      const lastGood = relay.lastCreditSmsAt ?? 0;
      if (isUnclaimed(relay) && now > (relay.claimExpiresAt ?? 0)) {
        state = "setup_expired";
      } else if (
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

/**
 * Starts a fresh setup: kills the current token and any pending code at once
 * (tokenHash cleared, so the old phone's requests get 401), and makes a new
 * one-time code. The token itself is made at claim time, because only its hash
 * is stored and the claim must hand the token back.
 */
/** Writes the store's relay row: new token state, plus claim fields (undefined clears them). */
async function writeRelay(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  now: number,
  state: {
    tokenHash: string;
    tokenLast4: string;
    claimCodeHash: string | undefined;
    claimExpiresAt: number | undefined;
    claimedAt: number | undefined;
  },
): Promise<boolean> {
  const existing = await ctx.db
    .query("smsRelays")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...state,
      active: true,
      rotatedAt: now,
      revokedAt: undefined,
      rateWindowStart: undefined,
      rateCount: undefined,
      lastSetupErrorAt: undefined,
      lastSetupError: undefined,
    });
  } else {
    await ctx.db.insert("smsRelays", { orgId, ...state, active: true, createdAt: now });
  }
  return !!existing;
}

/**
 * Android: starts a fresh setup. Kills the current token and any pending code
 * (tokenHash cleared, so old requests get 401) and makes a one-time setup code.
 * The token is made at claim time, because the claim must hand it back and only
 * its hash is stored.
 */
async function rotateAndroid(ctx: MutationCtx, orgId: Id<"organizations">, userId: string): Promise<{ siteUrl: string; code: string }> {
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) throw new ConvexError({ code: "SMS_RELAY_NOT_CONFIGURED" });
  const code = newToken();
  const now = Date.now();
  const claimExpiresAt = now + CLAIM_TTL_MS;
  const existed = await writeRelay(ctx, orgId, now, {
    tokenHash: "",
    tokenLast4: "",
    claimCodeHash: await sha256Hex(code),
    claimExpiresAt,
    claimedAt: undefined,
  });
  await audit(ctx, {
    orgId,
    adminUserId: userId,
    action: existed ? "sms_relay.setup_rotated" : "sms_relay.setup_created",
    targetType: "smsRelay",
    targetId: String(orgId),
    payload: { claimExpiresAt },
  });
  return { siteUrl: siteUrl.replace(/\/$/, ""), code };
}

/**
 * iPhone: the link is copied to the clipboard, never saved as a file, so the
 * token is made now and the relay is claimed at once (no setup code).
 */
async function rotateIphone(ctx: MutationCtx, orgId: Id<"organizations">, userId: string): Promise<string> {
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) throw new ConvexError({ code: "SMS_RELAY_NOT_CONFIGURED" });
  const token = newToken();
  const now = Date.now();
  const existed = await writeRelay(ctx, orgId, now, {
    tokenHash: await sha256Hex(token),
    tokenLast4: token.slice(-4),
    claimCodeHash: undefined,
    claimExpiresAt: undefined,
    claimedAt: now,
  });
  await audit(ctx, {
    orgId,
    adminUserId: userId,
    action: existed ? "sms_relay.token_rotated" : "sms_relay.token_created",
    targetType: "smsRelay",
    targetId: String(orgId),
    payload: { tokenLast4: token.slice(-4) },
  });
  return `${siteUrl.replace(/\/$/, "")}${SMS_PATH_PREFIX}${token}`;
}

/**
 * Connects (or reconnects) a phone. Android returns the MacroDroid file built
 * with a one-time setup code (no token; the macro claims it). iPhone returns the
 * receiveBankSms URL to copy, with the token already live.
 */
export const connectPhone = mutation({
  args: {
    orgId: v.id("organizations"),
    device: v.union(v.literal("android"), v.literal("iphone")),
    saToken: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, device, saToken }) => {
    const { userId } = await requirePaymentsAdmin(ctx, orgId, saToken, "write");
    if (device === "iphone") {
      const url = await rotateIphone(ctx, orgId, String(userId));
      return { url };
    }
    const { siteUrl, code } = await rotateAndroid(ctx, orgId, String(userId));
    return { macro: buildMacroFile(siteUrl, code), filename: MACRO_FILENAME };
  },
});

/**
 * Claim (called by the http route after hashing the setup code). A valid,
 * unexpired, unclaimed code creates the store token, returns it once, and
 * clears the code. Anything else is 401.
 */
export const claim = internalMutation({
  args: { codeHash: v.string() },
  handler: async (ctx, { codeHash }) => {
    const relay = await ctx.db
      .query("smsRelays")
      .withIndex("by_claim_code_hash", (q) => q.eq("claimCodeHash", codeHash))
      .unique();
    const now = Date.now();
    if (!relay || !relay.active || !isUnclaimed(relay)) return { status: 401 as const };
    if (!relay.claimExpiresAt || now > relay.claimExpiresAt) return { status: 401 as const };

    // Same fixed-window limit as the SMS route, on the row the code points to.
    let windowStart = relay.rateWindowStart ?? 0;
    let count = relay.rateCount ?? 0;
    if (now - windowStart >= RATE_WINDOW_MS) {
      windowStart = now;
      count = 0;
    }
    if (count >= RATE_MAX) return { status: 429 as const };

    const token = newToken();
    await ctx.db.patch(relay._id, {
      tokenHash: await sha256Hex(token),
      tokenLast4: token.slice(-4),
      claimCodeHash: undefined,
      claimExpiresAt: undefined,
      claimedAt: now,
      rateWindowStart: windowStart,
      rateCount: count + 1,
    });
    await audit(ctx, {
      orgId: relay.orgId,
      adminUserId: "sms_relay_claim",
      action: "sms_relay.claimed",
      targetType: "smsRelay",
      targetId: String(relay.orgId),
      payload: { tokenLast4: token.slice(-4) },
    });
    return { status: 200 as const, token };
  },
});

export const revokeToken = mutation({
  args: { orgId: v.id("organizations"), saToken: v.optional(v.string()) },
  handler: async (ctx, { orgId, saToken }) => {
    const { userId } = await requirePaymentsAdmin(ctx, orgId, saToken, "write");
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
    // Unclaimed: the macro has not run its claim yet, so the token is not live.
    if (!relay || !relay.active || isUnclaimed(relay)) return { status: 401 as const };

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
