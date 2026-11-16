import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { isSafeReturnTo, returnFallbackFor } from "./lib/auth";
import { encryptSecret } from "./lib/crypto";
import { gmailRedirectUri } from "./gmail";
import { saExchange, saLogout, saMe, saPreflight } from "./saHttp";
import { LEGACY_ORG_SLUG } from "./lib/legacyOrg";
import { CLAIM_PATH_PREFIX, SMS_PATH_PREFIX, SMS_TOKEN_RE, sha256Hex } from "./smsRelay";
import { detectSetupError, parseRelayPayload } from "./lib/bankMessage";

const http = httpRouter();

http.route({
  path: '/crashLogs', method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.EDGE_SHARED_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const text = await req.text();
    if (text.length > 24000) return new Response('Too large', { status: 413 });
    try {
      const body = JSON.parse(text);
      const result = await ctx.runMutation(internal.crashLogs.record, {
        orgSlug: body.orgSlug, reporter: body.reporter, report: body.report,
      });
      return new Response(JSON.stringify(result), {
        status: result.accepted ? 200 : 429,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    } catch {
      return new Response('Invalid crash report', { status: 400 });
    }
  }),
});

// ---------- Google OAuth callback (one-click Gmail connect, per store) ----------
//
// Google redirects here after the admin approves gmail.readonly access.
// The single-use `state` row (created by gmail.getOAuthUrl for ONE org) is the
// auth: it is consumed here, the code is exchanged, the refresh token is
// encrypted and upserted into that org's gmailConnections row only.
http.route({
  path: "/gmailOAuthCallback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const denied = url.searchParams.get("error");
    if (denied || !code || !state) {
      return oauthPage(false, "Google did not approve access. Go back and try again.");
    }

    // Check server config before consuming the single-use state, so a fixable
    // config problem does not burn the admin's connect attempt.
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return oauthPage(false, "Server is missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET.");
    }
    if (!process.env.GMAIL_TOKEN_KEY) {
      return oauthPage(false, "Server is missing GMAIL_TOKEN_KEY. Add it in Convex env vars and try again.");
    }

    const pending: any = await ctx.runMutation(internal.gmail.takeOAuthState, { state });
    if (!pending) {
      return oauthPage(false, "This connect link expired or was already used. Start again from Payment Settings.");
    }

    let tokens: any;
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: gmailRedirectUri(),
          grant_type: "authorization_code",
        }).toString(),
      });
      tokens = await res.json();
    } catch {
      return oauthPage(false, "Could not reach Google. Try again.");
    }
    if (!tokens?.refresh_token) {
      return oauthPage(
        false,
        "Google did not issue a refresh token. Remove the app's access at myaccount.google.com/permissions and try again.",
      );
    }

    let accountEmail: string | undefined;
    try {
      const profile = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      ).then((r) => r.json());
      if (profile?.emailAddress) accountEmail = String(profile.emailAddress);
    } catch {
      // Non-fatal — token is what matters.
    }

    let refreshTokenEnc: string;
    try {
      refreshTokenEnc = await encryptSecret(String(tokens.refresh_token));
    } catch {
      return oauthPage(false, "Server encryption key is invalid. GMAIL_TOKEN_KEY must be base64 of 32 bytes.");
    }

    try {
      await ctx.runMutation(internal.gmail.saveGmailConnection, {
        orgId: pending.orgId,
        userId: pending.userId,
        accountEmail: accountEmail ?? "",
        refreshTokenEnc,
      });
    } catch {
      return oauthPage(false, "Could not save the connection. Start again from Payment Settings.");
    }
    // Bounce back to the admin page the flow started from. Google can only
    // redirect to the pre-registered convex.site callback, so this hop is
    // what returns the admin to /admin/payments/settings.
    const back = pending.returnTo;
    if (typeof back === "string" && back.length > 0) {
      return Response.redirect(
        isSafeReturnTo(back) ? back : returnFallbackFor(back),
        302,
      );
    }
    return oauthPage(true, accountEmail ?? null);
  }),
});

// ---------- Bank email ingestion (push fallback) ----------
//
// Optional push path (e.g. Cloudflare Email Worker) into the same idempotent
// `ingestBankEmail` the Gmail poller uses. Auth via Bearer token matching the
// EMAIL_WEBHOOK_SECRET env var set in Convex.
http.route({
  path: "/receiveBankEmail",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const expected = process.env.EMAIL_WEBHOOK_SECRET;
    if (!expected) {
      return jsonResponse({ ok: false, error: "misconfigured" }, 500);
    }
    if (req.headers.get("authorization") !== `Bearer ${expected}`) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "bad json" }, 400);
    }

    const from = String(body.from ?? "").trim();
    const messageId = String(body.messageId ?? "").trim();
    if (!from || !messageId) {
      return jsonResponse(
        { ok: false, error: "missing from or messageId" },
        400,
      );
    }

    const result = await ctx.runMutation(internal.payments.ingestBankEmail, {
      to: body.to ? String(body.to).toLowerCase() : undefined,
      alias: body.alias ? String(body.alias) : undefined,
      from,
      subject: body.subject ? String(body.subject) : undefined,
      textBody: body.textBody ? String(body.textBody) : undefined,
      htmlBody: body.htmlBody ? String(body.htmlBody) : undefined,
      rawBody: body.rawBody ? String(body.rawBody) : undefined,
      messageId,
    });

    return jsonResponse({ ok: true, ...result });
  }),
});

// ---------- Bank SMS relay (MacroDroid or iPhone Shortcut) ----------
//
// POST /receiveBankSms/<token>. Two body shapes:
// - text/plain (the generated MacroDroid file): first line = sender, the rest =
//   the SMS text. Quotes and newlines in the SMS cannot break it.
// - JSON {"sender": "...", "body": "...", "receivedAt": <epoch ms or ISO, optional>}
//   (iPhone Shortcuts dictionary, older manual setups).
// Old macros' JSON broken by a newline or quote in the SMS is repaired
// (convex/lib/bankMessage.ts parseRelayPayload). Unreplaced magic text
// ("{sms_number}", "<SENDER>") or an unreadable body is recorded as a setup
// error for the store. The token is the store's secret (convex/smsRelay.ts);
// only its SHA-256 is compared, via an index lookup.
http.route({
  pathPrefix: SMS_PATH_PREFIX,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).pathname.slice(SMS_PATH_PREFIX.length).replace(/\/$/, "");
    if (!SMS_TOKEN_RE.test(token)) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    const raw = await req.text();
    if (raw.length > 8000) return jsonResponse({ ok: false, error: "too large" }, 413);
    const payload = parseRelayPayload(raw, (req.headers.get("content-type") ?? "").toLowerCase());
    const tokenHash = await sha256Hex(token);

    const sender = (payload?.sender ?? "").trim().toUpperCase().slice(0, 60);
    // Never dropped silently: an unreadable request keeps its raw text (2000
    // chars) so the super admin and the merchant status can see it.
    const text = payload ? payload.body.trim().slice(0, 4000) : raw.trim().slice(0, 2000);
    const setupError = !payload ? "Setup error: unreadable payload" : detectSetupError(sender, text);

    // Phone-reported time is used for dedupe; anything implausible falls back to now.
    const now = Date.now();
    const rt = payload?.receivedAt;
    const rawTime = typeof rt === "string" && /^\d+$/.test(rt) ? Number(rt) : typeof rt === "string" ? Date.parse(rt) : rt;
    const receivedAt =
      typeof rawTime === "number" &&
      Number.isFinite(rawTime) &&
      rawTime >= now - 24 * 60 * 60 * 1000 &&
      rawTime <= now + 5 * 60 * 1000
        ? rawTime
        : now;

    const res = await ctx.runMutation(internal.smsRelay.ingest, {
      tokenHash,
      sender,
      body: text,
      receivedAt,
      setupError: setupError ?? undefined,
    });
    if (res.status === 401) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    if (res.status === 429) {
      return new Response(JSON.stringify({ ok: false, error: "rate limited" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      });
    }
    // 200 even for setup errors: a retry would not fix them. The store sees it.
    return jsonResponse({ ok: true, ...res.result });
  }),
});

// ---------- SMS relay claim (MacroDroid first run) ----------
//
// POST /claimSmsRelay/<code>. The code comes from the macro file (24 h, single
// use). Valid code: 200 with the store token as a text/plain body, nothing
// else. Anything else: 401 with an empty body. The token is then the macro's
// cigarro_key variable (convex/lib/macrodroid.ts). Rate limited like the SMS route.
http.route({
  pathPrefix: CLAIM_PATH_PREFIX,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const code = new URL(req.url).pathname.slice(CLAIM_PATH_PREFIX.length).replace(/\/$/, "");
    if (!SMS_TOKEN_RE.test(code)) return new Response(null, { status: 401 });

    const codeHash = await sha256Hex(code);
    const res = await ctx.runMutation(internal.smsRelay.claim, { codeHash });
    if (res.status === 429) {
      return new Response(null, { status: 429, headers: { "retry-after": "60" } });
    }
    if (res.status !== 200) return new Response(null, { status: 401 });
    return new Response(res.token, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }),
});

// ---------- Pre-login phone identity (auth cutover) ----------
//
// Called by the phone-verify edge endpoint after MSG91 confirms the OTP.
// Resolves phone -> stable userId (creating the users row for new phones)
// so the edge can mint our own JWT without touching Supabase.
// Auth via Bearer token matching the EDGE_SHARED_SECRET env var in Convex.
http.route({
  path: "/resolvePhoneIdentity",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const expected = process.env.EDGE_SHARED_SECRET;
    if (!expected) {
      return jsonResponse({ ok: false, error: "misconfigured" }, 500);
    }
    if (req.headers.get("authorization") !== `Bearer ${expected}`) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "bad json" }, 400);
    }
    const phone = String(body.phone ?? "").trim();
    if (!phone) return jsonResponse({ ok: false, error: "missing phone" }, 400);

    const result = await ctx.runMutation(
      internal.userState.resolvePhoneIdentity,
      {
        phone,
        // Older edge builds omit orgSlug; they only ever served the legacy org.
        orgSlug: String(body.orgSlug || LEGACY_ORG_SLUG),
        name: body.name ? String(body.name).slice(0, 100) : undefined,
      },
    );
    return jsonResponse({ ok: true, ...result });
  }),
});

// Edge-only: stores where a phone is owner/admin (admin-host login and store
// switch). Same shared secret as resolvePhoneIdentity; never called by browsers.
http.route({
  path: "/adminStores",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const expected = process.env.EDGE_SHARED_SECRET;
    if (!expected) {
      return jsonResponse({ ok: false, error: "misconfigured" }, 500);
    }
    if (req.headers.get("authorization") !== `Bearer ${expected}`) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "bad json" }, 400);
    }
    const phone = String(body.phone ?? "").trim();
    if (!phone) return jsonResponse({ ok: false, error: "missing phone" }, 400);
    const stores = await ctx.runQuery(internal.organizations.adminStoresForPhoneInternal, { phone });
    return jsonResponse({ ok: true, stores });
  }),
});

// ---------- Marketing click redirect (/m?c=<campaignId>&p=<contactId>) ----------
//
// The {{link}} variable in WhatsApp copy expands to this URL. It logs the
// tap (per-contact click counts feed campaignStats) and 302s to the shop.
// Unknown/expired ids still redirect — a customer never sees an error page.
http.route({
  path: "/m",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const site = (process.env.SITE_URL ?? "https://cigarro.in").replace(/\/$/, "");
    const fallback = `${site}/?utm_source=whatsapp&utm_medium=blast`;
    const c = url.searchParams.get("c");
    const p = url.searchParams.get("p");
    if (!c || !p) return Response.redirect(fallback, 302);
    let hit: { campaignName: string; hostname: string | null } | null = null;
    try {
      hit = await ctx.runMutation(internal.marketing.logClick, {
        campaignId: c as never,
        contactId: p as never,
      });
    } catch {
      return Response.redirect(fallback, 302);
    }
    if (!hit) return Response.redirect(fallback, 302);
    const slug = hit.campaignName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    // The campaign's own store, never the platform domain when it has one.
    const storeSite = hit.hostname ? `https://${hit.hostname}` : site;
    return Response.redirect(
      `${storeSite}/?utm_source=whatsapp&utm_medium=blast&utm_campaign=${slug}`,
      302,
    );
  }),
});

// Citadel super-admin SSO (see convex/saHttp.ts). CORS is handled inside the
// handlers: only admin.cigarro.in and localhost origins are allowed.
http.route({ path: "/api/sa/exchange", method: "POST", handler: saExchange });
http.route({ path: "/api/sa/exchange", method: "OPTIONS", handler: saPreflight });
http.route({ path: "/api/sa/me", method: "GET", handler: saMe });
http.route({ path: "/api/sa/me", method: "OPTIONS", handler: saPreflight });
http.route({ path: "/api/sa/logout", method: "POST", handler: saLogout });
http.route({ path: "/api/sa/logout", method: "OPTIONS", handler: saPreflight });

// ---------- CORS preflight ----------
const preflight = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    },
  });
});
http.route({ path: "/receiveBankEmail", method: "OPTIONS", handler: preflight });
http.route({ path: "/gmailOAuthCallback", method: "OPTIONS", handler: preflight });
http.route({ path: "/resolvePhoneIdentity", method: "OPTIONS", handler: preflight });

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

function oauthPage(ok: boolean, detail: string | null): Response {
  const title = ok ? "Gmail connected" : "Connect failed";
  const body = ok
    ? `<p><b>${escapeHtml(detail ?? "Inbox")} is connected.</b></p><p>Return to Payment Settings — pending orders now auto-confirm.</p>`
    : `<p>${escapeHtml(detail ?? "Something went wrong.")}</p><p>Go back and try again.</p>`;
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;display:flex;min-height:90vh;align-items:center;justify-content:center;background:#faf7f2;margin:0">` +
      `<div style="max-width:420px;text-align:center;padding:32px"><div style="font-size:44px">${ok ? "✓" : "✗"}</div><h1>${title}</h1>${body}</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html" } },
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default http;
