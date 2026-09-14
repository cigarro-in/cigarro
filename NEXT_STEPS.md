# Handoff — Convex Migration (2026-09-14, post-session)

Remote = `30ff2d48` (push AFTER R2 uploads wired + verification — see bottom).
Local main = ahead (NOT pushed per founder instruction).
Start: read `LEARNINGS.md` + this file + `git log --oneline -8` + `git status`.

## Shipped earlier (pushed `30ff2d48`)
Content admin on Convex (blogs/heroes lists, blog/hero forms, homepage +
settings managers). Deployed DEV, build green.

## Done this session (committed, NOT pushed — one big push at the end)
- **Referrals minimal on Convex** (DEV deployed): new `referrals` table (GLOBAL,
  snake_case, rupees, ms dates) + `convex/referrals.ts` — `ensureMyReferral`
  (lazy row creation, replaces the auth trigger), subject-scoped reads
  (`getMyReferral`, `checkEligibility`, `checkIfReferred`, stats, referred list,
  leaderboard), public `validateReferralCode`, `recordReferral`/`attachReferralLate`
  with 040 RPC semantics (self-check, already-referred check, referrer counter).
  Backfilled DEV (3 rows, zero activity); temp backfill removed after.
  `referralService.ts` same signatures via shared client; `MobileCheckoutPage`
  eligibility + late-attach on Convex. Reward payout never existed server-side —
  flags carried, nothing invented.
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
1. **R2 uploads**: images already on `cigarro-assets` + CDN (reads fine). Still
   uploading to Supabase Storage: `AssetManager`, `ImagePicker` (list+upload),
   `ProductImageSearchModal` uploader, `images/process.js`. Plan: new Pages
   Function `api/images/upload.js` with R2 bucket binding (needs founder to bind
   bucket in Pages dashboard — no token needed for Functions) + admin gate via
   `checkMyAdmin`, returning CDN URLs; point the three UI upload paths at it.
   Needed from founder: bucket name + public base (cdn.cigarro.in?) + binding done.
2. **Auth Phase 2 go-ahead** (founder: AFTER push soaks — do not start yet):
   `useAuth`, `phone-verify`, `ConvexSupabaseProvider`, `SettingsManager`
   session stamp, `PhoneAuthDialog.updateUser` stay till cutover. Forces re-login.
3. **Standing deferral**: Checkout `saved_addresses`/money-path (GPS, untestable).
4. **Wave 10/11 after push**: Convex-native reviews (`ReviewsPage` broken —
   `product_reviews` dropped in 076); retire (drop anon key, cold backup).

## Post-push checklist (PROD `prestigious-bass-64`, code via push, DATA never syncs)
- Recreate "Lucky" coupon via `/admin/discounts` (PROD table empty; backfill fn removed).
- Seed PROD `referrals` (3 codes: GJ3DQP, XEVLUS, VM4JXU + userIds) — needs a
  push-then-remove temp mutation OR recreate via UI flow (codes would change;
  prefer temp-mutation backfill immediately post-push, then remove + push again).
- Verify: PROD admin login → discounts/dashboard/customers load; `?format=json`
  on a product; `invalidate-cache` with admin JWT; coupon validates at checkout.
- PROD backfill NOT needed for users/orders (already live); catalog/content done earlier.

## Standing rules
- Commit-only, no push until decoupled + verified (founder instruction 2026-09-14).
- `npx convex deploy` → DEV; PROD via git push only; DATA never syncs.
- Finance freeze (`orders/payments/wallet`); no partial `schema.ts` hand-edits;
  theme decoupling; paise-only-at-boundary; never commit env/`dist`/`opencode.json`.
- `git checkout -- dist` after builds. External `curl` verification only.
- Convex `patch` drops `undefined` — spreads with optionals are safe.
- `useQuery(..., 'skip')` pattern; edit-forms populate once via `populatedRef`;
  counts bounded `take(1000)`.
