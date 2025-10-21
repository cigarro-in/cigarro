# Gmail OAuth2 Setup Guide

This guide will help you set up Gmail API access for automatic payment verification.

## 🎯 Overview

We use Gmail API with OAuth2 refresh tokens to automatically check for payment confirmation emails. This is:
- ✅ Fully automated (no manual intervention)
- ✅ Works with free Gmail accounts
- ✅ No third-party services required
- ✅ Secure and reliable

## 📋 Prerequisites

- Gmail account (hrejuh@gmail.com)
- Google Cloud Console access
- 10 minutes of setup time

---

## 🚀 Setup Steps

### Step 1: Create Google Cloud Project (2 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Name it: `Cigarro Payment Verification`
4. Click **"Create"**

### Step 2: Enable Gmail API (1 minute)

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Gmail API"**
3. Click on it and click **"Enable"**

### Step 3: Create OAuth2 Credentials (3 minutes)

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. If prompted, configure OAuth consent screen:
   - User Type: **External**
   - App name: `Cigarro Payment Verification`
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"** through all steps
4. Back to Create OAuth client ID:
   - Application type: **Desktop app**
   - Name: `Cigarro Gmail Access`
   - Click **"Create"**
5. **Download the JSON** or copy the **Client ID** and **Client Secret**

### Step 4: Get Refresh Token (2 minutes)

1. Open `scripts/get-gmail-refresh-token.js`
2. Replace `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` with values from Step 3
3. Run the script:
   ```bash
   node scripts/get-gmail-refresh-token.js
   ```
4. Browser will open → Sign in with `hrejuh@gmail.com`
5. Click **"Allow"** to grant Gmail access
6. Script will display your **refresh token** and other credentials

### Step 5: Add to Cloudflare (2 minutes)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your **Pages project** (cigarro)
3. Go to **Settings** → **Environment Variables**
4. Add these variables (from Step 4 output):
   ```
   GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=xxx
   GMAIL_REFRESH_TOKEN=xxx
   GMAIL_USER_EMAIL=hrejuh@gmail.com
   ```
5. Also keep existing variables:
   ```
   SUPABASE_URL=xxx
   SUPABASE_SERVICE_ROLE_KEY=xxx
   WEBHOOK_SECRET=xxx
   ```

---

## ✅ Verification

After setup, test the integration:

1. **Deploy the updated code** (push to GitHub)
2. **Make a test payment** on cigarro.in
3. **Check Cloudflare Logs**:
   - Go to Pages → Functions → Real-time Logs
   - You should see: `"Searching Gmail with query: ..."`
   - Then: `"Found X potential emails"`
   - Finally: `"✅ Payment verified!"`

4. **Check Supabase**:
   ```sql
   SELECT * FROM payment_verification_logs 
   ORDER BY created_at DESC LIMIT 5;
   ```
   Should show the verification attempt with all steps logged.

---

## 🔒 Security Notes

- ✅ Refresh token is stored securely in Cloudflare
- ✅ Only has Gmail read-only access
- ✅ Can be revoked anytime from Google Account settings
- ✅ No password stored anywhere

## 🔄 Token Refresh

The refresh token **never expires** unless:
- You revoke it manually
- You change your Google password
- 6 months of inactivity

If it stops working, just re-run Step 4 to get a new one.

---

## 🐛 Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Make sure redirect URI is exactly: `http://localhost:3000/oauth2callback`
- Add it to authorized redirect URIs in Google Cloud Console

### "Error 403: access_denied"
- Make sure you're signing in with the correct Gmail account
- Check OAuth consent screen is configured

### "No emails found"
- Check Gmail actually received payment confirmation
- Verify email is from supported banks (PhonePe, Google Pay, etc.)
- Check Cloudflare logs for search query

### "Token expired"
- Function automatically refreshes access tokens
- If refresh token expired, re-run Step 4

---

## 📊 How It Works

```
User makes payment
    ↓
Frontend calls /functions/payment-email-webhook
    ↓
Function exchanges refresh token for access token (cached 1 hour)
    ↓
Searches Gmail API for payment email (last 5 minutes)
    ↓
Parses email to extract amount, bank, UPI ref
    ↓
Verifies amount matches order
    ↓
Updates order status in Supabase
    ↓
Logs all steps to payment_verification_logs
    ↓
Returns verified=true/false to frontend
```

---

## 📞 Support

If you encounter issues:
1. Check Cloudflare Functions logs
2. Check Supabase `payment_verification_logs` table
3. Verify all environment variables are set correctly
4. Ensure Gmail API is enabled in Google Cloud

---

**Setup complete! 🎉**
