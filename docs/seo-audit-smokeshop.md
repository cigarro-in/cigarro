# SEO audit: smokeshop.cigarro.in

Live, read-only audit run with curl on 2026-11-13. Storefront code was not changed. Scope: home, 3 category pages, 5 product pages, 2 content pages (1 blog post, /about), /sitemap.xml and /robots.txt. Googlebot and a desktop Chrome UA were both checked. Old Dukaan URLs were tested from `imports/the2935/redirects.csv`.

## Results by check

| Check | Result |
|---|---|
| Status codes (11 sample pages, both UAs) | All 200 |
| Bot vs human HTML | Same byte size for home and product pages. No cloaking seen. |
| SSR headers | `X-SSR: on` on all pages. `x-ssr-cache` mix of hit and miss. |
| Product content in SSR HTML | Name, price, add-to-cart and description present on all 5 products |
| h1 | Present on 10 of 11 pages. **Home has no h1.** |
| Title | Present everywhere. Length 15 to 64 chars. No duplicates in the sample. |
| Brand in titles and schema | Titles, WebSite name and home `<title>` say "Cigarro". Organization schema says "The Smoke Shop". "Cigarro" appears twice in the home title. |
| Meta description | Present on all 11. Two are cut at 160 chars with "..." mid-word (`/category/cigarette`, `/product/sobranie-black-russian-cigarettes`). |
| Canonical | Absolute, same host, self-referencing on all 11. The "3 canonical mismatch" items in SEO_CURRENT_STATE.md did not reproduce in this sample. |
| og:image | Present on all 11. Two products use a hero image instead of a product image (`/product/sobranie-cocktail`). |
| JSON-LD | Product (with Offer, price, InStock, seller) on all 5 products. BreadcrumbList on category, product, blog. Organization and WebSite on every page. |
| Product price | `/product/smoking-slim-long-filters-packet-with-120-tips-white` shows and marks up **Rs 2**. Looks like a data error. |
| Offer URLs | Product offers use `?variant=...` URLs, not the canonical product URL. |
| Image alt | No empty or missing alt on any sample page. |
| noindex | None on any sample page. |
| Sitemap | Valid XML. 97 URLs (63 products, 17 categories, 4 blog posts, 13 static). All on `smokeshop.cigarro.in`. Every sampled URL is listed. Images included. |
| robots.txt | Points to `https://smokeshop.cigarro.in/sitemap.xml`. Disallows admin, api, cart, checkout and account paths. |
| Old Dukaan URLs | **Not redirected.** See below. |

### Old Dukaan URLs

| Old URL (from redirects.csv) | Googlebot UA | Desktop UA | Location header |
|---|---|---|---|
| `/products/classic-mild` | 404 "Page not found" | 200, SPA shell with home title | none |
| `/products/american-spirit-smoking-tobacco` | 404 | 200, SPA shell | none |
| `/blogs/genuine-quality` | 404 | 200, SPA shell | none |

The Convex `redirects:lookup` for `orgSlug=smokeshop` returns `null` for all three paths. The `orgRedirects` rows for this store have not landed in production. The edge middleware reads that table, so no 301 is issued.

## Prioritised fixes

**P0 (ranking loss risk)**
1. Import `imports/the2935/redirects.csv` for the `smokeshop` org (SEO > Redirects) and re-run the three curls. Expect 301 to `/product/...` and `/blog/...`.
2. Unknown product-like paths return a 200 soft 404 to browsers (SPA fallback with the home title, indexable). Return a real 404 status with a not-found title for unmatched routes.
3. Add an h1 to the home page (for example the store name or the main value line).

**P1 (CTR and trust)**
4. Fix the brand. Titles and WebSite name use "Cigarro", Organization uses "The Smoke Shop". Set the title suffix from `siteSettings.seo.titleTemplate` for this store. Remove the duplicate "Cigarro" in the home title.
5. Verify the Rs 2 price on the Slim Long Filters product. If correct, fix the data. If not, correct the price in catalog data. The structured data and the price shown both come from it.
6. Stop cutting meta descriptions mid-word. Truncate at a word boundary, or let the editor control the length. Affected: `/category/cigarette`, `/product/sobranie-black-russian-cigarettes`.
7. Product og:image and JSON-LD image should use the product's own image, not a hero image (`/product/sobranie-cocktail`).

**P2 (cleanup)**
8. Use the canonical product URL in Offer `url` (drop `?variant=`).
9. Fix the h1 typo "Rolling Paper &amp; Accesories" on `/category/rolling-paper`.
10. Blog title "Genuine Quality" (15 chars, no brand). Add a descriptive title and a store suffix.
11. `/blog/genuine-quality` has two BlogPosting blocks. Check that the second is a related post and not the same post.
12. `robots.txt` comment says "Last updated: December 2025". Update or remove.

## Notes
- Sample only: 11 URLs. A full crawl of all 63 product URLs was not run.
- Sitemap product count (63) was not compared with the live active catalog count.
