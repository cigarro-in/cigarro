# Convex backend

Owns the data, orders, payments, wallet and admin reconciliation for every store. Each store is an `organizations` row; every store-owned row carries `orgId`.

## Layout

```
convex/
  schema.ts                All tables + shared validators (source of truth)
  auth.config.ts           Trusts our own ES256 issuer (https://cigarro.in/auth) only
  http.ts                  /receiveBankEmail (email-worker fallback), other HTTP routes
  saHttp.ts                Super-admin HTTP endpoints (Citadel SSO exchange)
  organizations.ts         Store settings, seedOrg bootstrap, legacy rename migration
  domains.ts               orgDomains: resolveByHost (edge), status, monitor cron
  cloudflare.ts            Cloudflare Pages Domains API client
  crons.ts                 Scheduled jobs (domain monitor every 15 min, crash-log prune every 6 h)
  orders.ts                createOrder, cancelOrder, retryOrder, queries
  payments.ts              Internal: expireHeldSlot, releaseQuarantine, ingestBankEmail
  gmail.ts                 Per-store Gmail poller (primary bank-email feed, pollInbox)
  admin.ts                 markPaid, refundOrder, voidOrder, resolveLatePayment
  wallet.ts                Wallet primitives + balance/ledger queries + admin credit
  storeImport.ts           Dukaan catalog importer
  migrations.ts            One-off data jobs (run only from the /sa button or dev CLI)
  lib/
    auth.ts                requireIdentity / requireMember / requireOrgAdmin
    citadel*.ts            Super-admin (Citadel) session checks
    legacyOrg.ts           LEGACY_ORG_SLUG (oldsmokeshop) and the rename migration
    org.ts, hosts.ts       Store lookup helpers
    audit.ts               adminAuditLog helper
    email.ts, bankAlias.ts Bank-email parsing and alias routing
    ids.ts                 displayOrderId generator
    money.ts               integer-paise helpers
    upi.ts                 buildUpiUrl
    crypto.ts              AES-GCM for stored Gmail refresh tokens
```

## Money

Everything is **integer paise**. `500.47` rupees ↔ `50047` paise. No floats cross the DB.

## Paise fingerprinting (the matching trick)

Bank alert emails only expose the amount (note field is stripped). To match a payment to an order, each pending order's amount is made unique via the last two paise digits:

1. Re-price the cart, shipping, coupon and wallet contribution on the server.
2. Choose a 1–99 paise discount whose resulting amount is not used by a pending order, a recently terminal order in quarantine, or a recently paid order in the duplicate-detection window.
3. Store that exact amount in `finalAmountPaise` and use it in the UPI request.
4. A bank email for `X` identifies the order through `orders.by_org_final_status`.

Legacy `paymentSlots` rows are still supported for older orders.

## Retry model

Failed, expired and cancelled orders are **terminal**. Retries create a **new** `orders` row with `retryOfOrderId` set. Historical state is never mutated.

## Wallet

Append-only `walletLedger` plus denormalized `walletAccounts.balancePaise`, updated in the same mutation. Wallet loads are orders with `kind: "wallet_load"` and use the same payment flow.

Partial wallet payment:
- Debit at order creation.
- If the order expires or is cancelled, `expireHeldSlot` inserts a refund credit.
- `walletRefundedAt` prevents a double refund.

## Multi-tenancy

Every store-owned row is scoped by `orgId`: orders, payment slots, wallets, bank emails, catalog, users. `memberships(orgId, userId, role)` drives access. Stores are found by hostname (`orgDomains`) at the edge and by slug (`orgSlug`) for public catalog queries.

## Setup (dev deployment)

```bash
npm install
npx convex dev                                  # bootstrap the DEV deployment (.env.local)
npx convex env set EMAIL_WEBHOOK_SECRET <random string>
npx convex run organizations:seedOrg '{
  "slug":"<store-slug>",
  "name":"<Store name>",
  "upiVpa":"<vpa>",
  "bankEmailAlias":"<alias>",
  "ownerUserId":"<users row id>"
}'
```

### Own JWT prerequisite

Convex verifies our ES256 JWTs. The public JWKS endpoint `https://cigarro.in/.well-known/jwks.json` must be reachable; Convex fetches it.

### React wiring

Wrap the app root with `ConvexAuthProvider` once, above the router:

```tsx
import { ConvexAuthProvider } from '@/lib/convex/ConvexAuthProvider';

<ConvexAuthProvider>
  <App />
</ConvexAuthProvider>
```

Components should not call Convex directly in theme files. Use hooks in `src/hooks/data/` (see `CLAUDE.md`).

### Email forwarding (fallback)

Gmail sign-in per store is the primary path. For forwarding, the `email-worker` posts to `POST /receiveBankEmail`:

```bash
cd email-worker
npm install
npx wrangler secret put CONVEX_URL              # https://<deployment>.convex.site
npx wrangler secret put EMAIL_WEBHOOK_SECRET    # same value as on Convex
npx wrangler deploy
```

In Cloudflare Email Routing, route each store alias (for example `<store>@pay.cigarro.in`) to the worker. The alias must match a store's `bankEmailAlias` or a `bankInboxes` row.

## Testing the matcher without a real email

```bash
npx convex run payments:ingestBankEmail '{
  "alias":"<alias>",
  "from":"alerts@hdfcbank.net",
  "subject":"UPI credit",
  "rawBody":"Dear Customer, Rs 500.47 credited to A/c xxxx via UPI. UPI Ref: 412345678901",
  "messageId":"test-'"$RANDOM"'@example.com"
}'
```

Then check `bankEmails` and the matched `orders` row in the Convex dashboard.
