# Import: Dukaan store `the2935` → platform store `smokeshop`

Source: `https://mydukaan.io/the2935` (the merchant's own store, "The Smoke Shop").
Target: store slug `smokeshop` (later `smokeshop.co.in`; until then `smokeshop.cigarro.in`).

## What is in this folder

| File | What it is |
|---|---|
| `normalized.json` | The importable export: store, 17 categories (tree via `parentSlugs`/`childSlugs`), 63 products with 114 variants, home hero, 8 pages, 4 blog posts. Input to the `/sa` importer. |
| `raw/products/*.json` | Raw product payload per product, exactly as the storefront received it (plus the store object). |
| `raw/collections/*.json` | Raw listing payload per category (product slugs, intro HTML, subcategory links). |
| `raw/sitemap.xml`, `fetch-log.json` | Sitemap as served, and every request the crawl made (URL, status, bytes). |
| `redirects.csv` | 301 map, custom-domain paths (`/products/x` → `/product/x`). Import via **SEO → Redirects** once `smokeshop.co.in` points here. |
| `redirects-mydukaan.csv` | Same map as full `mydukaan.io` URLs → `https://smokeshop.co.in…`. Reference only: Dukaan's host is not ours to redirect. |
| `raw/html/`, `raw/pages/`, `raw/blogs/` | Raw HTML snapshots. Git-ignored (about 27 MB); regenerate with the crawler. |
| `images/` | Converted WebP originals + `image-manifest.json`. Git-ignored; regenerate with `images.mjs download`. |
| `image-map.json` | Old Dukaan image URL → new R2 CDN URL. Produced by `images.mjs upload`. |

## Counts (from the crawl)

- Categories: 17 (collections, excluding Dukaan's virtual "all" listing)
- Products: 63; variants: 114 (each Dukaan SKU becomes one variant)
- Product images referenced: see `normalized.json` (all unique `dms.mydukaan.io` URLs are in `images/image-manifest.json`)
- Blog posts: 4 (one Dukaan sitemap entry returns 404 on the live site and is redirected to `/blogs`)
- Static pages: 8 (kept as unpublished drafts; see gaps)
- URLs in the sitemap: 95; URLs the crawl fetched: 102 (incl. home, collections index, and 6 non-content URLs)

## Re-running the crawl

```bash
node scripts/dukaan-import/crawl.mjs imports/the2935
node scripts/dukaan-import/images.mjs download imports/the2935/normalized.json imports/the2935/images
node scripts/dukaan-import/redirects.mjs imports/the2935/normalized.json imports/the2935 smokeshop.co.in
```

The crawler is sequential with a 1.2 s delay and a normal browser user agent. Image download uses a 1 s delay.

## Going live (steps for the operator)

1. **Create the store.** Only after `oldsmokeshop` rename has shipped. In `/sa` → Stores → Create: slug `smokeshop`, name `The Smoke Shop`. This also provisions `smokeshop.cigarro.in`.
2. **Upload images.** Needs a store-admin token for `smokeshop` (the upload endpoint checks store admin on the store's host):
   ```bash
   STORE_ORIGIN=https://smokeshop.cigarro.in IMPORT_TOKEN=<store admin cigarro_token> \
     node scripts/dukaan-import/images.mjs upload imports/the2935/images imports/the2935/image-map.json
   ```
   Re-running is safe: entries already in `image-map.json` are skipped.
3. **Import the catalog.** `/sa` → Stores → `smokeshop` → "Import catalog (Dukaan)". Choose `normalized.json` and `image-map.json`, check the plan, run. Re-running updates rows in place (keys are `dukaan:the2935:<kind>:<id>`).
4. **Check.** Open `smokeshop.cigarro.in` and a product page; the theme is activated by the import (`activeTheme: vivid`).
5. **Redirects.** SEO → Redirects → import `redirects.csv`. Do this before the domain moves.
6. **Domain.** Add `smokeshop.co.in` in `/sa` → Domains, point DNS, then set it primary. Submit the sitemap and watch GSC coverage for 14 days.

## Known gaps

- **Catalog categories are flat in the schema.** The tree (`parentSlugs`/`childSlugs`) is kept in `normalized.json` but not in the database yet. Product memberships include all ancestors, matching Dukaan's listing behaviour.
- **Static pages are drafts.** Dukaan's `about-us`, `privacy-policy`, `terms-conditions` and `refund-policy` map to `/about`, `/privacy`, `/terms`, `/returns`, but those routes read from code, not from the database. The copy is stored as draft blog posts (`categorySlug: static-page`) so it is not lost. FAQ, bestseller, ratings and the notice page have no matching route yet. Their redirects point to the nearest page.
- **Brand.** Dukaan does not expose brands, so products have none.
- **Hero.** Imported as one slide from the home hero, with the first of its three images.
- **Dead URLs.** `/blogs/%2Fbuy-international-cigarettes-online-india` and `/pages/important-notice:-beware-of-scammers!` return 404 on Dukaan. They are redirected to the nearest listing.
- **Images.** Dukaan has no WebP originals for most images, so each is converted with `sharp` (dev dependency). Quality 84.
- **Prices.** Dukaan stores whole rupees. The catalog schema is also in rupees, so no paise conversion happens for catalog rows (orders and wallet stay in paise).
