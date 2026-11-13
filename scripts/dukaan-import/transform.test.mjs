// node --test scripts/dukaan-import/transform.test.mjs
// Checks the Dukaan → platform mapping against the crawled export in imports/the2935.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImportPlan, mapSourcePath, rewriteHtml } from '../../src/lib/storeImport/dukaan.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const normPath = path.join(here, '..', '..', 'imports', 'the2935', 'normalized.json');
const SRC = 'the2935';

test('path mapping covers every Dukaan route family', () => {
  assert.equal(mapSourcePath('/the2935', SRC), '/');
  assert.equal(mapSourcePath('https://mydukaan.io/the2935/shop', SRC), '/products');
  assert.equal(mapSourcePath('/the2935/collections', SRC), '/categories');
  assert.equal(mapSourcePath('/the2935/collections/all', SRC), '/products');
  assert.equal(mapSourcePath('/the2935/collections/cigarette', SRC), '/category/cigarette');
  assert.equal(mapSourcePath('/the2935/products/marlboro-red/', SRC), '/product/marlboro-red');
  assert.equal(mapSourcePath('/the2935/blogs', SRC), '/blogs');
  assert.equal(mapSourcePath('/the2935/blogs/genuine-quality', SRC), '/blog/genuine-quality');
  assert.equal(mapSourcePath('/the2935/pages/about-us', SRC), '/about');
  assert.equal(mapSourcePath('/the2935/pages/refund-policy', SRC), '/returns');
  assert.equal(mapSourcePath('/the2935/pages/unknown-page', SRC), '/legal');
});

test('rewriteHtml maps images, internal links and demotes h1', () => {
  const html = '<h1>Title</h1><a href="/the2935/products/x">x</a><img src="https://dms.mydukaan.io/a.webp">';
  const out = rewriteHtml(html, { 'https://dms.mydukaan.io/a.webp': 'https://cdn.cigarro.in/k.webp' }, SRC);
  assert.equal(out, '<h2>Title</h2><a href="/product/x">x</a><img src="https://cdn.cigarro.in/k.webp">');
});

test('plan from the real export: counts, idempotent keys, no empty categories', { skip: !fs.existsSync(normPath) }, () => {
  const norm = JSON.parse(fs.readFileSync(normPath, 'utf8'));
  const plan = buildImportPlan(norm, {}, { storeSlug: 'smokeshop', activeTheme: 'dukaan' });
  assert.equal(plan.counts.products, norm.products.length);
  assert.equal(plan.counts.categories, norm.collections.length);
  const keys = new Set(plan.products.map((p) => p.sourceKey));
  assert.equal(keys.size, plan.products.length, 'product source keys are unique');
  for (const p of plan.products) {
    assert.ok(p.variants.length > 0, `${p.slug} has a variant`);
    assert.equal(p.variants.filter((v) => v.isDefault).length, 1, `${p.slug} has one default variant`);
    for (const k of p.categorySourceKeys) assert.ok(plan.categories.some((c) => c.sourceKey === k));
  }
  // Dukaan prices are whole rupees and must stay rupees in the catalog.
  const marlboro = plan.products.find((p) => p.slug === 'marlboro-red');
  assert.ok(marlboro);
  assert.equal(marlboro.variants.find((v) => v.isDefault).priceRupees, 4800);
  // Hero CTA points at our listing, not Dukaan's path.
  assert.equal(plan.heroSlides[0]?.buttonUrl, '/products');
});
