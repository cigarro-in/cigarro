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
