// One-off / operational data maintenance. Internal only: run from the CLI,
// never exposed to clients. Example:
//   npx convex run --prod maintenance:cleanupCanonicalUrls '{"orgSlug":"oldsmokeshop","dryRun":true}'

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { collectInOrg, inOrg, resolveOrg } from "./lib/org";
import {
  parseCanonicalUrl,
  storeHostSet,
  type CanonicalRef,
} from "./lib/hosts";
import { LEGACY_ORG_SLUG } from "./lib/legacyOrg";

const MAX_DOCS_PER_TABLE = 4000;

type CleanupAction =
  | "clear:not-absolute-https"
  | "clear:unroutable-store-path"
  | "clear:self"
  | "clear:dead-target";

export const cleanupCanonicalUrls = internalMutation({
  args: { orgSlug: v.string(), dryRun: v.boolean() },
  handler: async (ctx, { orgSlug, dryRun }) => {
    const org = await resolveOrg(ctx, orgSlug);

    const domains = await ctx.db
      .query("orgDomains")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const storeHosts = storeHostSet({
      orgSlug: org.slug,
      activeHostnames: domains
        .filter((d) => d.status === "active")
        .map((d) => d.hostname),
      platformRoot: process.env.PLATFORM_ROOT_DOMAIN ?? "cigarro.in",
      defaultOrgSlug: process.env.DEFAULT_ORG_SLUG ?? LEGACY_ORG_SLUG,
    });

    const products = await collectInOrg(ctx, "catalogProducts", org);
    const posts = await collectInOrg(ctx, "blogPosts", org);
    if (products.length >= MAX_DOCS_PER_TABLE || posts.length >= MAX_DOCS_PER_TABLE) {
      throw new Error(`TOO_MANY_DOCS: run per-table batches (limit ${MAX_DOCS_PER_TABLE})`);
    }

    // Active targets, keyed "type:slug". Product = isActive; blog = published.
    const activeTargets = new Set<string>();
    for (const p of products) {
      if (p.isActive === true && inOrg(p, org)) activeTargets.add(`product:${p.slug}`);
    }
    for (const b of posts) {
      if (b.status === "published" && inOrg(b, org)) activeTargets.add(`blog:${b.slug}`);
    }

    const classify = (
      raw: string,
      self: CanonicalRef,
    ): CleanupAction | null => {
      const parsed = parseCanonicalUrl(raw, storeHosts);
      if (parsed.kind === "invalid") return "clear:not-absolute-https";
      if (parsed.kind === "external") return null;
      if (!parsed.ref) return "clear:unroutable-store-path";
      if (parsed.ref.type === self.type && parsed.ref.slug === self.slug) {
        return "clear:self";
      }
      return activeTargets.has(`${parsed.ref.type}:${parsed.ref.slug}`)
        ? null
        : "clear:dead-target";
    };

    const changes: {
      type: "product" | "blog";
      slug: string;
      old: string;
      action: CleanupAction;
    }[] = [];
    let kept = 0;

    for (const p of products) {
      if (p.canonicalUrl === undefined) continue;
      const action = classify(p.canonicalUrl, { type: "product", slug: p.slug });
      if (!action) {
        kept++;
        continue;
      }
      changes.push({ type: "product", slug: p.slug, old: p.canonicalUrl, action });
      if (!dryRun) await ctx.db.patch(p._id, { canonicalUrl: undefined });
    }
    for (const b of posts) {
      if (b.canonicalUrl === undefined) continue;
      const action = classify(b.canonicalUrl, { type: "blog", slug: b.slug });
      if (!action) {
        kept++;
        continue;
      }
      changes.push({ type: "blog", slug: b.slug, old: b.canonicalUrl, action });
      if (!dryRun) await ctx.db.patch(b._id, { canonicalUrl: undefined });
    }

    return {
      orgSlug: org.slug,
      dryRun,
      scanned: { products: products.length, blogPosts: posts.length },
      keptCount: kept,
      changes,
    };
  },
});

