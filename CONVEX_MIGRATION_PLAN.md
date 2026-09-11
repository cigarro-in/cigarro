# Convex Migration Plan — Cigarro.in (Supabase → Convex + R2)

**Status:** Phase 0 complete, Phase 1 partially complete (schema + functions deployed).
**Owner:** founder + Muse Spark. **Rule:** no phase advances without its
acceptance tests passing; SEO invariants hold across ALL phases.
**Standing project rules (AGENTS.md) still apply:** paise at the Convex
boundary, theme decoupling (no Convex/Supabase imports in `src/themes/*`),
`npx convex deploy` before relying on schema changes, `sonner` toasts.

---

## 1. Objective

One backend (Convex) + one object store (R2). Retire Supabase Auth, Postgres,
and Storage. Keep Cloudflare Pages + edge prerender architecture unchanged.

**Non-goals:** no URL changes, no sitemap/canonical changes, no visual
redesigns, no paid-ads work, no tobacco-SKU promotion beyond current organic
surfaces (founder verdict 2026-09-11: prices/discounts/reviews/education OK;
paid tobacco promotion never).

## 2. Current state (verified 2026-09-11)

### Auth chain (passwordless — no password migration problem exists)
MSG91 OTP widget (`src/hooks/useOTPWidget.ts`) → client POSTs one-time JWT →
`functions/api/auth/phone-verify.js` verifies via MSG91 `verifyAccessToken`,
finds/creates Supabase auth user (synthetic `<phone>@phone.cigarro.in` email),
mints magiclink `token_hash` → client `supabase.auth.verifyOtp` → Supabase
ES256 session → Convex `customJwt` bridge (`convex/auth.config.ts`).

### Supabase reads/writes (100+ call sites, `src/` + `functions/`)
| Domain | Tables | Notes |
|---|---|---|
| Catalog | products, product_variants, brands, categories, product_categories, collections, collection_products | prerender/sitemap/feeds/storefront/admin |
| Content | blog_posts, blog_categories, blog_tags, blog_post_tags, blog_comments(empty) | guides + comparisons live here |
| Storefront config | hero_slides, section_configurations, homepage_component_config, site_settings | homepage composition |
| User state | cart_items, user_wishlists, profiles, saved_addresses, pincode_lookup (static) | **Phase 1 target** |
| Commercial | discounts, orders (legacy mirror), order_items, customers-surface via profiles | discounts admin stays till Phase 2/3 |
| Compliance/audit | audit_logs (**missing in prod** — migration `083` pending apply) | circuit breaker active in app |

### Convex (live: `proper-coyote-383.convex.cloud`)
payments, orders, wallet, orgs/memberships, email, scheduler, admin audit —
plus NEW Phase 1 tables: `users`, `carts`, `wishlists`, `savedAddresses`
(deployed 2026-09-11) and functions in `convex/userState.ts` (deployed).

### Storage
All images in Supabase Storage (`asset_images`, …). No `wrangler.toml`
(Pages dashboard-managed). **No R2 bucket yet — founder action required.**

## 3. Identity strategy (load-bearing decision)

`userId` = Supabase `auth.users.id` string, used as-is in Convex tables AND
as the `subject` the bridge yields. Phase 2 mints our own JWTs whose `sub`
is the **same string** (Convex `users` table maps `phone → legacy userId`).
Result: Phase 2 rewrites zero data rows and zero table schemas.

## 4. Money conventions

- Convex boundary: **integer paise** (`unitPricePaise`, `rupeesToPaise`).
- Supabase catalog: **rupees** (`price`, `compare_at_price`, `price_inr`).
- NEW `carts.unitPriceRupees`: snapshot in rupees at add-to-cart time.
  Checkout MUST re-price from the catalog before `createOrder` (already the
  pattern in both checkout pages) — cart snapshots are display-only.

## 5. Phase 1 — user state (IN PROGRESS)

- [x] Schema: `users`, `carts`, `wishlists`, `savedAddresses` (+indexes) — deployed
- [x] Functions: `convex/userState.ts` (upsertUser/getMe, cart CRUD, wishlist toggle, address CRUD) — deployed
- [ ] Rewrite `useCart` (Supabase `cart_items` → Convex; keep totals math + re-price-at-checkout)
- [ ] Rewrite `useWishlist` (`user_wishlists` → Convex)
- [ ] Profiles: `useAuth`/`useAdminAuth` profile reads → Convex `users` (+ backfill job for existing Supabase profiles)
- [ ] Addresses: `AddressManager`/`AddressDrawer` (`saved_addresses` → Convex)
- [ ] Backfill: one-shot script copying Supabase rows → Convex (idempotent, by userId)
- [ ] Dual-read soak: 48h with mismatch logging, then Supabase reads removed
- [ ] NEW: `productReviews` table + PDP UI + WhatsApp request hook (reviews never existed — build natively in Convex, not Supabase)

**Acceptance:** cart/wishlist/address flows verified black-box against
production build; no Supabase `cart_items`/`user_wishlists`/`saved_addresses`
reads remain in `src/`; backfill counts match; 48h error-free.

## 6. Phase 2 — auth cutover

- [ ] Pages Function: verify MSG91 → mint OUR JWT (new JWKS endpoint, private key in Pages env)
- [ ] `convex/auth.config.ts`: trust our issuer alongside Supabase (dual-run)
- [ ] `useAuth` swaps session source; `ConvexSupabaseProvider` bridge retired after soak
- [ ] Supabase Auth retired; anon key removed from client bundle
- [ ] Runbook: forced re-login (no password resets needed — OTP flow unchanged for users)

**Acceptance:** new logins via our JWT only; Convex identity `subject`
equals legacy Supabase sub for existing phones (spot-check 5 users); admin
roles intact via memberships.

## 7. Phase 3 — catalog authorship, reads, storage

- [ ] Admin CRUD (products/variants/brands/categories/blogs/collections/hero/discounts) → Convex mutations; Supabase kept as read replica during soak
- [ ] Catalog reads → Convex: prerender (`generate*HTML`), sitemap, `?format=` feeds, storefront queries — with **byte-diff gates** (bot HTML before/after must match except intended deltas; canonical/H1/schema asserted)
- [ ] Storage → R2: bucket `cigarro-assets`, bulk copy, DB URL rewrite, redirect map for old Supabase URLs, sitemap/OG/JSON-LD updated; share-preview revalidated
- [ ] Retire Supabase reads; keep project (stopped) 90 days as cold backup, then delete

**Acceptance:** byte-identical bot HTML pre/post cutover (diff allowlist only);
GSC coverage stable ±5% for 2 weeks post-cutover; share validators green;
zero Supabase imports in `functions/` and catalog paths in `src/`.

## 8. SEO guardrails (every phase)

No URL/slug/canonical/sitemap-shape changes. No prerender template changes
except data-source swaps. GSC + Bing coverage checked weekly. Any indexed-URL
delta beyond ±5% pauses the program.

## 9. Rollback

- Phase 1: hooks keep a `USE_CONVEX_USERSTATE=false` fallback to Supabase reads (remove after soak).
- Phase 2: dual-issuer trust stays until 7 clean days, then Supabase issuer removed.
- Phase 3: Supabase read replica + old image URLs retained until R2 verified; instant revert = flip reads back.

## 10. Open items / dependencies

- [ ] Founder: create R2 bucket `cigarro-assets` + public base URL (`cdn.cigarro.in` or R2.dev) — needed for Phase 3
- [ ] Founder: legal verdict (gates content scale, not migration)
- [ ] Apply migration `083_audit_logs_sink_repair.sql` (Dashboard SQL Editor, 2 min)
- [ ] `ktnng` cleanup done 2026-09-11 (deleted, 301s to ESSE)

## 11. Progress log

- 2026-09-11 — Phase 0 inventory complete (OTP chain, R2 unbound, schema mapped).
- 2026-09-11 — Phase 1 schema + `convex/userState.ts` deployed to production Convex.
