import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireOrgAdminBySlug, collectInOrg } from "./lib/org";

// ---------- Per-store SEO health (admin read-only) ----------
// Scans the store's own catalog, content, redirects and domains and reports
// SEO problems. Read-only; every check lists its affected items with an admin
// edit link. Thresholds mirror the storefront meta rules (title <= 60,
// description <= 160). Static pages (about, contact, ...) are code-defined,
// not rows, so they are not scanned here.

const TITLE_MAX = 60;
const TITLE_MIN = 30;
const DESC_MAX = 160;
const THIN_WORDS = 50;
const MAX_ITEMS = 100;
const REDIRECT_MAX_HOPS = 10;

type Severity = "high" | "medium" | "low";

type Item = {
  id: string;
  kind: "product" | "category" | "blog" | "redirect" | "domain";
  label: string;
  detail: string;
  adminPath: string;
};

type CheckDef = {
  id: string;
  label: string;
  description: string;
  severity: Severity;
  weight: number;
};

function plainText(s?: string | null): string {
  return (s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function wordCount(s?: string | null): number {
  const t = plainText(s);
  return t ? t.split(" ").length : 0;
}

function textLen(s?: string | null): number {
  return (s ?? "").trim().length;
}

function normTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function makeCheck(def: CheckDef, total: number, items: Item[]) {
  return {
    ...def,
    total,
    affected: items.length,
    items: items.slice(0, MAX_ITEMS),
    truncated: items.length > MAX_ITEMS,
  };
}

export const getSeoHealth = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, { orgSlug }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);

    const allProducts = (await collectInOrg(
      ctx,
      "catalogProducts",
      org,
    )) as Doc<"catalogProducts">[];
    const products = allProducts.filter((p) => p.isActive);
    const categories = (
      (await collectInOrg(ctx, "catalogCategories", org)) as Doc<"catalogCategories">[]
    ).filter((c) => c.isActive !== false);
    const blogs = (
      (await collectInOrg(ctx, "blogPosts", org)) as Doc<"blogPosts">[]
    ).filter((b) => b.status === "published");
    const variants = (
      (await collectInOrg(ctx, "catalogVariants", org)) as Doc<"catalogVariants">[]
    ).filter((x) => x.isActive !== false);
    const variantsByProduct = new Map<string, Doc<"catalogVariants">[]>();
    for (const x of variants) {
      const list = variantsByProduct.get(x.productSupabaseId) ?? [];
      list.push(x);
      variantsByProduct.set(x.productSupabaseId, list);
    }
    const redirects = await ctx.db
      .query("orgRedirects")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const domains = await ctx.db
      .query("orgDomains")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();

    // Normalised entries shared by the title / description / slug checks.
    type Entry = {
      kind: "product" | "category" | "blog";
      id: string;
      name: string; // fallback title (product name, category name, post title)
      slug: string;
      metaTitle?: string;
      metaDescription?: string;
      adminPath: string;
      description?: string; // body text for thin-content checks
    };
    const productEntries: Entry[] = products.map((p) => ({
      kind: "product",
      id: p.supabaseId,
      name: p.name,
      slug: p.slug,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      adminPath: `/products/${p.supabaseId}`,
      description: p.description,
    }));
    const categoryEntries: Entry[] = categories.map((c) => ({
      kind: "category",
      id: c.supabaseId,
      name: c.name,
      slug: c.slug,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      adminPath: `/categories/${c.supabaseId}`,
      description: c.description,
    }));
    const blogEntries: Entry[] = blogs.map((b) => ({
      kind: "blog",
      id: b._id,
      name: b.title,
      slug: b.slug,
      metaTitle: b.metaTitle,
      metaDescription: b.metaDescription,
      adminPath: `/blogs/${b._id}`,
      description: b.content,
    }));
    const entries = [...productEntries, ...categoryEntries, ...blogEntries];

    const toItem = (e: Entry, detail: string): Item => ({
      id: `${e.kind}:${e.id}`,
      kind: e.kind,
      label: e.name,
      detail,
      adminPath: e.adminPath,
    });

    // 1. Meta title / description missing.
    const metaTitleMissing = entries
      .filter((e) => textLen(e.metaTitle) === 0)
      .map((e) => toItem(e, "No meta title; the page falls back to its name."));
    const metaDescMissing = entries
      .filter((e) => textLen(e.metaDescription) === 0)
      .map((e) => toItem(e, "No meta description."));

    // 2. Meta title length (only when an explicit meta title is set).
    const titleTooLong = entries
      .filter((e) => textLen(e.metaTitle) > TITLE_MAX)
      .map((e) => toItem(e, `Meta title is ${textLen(e.metaTitle)} characters (max ${TITLE_MAX}).`));
    const titleTooShort = entries
      .filter((e) => textLen(e.metaTitle) > 0 && textLen(e.metaTitle) < TITLE_MIN)
      .map((e) => toItem(e, `Meta title is ${textLen(e.metaTitle)} characters (min ${TITLE_MIN}).`));

    // 3. Meta description too long.
    const descTooLong = entries
      .filter((e) => textLen(e.metaDescription) > DESC_MAX)
      .map((e) => toItem(e, `Meta description is ${textLen(e.metaDescription)} characters (max ${DESC_MAX}).`));

    // 4. Duplicate titles across products, categories and posts.
    const titleGroups = new Map<string, Entry[]>();
    for (const e of entries) {
      const effective = textLen(e.metaTitle) > 0 ? (e.metaTitle as string) : e.name;
      const key = normTitle(effective);
      if (!key) continue;
      const list = titleGroups.get(key) ?? [];
      list.push(e);
      titleGroups.set(key, list);
    }
    const duplicateTitles: Item[] = [];
    for (const group of titleGroups.values()) {
      if (group.length < 2) continue;
      for (const e of group) {
        duplicateTitles.push(toItem(e, `Same title as ${group.length - 1} other page(s).`));
      }
    }

    // 5. Duplicate slugs within each content type.
    const duplicateSlugs: Item[] = [];
    for (const list of [productEntries, categoryEntries, blogEntries]) {
      const bySlug = new Map<string, Entry[]>();
      for (const e of list) {
        const arr = bySlug.get(e.slug) ?? [];
        arr.push(e);
        bySlug.set(e.slug, arr);
      }
      for (const group of bySlug.values()) {
        if (group.length < 2) continue;
        for (const e of group) {
          duplicateSlugs.push(toItem(e, `Slug "${e.slug}" is used ${group.length} times.`));
        }
      }
    }

    // 6. Products without images, and images without alt text.
    const productsWithImages = new Set<string>();
    const noImages: Item[] = [];
    const missingAlt: Item[] = [];
    for (const p of products) {
      const vs = variantsByProduct.get(p.supabaseId) ?? [];
      const withImg = vs.filter((x) => (x.images ?? []).some(Boolean));
      if (withImg.length === 0) {
        noImages.push({
          id: `product:${p.supabaseId}`,
          kind: "product",
          label: p.name,
          detail: "No product image on any active variant.",
          adminPath: `/products/${p.supabaseId}`,
        });
        continue;
      }
      productsWithImages.add(p.supabaseId);
      const noAlt = withImg.filter((x) => textLen(x.imageAltText) === 0);
      if (noAlt.length > 0) {
        missingAlt.push({
          id: `product:${p.supabaseId}`,
          kind: "product",
          label: p.name,
          detail: `${noAlt.length} variant(s) with images have no alt text.`,
          adminPath: `/products/${p.supabaseId}`,
        });
      }
    }

    // 7. Thin content (under 50 words).
    const thin = entries
      .filter((e) => wordCount(e.description) < THIN_WORDS)
      .map((e) => toItem(e, `${wordCount(e.description)} words (min ${THIN_WORDS}).`));

    // 8. Out-of-stock products that are still active (and so indexed and in the sitemap).
    const outOfStock: Item[] = [];
    for (const p of products) {
      const vs = variantsByProduct.get(p.supabaseId) ?? [];
      if (vs.length === 0) continue;
      const allEmpty = vs.every((x) => x.trackInventory === true && (x.stock ?? 0) <= 0);
      if (!allEmpty) continue;
      outOfStock.push({
        id: `product:${p.supabaseId}`,
        kind: "product",
        label: p.name,
        detail: "Every variant is out of stock but the product is still active.",
        adminPath: `/products/${p.supabaseId}`,
      });
    }

    // 9. Redirect chains, loops and missing targets.
    const redirectMap = new Map<string, { to: string; status: number }>();
    for (const r of redirects) {
      if (r.status === 410) continue;
      redirectMap.set(r.fromPath, { to: r.toPath, status: r.status });
    }
    const activeSlugs = {
      product: new Set(products.map((p) => p.slug)),
      category: new Set(categories.map((c) => c.slug)),
      blog: new Set(blogs.map((b) => b.slug)),
    };
    const chainItems: Item[] = [];
    const targetItems: Item[] = [];
    for (const r of redirects) {
      const seen = new Set<string>([r.fromPath]);
      let cur = r.toPath;
      let hops = 1;
      let loop = false;
      if (cur === r.fromPath) loop = true;
      while (!loop && redirectMap.has(cur) && hops <= REDIRECT_MAX_HOPS) {
        if (seen.has(cur)) {
          loop = true;
          break;
        }
        seen.add(cur);
        cur = redirectMap.get(cur)!.to;
        hops++;
      }
      if (loop) {
        chainItems.push({
          id: `redirect:${r._id}`,
          kind: "redirect",
          label: r.fromPath,
          detail: `Redirect loop through ${r.toPath}.`,
          adminPath: "/seo/redirects",
        });
      } else if (hops > 1) {
        chainItems.push({
          id: `redirect:${r._id}`,
          kind: "redirect",
          label: r.fromPath,
          detail: `Chain of ${hops} redirects ends at ${cur}. Point it straight at the final URL.`,
          adminPath: "/seo/redirects",
        });
      }

      if (r.status === 410) continue;
      const m = /^\/(product|category|blog)\/([^/?#]+)/.exec(r.toPath);
      if (m) {
        const kind = m[1] === "product" ? "product" : m[1] === "category" ? "category" : "blog";
        const set = activeSlugs[kind];
        if (!set.has(decodeURIComponent(m[2]))) {
          targetItems.push({
            id: `redirect:${r._id}`,
            kind: "redirect",
            label: r.fromPath,
            detail: `Target ${r.toPath} is missing or inactive.`,
            adminPath: "/seo/redirects",
          });
        }
      }
    }
    const redirectActive = redirects.filter((r) => r.status !== 410).length;

    // 10. Domain status: primary must be active; any unhealthy domain is listed.
    const primary = domains.find((d) => d.kind === "primary") ?? null;
    const domainItems: Item[] = [];
    if (!primary) {
      domainItems.push({
        id: "domain:none",
        kind: "domain",
        label: "No primary domain",
        detail: "The store has no primary domain row, so canonical URLs have no host.",
        adminPath: "/settings",
      });
    }
    for (const d of domains) {
      if (d.status === "active") continue;
      const isPrimary = d.kind === "primary";
      domainItems.push({
        id: `domain:${d._id}`,
        kind: "domain",
        label: d.hostname,
        detail: `${isPrimary ? "Primary" : "Alias"} domain status is ${d.status}.`,
        adminPath: "/settings",
      });
    }
    const domainTotal = Math.max(1, domains.length);

    const defs: CheckDef[] = [
      { id: "meta_title_missing", label: "Meta title missing", description: "Page has no meta title, so the name is used as the title.", severity: "high", weight: 3 },
      { id: "meta_description_missing", label: "Meta description missing", description: "No meta description, so search engines write their own snippet.", severity: "high", weight: 3 },
      { id: "title_too_long", label: "Meta title too long", description: `Meta title over ${TITLE_MAX} characters is cut off in results.`, severity: "medium", weight: 1 },
      { id: "title_too_short", label: "Meta title too short", description: `Meta title under ${TITLE_MIN} characters says little about the page.`, severity: "low", weight: 1 },
      { id: "description_too_long", label: "Meta description too long", description: `Meta description over ${DESC_MAX} characters is truncated.`, severity: "medium", weight: 2 },
      { id: "duplicate_titles", label: "Duplicate titles", description: "Two or more pages share the same title.", severity: "high", weight: 2 },
      { id: "duplicate_slugs", label: "Duplicate slugs", description: "Two or more pages of one type share a slug.", severity: "high", weight: 2 },
      { id: "product_no_images", label: "Products without images", description: "Active products with no image on any variant.", severity: "high", weight: 3 },
      { id: "image_alt_missing", label: "Images without alt text", description: "Product images with no alt text on the variant.", severity: "medium", weight: 2 },
      { id: "thin_content", label: "Thin content", description: `Descriptions or post bodies under ${THIN_WORDS} words.`, severity: "medium", weight: 1 },
      { id: "out_of_stock_indexed", label: "Out-of-stock products still indexed", description: "Active products whose variants are all out of stock.", severity: "medium", weight: 3 },
      { id: "redirect_chains", label: "Redirect chains and loops", description: "Redirects that pass through other redirects, or loop.", severity: "high", weight: 2 },
      { id: "redirect_targets_missing", label: "Redirects to missing pages", description: "Redirect targets that no longer exist or are inactive.", severity: "medium", weight: 1 },
      { id: "domain_status", label: "Domain status", description: "Primary domain must be active; aliases should be active.", severity: "high", weight: 3 },
    ];

    const checks = [
      makeCheck(defs[0], entries.length, metaTitleMissing),
      makeCheck(defs[1], entries.length, metaDescMissing),
      makeCheck(defs[2], entries.length, titleTooLong),
      makeCheck(defs[3], entries.length, titleTooShort),
      makeCheck(defs[4], entries.length, descTooLong),
      makeCheck(defs[5], entries.length, duplicateTitles),
      makeCheck(defs[6], entries.length, duplicateSlugs),
      makeCheck(defs[7], products.length, noImages),
      makeCheck(defs[8], productsWithImages.size, missingAlt),
      makeCheck(defs[9], entries.length, thin),
      makeCheck(defs[10], products.length, outOfStock),
      makeCheck(defs[11], redirects.length, chainItems),
      makeCheck(defs[12], redirectActive, targetItems),
      makeCheck(defs[13], domainTotal, domainItems),
    ];

    // Weighted score: each check contributes its weight times the share of
    // items that pass. A check with nothing to test counts as passing.
    let weighted = 0;
    let weightSum = 0;
    for (const c of checks) {
      weightSum += c.weight;
      const ratio = c.total === 0 ? 1 : 1 - Math.min(1, c.affected / c.total);
      weighted += c.weight * ratio;
    }
    const score = weightSum === 0 ? 100 : Math.round((weighted / weightSum) * 100);

    return {
      orgSlug,
      generatedAt: Date.now(),
      score,
      canonicalHost: primary?.hostname ?? null,
      primaryDomainStatus: primary?.status ?? null,
      counts: {
        products: products.length,
        categories: categories.length,
        blogPosts: blogs.length,
        redirects: redirects.length,
        domains: domains.length,
      },
      sitemap: {
        enabled: true,
        path: "/sitemap.xml",
        urls: products.length + categories.length + blogs.length,
      },
      checks,
    };
  },
});
