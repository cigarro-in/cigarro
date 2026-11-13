import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { collectInOrg, inOrg, requireOrgAdminBySlug, resolveOrg } from "./lib/org";

// Store pages (About, Contact, policies). Each row overrides the built-in
// storefront page with the same slug. No row, or an unpublished row, means the
// storefront keeps rendering the built-in content.
// Keep in sync with STORE_PAGE_SLUGS in src/lib/storePages/catalog.ts.
export const STORE_PAGE_SLUGS = [
  "about",
  "contact",
  "legal",
  "terms",
  "privacy",
  "shipping",
  "returns",
] as const;

function assertKnownSlug(slug: string) {
  if (!(STORE_PAGE_SLUGS as readonly string[]).includes(slug))
    throw new ConvexError({ code: "UNKNOWN_PAGE", slug });
}

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
    page: v.object({
      title: v.string(),
      body: v.string(),
      published: v.boolean(),
      metaTitle: v.optional(v.string()),
      metaDescription: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { orgSlug, slug, page }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    assertKnownSlug(slug);
    if (!page.title.trim()) throw new ConvexError({ code: "TITLE_REQUIRED" });
    const existing = await ctx.db
      .query("storePages")
      .withIndex("by_org_slug", (q) => q.eq("orgId", org._id).eq("slug", slug))
      .unique();
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

// Publish or unpublish several pages at once.
export const setStorePagesPublished = mutation({
  args: { orgSlug: v.string(), slugs: v.array(v.string()), published: v.boolean() },
  handler: async (ctx, { orgSlug, slugs, published }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    let updated = 0;
    for (const slug of slugs) {
      assertKnownSlug(slug);
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
