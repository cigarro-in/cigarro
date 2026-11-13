import { ConvexError, v } from "convex/values";
import {
  assertTokenOrg,
  optionalMember,
  requireIdentity,
  requireMember,
} from "./lib/auth";
import { resolveOrg } from "./lib/org";
import { normalizePhoneE164 } from "./lib/phone";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { isLegacyOrg, LEGACY_ORG_SLUG } from "./lib/legacyOrg";

// ---------- Phase 1: user state (cart, wishlist, profiles, addresses) ----------
// Identity: identity.subject (Supabase sub today; stable string carried
// across the Phase 2 issuer change). All reads/writes org-scoped.

// ----- Users (profile spine) -----

// Auth Phase 2 profile read: identity-scoped (no membership needed —
// customers may have none yet). isAdmin resolves via memberships, replacing
// the Supabase profiles read in useAuth.
// Pass orgSlug to scope isAdmin to that org (owner/admin of THAT org). Without
// it, isAdmin is true for admin of ANY org (legacy; do not use for gating).
// Read query: returns null (never throws) for a signed-out caller. Callers
// treat null as "no profile yet".
export const getMyProfile = query({
  args: { orgSlug: v.optional(v.string()) },
  handler: async (ctx, { orgSlug }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
    let isAdmin: boolean;
    if (orgSlug !== undefined) {
      const org = await resolveOrg(ctx, orgSlug).catch(() => null);
      const orgMembership = org
        ? await ctx.db
            .query("memberships")
            .withIndex("by_org_user", (q) =>
              q.eq("orgId", org._id).eq("userId", identity.subject),
            )
            .unique()
        : null;
      isAdmin =
        orgMembership?.role === "owner" || orgMembership?.role === "admin";
    } else {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .filter((q: any) =>
          q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin")),
        )
        .first();
      isAdmin = !!membership;
    }
    return {
      userId: identity.subject,
      phone: user?.phone ?? null,
      name: user?.name ?? null,
      isAdmin,
    };
  },
});

// Authenticated session handshake: maintain the user spine and guarantee the
// shopper has a customer membership for the active storefront. Existing
// staff/admin/owner roles are preserved.
export const ensureMyProfile = mutation({
  args: {
    orgSlug: v.string(),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    // The store is whichever org the caller names, but only if the token was
    // minted for that store (assertTokenOrg). No env allow-list: every store
    // gets its own customer membership.
    const org = await resolveOrg(ctx, args.orgSlug);
    await assertTokenOrg(ctx, identity, org);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
    if (
      existing &&
      existing.orgId !== undefined &&
      existing.orgId !== org._id
    ) {
      throw new ConvexError({ code: "WRONG_STORE" });
    }
    const now = Date.now();
    // Normalize on write: a raw client phone must never overwrite the E.164
    // form, or the next by_org_phone lookup forks a second users row.
    const profilePhone = normalizePhoneE164(args.phone);
    let userId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        // Pre-backfill legacy row (legacy org only) claims its store here.
        ...(existing.orgId === undefined && isLegacyOrg(org)
          ? { orgId: org._id }
          : {}),
        ...(profilePhone !== undefined ? { phone: profilePhone } : {}),
        ...(args.name !== undefined ? { name: args.name } : {}),
        updatedAt: now,
      });
    } else {
      userId = await ctx.db.insert("users", {
        userId: identity.subject,
        orgId: org._id,
        phone: profilePhone,
        name: args.name,
        createdAt: now,
        updatedAt: now,
      });
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", org._id).eq("userId", identity.subject),
      )
      .unique();
    if (!membership) {
      await ctx.db.insert("memberships", {
        orgId: org._id,
        userId: identity.subject,
        role: "customer",
        createdAt: now,
      });
    }
    return userId;
  },
});

// Pre-login identity resolution for the phone-verify edge endpoint (auth
// cutover: no Supabase). Users are per store: lookup is by (orgId, phone), so
// the same phone shopping two stores gets two rows and two userIds. A new
// store mints a fresh row. Legacy rows (no orgId, pre-backfill) are legacy-org
// customers, so they resolve for the legacy org only and keep their userId.
export const resolvePhoneIdentity = internalMutation({
  args: {
    phone: v.string(),
    orgSlug: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const phone = normalizePhoneE164(args.phone) ?? args.phone;
    const now = Date.now();
    let existing = await ctx.db
      .query("users")
      .withIndex("by_org_phone", (q) =>
        q.eq("orgId", org._id).eq("phone", phone),
      )
      .first();
    if (!existing && isLegacyOrg(org)) {
      const samePhone = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", phone))
        .collect();
      existing = legacyUserRow(samePhone);
      if (existing) {
        // Claim the legacy row for the legacy org in the same write.
        await ctx.db.patch(existing._id, { orgId: org._id });
      }
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.name !== undefined ? { name: args.name } : {}),
        updatedAt: now,
      });
      return { userId: existing.userId, isNewUser: false };
    }
    const userId = crypto.randomUUID();
    await ctx.db.insert("users", {
      userId,
      orgId: org._id,
      phone,
      name: args.name ?? "Customer",
      createdAt: now,
      updatedAt: now,
    });
    return { userId, isNewUser: true };
  },
});

function legacyUserRow(rows: Doc<"users">[]) {
  return rows.find((r) => r.orgId === undefined) ?? null;
}

// One-time, resumable backfill: stamps orgId = the legacy org on every users row
// that predates per-store accounts. Paginates the undefined-orgId partition of
// by_org_phone with a cursor; patched rows leave that partition, and the cursor
// never revisits them, so repeat calls converge. Run it until isDone is true.
//   npx convex run userState:backfillUserOrgs '{"orgSlug":"oldsmokeshop"}'
//   npx convex run userState:backfillUserOrgs '{"orgSlug":"oldsmokeshop","cursor":"<continueCursor>"}'
export const backfillUserOrgs = internalMutation({
  args: {
    orgSlug: v.string(),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.orgSlug !== LEGACY_ORG_SLUG)
      throw new ConvexError({ code: "LEGACY_DATA_BELONGS_TO_LEGACY_ORG" });
    const org = await resolveOrg(ctx, args.orgSlug);
    const numItems = Math.max(1, Math.min(args.batchSize ?? 200, 500));
    const page = await ctx.db
      .query("users")
      .withIndex("by_org_phone", (q) => q.eq("orgId", undefined))
      .paginate({ cursor: args.cursor ?? null, numItems });
    for (const row of page.page) {
      await ctx.db.patch(row._id, { orgId: org._id });
    }
    return {
      patched: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

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
    const profilePhone = normalizePhoneE164(args.phone);
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(profilePhone !== undefined ? { phone: profilePhone } : {}),
        ...(args.name !== undefined ? { name: args.name } : {}),
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      userId,
      phone: profilePhone,
      name: args.name,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMe = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await optionalMember(ctx, args.orgId);
    if (!member) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", member.userId))
      .first();
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
    const member = await optionalMember(ctx, args.orgId);
    if (!member) return [];
    const lines = await ctx.db
      .query("carts")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", member.userId),
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
    if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
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
    if (!Number.isInteger(args.qty) || args.qty > 99) {
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
    // Idempotent: callers fire clear on every visit to /transaction
    // (mount + StrictMode remount + countdown re-renders). Skipping the
    // writes when already empty stops the no-op delete storm in prod logs.
    if (lines.length === 0) return 0;
    await Promise.all(lines.map((l) => ctx.db.delete(l._id)));
    return lines.length;
  },
});

// Atomic full-replace: delete + re-add in ONE mutation so concurrent
// readers never observe the empty middle state. useCart.persistAllConvex
// used to do clear→N×add as separate round-trips; any poll landing
// between them adopted the empty cart and wiped local state.
export const replaceCart = mutation({
  args: {
    orgId: v.id("organizations"),
    lines: v.array(
      v.object({
        productId: v.string(),
        variantId: v.optional(v.string()),
        comboId: v.optional(v.string()),
        name: v.string(),
        variantName: v.optional(v.string()),
        unitPriceRupees: v.number(),
        qty: v.number(),
        imageUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const validated = args.lines.map((line) => {
      if (!Number.isInteger(line.qty) || line.qty <= 0 || line.qty > 99) {
        throw new ConvexError({ code: "BAD_QTY" });
      }
      if (!Number.isFinite(line.unitPriceRupees) || line.unitPriceRupees < 0) {
        throw new ConvexError({ code: "BAD_PRICE" });
      }
      return line;
    });
    const existing = await ctx.db
      .query("carts")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId),
      )
      .collect();
    await Promise.all(existing.map((l) => ctx.db.delete(l._id)));
    const now = Date.now();
    for (const l of validated) {
      await ctx.db.insert("carts", {
        orgId: args.orgId,
        userId,
        productId: l.productId,
        variantId: l.variantId,
        comboId: l.comboId,
        name: l.name,
        variantName: l.variantName,
        unitPriceRupees: l.unitPriceRupees,
        qty: l.qty,
        imageUrl: l.imageUrl,
        updatedAt: now,
      });
    }
    return validated.length;
  },
});

// ----- Wishlist -----

export const listWishlist = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const member = await optionalMember(ctx, args.orgId);
    if (!member) return [];
    const rows = await ctx.db
      .query("wishlists")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", member.userId),
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
    const member = await optionalMember(ctx, args.orgId);
    if (!member) return [];
    const rows = await ctx.db
      .query("savedAddresses")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", member.userId),
      )
      .collect();
    // Deterministic order (oldest first) so "default else newest (last)"
    // picks the same row on every client.
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
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
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  userProvidedAddress: v.optional(v.string()),
  isDefault: v.optional(v.boolean()),
};

export const addAddress = mutation({
  args: addressArgs,
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const now = Date.now();
    const existingCount = (
      await ctx.db
        .query("savedAddresses")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", userId),
        )
        .collect()
    ).length;
    // First address is always the default (explicit isDefault:false must not
    // leave a new book with zero defaults — the form sends false by default).
    const makeDefault =
      existingCount === 0 ? true : (args.isDefault ?? false);
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
        latitude: args.latitude,
        longitude: args.longitude,
        userProvidedAddress: args.userProvidedAddress,
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
    // Deleting the default must not leave zero defaults: promote the oldest
    // remaining row so the next "default else newest" pick stays deterministic.
    if (row.isDefault) {
      const remaining = await ctx.db
        .query("savedAddresses")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", userId),
        )
        .collect();
      if (remaining.length > 0) {
        remaining.sort((a, b) => a.createdAt - b.createdAt);
        await ctx.db.patch(remaining[0]._id, {
          isDefault: true,
          updatedAt: Date.now(),
        });
      }
    }
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
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    userProvidedAddress: v.optional(v.string()),
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
        latitude: args.latitude,
        longitude: args.longitude,
        userProvidedAddress: args.userProvidedAddress,
      },
      ...(args.isDefault !== undefined ? { isDefault: args.isDefault } : {}),
      updatedAt: Date.now(),
    });
    return args.addressId;
  },
});
