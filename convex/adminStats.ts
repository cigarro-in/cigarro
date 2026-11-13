import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireOrgAdmin } from "./lib/auth";
import { collectInOrg } from "./lib/org";
import { isLegacyOrg } from "./lib/legacyOrg";
import { orderNumberOf } from "./lib/ids";

// ---------- Wave 7: dashboard + customers reads (Supabase -> Convex) ----------
// Org-scoped like the rest of the payments surface. Bounded take(1000) per
// standing rule — counts cap there; materialize counters past ~1k orders.
// Money leaves here in RUPEES (paise/100); UI never divides inline.

const PAID = ["paid", "late_paid"];

// Edge (invalidate-cache) admin gate: the caller forwards the admin's
// session JWT as Bearer; the customJwt bridge yields the same subject the
// SPA uses, so memberships resolve identically.
export const checkMyAdmin = query({
  args: { orgSlug: v.optional(v.string()) },
  handler: async (ctx, { orgSlug }) => {
    const identity = await requireIdentity(ctx);
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgSlug
      ? orgs.find((o) => o.slug === orgSlug)
      : orgs.find((o) => isLegacyOrg(o)) ?? orgs[0];
    if (!org) return { ok: false };
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", org._id).eq("userId", identity.subject),
      )
      .unique();
    const role = membership?.role;
    return { ok: role === "admin" || role === "owner" };
  },
});

function rupees(paise: number) {
  return paise / 100;
}

export const getDashboardStats = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(1000);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const yesterdayStart = new Date(dayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayStartMs = yesterdayStart.getTime();

    let pending = 0;
    let processing = 0;
    let shipped = 0;
    let revenue = 0;
    let todayOrders = 0;
    let todayRevenue = 0;
    let yesterdayOrders = 0;
    let yesterdayRevenue = 0;
    for (const o of orders) {
      const paid = PAID.includes(o.status);
      if (o.status === "pending") pending++;
      else if (paid && (!o.shippingStatus || ["awaiting", "processing"].includes(o.shippingStatus))) processing++;
      if (o.shippingStatus === "shipped") shipped++;
      if (paid) revenue += rupees(o.finalAmountPaise);
      if (o.createdAt >= dayStartMs) {
        todayOrders++;
        if (paid) todayRevenue += rupees(o.finalAmountPaise);
      } else if (o.createdAt >= yesterdayStartMs) {
        yesterdayOrders++;
        if (paid) yesterdayRevenue += rupees(o.finalAmountPaise);
      }
    }

    // Payments the bank emails could not match to an order (cheap: one index range).
    const unmatchedEmails = await ctx.db
      .query("bankEmails")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "unmatched"))
      .take(100);

    const org = await ctx.db.get(orgId);
    if (!org) return null;
    const [products, variants] = await Promise.all([
      collectInOrg(ctx, "catalogProducts", org),
      collectInOrg(ctx, "catalogVariants", org),
    ]);
    const inventory = await ctx.db
      .query("inventoryBalances")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const inventoryByVariant = new Map(inventory.map((row) => [row.variantSupabaseId, row]));
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId))
      .collect();
    const customerIds = new Set([
      ...orders.map((o) => o.userId),
      ...memberships.map((m) => m.userId),
    ]);
    const users = (await ctx.db.query("users").collect()).filter((u) =>
      customerIds.has(u.userId),
    );

    const recentOrders = orders.slice(0, 5).map((o) => ({
      id: o._id,
      display_order_id: o.displayOrderId,
      order_number: orderNumberOf(o),
      shipping_name: o.address?.name ?? "Guest",
      total: rupees(o.finalAmountPaise),
      status: o.shippingStatus ?? o.status,
      // Raw lifecycles so views can derive one stage (src/lib/orders/orderStage.ts).
      payment_status: o.status,
      shipping_status: o.shippingStatus ?? null,
      created_at: o.createdAt,
    }));

    const recentCustomers = users
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((u) => ({
        id: u.userId,
        name: u.name ?? "Unknown",
        phone: u.phone ?? "",
        created_at: u.createdAt,
      }));

    return {
      totalProducts: products.length,
      activeProducts: products.filter((p) => p.isActive).length,
      totalOrders: orders.length,
      ordersCapped: orders.length === 1000,
      pendingOrders: pending,
      processingOrders: processing,
      shippedOrders: shipped,
      totalCustomers: users.length,
      totalRevenue: revenue,
      todayOrders,
      todayRevenue,
      yesterdayOrders,
      yesterdayRevenue,
      unmatchedPayments: unmatchedEmails.length,
      unmatchedCapped: unmatchedEmails.length === 100,
      lowStockCount: variants.filter((vv) => {
        if (vv.trackInventory === false) return false;
        const balance = inventoryByVariant.get(vv.supabaseId);
        const available = balance ? balance.onHand - balance.reserved : Number(vv.stock ?? 0);
        return available <= (balance?.reorderPoint ?? 10);
      }).length,
      recentOrders,
      recentCustomers,
    };
  },
});

// Customer list with per-customer order aggregates (Convex users + orders).
// No status/block toggle: Supabase profiles never had a status column, so
// the old toggle always failed — dropped, not ported.
export const listCustomersForAdmin = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(1000);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_role", (q) => q.eq("orgId", orgId))
      .collect();
    const roleByUser = new Map(memberships.map((m) => [m.userId, m.role]));
    const customerIds = new Set([
      ...orders.map((o) => o.userId),
      ...memberships.map((m) => m.userId),
    ]);
    const users = (await ctx.db.query("users").collect()).filter((u) =>
      customerIds.has(u.userId),
    );

    return users
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((u) => {
        const mine = orders.filter((o) => o.userId === u.userId);
        const totalSpent = mine.reduce(
          (s, o) => s + (PAID.includes(o.status) ? rupees(o.finalAmountPaise) : 0),
          0,
        );
        const times = mine.map((o) => o.createdAt);
        const role = roleByUser.get(u.userId);
        return {
          id: u.userId,
          name: u.name ?? "Unknown",
          phone: u.phone ?? "",
          is_admin: role === "admin" || role === "owner",
          orderCount: mine.length,
          totalSpent,
          averageOrderValue: mine.length > 0 ? totalSpent / mine.length : 0,
          lastOrderDate: times.length ? Math.max(...times) : undefined,
          firstOrderDate: times.length ? Math.min(...times) : undefined,
          created_at: u.createdAt,
          updated_at: u.updatedAt,
        };
      });
  },
});

export const getCustomerForAdmin = query({
  args: { orgId: v.id("organizations"), userId: v.string() },
  handler: async (ctx, { orgId, userId }) => {
    await requireOrgAdmin(ctx, orgId);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .unique();

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .order("desc")
      .take(100);
    if (!membership && orders.length === 0) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!user) return null;
    const paid = orders.filter((o) => PAID.includes(o.status));
    const totalSpent = paid.reduce((s, o) => s + rupees(o.finalAmountPaise), 0);
    const times = orders.map((o) => o.createdAt);

    return {
      id: user.userId,
      name: user.name ?? "Unknown",
      phone: user.phone ?? "",
      is_admin: membership?.role === "admin" || membership?.role === "owner",
      orderCount: orders.length,
      totalSpent,
      averageOrderValue: orders.length > 0 ? totalSpent / orders.length : 0,
      lastOrderDate: times.length ? Math.max(...times) : undefined,
      firstOrderDate: times.length ? Math.min(...times) : undefined,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      orders: orders.slice(0, 10).map((o) => ({
        id: o._id,
        display_order_id: o.displayOrderId,
        order_number: orderNumberOf(o),
        total: rupees(o.finalAmountPaise),
        status: o.shippingStatus ?? o.status,
        created_at: o.createdAt,
        items_count: o.items.reduce((s, i) => s + i.qty, 0),
      })),
    };
  },
});

// Customer profile for the admin detail page. One round trip: identity,
// lifetime summary (over the newest ORDER_CAP orders), wallet, referral,
// addresses (saved + distinct delivery addresses from orders) and orders.
const ORDER_CAP = 200;

export const getCustomerProfile = query({
  args: { orgId: v.id("organizations"), userId: v.string() },
  handler: async (ctx, { orgId, userId }) => {
    await requireOrgAdmin(ctx, orgId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!user) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .first();
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .order("desc")
      .take(ORDER_CAP);
    if (!membership && orders.length === 0) return null;

    const wallet = await ctx.db
      .query("walletAccounts")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .first();
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .first();
    const saved = await ctx.db
      .query("savedAddresses")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .take(20);

    const paid = orders.filter((o) => PAID.includes(o.status));
    const totalSpent = paid.reduce((s, o) => s + rupees(o.finalAmountPaise), 0);
    const times = orders.map((o) => o.createdAt);

    const addressKey = (a: { line1: string; pincode: string }) =>
      `${a.line1.trim().toLowerCase()}|${a.pincode.trim()}`;
    const savedKeys = new Set(saved.map((s) => addressKey(s.address)));
    const addresses: Array<{
      id: string;
      source: "saved" | "order";
      label: string | null;
      isDefault: boolean;
      name: string;
      phone: string;
      line1: string;
      line2: string | null;
      city: string;
      state: string;
      pincode: string;
      latitude: number | null;
      longitude: number | null;
    }> = [];
    for (const s of saved) {
      addresses.push({
        id: s._id,
        source: "saved",
        label: s.label ?? null,
        isDefault: s.isDefault,
        name: s.address.name,
        phone: s.address.phone,
        line1: s.address.line1,
        line2: s.address.line2 ?? null,
        city: s.address.city,
        state: s.address.state,
        pincode: s.address.pincode,
        latitude: s.address.latitude ?? null,
        longitude: s.address.longitude ?? null,
      });
    }
    const seenOrderAddress = new Set<string>();
    for (const o of orders) {
      const a = o.address;
      if (!a) continue;
      const key = addressKey(a);
      if (savedKeys.has(key) || seenOrderAddress.has(key)) continue;
      seenOrderAddress.add(key);
      addresses.push({
        id: o._id,
        source: "order",
        label: null,
        isDefault: false,
        name: a.name,
        phone: a.phone,
        line1: a.line1,
        line2: a.line2 ?? null,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
      });
      if (addresses.length >= 8) break;
    }

    return {
      id: user.userId,
      name: user.name ?? "Unknown",
      phone: user.phone ?? "",
      isAdmin: membership?.role === "admin" || membership?.role === "owner",
      createdAt: user.createdAt,
      ordersCapped: orders.length === ORDER_CAP,
      summary: {
        orderCount: orders.length,
        paidOrderCount: paid.length,
        totalSpent,
        averageOrder: paid.length > 0 ? totalSpent / paid.length : 0,
        firstOrderAt: times.length ? Math.min(...times) : null,
        lastOrderAt: times.length ? Math.max(...times) : null,
      },
      walletBalance: wallet ? rupees(wallet.balancePaise) : 0,
      referral: referral
        ? {
            code: referral.referralCode,
            isActive: referral.isActive,
            totalReferrals: referral.totalReferrals,
            successfulReferrals: referral.successfulReferrals,
            totalRewardsEarned: referral.totalRewardsEarned,
            referredByCode: referral.referredByCode ?? null,
          }
        : null,
      addresses,
      orders: orders.map((o) => ({
        id: o._id,
        orderNumber: orderNumberOf(o) ?? null,
        displayOrderId: o.displayOrderId,
        payment_status: o.status,
        shipping_status: o.shippingStatus ?? null,
        total: rupees(o.finalAmountPaise),
        created_at: o.createdAt,
        items: o.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: i.qty,
        })),
      })),
    };
  },
});
