# What To Do Next — Convex Migration (written 2026-09-14, ~morning IST)

Remote = `2e360779` (main in sync). Start by reading `LEARNINGS.md` +
`CONVEX_MIGRATION_PLAN.md`, then `git log --oneline -8` + `git status`.

## Where things stand
- READS are fully on Convex: storefront (PDP/PLP/category/brand(s)/search/
  home/wishlist), cart rehydration, sitemap + bot HTML + 4 catalog APIs
  (all gated: bot HTML byte-identical except allowlisted PDP related-picks;
  API JSON semantically identical).
- DATA backfilled on DEV (`proper-coyote-383`) and PROD (`prestigious-bass-64`),
  parity ALL OK both waves. Combos table is empty (code handles it).
- STILL on Supabase: admin CRUD writes, auth (session/isAdmin/profiles reads),
  discounts (+usage), desktop CheckoutPage addresses, search RPC/materialized
  view (unused now — header/PLP filter locally), `lib/supabase/homepage.ts`
  (orphan, no importers), storage URL helpers (pure functions, Supabase buckets
  as cold fallback — deliberate, don't touch).

## Do next, in order
1. **Admin mutations** (`convex/catalog.ts` or new `convex/adminCatalog.ts`):
   create/update/delete for products, variants, brands, categories,
   collections (+joins), combos (+items), plus content writes (blogs, heroes,
   section configs, site settings). Mirror backfill shapes; enforce slug
   uniqueness. `npx convex deploy` (goes to DEV).
2. **Admin pages → mutations** (~15 files, all under `src/admin*/`):
   ProductsPage, ProductFormPage, productService, Brands/Categories/
   Collections pages + forms, CombosManager, BlogManager/BlogsPage/
   BlogFormPage, HomepageManager(s), HeroSectionManager, SettingsManager,
   SiteSettingsPage, Discounts + Customers pages (reads of legacy `orders`
   mirror are known-stale — leave). Build-check with `npm run build`;
   restore `dist/` before commit (`git checkout -- dist`).
3. **Phase 2 auth** (riskiest — forces re-login, tell the founder first):
   Pages Function mints our JWT → `convex/auth.config.ts` dual issuer →
   `useAuth` swaps session → retire bridge. Spot-check 5 users' identity
   continuity (phone → same `sub`).
4. **Reviews**: new `productReviews` table (Convex-native) + PDP UI +
   WhatsApp hook. Ratings fields already on catalogProducts.
5. **Retire**: delete `backfillCatalog` after soak; drop Supabase reads when
   zero refs remain outside `functions/` search + CheckoutPage money-path.

## How to verify (non-negotiable)
- Every claim ends in external `curl` with browser UA (bot UA for prerender).
  Never unit tests. `curl > file` writes UTF-16 — convert. GET (not `-I`)
  for cache checks. Inline `python3 -c` with quotes breaks PowerShell —
  use script files in `C:\Users\Ahad\AppData\Local\Temp\opencode\`.
- Convex user-facing checks MUST hit PROD `prestigious-bass-64`
  (`npx convex run` hits DEV). Code auto-deploys to PROD on git push;
  DATA never syncs — backfill per deployment (drivers in Temp).
- No `convex deploy --prod` (flag doesn't exist; token has no prod access).
- Pushes stall transiently → retry `-c http.version=HTTP/1.1`.

## Constraints
- One plan-paragraph BEFORE any tools, every prompt.
- Finance freeze: never touch `convex/{orders,payments,wallet}.ts`.
- No partial hand-edits to `convex/schema.ts` (anchored appends only).
- Theme decoupling: zero Convex/Supabase imports in `src/themes/*`.
- Money: paise integers at order boundary only; catalog in rupees.
- Never commit `.env.local` / `.dev.vars` / `.wrangler/` / `dist/`.
- Only commit/push when asked. Review every diff line.
- **Another session is live in this tree**: uncommitted edits to
  `functions/_middleware.js`, `functions/ssr-middleware.js`, `src/App.tsx`,
  `src/lib/analytics/ga.ts` + untracked `opencode.json` are THEIRS (/returns
  prerender route, GA debug mode). Do not touch, stage, or overwrite them.
- Known allowlisted deltas: PDP bot-HTML related-picks order/set (same
  template, valid links); timestamp µs truncation + `+00:00` vs `Z`;
  hero `created_at/updated_at/id`, blog author email in edge JSON.
- Deferred/documented: CheckoutPage Supabase money-path (GPS + dual
  `addresses`), `pincode_lookup` never migrates, audit_logs 083 unapplied,
  bank-email rail untouchable, admin email+password stays post-cutover.
