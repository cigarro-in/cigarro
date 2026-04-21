// Poke scheduler — dispatches bulk-fetch requests to a tenant's Apps Script
// web app, ingests returned emails, and exposes an authenticated wake
// endpoint the browser can call on visibilitychange / refresh button.

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { requireMember } from "./lib/auth";

const WAKE_THROTTLE_MS = 3 * 60 * 1000;
const MAX_FETCH_BATCH = 20;
// GAS cold-starts can take 15-20s; allow 45s before aborting.
const POKE_TIMEOUT_MS = 45_000;

// ---------- Internal queries (read-only probes used by the poke action) ----------

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

export const getGasConfig = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    if (!org?.gasWebhookUrl || !org?.gasWebhookSecret) return null;
    return { url: org.gasWebhookUrl, secret: org.gasWebhookSecret };
  },
});

const DEFAULT_SENDERS = [
  "hdfcbank.bank.in",
  "hdfcbank.net",
];

/** Always merge custom + defaults (dedup, case-insensitive). */
export const getSendersForPoke = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();
    const custom = row?.bankSenders ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of [...custom, ...DEFAULT_SENDERS]) {
      const n = s.trim().toLowerCase();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(s.trim());
    }
    return out;
  },
});

// ---------- The poke action ----------
//
// Returns a detailed trace with timing and status for every step so the
// admin UI can show exactly where failure happened. Each trace entry is
// { step, ok, ms, ... details }.

type TraceStep = {
  step: string;
  ok: boolean;
  ms: number;
  [k: string]: any;
};

function addStep(
  trace: TraceStep[],
  step: string,
  ok: boolean,
  startedAt: number,
  extra: Record<string, any> = {},
) {
  // Put step, ok, ms LAST so any name-collision in `extra` can't override
  // the step's own ok flag (previous bug: a `ok: false` inside GAS payload
  // was being spread and overrode the step's own success marker).
  const entry: TraceStep = { ...extra, step, ok, ms: Date.now() - startedAt };
  trace.push(entry);
  console.log(`[pokeGas] ${step} ok=${ok} ms=${entry.ms}`, extra);
  return entry;
}

export const pokeGas = internalAction({
  args: {
    orgId: v.id("organizations"),
    reason: v.union(
      v.literal("scheduled"),
      v.literal("wake"),
      v.literal("refresh"),
      v.literal("sweep"),
      v.literal("admin_scan"),
    ),
    triggerOrderId: v.optional(v.id("orders")),
    includeLabeled: v.optional(v.boolean()),
    peek: v.optional(v.boolean()),
  },
  handler: async (ctx, { orgId, reason, triggerOrderId, includeLabeled, peek }) => {
    const trace: TraceStep[] = [];
    const runStartedAt = Date.now();

    // ---- 1. Idle-skip check for scheduled pokes ----
    if (reason === "scheduled") {
      const t = Date.now();
      const anyPending = await ctx.runQuery(
        internal.scheduler.hasPendingOrders,
        { orgId },
      );
      addStep(trace, "check_pending_orders", true, t, { anyPending });
      if (!anyPending) {
        return {
          skipped: "no_pending_orders",
          reason,
          trace,
          totalMs: Date.now() - runStartedAt,
        };
      }
    }

    // ---- 2. Load GAS config ----
    let cfg: { url: string; secret: string } | null = null;
    {
      const t = Date.now();
      cfg = await ctx.runQuery(internal.scheduler.getGasConfig, { orgId });
      addStep(trace, "load_gas_config", !!cfg, t, {
        found: !!cfg,
        url: cfg?.url ? cfg.url.slice(0, 60) + "…" : null,
        hasSecret: !!cfg?.secret,
      });
    }
    if (!cfg) {
      return {
        skipped: "no_gas_config",
        reason,
        trace,
        totalMs: Date.now() - runStartedAt,
      };
    }

    // ---- 3. Load sender list ----
    let bankSenders: string[] = [];
    {
      const t = Date.now();
      bankSenders = await ctx.runQuery(
        internal.scheduler.getSendersForPoke,
        {},
      );
      addStep(trace, "load_senders", true, t, { count: bankSenders.length, senders: bankSenders });
    }

    // ---- 4. POST to GAS webhook with timeout ----
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POKE_TIMEOUT_MS);
    let httpStatus = 0;
    let responseBody = "";
    let parseOk = false;
    let emails: Array<any> = [];
    let gasPayload: any = null;

    const fetchStart = Date.now();
    try {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auth: cfg.secret,
          orgId,
          since: Date.now() - 7 * 24 * 60 * 60 * 1000, // last 7 days
          limit: peek ? 3 : MAX_FETCH_BATCH,
          reason,
          triggerOrderId,
          senders: bankSenders,
          includeLabeled: !!includeLabeled,
          peek: !!peek,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      httpStatus = res.status;

      const text = await res.text().catch(() => "");
      responseBody = text.slice(0, 1000);

      addStep(trace, "gas_fetch", res.ok, fetchStart, {
        httpStatus,
        bodyBytes: text.length,
        bodyPreview: text.slice(0, 200),
        timeoutMs: POKE_TIMEOUT_MS,
      });

      if (!res.ok) {
        return {
          error: `gas_http_${httpStatus}`,
          body: responseBody.slice(0, 200),
          reason,
          trace,
          totalMs: Date.now() - runStartedAt,
        };
      }

      const parseStart = Date.now();
      try {
        gasPayload = JSON.parse(text);
        parseOk = true;
        emails = Array.isArray(gasPayload?.emails) ? gasPayload.emails : [];
        addStep(trace, "parse_response", true, parseStart, {
          emailsCount: emails.length,
          topLevelKeys: Object.keys(gasPayload || {}),
          gasReportedOk: !!gasPayload?.ok,
          gasError: gasPayload?.error,
          // Pass through GAS's debug object so admin sees the Gmail query,
          // threads matched, messages inspected, etc.
          gasDebug: gasPayload?.debug,
        });

        // Even though HTTP was 200, GAS may have signalled failure at the
        // app level (e.g. wrong secret). Surface that as a proper error.
        if (gasPayload && gasPayload.ok === false) {
          return {
            error: `gas_${gasPayload.error || "reported_failure"}`,
            message:
              gasPayload.error === "unauthorized"
                ? "GAS rejected the CONVEX_SECRET. Re-run the Connect Gmail wizard to re-sync the secret between Convex and Apps Script, or verify the CONVEX_SECRET script property in your Apps Script matches what's saved in Payment Settings."
                : gasPayload.message || gasPayload.error,
            gasError: gasPayload.error,
            body: responseBody.slice(0, 200),
            reason,
            trace,
            totalMs: Date.now() - runStartedAt,
          };
        }
      } catch (parseErr: any) {
        addStep(trace, "parse_response", false, parseStart, {
          error: String(parseErr?.message || parseErr),
          preview: text.slice(0, 200),
        });
        return {
          error: "gas_response_not_json",
          body: responseBody.slice(0, 200),
          reason,
          trace,
          totalMs: Date.now() - runStartedAt,
        };
      }
    } catch (e: any) {
      clearTimeout(timer);
      const isAbort = e?.name === "AbortError";
      addStep(trace, "gas_fetch", false, fetchStart, {
        errorName: e?.name,
        errorMessage: String(e?.message || e),
        isAbort,
        timeoutMs: POKE_TIMEOUT_MS,
      });
      return {
        error: isAbort ? "gas_fetch_timeout" : "gas_fetch_failed",
        message: String(e?.message || e),
        timeoutMs: POKE_TIMEOUT_MS,
        reason,
        trace,
        totalMs: Date.now() - runStartedAt,
      };
    }

    // Peek mode returns here without ingesting — it's a read-only diagnostic.
    if (peek) {
      addStep(trace, "peek_done", true, runStartedAt, { count: emails.length });
      return {
        ok: true,
        peek: true,
        reason,
        fetched: emails.length,
        emails,
        trace,
        totalMs: Date.now() - runStartedAt,
      };
    }

    // ---- 5. Ingest each email ----
    const ingestResults: Array<{
      messageId: string;
      amount?: number;
      matched?: boolean;
      duplicate?: boolean;
      parsed?: boolean;
      orgNotFound?: boolean;
      reusedEmailId?: string;
    }> = [];
    let matched = 0;
    let duplicates = 0;
    let parseFailures = 0;
    let skippedMissingFields = 0;

    for (const em of emails) {
      if (!em?.messageId || !em?.from) {
        skippedMissingFields++;
        continue;
      }
      const t = Date.now();
      const r: any = await ctx.runMutation(
        internal.payments.ingestBankEmail,
        {
          orgId, // scheduler already knows whose scan this is
          to: em.to ? String(em.to).toLowerCase() : undefined,
          from: String(em.from),
          subject: em.subject ? String(em.subject) : undefined,
          textBody: em.textBody ? String(em.textBody) : undefined,
          htmlBody: em.htmlBody ? String(em.htmlBody) : undefined,
          messageId: String(em.messageId),
        },
      );
      const entry = {
        messageId: String(em.messageId).slice(0, 30),
        from: String(em.from),
        matched: !!r?.matched,
        duplicate: !!r?.duplicate,
        parsed: r?.parsed !== false,
        orgNotFound: !!r?.orgNotFound,
        via: r?.via,
      };
      ingestResults.push(entry as any);
      if (r?.matched) matched++;
      if (r?.duplicate) duplicates++;
      if (r?.parsed === false) parseFailures++;
      addStep(trace, "ingest_email", !r?.orgNotFound, t, entry);
    }

    addStep(trace, "summary", true, runStartedAt, {
      fetched: emails.length,
      ingested: ingestResults.length,
      matched,
      duplicates,
      parseFailures,
      skippedMissingFields,
    });

    return {
      ok: true,
      reason,
      fetched: emails.length,
      ingested: ingestResults.length,
      matched,
      duplicates,
      parseFailures,
      skippedMissingFields,
      ingestResults,
      trace,
      totalMs: Date.now() - runStartedAt,
    };
  },
});

// ---------- Scheduling pokes when an order becomes pending ----------

export const schedulePokesForOrder = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== "pending") return;
    const offsets = [
      30_000,
      90_000,
      3 * 60_000,
      6 * 60_000,
      9 * 60_000 + 45_000,
    ];
    for (const ms of offsets) {
      await ctx.scheduler.runAfter(ms, internal.scheduler.pokeGas, {
        orgId: order.orgId,
        reason: "scheduled",
        triggerOrderId: orderId,
      });
    }
  },
});

// ---------- wakeOrder — invoked from the /wakeOrder HTTP endpoint ----------

export const wakeOrder = internalMutation({
  args: {
    orderId: v.id("orders"),
    source: v.union(v.literal("wake"), v.literal("refresh")),
  },
  handler: async (ctx, { orderId, source }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });

    const { userId } = await requireMember(ctx, order.orgId);
    if (order.userId !== userId)
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

    await ctx.scheduler.runAfter(0, internal.scheduler.pokeGas, {
      orgId: order.orgId,
      reason: source,
      triggerOrderId: orderId,
    });
    await ctx.scheduler.runAfter(15_000, internal.scheduler.pokeGas, {
      orgId: order.orgId,
      reason: source,
      triggerOrderId: orderId,
    });

    return { poked: true };
  },
});

// ---------- Public wake mutation (called from the customer Transaction page) ----------

export const wake = mutation({
  args: {
    orderId: v.id("orders"),
    source: v.union(v.literal("wake"), v.literal("refresh")),
  },
  handler: async (ctx, { orderId, source }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });

    const { userId } = await requireMember(ctx, order.orgId);
    if (order.userId !== userId)
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

    await ctx.scheduler.runAfter(0, internal.scheduler.pokeGas, {
      orgId: order.orgId,
      reason: source,
      triggerOrderId: orderId,
    });
    await ctx.scheduler.runAfter(15_000, internal.scheduler.pokeGas, {
      orgId: order.orgId,
      reason: source,
      triggerOrderId: orderId,
    });

    return { poked: true };
  },
});

// ---------- Admin: manual "Scan inbox now" ----------
//
// Runs pokeGas synchronously and returns the full bundle (count, matches,
// duplicates, errors) so the admin UI can display results inline instead
// of the user having to hunt through reactive queries.

export const assertOrgAdmin = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireMember(ctx, orgId, ["admin", "owner"]);
    return true;
  },
});

export const adminScan = action({
  args: {
    orgId: v.id("organizations"),
    includeLabeled: v.optional(v.boolean()),
    peek: v.optional(v.boolean()),
  },
  handler: async (ctx, { orgId, includeLabeled, peek }): Promise<any> => {
    await ctx.runQuery(internal.scheduler.assertOrgAdmin, { orgId });
    return await ctx.runAction(internal.scheduler.pokeGas, {
      orgId,
      reason: "admin_scan",
      includeLabeled,
      peek,
    });
  },
});

// ---------- Daily 2 AM sweep across all configured orgs ----------

export const dailySweepAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    let scheduled = 0;
    for (const org of orgs) {
      if (!org.active) continue;
      if (!org.gasWebhookUrl || !org.gasWebhookSecret) continue;
      await ctx.scheduler.runAfter(0, internal.scheduler.pokeGas, {
        orgId: org._id,
        reason: "sweep",
      });
      scheduled++;
    }
    return { scheduled };
  },
});

// ---------- Admin: test connection (synchronous, returns result) ----------

export const testGasConnection = action({
  args: {
    orgId: v.id("organizations"),
    includeLabeled: v.optional(v.boolean()),
  },
  handler: async (ctx, { orgId, includeLabeled }): Promise<any> => {
    await ctx.runQuery(internal.scheduler.assertOrgAdmin, { orgId });
    return await ctx.runAction(internal.scheduler.pokeGas, {
      orgId,
      reason: "admin_scan",
      includeLabeled,
    });
  },
});
