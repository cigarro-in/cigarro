# Cigarro SEO current state

**Updated:** 2026-09-20

**Purpose:** durable handoff for future sessions. Read this before starting SEO work.
**Precedence:** this file records the current state. `SEO Audits/` is historical evidence and `03-consolidated-final-audit-2026-09-10.md` is the pre-fix baseline, not a current task list.

## Objective and success condition

Cigarro should present one truthful, consistent business and catalog to users, Google, Bing, and AI search systems. Canonical/indexable URLs must agree across internal links, sitemap entries, HTML canonicals, structured data, and machine feeds. Important pages must be reachable through crawlable links and must not depend on invented business facts.

## Current production shape

Verified against `https://cigarro.in` on 2026-09-20:

- Sitemap is valid XML with 61 URLs: 23 products, 15 brands, 2 categories, 8 articles, and 13 static pages.
- All 23 sitemap product entries include images.
- Apex homepage returns 200.
- `www` returns 301 to the apex host and preserves the canonical host policy.
- Bare `/blog` returns 301 to `/blogs`.
- Missing catalog slugs return a branded HTTP 404 with `noindex` to crawler UAs.
- `/og-default.jpg` returns a real JPEG.
- Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, GPTBot, Claude, Perplexity, Applebot, and other known crawlers are recognized by the edge renderer. `robots.txt` also permits public crawling through its wildcard rule.
- Product crawler HTML exposes product/offer, shipping, return-policy, brand, and breadcrumb data. JSON and Markdown alternates are available.
- GA4 code exists and uses `VITE_GA_MEASUREMENT_ID`; it initializes with consent denied and loads after consent. Whether the production environment variable and property are currently receiving data still requires account-side confirmation.

## Closed work — do not reopen without evidence of regression

These findings from the 9–10 September audits were implemented and production-verified on 11 September or in later commits:

- `www`/apex duplication and failed `www` host.
- Bot-facing soft 404s for missing product, brand, category, and article slugs.
- Catch-all route rendering the homepage instead of a noindex Not Found page.
- Bare `/blog` crawler trap.
- Default product offer choosing the wrong variant or lying about stock.
- Duplicate product price metadata.
- Missing visible variant labels and carton offer details in crawler HTML.
- Missing breadcrumb markup and visible breadcrumb navigation on catalog/article pages.
- Broken `/logo.png` social image target; replaced by `/og-default.jpg`.
- Missing crawler-readable product specifications, brand links, related products, and full article bodies.
- No crawlable fallback links in the human SPA shell; homepage now has a noscript catalog summary.
- Inconsistent carton quantities/MRPs and generic descriptions in the pre-Convex catalog.
- Missing AI entry points. `/agents`, `llms.txt`, `?format=json`, and `?format=md` now exist.
- Missing analytics implementation. GA4 support is now in the codebase.

Relevant shipped commits include `864bd98f`, `27e290aa`, `60391c3d`, `3abea745`, `1a7f8d1d`, `1a30491b`, `8b514962`, `6c657d77`, `6a2fb82b`, `2f14dd42`, `34ff1d31`, and `f9838004`.

## Open work — current priorities only

### P0. Repair three post-migration canonical regressions

The sitemap/internal URL returns 200, but its declared canonical returns 404:

| Live/sitemap URL | Current declared canonical (404) |
| --- | --- |
| `/product/elements-filter-tips` | `/product/elements-rolling-tips` |
| `/product/dunhill-international` | `/product/dunhill-international-silver` |
| `/product/esse-black-golden-leaf` | `/product/esse-black-super-slim` |

Likely cause: Convex product `slug` and migrated `canonicalUrl` disagree. Fix the catalog data or implement an intentional redirect, then require one URL to match internal links, sitemap, canonical, structured data, and machine feeds. Do not patch only the HTML template.

### Completed 2026-09-20. Truthful company and support information

- Replaced the fabricated About timeline, team, dates, store, statistics and awards with direct customer-focused copy and catalogue links.
- Replaced the simulated Contact form, placeholder phone, fake address and expert/live-chat claims with the published `support@cigarro.in` channel.
- Aligned Terms, Privacy, Shipping, Returns and the Legal hub around one support address and the actual 2026-09-20 revision date; removed unverified operational guarantees.
- Updated shared SEO defaults, homepage descriptions, `llms.txt`, the web manifest and crawler-rendered About/Contact content to remove “premier,” authenticity and fake-expertise claims.

Still needed before expanding Organization schema: the real public legal business name and any public address or social profiles the business is prepared to publish. Do not invent missing facts.

### P1. Strengthen crawler-facing hub pages; do not run another discovery audit

Current Googlebot responses for `/`, `/products`, `/brands`, `/categories`, and `/blogs` are separate compact templates. The homepage crawler response has roughly 260 visible characters and zero links; the other hub templates are similarly thin and contain zero internal links. Category, brand, product, and article detail templates are materially better.

This is the unfinished part of audit finding T5. Preferred long-term fix: universal SSR/static rendering or hydration with materially equivalent content for users and crawlers. Safe interim fix: shared server-rendered navigation and truthful hub content linking homepage → categories/brands/key products/articles, and each hub → its children. Keep crawler and user copy equivalent.

### P1. Revalidate search-platform state after the migration

The saved GSC performance export covers 2025-10-05 through 2026-09-06:

- 31 clicks and 490 impressions total.
- Peak: 6 clicks / 29 impressions at position 1.0 on 2025-11-04.
- Last 30 exported days: 2 clicks / 252 impressions.
- India generated all 31 clicks.
- Mobile: 31 clicks / 139 impressions, average position 7.43.
- Desktop: 0 clicks / 349 impressions, average position 51.93.
- The historical HTTP homepage received 9 clicks at position 1.38 while the HTTPS homepage averaged position 41.36. Redirect/canonical fixes are now live, so this should be monitored rather than rediscovered.

The 2026-09-10 Merchant Listings export showed no critical errors and four non-critical field warnings across five items. Shipping and return-policy schema was subsequently added. Confirm the current GSC validation state rather than treating the old warnings as still open.

Manual/account work still needing confirmation:

- Google Search Console: sitemap last-read state, Page Indexing report, and URL inspection for homepage, products, one category, one brand, and one product.
- Bing Webmaster Tools: ownership, sitemap submission/last-read state, and indexing coverage. A public Bing `site:cigarro.in` check on 2026-09-20 showed no visible results.
- Consider IndexNow after Bing verification for product/article create, update, and delete events.
- Confirm GA4 Realtime receives a consented page view in production.

### P2. Content/data cleanup after P0/P1

- `Marlboro Double Mix` is the only current product feed entry with no description or specifications; the other 22 products have descriptions and specs.
- Rewrite `public/llms.txt` as a neutral factual contract. Fix the incorrect `/brands/[slug]` example (real route: `/brand/:slug`) and remove unsupported instructions/claims. Keep live prices out of prose; machine feeds remain authoritative.
- Add truthful, useful category/brand introductions based on actual inventory and query intent. Do not create taxonomy pages without real products.
- Link articles contextually to relevant category, brand, and product pages. Seven current articles have 7–21 crawler links; “The Global History of Cigarettes” has only 2.
- Build independent authority through real citations, reviews, profiles, and mentions. Schema and `llms.txt` cannot substitute for third-party trust.
- Update pinned static sitemap `lastmod` only when static content materially changes.

## Known constraints and decisions

- Tobacco promotion and compliance require specialist legal review. Repository notes are risk flags, not legal advice.
- Do not add fictional founders, dates, store locations, certifications, guarantees, or customer statistics.
- Do not restart with keyword stuffing or bulk articles. Fix truth, canonical consistency, hub hierarchy, and measurement first.
- Preserve theme decoupling and the Convex/R2 architecture described in `AGENTS.md`.
- The working tree contains extensive unrelated user changes. SEO edits must stay narrow and must not overwrite them.
- `SEO Audits/` is intentionally git-ignored. It contains useful raw evidence locally, but this tracked file is the portable continuation record.

## Evidence and verification already available

- Historical audit: `SEO Audits/03-consolidated-final-audit-2026-09-10.md`
- Ranking-collapse analysis: `SEO Audits/evidence/collapse-memo-2026-09-10.md`
- Production before/after proof: `SEO Audits/evidence/post-deploy-2026-09-11/SUMMARY.md`
- Offer verification: `SEO Audits/evidence/fix-offers-2026-09-10/RESULTS.md`
- 404 verification: `SEO Audits/evidence/fix-404-2026-09-10/RESULTS.md`
- `/blog` redirect verification: `SEO Audits/evidence/blog301-2026-09-10/RESULTS.md`
- Historical GSC exports: `SEO Audits/gsc/`

## Exact next action

Fix and deploy the three canonical regressions first. Verify each sitemap URL returns 200 with a self-referencing canonical and that the canonical URL also returns 200. Then implement the truthful About/Contact/entity cleanup across both React and crawler templates. Only after those changes should GSC/Bing validations be resubmitted.
