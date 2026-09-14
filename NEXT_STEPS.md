# Handoff — Convex Migration (2026-09-14, post-push)

Remote = `f41b2216` (all pushed). PROD Convex live + seeded.
⚠️ OPEN: PROD Pages still serving OLD edge functions (see bottom).
Start: read `LEARNINGS.md` + this file + `git log --oneline -8` + `git status`.

## Shipped earlier (pushed `30ff2d48`)
Content admin on Convex (blogs/heroes lists, blog/hero forms, homepage +
settings managers). Deployed DEV, build green.

## Done this session (committed, NOT pushed — one big push at the end)
- **R2 uploads** (needs `ASSETS` binding live on Pages — founder confirmed):
  new `functions/api/images/upload.js` (GET list / POST store / DELETE, admin-gated
  via `checkMyAdmin`, bucket `cigarro-assets`, CDN `https://cdn.cigarro.in`, keys
  under `asset_images/`); `process.js` repointed Supabase→R2 (same contract).
  New `src/lib/images/upload.ts`: canvas → WebP q0.82 ≤1600px (redraw strips
  EXIF/GPS), `humanizeAlt`, session-token authed calls; `uploadRawToR2` for
  video/pdf/zip. `ImagePicker`/`AssetManager`/`ProductImageSearchModal` fully off
  Supabase Storage (only `supabase.auth.getSession` for the token remains —
  moves in auth Phase 2). Alt tags: variant `image_alt_text` input added,
  auto-default "{Product} {Variant}" on save, PDP + card prefer it.
  Live DB URLs all under `asset_images/` (71 sampled) — `images/` is legacy.
- **Referrals minimal on Convex** (DEV deployed): new `referrals` table (GLOBAL,
  snake_case, rupees, ms dates) + `convex/referrals.ts` — `ensureMyReferral`
  (lazy row creation, replaces the auth trigger), subject-scoped reads
  (`getMyReferral`, `checkEligibility`, `checkIfReferred`, stats, referred list,
  leaderboard), public `validateReferralCode`, `recordReferral`/`attachReferralLate`
  with 040 RPC semantics (self-check, already-referred check, referrer counter).
  Backfilled DEV (3 rows, zero activity); temp backfill removed after.
  `referralService.ts` same signatures via shared client; `MobileCheckoutPage`
  eligibility + late-attach on Convex. Reward payout never existed server-side —
  flags carried, nothing invented. `getReferralStats` returns zero-stats (not
  null) for row-less users.
- **`ad85f9c6` Discounts on Convex** (DEV `proper-coyote-383` deployed):
  new `discounts` table (GLOBAL, rupees, ms dates, snake_case) + `convex/discounts.ts`
  (admin CRUD gated `NOT_DISCOUNT_ADMIN`, public `listActiveDiscounts`,
  case-insensitive `getDiscountByCode`, `registerUse`). Backfilled DEV from
  Supabase (1 row: "Lucky" 10% code 2FW3A5FI, scheduled Dec 2026).
  `DiscountsPage`/`DiscountFormPage` Convex (`_id` routes, `CODE_TAKEN` surfacing);
  `utils/discounts.ts` via shared `convex` client (same signatures).
  Behavior fix: coupons actually validate now (Supabase compared lower-vs-UPPER
  and never matched; RPC likewise). Checkout money-path untouched (display only).
- **`ad85f9c6` Dashboard + Customers on Convex**: new `convex/adminStats.ts`
  (`getDashboardStats`, `listCustomersForAdmin`, `getCustomerForAdmin` —
  org-gated, bounded take(1000), rupees out). Dashboard tiles read Convex orders
  (fixes stale 0s) + catalog counts + users. Customers = Convex users + order
  aggregates; route ids unchanged (userId = auth UUID).
  Behavior change (admin-only, intended): block/activate toggle DROPPED —
  Supabase `profiles` never had a `status` column (verified: all migrations
  read — effective cols are id/email/phone/phone_verified_at/name/is_admin),
  so the toggle always failed. Role badge now from memberships.
  Also fixes: old dashboard used `profiles.full_name` (column never existed).
- **`9a710997` Edge on Convex**: `fetchProductData`/`fetchSearchResults` in
  `ssr-middleware.js` via `catalog:getProductBySlug`/`relatedProductLinks`/
  `fullCatalog` (extended with combos); `fallbackSearchRows` + RPC deleted;
  Supabase import/init removed. `invalidate-cache` admin check via
  `adminStats:checkMyAdmin` (forwards Supabase JWT through customJwt bridge).
  Verified: real edge file executed in Node vs DEV — search json/md, product
  md, 404, bot HTML all correct. `ProductImageSearchModal` dead Supabase
  `products` write removed (parent owns Convex state via onImagesAdded).
  Deleted zero-caller `useDashboardData.ts`.
- **`9485b0f1`**: removed temporary public `backfillDiscounts` (was DEV-only use).

## Schema findings (all 17 Supabase migrations + convex/schema.ts read)
- `products` final cols (076): id/name/slug/brand_id/description/short_description/
  origin/specifications/is_active/meta_*/canonical_url/created+updated. Price/stock/
  brand/gallery/rating/image_url all dropped → old feed image slot now uses
  default-variant images (feed-only delta, noindex alternates).
- `product_reviews` DROPPED (076) + `products.image_url` dropped → `ReviewsPage`
  doubly broken (Wave 10: Convex-native reviews still to build).
- `create_order` RPC compares `code = lower(trim(...))` while admin stored UPPER —
  coupons never worked; usage_count never moved (`supabase.raw` doesn't exist).
- `combos` renamed from `product_combos` (076); `searchable_products` matview
  dropped by 076 then 082 re-adds only the function (fragile — another reason
  search now lives in Convex).

## What's LEFT (needs founder — blocks the big push)
1. **R2 uploads**: confirm the `ASSETS` → `cigarro-assets` binding is SAVED for
   Production (+ Preview) in the Pages dashboard. Code is committed; first R2
   upload/list/delete must be smoke-tested against PROD after the push.
2. **Auth Phase 2 go-ahead** (founder: AFTER push soaks — do not start yet):
   `useAuth`, `phone-verify`, `ConvexSupabaseProvider`, `SettingsManager`
   session stamp, `PhoneAuthDialog.updateUser` stay till cutover. Forces re-login.
3. **Standing deferral**: Checkout `saved_addresses`/money-path (GPS, untestable).
4. **Wave 10/11 after push**: Convex-native reviews (`ReviewsPage` broken —
   `product_reviews` dropped in 076); retire (drop anon key, cold backup).

## Post-push status (2026-09-14 ~18:00 IST)
- Pushed `c0a8bd27` (all waves) → `addba173` (TEMP seed) → `f41b2216` (seed removed).
- PROD Convex (`prestigious-bass-64`) LIVE: new functions resolve; seeded
  `discounts` (Lucky 2FW3A5FI) + `referrals` (GJ3DQP/XEVLUS/VM4JXU) — verified
  over HTTPS (`validateReferralCode` → valid, referrer "Customer").
- PROD gates green: `200` home, `200` sitemap, `200` `?format=json` search.
- ⚠️ PROD Pages edge still OLD: `?format=json` images are `supabase.co` URLs
  while PROD `fullCatalog` is 100% `cdn.cigarro.in` (64/64) — proves the
  deployed Function predates this push. Founder: check Workers & Pages →
  project → Deployments (build failed / queued / paused?). New code is live
  the moment Pages deploys `f41b2216`. Re-run the feed gate after.
- Next: R2 `ASSETS` binding save confirmation → smoke-test upload/list/delete
  on PROD admin → auth Phase 2 (after soak) → reviews + retire.
- Verify after Pages deploys: PROD admin login → discounts/dashboard/customers
  load; `?format=json` images are `cdn.cigarro.in`; `invalidate-cache` with
  admin JWT; coupon validates at checkout.

## Standing rules
- Commit-only, no push until decoupled + verified (founder instruction 2026-09-14).
- `npx convex deploy` → DEV; PROD via git push only; DATA never syncs.
- Finance freeze (`orders/payments/wallet`); no partial `schema.ts` hand-edits;
  theme decoupling; paise-only-at-boundary; never commit env/`dist`/`opencode.json`.
- `git checkout -- dist` after builds. External `curl` verification only.
- Convex `patch` drops `undefined` — spreads with optionals are safe.
- `useQuery(..., 'skip')` pattern; edit-forms populate once via `populatedRef`;
  counts bounded `take(1000)`.
