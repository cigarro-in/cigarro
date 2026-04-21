# Convex backend — payments & wallet

First module of the Convex migration. Owns orders, payments, wallet, and admin reconciliation. Auth bridges into the existing Supabase session — no user migration needed.

## Layout

```
convex/
  schema.ts                All tables + shared validators
  auth.config.ts           Supabase → Convex JWT trust
  http.ts                  /receiveBankEmail (called by Cloudflare Email Worker)
  organizations.ts         Org settings + seedOrg bootstrap
  orders.ts                createOrder, cancelOrder, retryOrder, queries
  payments.ts              Internal: expireHeldSlot, releaseQuarantine, ingestBankEmail
  wallet.ts                Wallet primitives + balance/ledger queries + admin credit
  admin.ts                 markPaid, refundOrder, voidOrder, resolveLatePayment
  lib/
    auth.ts                requireIdentity / requireMember / requireOrgAdmin
    audit.ts               audit log helper
    email.ts               parseBankEmail (amount + UPI ref)
    ids.ts                 displayOrderId generator
    money.ts               integer-paise helpers
    upi.ts                 buildUpiUrl
```

## Money

Everything is **integer paise**. `500.47` rupees ↔ `50047` paise. No floats crossing the DB.

## Paise-slot fingerprinting (the matching trick)

Bank alert emails only expose the amount (note field is stripped). To match a payment to an order, we make each pending order's amount unique via the last two paise digits:

1. Compute `baseAmountPaise` (cart total minus wallet debit).
2. `allocateSlot(orgId, baseAmountPaise)` picks the lowest free slot `0..99` for that `(orgId, baseAmount)` pair.
3. `finalAmountPaise = baseAmount + slot`. That's the UPI ask.
4. Bank email arrives for `X` → `orders.by_org_final_status` index hits exactly one held order.

Slot states: `free → held → quarantined → free`. Verified payments free instantly; every other terminal state goes through a 30-minute quarantine so late UPI arrivals don't get misattributed to a freshly-assigned order.

## Retry model

Failed / expired / cancelled orders are **terminal**. Retries create a **new** `orders` row with `retryOfOrderId` set — no mutation of historical state. Clean audit, clean slot lifecycle, clean analytics.

## Wallet

Append-only `walletLedger` + denormalized `walletAccounts.balancePaise` updated in the same mutation. Wallet loads are just `orders` with `kind: "wallet_load"` — same slot flow, same email matcher. A successful wallet-load credits the ledger.

Partial wallet payment:
- Debit at order creation
- If order expires/cancels, `expireHeldSlot` inserts a refund credit
- `walletRefundedAt` flag prevents double refund

## Multi-tenancy

Every row is scoped by `orgId`. Slot pools, orders, wallets, bank emails — all org-isolated. `memberships(orgId, userId, role)` drives access. Org is resolved from the incoming email's To: alias (`bank-<slug>@yourdomain.com`) via `organizations.by_alias`.

## Setup

```bash
# 1. Install Convex CLI + client
npm install

# 2. Bootstrap Convex deployment (pick a name, follow prompts)
npx convex dev

# 3. In a second shell, set env vars on the Convex deployment
npx convex env set SUPABASE_URL https://<project-ref>.supabase.co
npx convex env set EMAIL_WEBHOOK_SECRET <generate a random string>

# 4. Copy your Convex URL into .env
echo "VITE_CONVEX_URL=https://<deployment>.convex.cloud" >> .env

# 5. Seed the first org (replace values)
npx convex run organizations:seedOrg '{
  "slug":"cigarro",
  "name":"Cigarro",
  "upiVpa":"cigarro@ybl",
  "bankEmailAlias":"cigarro",
  "ownerUserId":"<your-supabase-auth.users.id>"
}'
```

### Supabase JWT prerequisite

Convex verifies Supabase JWTs using RS256. Enable asymmetric JWT signing in the Supabase dashboard:

> Project Settings → Auth → JWT Signing Keys → migrate to RS256

The public JWKS endpoint `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` must be reachable; Convex fetches it on startup.

### React wiring

Wrap the app root with `ConvexSupabaseProvider` (once — above your router but below the Supabase session initialiser):

```tsx
import { ConvexSupabaseProvider } from '@/lib/convex/ConvexSupabaseProvider';

<ConvexSupabaseProvider>
  <App />
</ConvexSupabaseProvider>
```

Then use Convex hooks as usual:

```tsx
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const order = useQuery(api.orders.getMine, { orderId });
const createOrder = useMutation(api.orders.createOrder);
```

### Email worker

```bash
cd email-worker
npm install
npx wrangler secret put CONVEX_URL              # https://<deployment>.convex.site
npx wrangler secret put EMAIL_WEBHOOK_SECRET    # same value you set on Convex
npx wrangler deploy
```

Then in Cloudflare dashboard:
1. Domain → Email → Email Routing → Enable
2. Add addresses `bank-<slug>@yourdomain.com` → action "Send to Worker" → pick `cigarro-bank-email`
3. In Gmail, auto-forward bank alerts to that address

## Testing the matcher without real email

```bash
npx convex run payments:ingestBankEmail '{
  "alias":"cigarro",
  "from":"alerts@hdfcbank.net",
  "subject":"UPI credit",
  "rawBody":"Dear Customer, Rs 500.47 credited to A/c xxxx via UPI. UPI Ref: 412345678901",
  "messageId":"test-"$RANDOM"@gmail.com"
}'
```

Then tail `bankEmails` and the matched `orders` row via the Convex dashboard.

## Still TODO (flag when you pick these up)

- Frontend: new `/checkout` page that calls `api.orders.createOrder` and redirects to a reactive `/transaction/:orderId` page that `useQuery`s `api.orders.getMine`.
- Delete Supabase RPCs `verify_order_payment`, `process_order_payment`, `create_order`, and the Cloudflare function `functions/api/webhooks/payment-email.js` after cutover.
- Admin UI screens for late payments, unmatched emails, wallet credits.
