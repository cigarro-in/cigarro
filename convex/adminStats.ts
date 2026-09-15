import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireOrgAdmin } from "./lib/auth";

// ---------- Wave 7: dashboard + customers reads (Supabase -> Convex) ----------
// Org-scoped like the rest of the payments surface. Bounded take(1000) per
// standing rule — counts cap there; materialize counters past ~1k orders.
// Money leaves here in RUPEES (paise/100); UI never divides inline.

const PAID = ["paid", "late_paid"];

// Edge (invalidate-cache) admin gate: the caller forwards the admin's
// Supabase session JWT as Bearer; the customJwt bridge yields the same
// subject the SPA uses, so memberships resolve identically.
export const checkMyAdmin = query({
  args: { orgSlug: v.optional(v.string()) },
  handler: async (ctx, { orgSlug }) => {
    const identity = await requireIdentity(ctx);
    const orgs = await ctx.db.query("organizations").collect();
    const org = orgSlug
      ? orgs.find((o) => o.slug === orgSlug)
      : orgs.find((o) => o.slug === "smokeshop") ?? orgs[0];
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

    let pending = 0;
    let processing = 0;
    let shipped = 0;
    let revenue = 0;
    let todayOrders = 0;
    let todayRevenue = 0;
    for (const o of orders) {
      const paid = PAID.includes(o.status);
      if (o.status === "pending") pending++;
      else if (paid && (!o.shippingStatus || ["awaiting", "processing"].includes(o.shippingStatus))) processing++;
      if (o.shippingStatus === "shipped") shipped++;
      if (paid) {
        revenue += rupees(o.finalAmountPaise);
        if (o.createdAt >= dayStartMs) {
          todayOrders++;
          todayRevenue += rupees(o.finalAmountPaise);
        }
      } else if (o.createdAt >= dayStartMs) {
        todayOrders++;
      }
    }

    const products = await ctx.db.query("catalogProducts").collect();
    const variants = await ctx.db.query("catalogVariants").collect();
    const inventory = await ctx.db
      .query("inventoryBalances")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const inventoryByVariant = new Map(inventory.map((row) => [row.variantSupabaseId, row]));
    const users = await ctx.db.query("users").collect();

    const recentOrders = orders.slice(0, 5).map((o) => ({
      id: o._id,
      display_order_id: o.displayOrderId,
      shipping_name: o.address?.name ?? "Guest",
      total: rupees(o.finalAmountPaise),
      status: o.shippingStatus ?? o.status,
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

    const users = await ctx.db.query("users").collect();
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!user) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .unique();

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .order("desc")
      .take(100);
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
        total: rupees(o.finalAmountPaise),
        status: o.shippingStatus ?? o.status,
        created_at: o.createdAt,
        items_count: o.items.reduce((s, i) => s + i.qty, 0),
      })),
    };
  },
});
