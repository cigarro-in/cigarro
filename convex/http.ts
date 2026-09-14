import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ---------- Bank email ingestion ----------
//
// Called by the Google Apps Script (or any trusted relay) when a bank
// transaction email is observed. Auth via Bearer token matching the
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

// ---------- Self-debug: whose identity is this? ----------
//
// GET with the caller's own JWT as Bearer. Returns only rows belonging to
// the caller (user row, memberships + orgs). No secret — you can only ever
// see yourself. Used once to diagnose a missing-membership lockout.
http.route({
  path: "/debugIdentity",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return jsonResponse({ ok: false, error: "no identity" }, 401);
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    const orgs = await ctx.db.query("organizations").collect();
    return jsonResponse({
      ok: true,
      subject: identity.subject,
      issuer: identity.issuer,
      user: user
        ? { userId: user.userId, phone: user.phone, name: user.name }
        : null,
      memberships: memberships.map((m) => ({
        orgId: m.orgId,
        role: m.role,
      })),
      orgSlugs: orgs.map((o) => ({ id: o._id, slug: o.slug })),
    });
  }),
});

// ---------- Poke from the client: wake / refresh an order ----------
//
// The Transaction page calls this the moment the customer returns from
// their UPI app (visibilitychange), or when they press "Refresh status".
// Throttled server-side per order to avoid abuse.
http.route({
  path: "/wakeOrder",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "bad json" }, 400);
    }
    const orderId = body.orderId;
    const source = body.source === "refresh" ? "refresh" : "wake";
    if (!orderId) return jsonResponse({ ok: false, error: "missing orderId" }, 400);

    const result = await ctx.runMutation(internal.scheduler.wakeOrder, {
      orderId,
      source,
    });
    return jsonResponse({ ok: true, ...result });
  }),
});

// ---------- CORS preflight ----------
const preflight = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
});
http.route({ path: "/receiveBankEmail", method: "OPTIONS", handler: preflight });
http.route({ path: "/resolvePhoneIdentity", method: "OPTIONS", handler: preflight });
http.route({ path: "/wakeOrder", method: "OPTIONS", handler: preflight });

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

export default http;
