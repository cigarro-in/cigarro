# Gmail API + Pub/Sub Setup Guide

Complete guide to set up automatic UPI payment verification using Gmail API and Google Cloud Pub/Sub.

---

## 📋 Prerequisites

- Google Cloud Platform account
- Gmail account (`hrejuh@gmail.com`)
- Cloudflare Workers account (or Cloudflare Pages with Functions)
- Supabase project

---

## 🔧 Step 1: Google Cloud Project Setup

### 1.1 Create New Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: `cigarro-payment-verification`
4. Click "Create"

### 1.2 Enable Required APIs

1. Go to "APIs & Services" → "Library"
2. Search and enable:
   - **Gmail API**
   - **Cloud Pub/Sub API**
   - **Cloud Resource Manager API**

---

## 🔑 Step 2: Create OAuth 2.0 Credentials

### 2.1 Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (or "Internal" if using Google Workspace)
3. Fill in:
   - **App name**: Cigarro Payment Verification
   - **User support email**: your-email@gmail.com
   - **Developer contact**: your-email@gmail.com
4. Click "Save and Continue"
5. **Scopes**: Add `https://www.googleapis.com/auth/gmail.readonly`
6. **Test users**: Add `hrejuh@gmail.com`
7. Click "Save and Continue"

### 2.2 Create OAuth Client

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: `Cigarro Payment Webhook`
5. Authorized redirect URIs:
   - `https://developers.google.com/oauthplayground`
   - `http://localhost:3000` (for testing)
6. Click "Create"
7. **Save the Client ID and Client Secret** - you'll need these!

---

## 🎫 Step 3: Get Refresh Token

### 3.1 Using OAuth Playground

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in top right
3. Check "Use your own OAuth credentials"
4. Enter your **Client ID** and **Client Secret**
5. In left panel, find "Gmail API v1"
6. Select `https://www.googleapis.com/auth/gmail.readonly`
7. Click "Authorize APIs"
8. Sign in with `hrejuh@gmail.com`
9. Click "Allow"
10. Click "Exchange authorization code for tokens"
11. **Copy the Refresh Token** - save this securely!

---

## 📬 Step 4: Set Up Cloud Pub/Sub

### 4.1 Create Pub/Sub Topic

1. Go to "Pub/Sub" → "Topics"
2. Click "Create Topic"
3. Topic ID: `gmail-payment-notifications`
4. Leave other settings as default
5. Click "Create"

### 4.2 Grant Gmail Permission to Publish

1. In the topic details, click "Permissions"
2. Click "Add Principal"
3. Principal: `gmail-api-push@system.gserviceaccount.com`
4. Role: **Pub/Sub Publisher**
5. Click "Save"

### 4.3 Create Subscription

1. In the topic, click "Create Subscription"
2. Subscription ID: `payment-webhook-sub`
3. Delivery type: **Push**
4. Endpoint URL: `https://your-worker.workers.dev/payment-email-webhook`
   - Replace with your actual Cloudflare Worker URL
5. Enable authentication: **Yes**
6. Service account: Create new or use existing
7. Click "Create"

---

## ☁️ Step 5: Deploy Cloudflare Worker

### 5.1 Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 5.2 Create Worker Configuration

Create `wrangler.toml` in your project root:

```toml
name = "payment-email-webhook"
main = "functions/payment-email-webhook.ts"
compatibility_date = "2024-01-01"

[env.production]
vars = { }

[env.production.secrets]
# Set these using: wrangler secret put <NAME>
# GMAIL_CLIENT_ID
# GMAIL_CLIENT_SECRET
# GMAIL_REFRESH_TOKEN
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# WEBHOOK_SECRET
```

### 5.3 Set Secrets

```bash
# Set each secret
wrangler secret put GMAIL_CLIENT_ID
wrangler secret put GMAIL_CLIENT_SECRET
wrangler secret put GMAIL_REFRESH_TOKEN
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put WEBHOOK_SECRET
```

### 5.4 Deploy Worker

```bash
wrangler deploy functions/payment-email-webhook.ts
```

Copy the deployed URL (e.g., `https://payment-email-webhook.your-subdomain.workers.dev`)

### 5.5 Update Pub/Sub Subscription

1. Go back to Pub/Sub subscription
2. Edit the endpoint URL to your deployed worker URL
3. Save

---

## 📧 Step 6: Set Up Gmail Watch

### 6.1 Create Watch Request

Use this script to set up Gmail watch (run once):

```typescript
// setup-gmail-watch.ts
const GMAIL_ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN'; // Get from OAuth playground
const PUBSUB_TOPIC = 'projects/YOUR_PROJECT_ID/topics/gmail-payment-notifications';

async function setupGmailWatch() {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/watch',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GMAIL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: PUBSUB_TOPIC,
        labelIds: ['INBOX'],
        labelFilterAction: 'include',
      }),
    }
  );

  const data = await response.json();
  console.log('Gmail watch setup:', data);
}

setupGmailWatch();
```

Run with:
```bash
npx tsx setup-gmail-watch.ts
```

**Note**: Gmail watch expires after 7 days. You'll need to renew it weekly or set up automatic renewal.

---

## 🗄️ Step 7: Run Database Migration

```bash
# Apply the payment verification migration
supabase db push

# Or manually run the SQL file
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/038_payment_verification_system.sql
```

---

## ✅ Step 8: Testing

### 8.1 Test Email Parser

```bash
cd src/utils/payment
npx tsx -e "import('./emailParser.js').then(m => m.testEmailParser())"
```

### 8.2 Send Test Payment

1. Make a test UPI payment to `hrejuh@upi`
2. Include transaction ID in payment note: `TXN12345678`
3. Wait for confirmation email
4. Check Cloudflare Worker logs
5. Verify order status in Supabase

### 8.3 Check Verification Logs

```sql
-- View recent verifications
SELECT * FROM payment_verifications 
ORDER BY created_at DESC 
LIMIT 10;

-- View verification logs
SELECT * FROM payment_verification_logs 
ORDER BY created_at DESC 
LIMIT 20;

-- Check orders with auto-verification
SELECT id, transaction_id, status, payment_confirmed, auto_verified 
FROM orders 
WHERE auto_verified = true 
ORDER BY created_at DESC;
```

---

## 🔄 Step 9: Automatic Watch Renewal

Gmail watch expires after 7 days. Set up automatic renewal:

### 9.1 Create Renewal Worker

```typescript
// functions/renew-gmail-watch.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    // Get access token
    const accessToken = await getGmailAccessToken(env);
    
    // Renew watch
    await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: env.PUBSUB_TOPIC,
        labelIds: ['INBOX'],
        labelFilterAction: 'include',
      }),
    });
    
    console.log('Gmail watch renewed');
  },
};
```

### 9.2 Add Cron Trigger

In `wrangler.toml`:

```toml
[triggers]
crons = ["0 0 * * 0"] # Every Sunday at midnight
```

---

## 🔐 Security Best Practices

1. **Never commit secrets** to git
2. **Use environment variables** for all sensitive data
3. **Rotate credentials** regularly
4. **Enable 2FA** on Google account
5. **Monitor access logs** in Google Cloud Console
6. **Set up alerts** for failed verifications
7. **Limit OAuth scopes** to minimum required
8. **Use service accounts** where possible

---

## 📊 Monitoring

### Cloudflare Worker Logs

```bash
wrangler tail payment-email-webhook
```

### Google Cloud Logs

1. Go to "Logging" → "Logs Explorer"
2. Filter by resource: "Cloud Pub/Sub Topic"
3. View publish/delivery logs

### Supabase Logs

```sql
-- Failed verifications
SELECT * FROM payment_verifications 
WHERE verification_status = 'failed' 
ORDER BY created_at DESC;

-- Verification success rate
SELECT 
  verification_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM payment_verifications
GROUP BY verification_status;
```

---

## 🐛 Troubleshooting

### Issue: No emails received

**Check:**
- Gmail watch is active: `GET /gmail/v1/users/me/watch`
- Pub/Sub topic has correct permissions
- Worker endpoint is accessible
- Webhook secret matches

### Issue: Emails not parsing

**Check:**
- Bank email templates in database
- Email format matches regex patterns
- Test with `testEmailParser()` function
- Check verification logs for errors

### Issue: Orders not updating

**Check:**
- Supabase service role key is correct
- RLS policies allow service role access
- Order exists and is in 'pending' status
- Transaction ID matches

### Issue: Watch expired

**Solution:**
- Renew watch manually or via cron
- Set up automatic renewal worker
- Check expiration: `GET /gmail/v1/users/me/watch`

---

## 📈 Success Metrics

After setup, monitor these metrics:

- **Email Processing Latency**: < 2 seconds
- **Verification Success Rate**: > 95%
- **False Positive Rate**: < 1%
- **System Uptime**: > 99.9%
- **Manual Intervention Rate**: < 5%

---

## 🎯 Next Steps

1. ✅ Complete all setup steps above
2. ✅ Test with real payment
3. ✅ Monitor for 24 hours
4. ✅ Add more bank templates as needed
5. ✅ Set up alerts for failures
6. ✅ Create admin dashboard for monitoring
7. ✅ Document any custom bank email formats

---

## 📞 Support

If you encounter issues:

1. Check Cloudflare Worker logs
2. Check Google Cloud Pub/Sub logs
3. Check Supabase verification logs
4. Review this guide step-by-step
5. Test individual components separately

---

## 🔗 Useful Links

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Supabase Documentation](https://supabase.com/docs)
