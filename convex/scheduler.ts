// Poke scheduler — dispatches bulk-fetch requests to a tenant's Apps Script
// web app, ingests returned emails, and exposes an authenticated wake
// endpoint the browser can call on visibilitychange / refresh button.

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { requireMember } from "./lib/auth";

const WAKE_THROTTLE_MS = 3 * 60 * 1000;
const MAX_FETCH_BATCH = 20;
const POKE_TIMEOUT_MS = 10_000;

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

const DEFAULT_SENDERS = ["@hdfcbank.bank.in", "@hdfcbank.net", "alerts@hdfcbank"];
export const getSendersForPoke = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();
    return row?.bankSenders && row.bankSenders.length > 0
      ? row.bankSenders
      : DEFAULT_SENDERS;
  },
});

// ---------- The poke action ----------

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
  },
  handler: async (ctx, { orgId, reason, triggerOrderId }) => {
    // Idle-skip: scheduled pokes that find no pending orders return immediately.
    if (reason === "scheduled") {
      const anyPending = await ctx.runQuery(
        internal.scheduler.hasPendingOrders,
        { orgId },
      );
      if (!anyPending) return { skipped: "no_pending_orders" };
    }

    const cfg = await ctx.runQuery(internal.scheduler.getGasConfig, { orgId });
    if (!cfg) return { skipped: "no_gas_config" };

    const bankSenders = await ctx.runQuery(
      internal.scheduler.getSendersForPoke,
      {},
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POKE_TIMEOUT_MS);

    let emails: Array<any> = [];
    try {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Apps Script web apps can't read request headers, so the auth
        // token travels in the JSON body. GAS side uses constant-time compare.
        body: JSON.stringify({
          auth: cfg.secret,
          orgId,
          since: Date.now() - 60 * 60 * 1000,
          limit: MAX_FETCH_BATCH,
          reason,
          triggerOrderId,
          senders: bankSenders,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { error: `gas_http_${res.status}`, body: text.slice(0, 200) };
      }

      const payload = await res.json().catch(() => ({}));
      emails = Array.isArray(payload?.emails) ? payload.emails : [];
    } catch (e: any) {
      clearTimeout(timer);
      return { error: "gas_fetch_failed", message: String(e?.message || e) };
    }

    let ingested = 0;
    let matched = 0;
    let duplicates = 0;
    for (const em of emails) {
      if (!em?.messageId || !em?.from) continue;
      const r: any = await ctx.runMutation(
        internal.payments.ingestBankEmail,
        {
          to: em.to ? String(em.to).toLowerCase() : undefined,
          from: String(em.from),
          subject: em.subject ? String(em.subject) : undefined,
          textBody: em.textBody ? String(em.textBody) : undefined,
          htmlBody: em.htmlBody ? String(em.htmlBody) : undefined,
          messageId: String(em.messageId),
        },
      );
      ingested++;
      if (r?.matched) matched++;
      if (r?.duplicate) duplicates++;
    }

    return { ingested, matched, duplicates, reason };
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

export const adminScan = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireMember(ctx, orgId, ["admin", "owner"]);
    await ctx.scheduler.runAfter(0, internal.scheduler.pokeGas, {
      orgId,
      reason: "admin_scan",
    });
    return { triggered: true };
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

// ---------- Admin: test connection (just runs a poke and returns result) ----------

export const testGasConnection = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireMember(ctx, orgId, ["admin", "owner"]);
    await ctx.scheduler.runAfter(0, internal.scheduler.pokeGas, {
      orgId,
      reason: "admin_scan",
    });
    return { triggered: true };
  },
});
