# Apps Script onboarding — "Connect Gmail"

This script lets your store auto-confirm UPI payments by reading bank-alert
emails from **your** Gmail and relaying them to our backend. It runs inside
your own Google account; we never see your inbox.

## For you (the store owner / you set this up once)

### 1. Publish the master template (one-time, admin of the shop does this)

This step is done once by the platform owner (Ahad), not by every tenant.

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Replace the default code with the contents of [`Cigarro.gs`](./Cigarro.gs).
3. Save the project with a descriptive name, e.g. `Cigarro Bank Relay`.
4. Click **Share** (top-right) → make it "Anyone with the link → Viewer".
5. Copy the **Project ID** from the URL (`…/projects/<PROJECT_ID>/edit`).
6. Build a template-copy URL: `https://script.google.com/home/projects/<PROJECT_ID>/copy`.
7. Open `src/adminnew/pages/PaymentSettingsPage.tsx`, replace `GAS_COPY_URL`
   with that URL, and redeploy the web app.

### 2. Per-tenant setup (runs in the shop owner's admin panel)

Each new tenant (shop owner) signs in to your admin, opens
**Payments → Payment Settings → Connect Gmail**, and follows the 4-step wizard:

**Step 1 — Copy the template**
- Wizard opens your master template URL in a new tab.
- Tenant clicks "Make a copy" in Apps Script. The copy lives in their Drive.

**Step 2 — Paste the secret**
- Wizard shows a freshly-generated secret.
- Tenant opens their copy → **Project Settings (gear icon)** → **Script properties**
  → adds property name `CONVEX_SECRET`, value = the secret, Save.

**Step 3 — Deploy as Web App**
- In their copy, tenant clicks **Deploy** → **New deployment**:
  - Type: **Web app**
  - Execute as: **Me**
  - Who has access: **Anyone**
- First-time OAuth consent: Google warns *"hasn't been verified"* — this is
  normal for any self-deployed Apps Script. Tenant clicks **Advanced** →
  **Go to (project name)** → **Allow**.
- Tenant copies the resulting Web App URL and pastes it into the wizard.

**Step 4 — Save and test**
- Tenant clicks **Save & test**. We fire a test poke.
- They can verify by opening Gmail — recent HDFC alert emails should get a
  new `convex-sent` label within 30 seconds.

That's it. Total time: ~3 min per tenant.

## Supported banks

The default `BANK_SENDERS` script property is:

```
@hdfcbank.bank.in,@hdfcbank.net,alerts@hdfcbank
```

To add more banks, edit the script property in Apps Script and add comma-separated
sender domains:

```
@hdfcbank.bank.in,@icicibank.com,@sbi.co.in
```

For each new bank, also add a parsing template in the admin's
**Payments → Templates** page (once that UI is built).

## Quotas (for reference)

Consumer Gmail (free) limits:

- URL fetches/day: **20,000**
- Gmail read ops/day: **20,000**
- Total script runtime/day: **90 min**

At 500 orders/day this uses ~30 min runtime and ~5k fetches — well under.

If a shop crosses ~1,500 orders/day consistently, upgrade that shop's Gmail
to **Google Workspace Business Starter** (₹125/mo ≈ $7/mo). Limits become
360 min/day + 100,000 URL fetches/day, which covers ~5,000 orders/day.

Beyond that, move to a real payment gateway (Razorpay / Decentro).

## Security

- Convex → GAS auth: shared secret in request body (Apps Script web apps
  can't read request headers). Constant-time compare in GAS.
- Each tenant's GAS is isolated in their own account. Your Gmail never sees
  another tenant's emails.
- Labels (`convex-sent`) mark processed messages so they're not re-sent.
- If the tenant deletes or disables the script, we stop receiving emails —
  customer orders will remain `pending` until baseline (daily sweep) or the
  tenant reconnects.

## Troubleshooting

- **"Connect" shows red "Not connected" even after setup** — Apps Script URL
  didn't save. Open Payment Settings → Advanced → paste the URL manually.
- **Nothing labeled in Gmail after test poke** — check Apps Script's
  Executions tab for errors. The most common cause is missing `CONVEX_SECRET`
  script property.
- **Wrong script properties values** — you have to redeploy the web app
  after changing script properties for some versions. Click Deploy → Manage
  deployments → Edit → Version: New version → Deploy.
- **"Execute as" was set to "User accessing the web app"** — Convex's
  server-to-server calls have no Google identity, so the script can't read
  Gmail. Change to "Execute as: Me" and redeploy.
