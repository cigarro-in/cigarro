import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { collectInOrg, inOrg, requireOrgAdminBySlug, resolveOrg } from "./lib/org";

// Store pages. Two kinds of rows share the storePages table:
// - Built-in slugs (About, Contact, policies): a row overrides the built-in
//   storefront page at its existing URL. No row, or an unpublished row, keeps
//   the built-in content.
// - Custom slugs: any valid slug, served at /pages/<slug>. Only a published row
//   is visible; anything else is a 404.
// Keep STORE_PAGE_SLUGS in sync with src/lib/storePages/catalog.ts.
export const STORE_PAGE_SLUGS = [
  "about",
  "contact",
  "legal",
  "terms",
  "privacy",
  "shipping",
  "returns",
] as const;

// Storefront path segments and admin words a custom slug may not use, so a
// custom page never reads like another part of the store.
const RESERVED_PAGE_SLUGS = new Set<string>([
  ...STORE_PAGE_SLUGS,
  "agents", "api", "admin", "blog", "blogs", "brand", "brands", "cart", "category",
  "checkout", "desktop-checkout", "mobile-checkout", "categories", "login", "new",
  "orders", "pages", "payment", "product", "products", "profile", "addresses",
  "referral", "referrals", "reviews", "search",
  "transaction", "wallet", "wishlist", "functions", "sa",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 80;

export function isBuiltInPageSlug(slug: string) {
  return (STORE_PAGE_SLUGS as readonly string[]).includes(slug);
}

function assertCustomSlug(slug: string) {
  if (slug.length === 0 || slug.length > SLUG_MAX || !SLUG_PATTERN.test(slug))
    throw new ConvexError({ code: "SLUG_INVALID" });
  if (RESERVED_PAGE_SLUGS.has(slug)) throw new ConvexError({ code: "SLUG_RESERVED" });
}

const pageV = v.object({
  title: v.string(),
  body: v.string(),
  published: v.boolean(),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
});

// Admin: every page row for the store (published or not).
export const listStorePagesForAdmin = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, { orgSlug }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const rows = await collectInOrg(ctx, "storePages", org);
    return rows.map((r) => ({
      _id: r._id,
      slug: r.slug,
      title: r.title,
      body: r.body,
      published: r.published,
      metaTitle: r.metaTitle ?? null,
      metaDescription: r.metaDescription ?? null,
      updatedAt: r.updatedAt,
    }));
  },
});

// Storefront: published custom pages for the sitemap (built-in slugs excluded:
// they already have fixed URLs in the sitemap).
export const listPublishedCustomPages = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, { orgSlug }) => {
    const org = await resolveOrg(ctx, orgSlug);
    const rows = await ctx.db
      .query("storePages")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    return rows
      .filter((r) => r.published && !isBuiltInPageSlug(r.slug) && inOrg(r, org))
      .map((r) => ({ slug: r.slug, updatedAt: r.updatedAt }));
  },
});

// Storefront: the published row for this slug, or null (built-in content).
export const getBySlug = query({
  args: { orgSlug: v.string(), slug: v.string() },
  handler: async (ctx, { orgSlug, slug }) => {
    const org = await resolveOrg(ctx, orgSlug);
    const row = await ctx.db
      .query("storePages")
      .withIndex("by_org_slug", (q) => q.eq("orgId", org._id).eq("slug", slug))
      .unique();
    if (!row || !row.published || !inOrg(row, org)) return null;
    return {
      slug: row.slug,
      title: row.title,
      body: row.body,
      metaTitle: row.metaTitle ?? null,
      metaDescription: row.metaDescription ?? null,
      updatedAt: row.updatedAt,
    };
  },
});

// Create or update the store's row for a slug (one row per org + slug).
export const saveStorePage = mutation({
  args: {
    orgSlug: v.string(),
    slug: v.string(),
    page: pageV,
  },
  handler: async (ctx, { orgSlug, slug, page }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (!page.title.trim()) throw new ConvexError({ code: "TITLE_REQUIRED" });
    const existing = await ctx.db
      .query("storePages")
      .withIndex("by_org_slug", (q) => q.eq("orgId", org._id).eq("slug", slug))
      .unique();
    if (!existing && !isBuiltInPageSlug(slug)) assertCustomSlug(slug);
    const row = {
      title: page.title.trim(),
      body: page.body,
      published: page.published,
      metaTitle: page.metaTitle?.trim() || undefined,
      metaDescription: page.metaDescription?.trim() || undefined,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { id: existing._id };
    }
    const id = await ctx.db.insert("storePages", { ...row, orgId, slug });
    return { id };
  },
});

// Create a custom page. Fails when the slug is taken in this store.
export const createStorePage = mutation({
  args: { orgSlug: v.string(), slug: v.string(), page: pageV },
  handler: async (ctx, { orgSlug, slug, page }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (isBuiltInPageSlug(slug)) throw new ConvexError({ code: "SLUG_TAKEN" });
    assertCustomSlug(slug);
    if (!page.title.trim()) throw new ConvexError({ code: "TITLE_REQUIRED" });
    const existing = await ctx.db
      .query("storePages")
      .withIndex("by_org_slug", (q) => q.eq("orgId", org._id).eq("slug", slug))
      .unique();
    if (existing) throw new ConvexError({ code: "SLUG_TAKEN" });
    const id = await ctx.db.insert("storePages", {
      orgId,
      slug,
      title: page.title.trim(),
      body: page.body,
      published: page.published,
      metaTitle: page.metaTitle?.trim() || undefined,
      metaDescription: page.metaDescription?.trim() || undefined,
      updatedAt: Date.now(),
    });
    return { id };
  },
});

// Publish or unpublish several pages at once.
export const setStorePagesPublished = mutation({
  args: { orgSlug: v.string(), slugs: v.array(v.string()), published: v.boolean() },
  handler: async (ctx, { orgSlug, slugs, published }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    let updated = 0;
    for (const slug of slugs) {
      const row = await ctx.db
        .query("storePages")
        .withIndex("by_org_slug", (q) => q.eq("orgId", org._id).eq("slug", slug))
        .unique();
      if (!row || !inOrg(row, org)) continue;
      await ctx.db.patch(row._id, { published, orgId, updatedAt: Date.now() });
      updated += 1;
    }
    return { updated };
  },
});

// Delete the row: the storefront goes back to the built-in page.
export const deleteStorePage = mutation({
  args: { orgSlug: v.string(), slug: v.string() },
  handler: async (ctx, { orgSlug, slug }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db
      .query("storePages")
      .withIndex("by_org_slug", (q) => q.eq("orgId", org._id).eq("slug", slug))
      .unique();
    if (!row || !inOrg(row, org)) return { deleted: false };
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});
