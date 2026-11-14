// Web Push for store admins: subscriptions, the paid-order payload and the
// scheduling hook. Default runtime. The actual HTTP delivery to push services
// runs in convex/pushNode.ts ("use node", web-push).
//
// Env (Convex dashboard, both deployments):
//   VAPID_PUBLIC_KEY   base64url public key (shared with the browser)
//   VAPID_PRIVATE_KEY  base64url private key (server only)
//   VAPID_SUBJECT      mailto:you@example.com or an https URL
// Generate a pair with:  npx web-push generate-vapid-keys
// If any of the three is missing, nothing is sent and the admin UI says
// "Notifications not configured".

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { MutationCtx, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";

export const ADMIN_ORIGIN = "https://admin.cigarro.in";
const ADMIN_ROLES = ["admin", "owner"] as const;
const MAX_ENDPOINT_LENGTH = 2048;

export function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushTarget {
  _id: Id<"pushSubscriptions">;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const keysV = v.object({ p256dh: v.string(), auth: v.string() });

function isPushEndpoint(endpoint: string): boolean {
  return endpoint.length <= MAX_ENDPOINT_LENGTH && /^https:\/\/[^\s]+$/.test(endpoint);
}

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function adminUrl(slug: string, path: string): string {
  return `${ADMIN_ORIGIN}/${slug}${path}`;
}

// ---------- Subscriptions (admin devices) ----------

/** Push status for this store's admin UI. Never throws for a non-admin. */
export const status = query({
  args: { orgId: v.id("organizations"), endpoint: v.optional(v.string()) },
  handler: async (ctx, { orgId, endpoint }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    const configured = vapidConfigured();
    let subscribed = false;
    if (configured && endpoint && isPushEndpoint(endpoint)) {
      const row = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_org_endpoint", (q) => q.eq("orgId", orgId).eq("endpoint", endpoint))
        .first();
      subscribed = row?.userId === userId;
    }
    return {
      configured,
      publicKey: configured ? (process.env.VAPID_PUBLIC_KEY ?? null) : null,
      subscribed,
    };
  },
});

export const subscribe = mutation({
  args: {
    orgId: v.id("organizations"),
    endpoint: v.string(),
    keys: keysV,
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, endpoint, keys, userAgent }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    if (!vapidConfigured()) throw new ConvexError({ code: "NOT_CONFIGURED" });
    if (!isPushEndpoint(endpoint) || keys.p256dh.length > 200 || keys.auth.length > 200) {
      throw new ConvexError({ code: "INVALID_SUBSCRIPTION" });
    }
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_org_endpoint", (q) => q.eq("orgId", orgId).eq("endpoint", endpoint))
      .first();
    const fields = { userId, keys, userAgent: userAgent?.slice(0, 300) };
    if (existing) {
      // Same browser, possibly a different admin signed in now.
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("pushSubscriptions", {
      orgId,
      endpoint,
      createdAt: Date.now(),
      ...fields,
    });
  },
});

export const unsubscribe = mutation({
  args: { orgId: v.id("organizations"), endpoint: v.string() },
  handler: async (ctx, { orgId, endpoint }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    if (!isPushEndpoint(endpoint)) return;
    const row = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_org_endpoint", (q) => q.eq("orgId", orgId).eq("endpoint", endpoint))
      .first();
    if (row && row.userId === userId) await ctx.db.delete(row._id);
  },
});

/** Targets and payload for a test push to this device. Owner-only. */
export const testTarget = query({
  args: { orgId: v.id("organizations"), endpoint: v.string() },
  handler: async (ctx, { orgId, endpoint }) => {
    const { userId } = await requireOrgAdmin(ctx, orgId);
    if (!vapidConfigured()) throw new ConvexError({ code: "NOT_CONFIGURED" });
    const row = isPushEndpoint(endpoint)
      ? await ctx.db
          .query("pushSubscriptions")
          .withIndex("by_org_endpoint", (q) => q.eq("orgId", orgId).eq("endpoint", endpoint))
          .first()
      : null;
    if (!row || row.userId !== userId) throw new ConvexError({ code: "NOT_SUBSCRIBED" });
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    const payload: PushPayload = {
      title: "Notifications are on",
      body: `${org.name}: you will get an alert for every new paid order.`,
      url: adminUrl(org.slug, "/orders"),
      tag: "push-test",
    };
    const targets: PushTarget[] = [{ _id: row._id, endpoint: row.endpoint, keys: row.keys }];
    return { payload, targets };
  },
});

// ---------- Paid order fan-out ----------

export const loadOrderPush = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<{ payload: PushPayload; targets: PushTarget[] } | null> => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const org = await ctx.db.get(order.orgId);
    if (!org) return null;

    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_org_endpoint", (q) => q.eq("orgId", order.orgId))
      .collect();
    // Only devices whose owner is still an admin or owner of this store.
    const targets: PushTarget[] = [];
    for (const sub of subs) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) => q.eq("orgId", order.orgId).eq("userId", sub.userId))
        .first();
      if (membership && (ADMIN_ROLES as readonly string[]).includes(membership.role)) {
        targets.push({ _id: sub._id, endpoint: sub.endpoint, keys: sub.keys });
      }
    }
    if (targets.length === 0) return null;

    const total = order.finalAmountPaise + order.walletDebitPaise;
    const items = order.items.reduce((n, item) => n + item.qty, 0);
    const customer = order.address?.name?.trim() || order.payerName?.trim() || "Customer";
    const number = order.orderNumber ?? order.displayOrderId;
    const payload: PushPayload = {
      title: `New order ${number} · ${formatRupees(total)}`,
      body: `${customer} · ${items} ${items === 1 ? "item" : "items"}`,
      url: adminUrl(org.slug, `/orders/${order._id}`),
      tag: `order-${order._id}`,
    };
    return { payload, targets };
  },
});

export const removeSubscriptions = internalMutation({
  args: { ids: v.array(v.id("pushSubscriptions")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) await ctx.db.delete(id);
  },
});

/**
 * Called from every path that marks an order paid (admin markPaid, bank-email
 * matching, wallet-only checkout). Queues the send so the payment mutation
 * stays fast. A no-op until VAPID is configured.
 */
export async function schedulePaidOrderPush(ctx: MutationCtx, orderId: Id<"orders">) {
  if (!vapidConfigured()) return;
  await ctx.scheduler.runAfter(0, internal.pushNode.sendOrderPaid, { orderId });
}
