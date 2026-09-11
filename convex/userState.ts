import { ConvexError, v } from "convex/values";
import { requireMember } from "./lib/auth";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ---------- Phase 1: user state (cart, wishlist, profiles, addresses) ----------
// Identity: identity.subject (Supabase sub today; stable string carried
// across the Phase 2 issuer change). All reads/writes org-scoped.

// ----- Users (profile spine) -----

export const upsertUser = mutation({
  args: {
    orgId: v.id("organizations"),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.phone !== undefined ? { phone: args.phone } : {}),
        ...(args.name !== undefined ? { name: args.name } : {}),
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      userId,
      phone: args.phone,
      name: args.name,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMe = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    return await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

// ----- Cart -----

const cartLine = (d: Doc<"carts">) => ({
  _id: d._id,
  productId: d.productId,
  variantId: d.variantId,
  comboId: d.comboId,
  name: d.name,
  variantName: d.variantName,
  unitPriceRupees: d.unitPriceRupees,
  qty: d.qty,
  imageUrl: d.imageUrl,
  updatedAt: d.updatedAt,
});

export const listCart = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const lines = await ctx.db
      .query("carts")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId),
      )
      .collect();
    return lines.map(cartLine);
  },
});

export const addToCart = mutation({
  args: {
    orgId: v.id("organizations"),
    productId: v.string(),
    variantId: v.optional(v.string()),
    comboId: v.optional(v.string()),
    name: v.string(),
    variantName: v.optional(v.string()),
    unitPriceRupees: v.number(),
    qty: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const qty = args.qty ?? 1;
    if (!Number.isFinite(qty) || qty <= 0 || qty > 99) {
      throw new ConvexError({ code: "BAD_QTY" });
    }
    if (!Number.isFinite(args.unitPriceRupees) || args.unitPriceRupees < 0) {
      throw new ConvexError({ code: "BAD_PRICE" });
    }
    // Merge with an existing line for the same variant/combo/product.
    const existing = (
      await ctx.db
        .query("carts")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", userId),
        )
        .collect()
    ).find(
      (l) =>
        (args.variantId && l.variantId === args.variantId) ||
        (args.comboId && l.comboId === args.comboId) ||
        (!args.variantId &&
          !args.comboId &&
          !l.variantId &&
          !l.comboId &&
          l.productId === args.productId),
    );
    const now = Date.now();
    if (existing) {
      const nextQty = Math.min(99, existing.qty + qty);
      await ctx.db.patch(existing._id, {
        qty: nextQty,
        unitPriceRupees: args.unitPriceRupees,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("carts", {
      orgId: args.orgId,
      userId,
      productId: args.productId,
      variantId: args.variantId,
      comboId: args.comboId,
      name: args.name,
      variantName: args.variantName,
      unitPriceRupees: args.unitPriceRupees,
      qty,
      imageUrl: args.imageUrl,
      updatedAt: now,
    });
  },
});

export const setCartQty = mutation({
  args: {
    orgId: v.id("organizations"),
    lineId: v.id("carts"),
    qty: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.userId !== userId || line.orgId !== args.orgId) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
    if (args.qty <= 0) {
      await ctx.db.delete(args.lineId);
      return null;
    }
    if (!Number.isFinite(args.qty) || args.qty > 99) {
      throw new ConvexError({ code: "BAD_QTY" });
    }
    await ctx.db.patch(args.lineId, { qty: args.qty, updatedAt: Date.now() });
    return args.lineId;
  },
});

export const removeCartLine = mutation({
  args: { orgId: v.id("organizations"), lineId: v.id("carts") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.userId !== userId || line.orgId !== args.orgId) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.lineId);
    return null;
  },
});

export const clearCart = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const lines = await ctx.db
      .query("carts")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId),
      )
      .collect();
    await Promise.all(lines.map((l) => ctx.db.delete(l._id)));
    return lines.length;
  },
});

// ----- Wishlist -----

export const listWishlist = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const rows = await ctx.db
      .query("wishlists")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId),
      )
      .collect();
    return rows.map((r) => ({ productId: r.productId, createdAt: r.createdAt }));
  },
});

export const toggleWishlist = mutation({
  args: { orgId: v.id("organizations"), productId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const existing = await ctx.db
      .query("wishlists")
      .withIndex("by_org_user_product", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId).eq("productId", args.productId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { wishlisted: false as const };
    }
    await ctx.db.insert("wishlists", {
      orgId: args.orgId,
      userId,
      productId: args.productId,
      createdAt: Date.now(),
    });
    return { wishlisted: true as const };
  },
});

// ----- Saved addresses -----

export const listAddresses = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    return await ctx.db
      .query("savedAddresses")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId),
      )
      .collect();
  },
});

const addressArgs = {
  orgId: v.id("organizations"),
  label: v.optional(v.string()),
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  pincode: v.string(),
  name: v.string(),
  phone: v.string(),
  isDefault: v.optional(v.boolean()),
};

export const addAddress = mutation({
  args: addressArgs,
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const now = Date.now();
    const makeDefault =
      args.isDefault ??
      ((await ctx.db
        .query("savedAddresses")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", userId),
        )
        .collect()).length === 0);
    if (makeDefault) {
      const existing = await ctx.db
        .query("savedAddresses")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", userId),
        )
        .collect();
      await Promise.all(
        existing.map((a) => ctx.db.patch(a._id, { isDefault: false })),
      );
    }
    return await ctx.db.insert("savedAddresses", {
      orgId: args.orgId,
      userId,
      label: args.label,
      address: {
        line1: args.line1,
        line2: args.line2,
        city: args.city,
        state: args.state,
        pincode: args.pincode,
        name: args.name,
        phone: args.phone,
      },
      isDefault: makeDefault,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeAddress = mutation({
  args: { orgId: v.id("organizations"), addressId: v.id("savedAddresses") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const row = await ctx.db.get(args.addressId);
    if (!row || row.userId !== userId || row.orgId !== args.orgId) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.addressId);
    return null;
  },
});

export const setDefaultAddress = mutation({
  args: { orgId: v.id("organizations"), addressId: v.id("savedAddresses") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const row = await ctx.db.get(args.addressId);
    if (!row || row.userId !== userId || row.orgId !== args.orgId) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
    const all = await ctx.db
      .query("savedAddresses")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId),
      )
      .collect();
    await Promise.all(
      all.map((a) =>
        ctx.db.patch(a._id, {
          isDefault: a._id === args.addressId,
          updatedAt: Date.now(),
        }),
      ),
    );
    return args.addressId;
  },
});

export const clearWishlist = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const rows = await ctx.db
      .query("wishlists")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId),
      )
      .collect();
    await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
    return rows.length;
  },
});

export const updateAddress = mutation({
  args: {
    orgId: v.id("organizations"),
    addressId: v.id("savedAddresses"),
    label: v.optional(v.string()),
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
    name: v.string(),
    phone: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const row = await ctx.db.get(args.addressId);
    if (!row || row.userId !== userId || row.orgId !== args.orgId) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
    if (args.isDefault) {
      const all = await ctx.db
        .query("savedAddresses")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", userId),
        )
        .collect();
      await Promise.all(
        all.map((a) =>
          ctx.db.patch(a._id, { isDefault: a._id === args.addressId }),
        ),
      );
    }
    await ctx.db.patch(args.addressId, {
      label: args.label,
      address: {
        line1: args.line1,
        line2: args.line2,
        city: args.city,
        state: args.state,
        pincode: args.pincode,
        name: args.name,
        phone: args.phone,
      },
      ...(args.isDefault !== undefined ? { isDefault: args.isDefault } : {}),
      updatedAt: Date.now(),
    });
    return args.addressId;
  },
});
