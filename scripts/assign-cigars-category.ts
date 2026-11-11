// Phase 8: idempotent Cigars category + product assignment (PROD DATA OP).
// Reads are public; --apply needs a catalog-admin JWT in CIGARRO_ADMIN_JWT.
//   npx tsx scripts/assign-cigars-category.ts --dry-run   (read-only, safe now)
//   npx tsx scripts/assign-cigars-category.ts --apply     (needs auth + explicit approval)
// Uses only the validated admin mutations (createCategory, setCategoryProducts)
// via find-by-slug-first idempotency. Never touches prices/variants/images.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL =
  process.env.CONVEX_URL ?? "https://proper-coyote-383.convex.cloud";
const APPLY = process.argv.includes("--apply");
// Optional: category tile icon (CDN URL). Passed through on create,
// patched on if the category already exists without it.
const IMAGE_URL = process.env.IMAGE_URL || undefined;

const CATEGORY = {
  name: "Cigars",
  slug: "cigars",
  description: "Premium hand-rolled cigars — Phillies Blunt and King Edward.",
  metaTitle: "Buy Cigars Online in India | Cigarro",
  metaDescription: "Shop premium cigars online in India. Phillies Blunt and King Edward Imperial with secure delivery.",
};

const PRODUCT_SLUGS = [
  "phillies-blunt-cigar-original",
  "king-edward-imperial-cigars",
];

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL);
  if (APPLY) {
    const jwt = process.env.CIGARRO_ADMIN_JWT;
    if (!jwt) throw new Error("CIGARRO_ADMIN_JWT required for --apply");
    client.setAuth(jwt);
  }

  // Catalog is global/public — no org scoping needed for reads.
  const bundle: any = await client.query(api.catalog.fullCatalog, {} as any).catch(
    async () => {
      // fullCatalog may require orgId on this deployment; resolve it publicly.
      const org: any = await client.query(api.organizations.getBySlug, {
        slug: process.env.VITE_ORG_SLUG ?? "smokeshop",
      } as any);
      return client.query(api.catalog.fullCatalog, { orgId: org._id } as any);
    },
  );
  const categories: any[] = bundle.categories ?? [];
  const products: any[] = bundle.products ?? [];
  const joins: any[] = bundle.productCategories ?? [];

  const existing = categories.find((c) => c.slug === CATEGORY.slug);
  console.log(`category '${CATEGORY.slug}': ${existing ? `EXISTS (${existing.supabaseId})` : "missing"}`);

  // Resolve products by SLUG (stable). The audit's recorded Convex _ids
  // proved stale against live prod — never hardcode row ids here.
  const productSupabaseIds: string[] = [];
  for (const slug of PRODUCT_SLUGS) {
    const p = products.find((x) => x.slug === slug);
    console.log(`product '${slug}': ${p ? `OK (${p.name}, supabaseId=${p.supabaseId}, active=${p.isActive})` : "MISSING"}`);
    if (!p) throw new Error(`product slug '${slug}' not found — aborting`);
    if (p.isActive === false) throw new Error(`product '${slug}' is inactive — aborting`);
    const rels = joins.filter((j) => j.productSupabaseId === p.supabaseId);
    console.log(`  current relations: [${rels.map((j) => j.categorySupabaseId).join(", ") || "none"}]`);
    productSupabaseIds.push(p.supabaseId);
  }

  let categoryId = existing?.supabaseId as string | undefined;
  if (!categoryId) {
    if (!APPLY) {
      console.log("dry-run: would create category + link 2 products. Re-run with --apply.");
      return;
    }
    const created: any = await client.mutation(api.adminCatalog.createCategory, {
      ...CATEGORY,
      ...(IMAGE_URL ? { image: IMAGE_URL, imageAltText: "Premium hand-rolled cigars" } : {}),
    });
    categoryId = created.supabaseId;
    console.log(`created category (${categoryId})`);
  } else if (IMAGE_URL && (existing as any)?.image !== IMAGE_URL) {
    if (!APPLY) {
      console.log("dry-run: would patch existing category image. Re-run with --apply.");
    } else {
      const e: any = existing;
      await client.mutation(api.adminCatalog.updateCategory, {
        supabaseId: categoryId,
        patch: {
          name: e.name,
          slug: e.slug,
          description: e.description,
          image: IMAGE_URL,
          imageAltText: "Premium hand-rolled cigars",
          metaTitle: e.metaTitle,
          metaDescription: e.metaDescription,
        },
      });
      console.log("patched category image.");
    }
  }

  const linked = joins
    .filter((j) => j.categorySupabaseId === categoryId)
    .map((j) => j.productSupabaseId)
    .sort();
  const want = [...productSupabaseIds].sort();
  if (JSON.stringify(linked) === JSON.stringify(want)) {
    console.log("relations already exact — nothing to do (idempotent no-op).");
    return;
  }
  if (!APPLY) {
    console.log(`dry-run: would setCategoryProducts(${categoryId}, 2 products). Currently linked: [${linked.join(", ") || "none"}]`);
    return;
  }
  await client.mutation(api.adminCatalog.setCategoryProducts, {
    supabaseId: categoryId,
    productSupabaseIds,
  });
  console.log("linked 2 products to Cigars.");
}

main().then(
  () => console.log("done"),
  (e) => {
    console.error("FAILED:", e?.message ?? e);
    process.exit(1);
  },
);
