# Cigarro → multi-store platform plan

Status: draft, 2026-11-11. Owner: orchestrator session. Executors: Haiku agents, one phase-slice per agent.

## Decisions locked
- Narrow wedge: regulated retail (tobacco), India, UPI. Evolve this repo, no rewrite.
- Store resolved at runtime from hostname. Custom domains + `<slug>` subdomains.
- Customer accounts scoped per store.
- Per-store admin PWA at `admin.cigarro.in/<store>`.
- No self-serve onboarding yet (platform admin creates stores).
- SEO is non-negotiable: migrating merchants must keep or gain rankings.
- Rendering: full SSR for every visitor (React Router v7 framework mode on Cloudflare), done in slices. P0 hotfix still ships first on the current edge renderer.
- Bank emails: both paths. Gmail sign-in per store is primary; forwarding to `<store>@pay.cigarro.in` (existing email-worker) is the fallback. Google OAuth app must be set to "In production" (unverified is fine under 100 users), because "Testing" status expires refresh tokens after 7 days. Verification + CASA audit only when scaling past 100 users.
- Platform admin = **Citadel** (`P:\Citadel`, central SSO hub). Cigarro becomes a Citadel receiver: launch JWT (60s, Ed25519, single-use `jti`) → `/sa/callback` → `POST /api/sa/exchange` → `saSessions` (10 min idle / 1 h cap). Scaffold from `P:\Citadel\templates\citadel-integration` (`npm run scaffold:project -- --slug cigarro`). Store admins keep phone-verify login + `requireOrgAdmin`. Never mix the two sessions.
- **Do not onboard store #2** until P1 security fixes, the Citadel receiver (P2.5) and the P3 org-scoped JWT land. Today the same customer JWT works on every org and any org owner can edit platform config.

## What the survey found (2026-11-11)
- **LIVE SEO OUTAGE**: edge SSR (`functions/ssr-middleware.js`) and `functions/sitemap.xml.js` call Convex catalog/content queries without the required `orgSlug`. Verified on production: Googlebot gets **404** on every product/category/brand/blog URL; sitemap has 13 static URLs, zero catalog URLs. Unknown paths return 200 + homepage canonical to everyone (soft 404).
- Rendering is "dynamic rendering": humans get an empty SPA shell (canonical `/` everywhere until JS runs), bots get separate edge HTML. Bot and human JSON-LD diverge. `_headers` forces `X-Robots-Tag: index, follow` on every route, including noindex pages.
- Org is picked at build time (`VITE_ORG_SLUG`, ~227 refs / 62 files). ~39 Convex lines hardcode `slug === "smokeshop"` as a null-orgId fallback. Many tables have optional `orgId`. `organizations` has no domain field.
- No platform super-admin in code (`convex/lib/auth.ts:39` TODO). Closest: "Platform Config (owners only)" card on the Payments page, gated by "owner of ANY org".
- Customers: global `users` by phone; membership auto-created only for `smokeshop` (`convex/userState.ts:55`). JWT iss `https://cigarro.in/auth`, aud `cigarro-storefront`, no org claim.
- Gmail: one platform Gmail account in singleton `appConfig`, refresh token **plaintext**, bound to one org. Other orgs never matched. Per-org `bankInboxes` + email-worker push path already exists (`POST /receiveBankEmail`).
- Security holes: `gmail.getGmailStatus` is public; payments-admin checks accept admin of ANY org; `getMyProfile.isAdmin` true for admin of any org; OAuth `returnTo` accepts any https host; OAuth state is a single shared slot.
- Supabase: no client code left. Leftovers: `supabase/` folder (incl. tracked `.temp/pooler-url`), ~40 stale comments, `supabaseId` fields (live data, keep for now). Unused deps: @hookform/resolvers, @tailwindcss/aspect-ratio, dotenv, hono, next-themes, react-beautiful-dnd (+types), tailwindcss-animate, zod. `generate-sitemap` script broken. `convex/` is not type-checked.
- Images: no srcset/width params/AVIF. Admin stats: UTC day boundary, `take(1000)` caps.

## Phases

### P0: SEO hotfix (ship today, ~1 agent)
1. Pass `orgSlug` (from env, same as `functions/api/invalidate-cache.js:52`) in every Convex call in `ssr-middleware.js` and `sitemap.xml.js`. Sitemap must fail loudly (500, not static fallback) if catalog fetch fails.
2. Unknown paths: real 404 status for all UAs (edge checks route table + slug existence).
3. `_headers`: remove blanket `X-Robots-Tag: index, follow`.
4. Verify on preview deploy with Googlebot UA; then resubmit sitemap in Search Console.
5. P0b (data + small code): fix 3 canonical-drift 404s (`elements-filter-tips`, `dunhill-international`, `esse-black-golden-leaf`: `canonicalUrl` ≠ slug). Enrich hub bot HTML (`/`, `/products`, `/brands`, `/categories`, `/blogs` are ~260 chars with zero internal links) with real link lists for crawl/link equity. Then GSC + Bing revalidation.

### P1: Cleanup + guardrails (~2 agents, parallel)
- A0 (user action, before A): if the Supabase project still exists, run `supabase db push` for `supabase/migrations/084_drop_orphaned_payment_rpcs.sql`, or just delete the project. Keep `supabaseId` fields (live compat data, never rename). Add `scripts/check-no-supabase.mjs` guard (fails on `@supabase` import or `VITE_SUPABASE_`). Fix CLAUDE.md drift: sidebar export is `ADMIN_NAVIGATION`, not `NAVIGATION_CONFIG`.
- A: delete `supabase/` (check `.temp/pooler-url` contents, then `git rm`), stale comments, unused deps, dead shadcn/components listed in survey, broken `generate-sitemap`, root junk (after user OK on docs).
- B: add `convex/tsconfig.json` + `npm run type-check` covering convex; CI-style script `npm run verify` = type-check + lint + check-no-toasts + build.
- Fix security holes listed above (scope every admin check to the target org).

### P2: Tenancy core
1. Schema: `orgDomains { orgId, hostname, kind: primary|alias|subdomain, status, verifiedAt }` index by_hostname. Backfill all optional `orgId` to smokeshop, make required, delete the 39 `"smokeshop"` fallbacks. `siteSettings` per org.
2. Edge: `_middleware.js` resolves `Host` → org (cached KV/Cache API, 60s), 404 for unknown hosts, injects `window.__ORG__ = {id, slug, name, settings}` into HTML. All functions/api/* take org from the resolved host, never env.
3. Frontend: `useOrg()` reads `__ORG__`; delete `ORG_SLUG` constant; replace 227 refs mechanically (admin pages take org from route param `/<store>`).
4. Per-store settings: branding, contact, legal pages, age-gate (on/off, min age per state), referral reward, UPI VPA, invoice details, analytics/GSC verification tokens, SEO defaults. Move every hardcoded "Cigarro"/cigarro.in in survey list into settings.

Note: domains live in a separate `orgDomains` table, not a `domains[]` array on `organizations`, because each hostname needs its own verification status, Cloudflare hostname ID and primary/alias flag. Keep the `smokeshop` null-orgId fallback until the backfill is verified in production, then delete it.

### P2.5: Citadel super-admin receiver
- Scaffold receiver (`--slug cigarro`), add `saSessions` + `saExchangedJtis` tables, envs `CITADEL_JWKS_URL/ISSUER/AUDIENCE=cigarro`.
- Implement `requireSuperAdmin` / `requireSaSession` / `requireSaWrite` (TOTP-backed write scope) in `convex/lib/auth.ts`. `appConfig.set` and all org create/suspend/domain/member mutations require SA write.
- Platform pages under `/sa/*` behind `SuperGate`: stores list, create/suspend, domains (P6), members, platform config. Move "Platform Config (owners only)" card off the Payments page.

### P3: Per-store customers
- `users` gets `orgId`, index `by_org_phone`. Same phone = different user per store.
- JWT adds `org` claim; Convex auth helper rejects tokens whose `org` ≠ target org. Issuer stays platform (`https://auth.cigarro.in` or keep current), JWKS shared.
- Backfill existing users → smokeshop. Remove `CUSTOMER_ORG_SLUG` gate.
- Sessions are per-origin already (localStorage), good for custom domains. Subdomains on a shared parent are separate origins too; still key the session `cigarro.session.v1:<orgSlug>` as belt-and-braces.
- Audit every customer-facing Convex function for `requireMember(orgId)` coverage (one Haiku agent, table output).

### P4: Admin PWA (`admin.cigarro.in/<store>`)
- Admin routes move under `/:store/*`; membership check per store. Store switcher for multi-store users.
- Own manifest (scope `/<store>/`, start_url `/<store>/`), installable, push notifications for new orders/payments later.
- Bank-email matching per store (see decision Q3). Move Gmail config from `appConfig` to `orgPaymentInbox` table; encrypt refresh tokens (AES-GCM, key in Convex env); per-org OAuth state rows; handle `invalid_grant` (mark disconnected + alert); paginate `messages.list`; Gmail push via `users.watch` + Pub/Sub instead of per-order polling, poll kept as fallback.

### P5: SEO, best-in-class (the moat)
Rendering (decision Q2). Then, per store:
- Host-aware canonical, robots.txt, sitemap index (products/categories/brands/blog split, lastmod from `updatedAt`, image entries), all generated per host.
- **Migration toolkit**: import old sitemap/CSV → redirect map (`orgRedirects` table, exact + pattern rules, 301/410), applied at edge before routing. "Migration checker": crawls every old URL and reports which don't resolve to 200/301 before DNS cutover. Configurable URL patterns (e.g. keep Shopify `/products/:handle`, Woo `/product/:slug/`) so most merchants need zero redirects.
- Trailing-slash + case normalization 301s; www/apex choice per store.
- Identical JSON-LD for all UAs: Product/Offer (price, availability, shipping, returns), AggregateRating/Review, BreadcrumbList, ItemList on listings, Organization/LocalBusiness (address, geo, hours), BlogPosting, FAQ.
- Images: Cloudflare Image Resizing srcset (AVIF/WebP), explicit width/height, LCP image preload + fetchpriority.
- CWV budget per template (LCP < 2.0s, CLS < 0.05, INP < 200ms), checked with Lighthouse CI on preview deploys.
- Search Console verification + IndexNow ping on publish.
- Age gate must not block crawlers or hide content from HTML (overlay only, content stays in DOM).

### P6: Custom domains
- Cloudflare for SaaS custom hostnames on the Pages project; platform admin adds domain → API creates hostname → shows DNS (CNAME) + TXT verification → status polling → `orgDomains.status = active`.
- Cutover runbook: redirects imported + checker green → DNS switch → submit sitemap → monitor GSC coverage 14 days.

### P7: Platform admin extras
- On top of P2.5: plans/billing, impersonate-as-store-admin (audited), cross-store health (Gmail connection status, failed matches, GSC coverage).

## Execution rules for Haiku agents
- One slice per agent, brief names exact files, done criteria, and what NOT to touch.
- Never edit `convex/_generated/*`. Never use toasts. Money via `rupeesToPaise`/`paiseToRupees`. Themes never import `convex/react`.
- Every slice ends with `npm run type-check` and `npm run build` passing; report diffstat + anything skipped.
- Schema changes: agent does NOT run `npx convex deploy`; orchestrator asks user.
- No commits/pushes/deploys by agents unless the user approved that slice.
