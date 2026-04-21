# Project guide for Claude sessions

This is a multi-tenant cigarette e-commerce storefront (React + Vite) with payments on Convex and auth on Supabase.

## Architecture at a glance

- **Frontend**: React + Vite. Customer routes in `src/pages/`, admin in `src/adminnew/`, themes in `src/themes/`.
- **Auth**: Supabase (RS256 JWT). Bridged into Convex via `ConvexSupabaseProvider` (`src/lib/convex/`).
- **Payments + orders + wallet**: Convex at `proper-coyote-383.convex.cloud`. All code under `convex/`.
- **Legacy data (products, profiles, wishlist, referrals, search)**: still on Supabase. Do not migrate these without being asked.
- **Org scoping**: `useOrg()` returns the active organization (default slug `smokeshop`, set via `VITE_ORG_SLUG`). Every Convex payment/order/wallet call is scoped by `orgId`.
- **Money**: integers in paise at the DB/Convex boundary, rupees in UI. Use `rupeesToPaise` / `paiseToRupees` from `src/lib/convex/money.ts`. Never multiply by 100 inline.

## Theme decoupling (IMPORTANT)

Theme files under `src/themes/<theme>/` are **pure views**. They MUST NOT import from:
- `convex/react`, `convex/_generated/*`
- `src/lib/supabase/*`
- `@supabase/*`

All data access goes through hooks in `src/hooks/data/`:
- `useMyOrders({ kind?, limit? })` — normalized orders (paise→rupees, unified `uiStatus` that overlays payment + shipping)
- `useMyWallet({ ledgerLimit? })` — balance + ledger entries

When adding a new data surface for themes (addresses, wishlist, product list, cart, …), create a matching hook in `src/hooks/data/` that returns a normalized plain-object shape. **Never duplicate Convex fetch or status-mapping logic inside a theme component.** If you're about to `import { useQuery } from 'convex/react'` inside a `Vivid*.tsx` or `Classic*.tsx` file, stop and extract a hook instead.

Hooks owned by data layer:
- own the data source (Convex / Supabase) and all API specifics
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

- Admin dashboard / customers pages still read Supabase `orders` for stat tiles (shows 0 / stale, not breaking).
- Cloudflare Email Routing → Convex HTTP action for bank-email ingestion is not wired. Manual `markPaid` is the interim path.
- Supabase RPCs related to the old payment flow (`verify_order_payment`, `create_order`, `admin_verify_payment`, `get_wallet_balance`) are orphaned — safe to drop from Supabase.
