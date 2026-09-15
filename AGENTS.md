# Project guide for Codex sessions

This is a multi-tenant cigarette e-commerce storefront (React + Vite) with payments on Convex and own ES256 JWT auth (no Supabase).

## Architecture at a glance

- **Frontend**: React + Vite. Customer routes in `src/pages/`, admin in `src/adminnew/`, themes in `src/themes/`.
- **Auth**: own ES256 JWT (`phone-verify` mints `cigarro_token`, `auth.config.ts` trusts only `https://cigarro.in/auth`). Bridged into Convex via `ConvexAuthProvider` (`src/lib/convex/`).
- **Payments + orders + wallet**: Convex at `proper-coyote-383.convex.cloud`. All code under `convex/`.
- **Images**: Cloudflare R2 (`cigarro-assets` bucket, `https://cdn.cigarro.in`, keys under `asset_images/`). URL helpers in `src/lib/images/urls.ts`. No Supabase anywhere.
- **Org scoping**: `useOrg()` returns the active organization (default slug `smokeshop`, set via `VITE_ORG_SLUG`). Every Convex payment/order/wallet call is scoped by `orgId`.
- **Money**: integers in paise at the DB/Convex boundary, rupees in UI. Use `rupeesToPaise` / `paiseToRupees` from `src/lib/convex/money.ts`. Never multiply by 100 inline.

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
- **Paise-slot fingerprinting**: each order gets a unique offset 0–99 paise added to the base so the incoming UPI email amount uniquely identifies the order. `slotsPerBase` is configurable per org.
- **Retry semantics**: `retryOrder` only accepts `expired` or `cancelled` source orders. It creates a new order with `retryOfOrderId` link. For `pending` orders the UI shows "Continue Payment" (go back to the existing order), not "Retry".

## Admin UI structure

- `src/adminnew/AdminRouter.tsx` — route table. `ADMIN_ROUTES` array drives pages.
- `src/adminnew/layout/AdminSidebar.tsx` — `NAVIGATION_CONFIG` drives sidebar. Sections: `platform`, `payments`.
- Payment screens live under `/admin/payments/*`: hub, late payments, unmatched emails, settings.
- Order detail page `/admin/orders/:id` → `OrderFormPage.tsx` handles both payment actions (mark paid / void / refund) and shipping lifecycle.

## Conventions

- New admin pages: create in `src/adminnew/pages/`, export from `pages/index.ts`, add to `ADMIN_ROUTES` in `AdminRouter.tsx`, add to `NAVIGATION_CONFIG` in `AdminSidebar.tsx`.
- Never introduce `<theme>Xxx.tsx` files that fetch data. Extract a hook first.
- Use `sonner` `toast` for user-facing errors; surface Convex error codes via `error?.data?.code`.
- Before committing schema changes, run `npx convex deploy`. Schema changes are NOT live until deployed.

## Known deferred items

- Dashboard + customers read Convex (`adminStats.getDashboardStats`) — no Supabase stat tiles remain.
- Bank-email ingestion is code-complete both ends (`email-worker` → `POST /receiveBankEmail` → `ingestBankEmail`, org resolved via `bankInboxes` full address or legacy `bankEmailAlias` slug). Remaining is operator wiring: `wrangler deploy` + secrets in `email-worker/`, Email Routing rule per `bank-<slug>` alias, Gmail forward filter. Manual `markPaid` is the interim path.
- Old payment-flow RPCs (`verify_order_payment`, `create_order`, `admin_verify_payment`, `get_wallet_balance`) have zero callers in `src/` and `functions/`; drop file is `supabase/migrations/084_drop_orphaned_payment_rpcs.sql` (apply with `supabase db push`).
