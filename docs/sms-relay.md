# SMS relay: bank credit SMS from the store owner's phone

A store owner's phone receives the bank's credit SMS. MacroDroid on the phone
(Android) or a Shortcuts automation (iPhone) POSTs each SMS straight to the
store's webhook. The SMS then goes through the same matching as bank emails
(`processBankMessage` in `convex/payments.ts`).

Product rule: the merchant never thinks. The merchant sees one card, "Automatic
payment confirmation" (Payments > Settings, `AutoConfirmCard.tsx`), with one
button and then only a status line. Every rule and every message lives in the
super admin at `/sa/payments` (Messages, Rules) and on the store page
(Orders, Payments tabs).

## Merchant flow

- Android: "Connect this phone" calls `smsRelay.connectPhone`, which rotates the
  store token and returns a ready MacroDroid file (`convex/lib/macrodroid.ts`,
  name "Cigarro payments", any-number SMS trigger, HTTP POST). Steps shown:
  1. Get MacroDroid (an `intent://` link that opens MacroDroid, or the Play Store
     when it is not installed). 2. Share to MacroDroid via the Web Share API; when
  the browser cannot share the file (Chrome only shares a fixed list of file
  types and `.macro` is not on it), the file downloads as `cigarro-payments.macro`
  and the step reads "Open the downloaded file, choose MacroDroid, tap Import".
  3. Allow SMS and battery when MacroDroid asks. The URL is never displayed.
- iPhone: "Set up on this iPhone" gives a "Copy setup link" button and a three-line
  Shortcuts guide (Apple cannot share automations). The link is copied, not shown.
- Desktop: a QR code that opens the same page on the phone.
- After setup: status only. Connected with last confirmation time, waiting for the
  first bank SMS, "hasn't sent anything for a day" (open MacroDroid), or a setup
  error (template text received; "Set up again"). Gmail is the sibling option
  ("or confirm via Gmail") in the same card. The shell banner prompts until one works.

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
- Token: 32 random bytes, base64url (43 characters). Only its SHA-256 is stored (`smsRelays.tokenHash`), plus the last 4 characters.
- Unknown or revoked tokens get 401. 60 requests per token per minute (429 with `Retry-After: 60`). Body up to 8 KB.
- Connecting a phone again rotates the token; the old phone stops at once.

## 3. Payload

The generated macro sends `text/plain`: first line = sender, the rest = SMS text
(`{sms_number}
{sms_message}`). Quotes and newlines in an SMS cannot break it.
JSON still works for Shortcuts and old setups:
`{"sender": "VM-HDFCBK-S", "body": "...", "receivedAt": 1763200000000}`.

Setup errors: unreplaced magic text (`{sms_number}`, `{SMS_MESSAGE}`, `<SENDER>`,
`{{body}}`), an empty sender or body, or broken JSON are recorded as
`setup_error` (Messages view, and the merchant card asks to set up again). They
return 200 so the phone does not retry.

## 4. Decision rules (super admin)

Rules are in `paymentPipelineSettings`: one global row plus optional per-store
overrides (`convex/pipeline.ts` `loadPipelineConfig`; defaults in
`convex/lib/bankMessage.ts`). Edited at `/sa/payments` > Rules and on the store
page > Payments.

- Accepted TRAI suffixes: default T, S and no suffix. P (promotional) and G are off.
- Phone-number senders: rejected by default (anyone can text a fake credit).
- Known bank senders: seeded with the major Indian bank entities. "Only known
  banks" is off by default. A store can add extra entities.
- Credit words (credited, received, deposited, credit) plus a rupee amount, and no
  debit words (debited, debit, spent, withdrawn, sent, paid to).
- Legacy: a store's old merchant SMS allowlist (`organizations.allowedSmsSenders`)
  still counts as known senders and turns on known-only for that store, until the
  super admin removes it on the store page.
- Bank email senders per store (`organizations.allowedBankSenders`) are edited on
  the store page too; the merchant no longer sees them.

Parsing: amount from the first `Rs`/`INR`/`₹` amount (paise exact); UPI
reference = 12 digits (`UPI:668516223148`, `UPI Ref No`, `RRN`, `UTR`, or a bare
12-digit run in a UPI message). Example: ICICIT-S "Acct XX181 is credited with
Rs 1.00 ... UPI:668516223148-ICICI Bank." gives 100 paise and 668516223148.

## Cross-channel dedupe

The same UPI credit can arrive by SMS and by bank email. Before any matching,
`findChannelDuplicate` (`convex/payments.ts`) treats a message as the same
payment when:

- the UPI reference equals an earlier message of the store (any channel), or
- the amount equals an earlier message on the other channel within the duplicate
  window (default 10 minutes) and their UPI references do not disagree.

The second arrival is stored with status `duplicate`, linked to the first
(`duplicateOfEmailId`, and its order), and never marks an order paid or credits a
wallet. If only the second copy carried the UPI reference, the first learns it.
A bank email that no template can read is still checked this way (best-effort
amount and reference) so it does not show as an unmatched credit. Outside the
window, a credit on the other channel with the same amount as an order already
confirmed in the last 6 hours is also linked as a duplicate instead of being
credited to the wallet as an overpayment.

Repeats of the exact same SMS (MacroDroid retries) are dropped by an org + sender +
body + 2-minute bucket key.

## Message log (TEMPORARY: full text kept)

Every SMS and bank email is written to `paymentMessages` with the full text,
sender, parsed amount, UPI reference, outcome (matched, credit not matched,
ignored, duplicate, setup error), the reason, and the linked order. For now every
SMS body is kept, including non-credits, so the owner can study real data. OTP
messages are kept with the digit codes masked. This is temporary: once the rules
are settled, stop storing non-credit bodies and add a retention limit.

The super admin reads it at `/sa/payments` (filters: store, channel, outcome, text
search; credit-not-matched rows list close orders: same rupees, within a day) and
on each order at `/sa/stores/<orgId>/orders/<orderId>` (Payment evidence: every
linked SMS/email, which one confirmed it, which were duplicates; Possible
matches: unmatched credits of that store within a day with the same rupees).
Read-only: no manual linking from the super admin yet.

`smsRelayLog` (the old merchant "Recent messages" list) is no longer written.

## 5. iPhone setup (Shortcuts)

1. Shortcuts > **Automation** > **+** > **Create Personal Automation** > **Message**.
2. Sender: the bank sender ID or contact. Optionally "Message contains" `credited`.
3. Next > **Add Action** > **Get Contents of URL**. URL = paste the link copied with "Copy setup link".
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
- Dedupe and the super-admin rules run before any matching. Phone-number senders are rejected by default.
- The relay stores every SMS body for now (may include account digits and UPI refs; OTP codes masked). See "Message log". Only the super admin can read them.
- Only use HTTPS. Do not paste the webhook URL into shared chats.

## 7. Battery and background (summary)

- Android: MacroDroid unrestricted, auto-start allowed on the phone brand (Xiaomi, Oppo, Vivo, Realme often need an extra "autostart" toggle).
- iPhone: Shortcuts automations run in the background only when the Shortcut's conditions are met. Keep Low Power Mode off for the test day.
- The merchant card says the phone has not sent anything for a day when the last SMS is over a day old.
