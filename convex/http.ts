import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ---------- Google OAuth callback (one-click Gmail connect) ----------
//
// Google redirects here after the admin approves gmail.readonly access.
// Verifies the single-use state, exchanges the code for a refresh token,
// stores it server-side, and shows a plain result page. No auth header —
// the unguessable `state` (10-min expiry, single use) is the auth.
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

    const pending: any = await ctx.runQuery(internal.gmail.getOAuthState, { state });
    if (!pending?.redirectUri) {
      return oauthPage(false, "This connect link expired or was already used. Start again from Payment Settings.");
    }

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return oauthPage(false, "Server is missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET.");
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
          redirect_uri: pending.redirectUri,
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

    try {
      await ctx.runMutation(internal.gmail.finishOAuthConnect, {
        state,
        refreshToken: String(tokens.refresh_token),
        accountEmail,
      });
    } catch (e: any) {
      return oauthPage(false, "Connect link expired. Start again from Payment Settings.");
    }
    // Bounce back to the admin page the flow started from. Google can only
    // redirect to the pre-registered convex.site callback, so this hop is
    // what returns the admin to /admin/payments/settings.
    const back = (pending as any)?.returnTo;
    if (typeof back === "string" && isSafeRedirect(back)) {
      return Response.redirect(back, 302);
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
        name: body.name ? String(body.name).slice(0, 100) : undefined,
      },
    );
    return jsonResponse({ ok: true, ...result });
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
    let hit: { campaignName: string } | null = null;
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
    return Response.redirect(
      `${site}/?utm_source=whatsapp&utm_medium=blast&utm_campaign=${slug}`,
      302,
    );
  }),
});

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

function isSafeRedirect(url: string): boolean {
  if (url.startsWith("/admin/")) return true;
  if (/^https:\/\/[A-Za-z0-9.-]+(\/.*)?$/.test(url)) return true;
  if (/^http:\/\/localhost(:\d+)?(\/.*)?$/.test(url)) return true;
  return false;
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
