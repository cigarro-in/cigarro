# Project guide for Claude sessions

Cigarro is a multi-store platform for regulated (tobacco) retail in India, paid via UPI. React + Vite frontend on Cloudflare Pages, Convex for data and payments, own ES256 JWT auth. No Supabase anywhere.

## Architecture at a glance

- **Frontend**: React + Vite. Customer routes in `src/pages/`, store admin in `src/adminnew/`, platform (super-admin) in `src/sa/`, themes in `src/themes/`.
- **Stores (orgs)**: many stores share one codebase and one deployment. The store is resolved from the request hostname, never from a build-time env var. See "Stores and hosts" below.
- **Auth**: own ES256 JWT (`phone-verify` mints `cigarro_token`; JWKS at `/.well-known/jwks.json`). `auth.config.ts` trusts only `https://cigarro.in/auth`. Bridged into Convex via `ConvexAuthProvider` (`src/lib/convex/`). Tokens carry an org claim.
- **Payments + orders + wallet**: Convex. PROD is `prestigious-bass-64.convex.cloud`; DEV is `proper-coyote-383.convex.cloud` (local `.env.local`). All code under `convex/`.
- **Images**: Cloudflare R2 bucket `cigarro-assets`, served at `https://cdn.cigarro.in`. Keys are `asset_images/orgs/<slug>/<folder>/<stem>.webp`. URL helpers in `src/lib/images/urls.ts`.
- **Org scoping**: `useOrg()` returns the active store. Every Convex payment, order, wallet and catalog call is scoped by `orgId` (or `orgSlug` for public catalog queries).
- **Money**: integers in paise at the DB/Convex boundary, rupees in UI. Use `rupeesToPaise` / `paiseToRupees` from `src/lib/convex/money.ts`. Never multiply by 100 inline.

## Stores and hosts

- Stores: `oldsmokeshop` is the original store, served at `cigarro.in` (`LEGACY_ORG_SLUG` in `convex/lib/legacyOrg.ts`). `smokeshop` is a second store, imported from Dukaan (see `imports/the2935/README.md`), served at `smokeshop.cigarro.in` with the `vivid` theme. Nothing treats a slug as a default; the hostname decides.
- Hostname to store: `functions/_middleware.js` resolves each request once via `functions/lib/org.js`, which calls Convex `domains:resolveByHost` (cached 60 s per host). Handlers read the result from `context.data.org`. Unknown hosts are not served. Preview and local hosts fall back to the default store. If Convex is unreachable the edge degrades to the env fallback instead of failing.
- Domains live in the `orgDomains` table (`kind`: primary, alias or subdomain; `status`; `hostname` index). Status is derived from the Cloudflare Pages Domains API (`convex/cloudflare.ts`). The `domains:monitor` cron re-checks non-active domains every 15 minutes.
- The Pages API does not create DNS. A CNAME to `cigarro.pages.dev` must be added by hand for every custom domain or `<slug>.cigarro.in` subdomain.
- `VITE_ORG_SLUG` is no longer the store selector. It is still read as a last-resort fallback (`functions/lib/env.js`, `src/lib/org/OrgContext.tsx`). Do not rely on it, and do not add new uses.

## SSR and the edge

- Storefront rendering is Vite SSR: entry `src/entry-server.tsx`, routes in `src/routes/ssrRoutes.tsx` and `src/routes/eagerRoutes.tsx`, preload helpers in `src/lib/ssr/`, build config `vite.ssr.config.ts`.
- `SSR_ROUTES` lists which routes are server-rendered. Routes not on the list still use the bot-only renderer (`functions/ssr-middleware.js`, `functions/ssr-render.js`, `functions/_ssr/`) until cutover.
- Responses carry `x-ssr` (diagnostic) and `x-ssr-cache` headers, useful when checking what was served.
- Redirects are in `functions/lib/redirects.js` and `_redirects`. Headers are in `_headers`.
- `*.pages.dev` is noindex.

## Theme decoupling (IMPORTANT)

Theme files under `src/themes/<theme>/` are **pure views**. They MUST NOT import from:
- `convex/react`, `convex/_generated/*`

Image URLs go through `src/lib/images/urls.ts` (pure CDN helpers — allowed).

All data access goes through hooks in `src/hooks/data/`:
- `useMyOrders({ kind?, limit? })` — normalized orders (paise→rupees, unified `uiStatus` that overlays payment + shipping)
- `useMyWallet({ ledgerLimit? })` — balance + ledger entries

When adding a new data surface for themes (addresses, wishlist, product list, cart, …), create a matching hook in `src/hooks/data/` that returns a normalized plain-object shape. **Never duplicate Convex fetch or status-mapping logic inside a theme component.** If you're about to `import { useQuery } from 'convex/react'` inside a `Vivid*.tsx` or `Classic*.tsx` file, stop and extract a hook instead.

Hooks owned by data layer:
- own the data source (Convex) and all API specifics
- own unit conversions (paise→rupees, timestamps→Date)
- own status derivation (combining multi-field states into one `uiStatus`)
- return types themes can trust: `NormalizedOrder`, `WalletLedgerEntry`, etc.

Themes own:
- visuals (CSS classes, icons, copy)
- layout and routing
- per-theme UX variations (empty states, skeletons, badge labels)

## Payment model (Convex)

- `convex/schema.ts` — source of truth. Orders have payment status (`pending/paid/late_paid/expired/cancelled/refunded/voided`) and optional shipping status (`awaiting/processing/shipped/delivered/returned`) — two separate lifecycles.
- `convex/orders.ts` — `createOrder`, `retryOrder`, `listMyOrders`, `getMine`, `cancelOrder`
- `convex/admin.ts` — `markPaid`, `voidOrder`, `refundOrder`, `updateShipping`, `getOrder`, late-payment + bank-email admin
- `convex/wallet.ts` — append-only ledger + materialized `walletAccounts.balancePaise`
- `convex/payments.ts` — `expireHeldSlot`, `releaseQuarantine`, `ingestBankEmail`
- **Bank-email matching** is per store. Gmail sign-in per store (`convex/gmail.ts`, `gmailConnections`, refresh tokens encrypted) is the primary path. Forwarding to a store alias through `email-worker` (`POST /receiveBankEmail`, `bankInboxes`) is the fallback.
- **Paise-slot fingerprinting**: each order gets a unique offset 0–99 paise added to the base so the incoming UPI email amount uniquely identifies the order. `slotsPerBase` is configurable per org.
- **Retry semantics**: `retryOrder` only accepts `expired` or `cancelled` source orders. It creates a new order with `retryOfOrderId` link. For `pending` orders the UI shows "Continue Payment" (go back to the existing order), not "Retry".

## Customers and auth

- Customer accounts are per store (`users.orgId`). The same phone number can be a different customer in each store.
- Store admins log in with phone only, at `admin.cigarro.in/<store>/...`. The store switcher sits top-left (`src/adminnew/StorePicker.tsx`). Access is checked with `requireOrgAdmin` / `requireMember`.
- Super-admin is at `/sa` only, via Citadel SSO (launch JWT → `/sa/callback` → `POST /api/sa/exchange` → `saSessions`). Never mix super-admin and store-admin sessions. Store admins never get `/sa` access by phone login.
- Super-admin pages: `src/sa/`. The Platform Config page has the "Run pending migrations" button and the Dukaan importer lives on the store page.

## Admin UI structure

- `src/adminnew/AdminRouter.tsx` — route table. `ADMIN_ROUTES` array drives pages. Paths are router-relative (no `/admin` prefix); the admin host basename is `/<store>`, so `/orders` serves `admin.cigarro.in/<store>/orders`. Build admin links with `adminPath()` / `adminAbsoluteUrl()` from `src/adminnew/lib/paths.ts`. Legacy `/<store>/admin/*` redirects to `/<store>/*`.
- `src/adminnew/layout/AdminSidebar.tsx` — `ADMIN_NAVIGATION` drives sidebar. Sections: `platform`, `payments`.
- Payment screens live under `/<store>/payments/*`: hub, late payments, unmatched emails, settings.
- Order detail page `/<store>/orders/:id` → `OrderFormPage.tsx` handles both payment actions (mark paid / void / refund) and shipping lifecycle.
- Admin visual rules are in `DESIGN.md`.

## Data jobs and migrations

- One-off data jobs go in `convex/migrations.ts`. Each migration is recorded in the `migrations` table and runs once.
- Migrations run only when triggered: dev with `npx convex run migrations:runPending`, prod with the super-admin "Run pending migrations" button (`platform:runPendingMigrations`). Never add a cron for a migration.
- Convex PROD and DEV hold separate data. Code reaches PROD on push to `main`; data does not. Every backfill has to run against each deployment it is needed on. Verify user-facing claims against PROD, not DEV.
- Dukaan imports: data in `imports/the2935/`, importer button on the `/sa` store page.
- Before writing to R2, check whether the object already exists. No silent overwrites.

## Conventions

- New admin pages: create in `src/adminnew/pages/`, export from `pages/index.ts`, add to `ADMIN_ROUTES` in `AdminRouter.tsx`, add to `ADMIN_NAVIGATION` in `AdminSidebar.tsx`.
- Never introduce `<theme>Xxx.tsx` files that fetch data. Extract a hook first.
- Never use toasts (`sonner` is banned under `src/` — see `scripts/check-no-toasts.mjs`); surface user-facing errors inline via `InlineStatus` and include Convex error codes via `error?.data?.code`.
- Never edit `convex/_generated/*`.
- Checks: `npm run type-check`, `npm run type-check:convex`, `npm run check:guards`, `npm run lint`, `npm run build`. `npm run verify` runs all of them.
- Schema changes are not live until deployed. Prod Convex deploys on every push to `main`. `npx convex deploy` and `npx convex run` from a local shell use `CONVEX_DEPLOY_KEY`, which targets DEV.
- Verify behaviour against a running server (curl or the browser), not only unit checks. Use a browser User-Agent for server-side fetches; Cloudflare Bot Management returns 403 to other UAs.
- Never commit `.env.local`, `.dev.vars` or `.wrangler/`.

## Known deferred items

- DNS automation: adding the CNAME for custom domains and subdomains is manual.
- Admin title shows "Cigarro Admin" instead of the store name (`src/App.tsx`, `src/adminnew/StorePicker.tsx`).
- Old images are still under `asset_images/` and not yet moved to `orgs/oldsmokeshop`.
- No media table or srcset / responsive image variants yet.
- Vivid hub pages are not server-rendered yet.
- `functions/ssr-middleware.js` (bot-only renderer) is still in place; remove after every route is in `SSR_ROUTES`.
- No cache purge when admin edits content.
- Environment variables are not consolidated; `VITE_ORG_SLUG` is still a fallback.
