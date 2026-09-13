# Handoff — Convex Migration (2026-09-14, late IST)

Remote = `f9838004` (main in sync). Start: read `LEARNINGS.md` + this file + `git log --oneline -8` + `git status`.

## Done this session (pushed `01a616ec`, −15.9k/+582 lines)
- **Wave 4 dead-code harvest**: deleted `src/admin/` (68 files, unrouted), `src/utils/search.ts` (Supabase RPC, zero callers), `src/lib/supabase/homepage.ts` (orphan), `src/hooks/useAdminAuth.tsx` (email+password, zero callers after sidebar moved to phone `useAuth`). Header search is local Fuse.js.
- **Wave 5 `convex/adminCatalog.ts`** (deployed DEV `proper-coyote-383`): owner/admin-gated mutations for brands, categories, collections (+product links), products (+variants+joins in one `saveProduct`), combos (+items), blogs, heroes, sections, components, site settings. Slug-uniqueness enforced. Content rows key on Convex `_id` (no supabaseId on those tables); catalog rows key on supabaseId (UUIDs flow through forms unchanged).
- **Wave 6 catalog admin on Convex**: ProductsPage (joined list + bulk), ProductFormPage (load/save/delete), ProductImportExport (export from props, import via `saveProduct`/group), Brands/Categories/Collections pages + forms, ProductSelector (one query). Dashboard stat tiles NOT yet moved (still Supabase `orders` mirror).
- **Admin subdomain split** (pushed earlier `8afc5ed7`, verify live): `admin.cigarro.in` = phone-gated admin-only app; `cigarro.in/admin*` → homepage; non-admin numbers get deny message. Edge stamps noindex + skips prerender on admin host.

## UNCOMMITTED (content admin — commit + push to ship to PROD)
`convex/adminCatalog.ts` (blog/hero admin lists, bulk status), `BlogsPage`, `BlogFormPage`, `HeroSlideFormPage`, `HomepageManager`, `SettingsManager`, deleted empty `HeroSlidesManager.tsx`. Deployed to DEV only. Build green, dist restored.
- Content admin fully Convex: blog list/form (categories slug-keyed, `_id` routes), heroes (reorder via sort patch), settings (server `updatedBy`), homepage toggles. Dropped dev-only Supabase perf branch + Refresh buttons (reactive queries).
- **Behavior changes (admin-only, intended)**: old Supabase-UUID blog/hero edit URLs 404 → list; brand delete now blocked with message when products exist (`BRAND_IN_USE`); `catalogCategories.isActive` added to schema (absent = active).

## What's NEXT (in order)
1. **Admin**: Discounts, Customers, Dashboard (move stat tiles to Convex orders — fixes stale 0s), Orders pages. Asset/Image pickers still upload to Supabase Storage (reads are URL pass-throughs — fine).
2. **Wave 7 commercial**: new Convex `discounts` table + rewrite `utils/discounts.ts` (both checkouts consume it). **Referrals: founder call** — migrate minimal vs defer. Checkout/address money-path stays Supabase (GPS, untestable — standing deferral).
3. **Wave 8 edge**: `?format=` feeds + search → Convex `fullCatalog`; `invalidate-cache` admin check → memberships; `images/process.js` → R2 (**needs founder R2 upload token**, old one deleted).
4. **Wave 9 auth Phase 2**: own JWT, dual-issuer soak. Forces re-login — tell founder first.
5. **Wave 10/11**: Reviews (Convex-native) + retire (delete backfills, zero Supabase refs, drop anon key, cold backup 90d).

## Standing rules
- One plan-paragraph BEFORE any tools, every prompt. External `curl` verification only (browser UA; bot UA for prerender); never unit tests. `npx convex deploy` → DEV; PROD (`prestigious-bass-64`) via git push only; DATA never syncs.
- Finance freeze (`orders/payments/wallet`); no partial `schema.ts` hand-edits; theme decoupling (`src/themes/*` pure views via `src/hooks/data/`); paise-only-at-boundary; never commit env/`dist`/`opencode.json` (theirs, untracked — leave it).
- Only commit/push when asked. `git checkout -- dist` after builds.
- Convex `patch` + wire format drop `undefined` object values — spreads with optionals are safe (verified pattern, don't "fix").
- `useQuery(..., 'skip')` not used; edit-forms populate once via `populatedRef` + list queries (lists are tiny). Counts use bounded `take(1000)` — materialize counters past ~1k products.
