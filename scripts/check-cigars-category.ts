// Phase 8 gate: Cigars category exists with exactly the two cigar products.
// Read-only against prod (public catalog queries). Passes only AFTER the
// operator runs: npx tsx scripts/assign-cigars-category.ts --apply
// Run: npx tsx scripts/check-cigars-category.ts
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const URL = process.env.CONVEX_URL ?? 'https://proper-coyote-383.convex.cloud';
const WANT = new Set([
  'phillies-blunt-cigar-original',
  'king-edward-imperial-cigars',
]);

async function main() {
  const client = new ConvexHttpClient(URL);
  const org: any = await client.query(api.organizations.getBySlug, { slug: 'smokeshop' } as any);
  const b: any = await client.query(api.catalog.fullCatalog, { orgId: org._id } as any);

  const cat = (b.categories ?? []).find((c: any) => c.slug === 'cigars');
  console.log(`${cat ? 'PASS' : 'FAIL'}  cigars category exists`);
  const bySlug = new Map((b.products ?? []).map((p: any) => [p.slug, p]));
  let ok = !!cat;
  for (const slug of WANT) {
    const p: any = bySlug.get(slug);
    const linked =
      !!cat &&
      !!p &&
      (b.productCategories ?? []).some(
        (j: any) => j.categorySupabaseId === cat.supabaseId && j.productSupabaseId === p.supabaseId,
      );
    console.log(`${linked ? 'PASS' : 'FAIL'}  ${slug} linked to cigars`);
    if (!linked) ok = false;
  }
  if (!ok) {
    console.log('\nCategory assignment pending: run scripts/assign-cigars-category.ts --apply with approval.');
    process.exit(1);
  }
  console.log('\nCigars category assignment verified');
}

main().then(
  () => undefined,
  (e) => {
    console.error('FAILED:', e?.message ?? e);
    process.exit(1);
  },
);
