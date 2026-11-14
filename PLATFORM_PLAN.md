# Cigarro multi-store platform: status

Status: updated 2026-11-13. Keep this file short; move detail into code comments or the runbook for the area.

## Decisions (locked)
- Narrow wedge: regulated retail (tobacco), India, UPI. One codebase, no rewrite.
- The store is resolved from the request hostname at the edge. Custom domains and managed `<slug>.cigarro.in` subdomains live in `orgDomains`.
- Customer accounts are per store. Store admins use `admin.cigarro.in/<store>/`. Platform admin is Citadel SSO at `/sa` only.
- Bank-email matching is per store: Gmail sign-in is primary, forwarding through `email-worker` is the fallback.
- Rendering is Vite SSR on Pages Functions, on by default for every supported route. `SSR_ROUTES` is only an optional override (`off` = kill switch).
- SEO is non-negotiable: migrating merchants must keep or gain rankings.

## Shipped
- Hostname-based store resolution at the edge (`functions/_middleware.js`, `functions/lib/org.js`, `domains:resolveByHost`), with a 60 s cache.
- `orgDomains` table, Cloudflare Pages Domains API status sync (`convex/cloudflare.ts`), `domains:monitor` cron every 15 minutes.
- Stores `oldsmokeshop` (cigarro.in, rename migration done) and `smokeshop` (Dukaan import, `smokeshop.cigarro.in`, vivid theme).
- Per-store customer accounts (`users.orgId`) and per-store admin access with a store switcher.
- Super-admin `/sa` behind Citadel SSO (`saSessions`, `saExchangedJtis`), platform config, store create/suspend, domains, members.
- Per-store Gmail payment matching (`gmailConnections`, encrypted tokens) with `email-worker` forwarding as fallback.
- One-off migration runner (`convex/migrations.ts`, super-admin button).
- Dukaan importer and image pipeline on R2 (`cdn.cigarro.in`, `asset_images/orgs/<slug>/...`).
- Supabase removed from code. `check-no-supabase` guard in `npm run check:guards`.
- SSR infrastructure (`src/entry-server.tsx`, `SSR_ROUTES`, `x-ssr` diagnostics). Routes are being moved over one at a time.

## Remaining
1. DNS automation: create the CNAME to `cigarro.pages.dev` for custom domains through the Cloudflare API (today it is added by hand).
2. Admin title shows "Cigarro Admin" instead of the store name.
3. Move old images to `asset_images/orgs/oldsmokeshop`.
4. Media table and srcset / responsive image variants.
5. Vivid hub pages server-rendered (SSR).
6. Remove the bot-only renderer `functions/ssr-middleware.js` once SSR has run everywhere without needing the `off` kill switch.
7. Cache purge on admin edits.
8. Environment consolidation (drop the `VITE_ORG_SLUG` fallback).
9. Order id migration: backend uses the Convex `_id` for everything (links, payment matching, references); the frontend shows only the 5-digit order number. Retire the `ORD-YYMMDD-xxxxx` id (`convex/lib/ids.ts`) with a migration and redirects for old customer order links.
10. Store modules: a super-admin page that turns modules (invoices, inventory, marketing, ...) on or off per store, enforced in the backend and the admin nav. Invoices stay hidden until then.
12. Referral reward expiry is stored but not enforced.
13. Soft-404s: unknown storefront paths render the home page for browsers (bots get a real 404).
14. Bank SMS relay (same thing as an "SMS forwarder"): a phone on the shop's bank number forwards bank credit SMS to the store's bank inbox, as a fallback when the Gmail route is unreliable. Start with an existing forwarder app posting to a webhook; we only build the receiving endpoint.
15. Platform fees: prepaid wallet vs postpaid billing, shown in the payments statement (`kind: 'fee'` is already reserved).
16. Plug-and-play themes: let a store bring an external theme (e.g. a WordPress/PHP or other third-party theme) and use it like a built-in theme. Needs research: likely a theme package format (templates + assets) rendered at the edge against our data API, keeping SSR/SEO guarantees.
17. Per-store analytics settings: Google Analytics (GA4 measurement id), Meta Pixel (pixel id + Conversions API later) and a heatmap/session-recording tool (e.g. Microsoft Clarity or Hotjar), configured per store in admin Settings, loaded after consent and after page idle so they never hurt performance.
18. Observability hub in /sa: Convex function logs, Cloudflare Pages/Functions logs, client crash reports (functions/api/crash-logs.js) and customer/merchant-reported problems in one place, per store, with alerts as soon as something fails.
19. Database migration and backups: needs careful planning (strategy, scheduled exports kept off-platform, restore drills) before any implementation.
20. Automated browser tests for login, cart and checkout on every store, run on each push.
21. Payment pipeline alerts: tell the store owner when the Gmail connection breaks or paid orders stop being matched.
22. Customer order updates (WhatsApp/SMS: paid, shipped, delivered) and unpaid-order reminders. Deferred about a month (cost).
23. Merchant Android app (admin + notifications + SMS relay in one): only if item 14 outgrows an off-the-shelf forwarder. A PWA cannot read SMS; options are a sideloaded APK or a Play Store app (READ_SMS is restricted, approval unlikely).

SEO open items (canonical mismatches on three product slugs, etc.) are tracked in `SEO_CURRENT_STATE.md`.

## Execution rules
- One slice per agent or session. Name the exact files, done criteria, and what not to touch.
- Never edit `convex/_generated/*`. Never use toasts. Money via `rupeesToPaise` / `paiseToRupees`. Themes never import `convex/react`.
- Every slice ends with `npm run type-check`, `npm run type-check:convex` and `npm run build` passing.
- Schema changes: deploy happens on push to `main`; confirm the Convex deploy succeeded before relying on the change.
- No commits, pushes or deploys without the user's approval for that slice.
