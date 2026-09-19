import { mutation } from "./_generated/server";
import { v } from "convex/values";

// TEMPORARY one-shot content refresh (blog SEO cleanup). Secret-gated,
// single-use: call applyBlogRefresh once via HTTP, then DELETE this file.
// Local CLI has no prod-project access, so prod data moves through this
// deployed mutation (same pattern as the 2026-09-14 backfill incident).
const SECRET = "i82glm1tz43cwsb3c5no7phon3rlojvi2hqmbkjr";

export const applyBlogRefresh = mutation({
  args: {
    secret: v.string(),
    // Full post docs MINUS _id/_creationTime; matched by slug, patched in
    // place (prod _ids/_creationTime/publishedAt/status untouched).
    posts: v.array(v.any()),
    // Full category replacement set (no _id fields).
    categories: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== SECRET) throw new Error("BAD_SECRET");
    let postsUpdated = 0;
    for (const incoming of args.posts as any[]) {
      const { slug, ...patch } = incoming;
      delete (patch as any)._id;
      delete (patch as any)._creationTime;
      const row = await ctx.db
        .query("blogPosts")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!row) throw new Error("POST_NOT_FOUND:" + slug);
      await ctx.db.patch(row._id, patch);
      postsUpdated++;
    }
    const existing = await ctx.db.query("blogCategories").collect();
    for (const c of existing) await ctx.db.delete(c._id);
    for (const c of args.categories as any[]) {
      const doc = { ...c };
      delete doc._id;
      delete doc._creationTime;
      await ctx.db.insert("blogCategories", doc);
    }
    return { postsUpdated, categoriesReplaced: args.categories.length };
  },
});
