# SMS relay: bank credit SMS from the store owner's phone

A store owner's phone receives the bank's credit SMS. A small app on the phone
(Android) or a Shortcuts automation (iPhone) POSTs each SMS straight to the
store's webhook. The SMS then goes through the same matching as bank emails
(`processBankMessage` in `convex/payments.ts`). Setup is in the admin at
Payments > Settings > SMS relay.

## 1. Research

Verification notes: the Play Store pages were fetched through a web tool that
returned only the page title for MacroDroid and "SMS Forwarder" (frzinapps). So
"the listing exists" is confirmed; developer, last-updated date, price and
feature details are not. Open the listing yourself before rollout.

| App | Play Store listing | Free | Open source | Webhook POST | Custom headers / JSON body | Sender filter | Sends direct from phone | Verdict |
|---|---|---|---|---|---|---|---|---|
| **MacroDroid** (`com.arlosoft.macrodroid`) | Yes, title confirmed | Free tier; confirm the HTTP request action is included | No | Yes (HTTP request action, to verify on the free tier) | Headers and body template, to verify | Via the SMS trigger's sender filter, to verify | Yes | **Primary (Android)** |
| **SMS Forwarder** by frzinapps (`com.frzinapps.smsforward`) | Yes, title confirmed | Freemium, ad-watching free tier plus subscription | No | Not confirmed | Not confirmed | Not confirmed | Not confirmed | Not chosen. Re-check in-app before any use |
| **sms-forward-to-webhook** (dealright) | No (GitHub, Obtainium, F-Droid submission) | Yes | Yes | Yes | Yes, custom headers and JSON template with `{{sender}}`/`{{body}}` | Not listed | Yes | Fails the Play requirement. Good sideload fallback |
| **exelaguilar/sms-forwarder** | No (GitHub APK) | Yes | Yes, MIT | Yes | Yes, headers and JSON body template | Yes (regex, number, contact, exclude list) | Yes, "no cloud service in the middle" | **Fallback (Android, sideload)** |
| **httpSMS** (NdoleStudio) | Not found. A guessed `com.httpsms` listing returned 404 | Free plan, 200 SMS per month | Yes, AGPL-3.0 | Yes | Yes, HS256 JWT bearer on the service | Not checked | **No.** The default service relays SMS through the httpSMS cloud | Rejected (third-party cloud sees the SMS, no Play listing) |

Sources:
- MacroDroid Play listing: https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid
- SMS Forwarder (frzinapps) Play listing: https://play.google.com/store/apps/details?id=com.frzinapps.smsforward
- dealright/sms-forward-to-webhook: https://github.com/dealright/sms-forward-to-webhook
- exelaguilar/sms-forwarder: https://github.com/exelaguilar/sms-forwarder
- NdoleStudio/httpsms: https://github.com/NdoleStudio/httpsms
- httpSMS webhook docs: https://docs.httpsms.com/webhooks/introduction
- Apple Shortcuts user guide, Add automations: https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios
- Apple Shortcuts user guide, Create personal automations: https://support.apple.com/guide/shortcuts/create-personal-automations-apdf22b0444c/ios
- Run Immediately on iOS 17 (third-party): https://matthewcassinelli.com/automations-run-immediately-shortcuts-notifications/

**Picked:** MacroDroid for Android (the only candidate that is on Play and has
an HTTP request action). Fallback: exelaguilar/sms-forwarder APK (MIT, sender
filter, custom headers, no cloud), sideloaded from its GitHub release. It is not
on Play, so it needs "install unknown apps" on the phone.

**iPhone:** the built-in Shortcuts app. iOS does not let any third-party app read
incoming SMS, so no App Store app can do this without the same Shortcuts trigger.
I did not compare App Store apps; if one turns up, check it against the same
rules (no third-party cloud, HTTPS POST, sender filter).

## 2. Endpoint and auth

- Route: `POST https://<deployment>.convex.site/receiveBankSms/<token>` (`convex/http.ts`, `pathPrefix` route).
- Token: 32 random bytes, base64url (43 characters), made by `convex/smsRelay.ts` `generateToken` (`crypto.getRandomValues`).
- Storage: only the SHA-256 of the token is stored (`smsRelays.tokenHash`, indexed). The last 4 characters are kept for display. The full URL is shown once at generation and never again.
- Check: the path must match `^[A-Za-z0-9_-]{43}$`, then the hash is looked up by index and the row must be `active`. Unknown or revoked tokens get 401.
- Rotate: a new token replaces the hash, so the old URL stops working at once. Revoke sets `active: false`.
- Admin-only: `getStatus`, `generateToken`, `revokeToken`, `setAllowedSmsSenders` all call `requireOrgAdmin`. Every change writes `adminAuditLog` (the token itself is never logged).
- Rate limit: 60 requests per token per minute (fixed window). Over the limit returns 429 with `Retry-After: 60`.
- Body size: 8 KB raw, 2000 characters for `body`, 40 for `sender`.

## 3. Payload

```json
{ "sender": "VM-HDFCBK", "body": "Rs.1,250.00 credited to A/c XX1234 on 15-11-26 by UPI Ref 412345678901 ...", "receivedAt": 1763200000000 }
```

- `sender` (required): the SMS sender ID, as the phone shows it.
- `body` (required): the SMS text.
- `receivedAt` (optional): epoch milliseconds or an ISO string. Used for dedupe. Values more than a day old or 5 minutes in the future are replaced by server time.
- Response: `{"ok": true, "matched": true, ...}` or the processing result (`duplicate`, `ignored`, `unmatched`).

Sender filter (`convex/lib/smsSenders.ts`, `decideSms`): the phone forwards every
SMS ("Any number"). The sender is parsed as TRAI format `<prefix>-<entity>-<suffix>`
(`AX-ICICIT-T`: prefix AX, entity ICICIT, suffix T; prefix and suffix are optional).

- Explicit list (`allowedSmsSenders`): match on the entity. `HDFCBK`, `VM-HDFCBK`
  and `AD-HDFCBK-S` all match HDFCBK. Other senders are stored as `ignored` with
  the reason, no body.
- Empty list: accept only suffix T, S or none, and only when the body reads as a
  credit (amount marker plus credited/received/deposited/credit, no
  debited/debit/spent/withdrawn).
- Always dropped without storing anything: OTP bodies, suffix P (promotional),
  suffix G (government).

Dropped and ignored SMS never store the body. Non-credit ones keep a metadata
row (sender, suffix, reason) with an empty `rawBody`.

Detected senders: each accepted SMS that parses to an amount records its entity
on the organization (`detectedSmsSenders`, count and last seen). The admin card
shows them with "Only accept these", which saves them as the explicit list.

Dedupe: key = org + sender + body + 2-minute bucket of `receivedAt`, checked
against the current and previous bucket. Repeats are returned as `duplicate`.
Any UPI-ref duplicate is also caught by the existing matching step.

Every accepted SMS is stored in `bankEmails` with `channel: "sms"` and shows in
Payments > Matched (or Unmatched, Ignored by status).

Recent messages card: every SMS the relay handles (accepted, dropped or
duplicate) also writes one metadata row to `smsRelayLog` (time, sender entity and
suffix, outcome, plain-language reason, amount, order link). No body is stored
there. The card lists the latest 20, newest first, live. The SMS text is shown only
for accepted credits and is read from `bankEmails`. The log keeps the latest 200
rows per store.

## 4. Android setup (MacroDroid)

1. Install **MacroDroid - Device Automation** from Google Play.
2. New macro. Trigger: **Phone > SMS received**. Sender: **Any number**. The server filters bank credits; do not list senders on the phone.
3. Action: **Web > HTTP request**. Method POST. URL = the webhook URL from the card. Body type JSON. Header `Content-Type: application/json`.
4. Body: `{"sender": "<SENDER>", "body": "<MESSAGE>"}`. Replace the placeholders with MacroDroid's sender and message magic text (verify the names in the app).
5. Battery: Android Settings > Apps > MacroDroid > Battery > **Unrestricted**. Turn off "Remove permissions if app is not used" for MacroDroid on Android 11 and later. Keep the phone plugged in overnight if the store runs late.
6. Test: send a bank credit SMS to the phone, check Payments > Matched.

Caveat: a JSON body built from raw SMS text breaks if the SMS contains `"` or a
newline, because the template does not escape them. Bank SMS rarely contain
either. If one fails with 400 ("bad json") in the app's log, switch that macro to
a form-encoded body or use the Shortcuts-style Dictionary approach.

## 5. iPhone setup (Shortcuts)

1. Shortcuts > **Automation** > **+** > **Create Personal Automation** > **Message**.
2. Sender: the bank sender ID or contact. Optionally "Message contains" `credited`.
3. Next > **Add Action** > **Get Contents of URL**. URL = the webhook URL from the card.
4. Tap **Show More**. Method **POST**. Request Body **JSON** (or a Dictionary). Add header `Content-Type: application/json` (the header field sits under Show More; verify on your iOS version).
5. Body Dictionary: key `sender` = the Sender variable; key `body` = Shortcut Input (the message text). Use a Dictionary, not hand-written JSON, so quotes are escaped.
6. Back in the automation: choose **Run Immediately** (not Run After Confirmation). Then **Edit** > info (i) > **Privacy** > **Allow Running When Locked** on, so it runs with the phone locked.
7. Turn off "Notify When Run" if the option appears. See the caveats below.

Shortcut body, JSON equivalent: `{"sender": "<Sender>", "body": "<Shortcut Input>"}`.

### iOS caveats (honest)

- **Confirmation tap:** Apple's Shortcuts guide documents "Allow Running When Locked" and says the automation will not notify when it runs with that option on. It also says some automations may still need individual actions set to run automatically. Those are the only confirmed points.
- **"Run Immediately":** Third-party sources (Matthew Cassinelli, iOS 17 beta coverage) say it arrived in iOS 17 for Message triggers, and that a notification is forced (the "Notify When Run" toggle hides). Those do not agree with Apple's "no notification" note, so check the notification setting on your phone.
- **iOS 27** shows "Confirm Before Run" instead, per a 2026 troubleshooting article (third-party). Turn it off.
- **Locked phone:** Apple's page implies that "Allow Running When Locked" covers locked runs, but I did not verify that it runs after a reboot before the first unlock, in Low Power Mode, or on very old iOS. Test the store's phone for a full day with the screen off.
- **Sender field:** the exact sender filter UI and the Sender variable name differ by iOS version. Check on the device.
- **Headers:** I did not confirm the Get Contents of URL header field from Apple's page. The body needs `Content-Type: application/json`, but if the body is sent as JSON, Shortcuts sets that header itself. Check on the device.
- iPhone cannot relay RCS messages; bank SMS are normal SMS, so this is fine for the banks in use.

## 6. Security notes

- The token is in the URL path, so it appears in request logs (Convex, and any proxy the phone uses). Anyone who sees the URL can post fake credits. Rotate the URL if it leaks; a rotated URL is dead at once. The fake-credit risk is limited to matching against pending orders with the exact paise amount, and every matched order still shows in Payments for review.
- Only the hash is stored; the admin can never read the URL back.
- Dedupe and the sender allowlist run before any matching. Empty allowlist = nothing matched.
- The relay stores the SMS body (may include account digits and UPI refs), the same as the bank-email path. Ignored SMS are stored too, so keep the sender allowlist tight.
- Only use HTTPS. Do not paste the webhook URL into shared chats.

## 7. Battery and background (summary)

- Android: MacroDroid unrestricted, auto-start allowed on the phone brand (Xiaomi, Oppo, Vivo, Realme often need an extra "autostart" toggle).
- iPhone: Shortcuts automations run in the background only when the Shortcut's conditions are met. Keep Low Power Mode off for the test day.
- The admin card shows "No bank SMS in 24 hours" when the last accepted SMS is over a day old.
