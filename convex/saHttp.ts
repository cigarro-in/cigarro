import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { httpAction, internalMutation, MutationCtx } from "./_generated/server";
import { liveSaSessionByHash } from "./lib/auth";
import { isAllowedSaOrigin, SA_WRITE_WINDOW_MS, SA_SESSION_HARD_CAP_MS } from "./lib/citadel";
import { newSessionToken, sha256Hex, verifyLaunchToken, LaunchTokenError } from "./lib/citadelAuth";

// Citadel super-admin HTTP surface, mounted in convex/http.ts:
//   POST   /api/sa/exchange  { token }  -> { token, expiresAt, write, writeExpiresAt }
//   GET    /api/sa/me        Bearer     -> { adminId, write, writeExpiresAt, expiresAt }
//   POST   /api/sa/logout    Bearer     -> { ok: true }
//
// Internal functions are referenced by path (makeFunctionReference) because
// convex/_generated/api.d.ts does not list this module until codegen runs.

const exchangeLaunchRef = makeFunctionReference<
  "mutation",
  {
    jti: string;
    exp: number;
    tokenHash: string;
    adminId: string;
    citadelSid: string;
    write: boolean;
  },
  { ok: boolean; expiresAt?: number; writeExpiresAt?: number }
>("saHttp:exchangeLaunch");

const meRef = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  null | { adminId: string; write: boolean; writeExpiresAt: number | null; expiresAt: number }
>("saHttp:meSession");

const logoutRef = makeFunctionReference<"mutation", { tokenHash: string }, null>(
  "saHttp:logoutSession",
);

// Single mutation: jti check + insert + session insert commit together.
// Convex mutations are serializable, so two concurrent exchanges of the same
// token cannot both succeed.
export const exchangeLaunch = internalMutation({
  args: {
    jti: v.string(),
    exp: v.number(),
    tokenHash: v.string(),
    adminId: v.string(),
    citadelSid: v.string(),
    write: v.boolean(),
  },
  returns: v.object({
    ok: v.boolean(),
    expiresAt: v.optional(v.number()),
    writeExpiresAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const nowS = Math.floor(now / 1000);

    // Opportunistic sweep of expired jti rows (bounded per call).
    const stale = await ctx.db
      .query("saExchangedJtis")
      .withIndex("by_exp", (q) => q.lt("exp", nowS))
      .take(50);
    for (const row of stale) await ctx.db.delete(row._id);

    const seen = await ctx.db
      .query("saExchangedJtis")
      .withIndex("by_jti", (q) => q.eq("jti", args.jti))
      .unique();
    if (seen) return { ok: false };
    await ctx.db.insert("saExchangedJtis", { jti: args.jti, exp: args.exp });

    const expiresAt = now + SA_SESSION_HARD_CAP_MS;
    const writeExpiresAt = args.write ? now + SA_WRITE_WINDOW_MS : undefined;
    await ctx.db.insert("saSessions", {
      tokenHash: args.tokenHash,
      adminId: args.adminId,
      citadelSid: args.citadelSid,
      write: args.write,
      ...(writeExpiresAt !== undefined ? { writeExpiresAt } : {}),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    });
    return { ok: true, expiresAt, writeExpiresAt };
  },
});

// Validates and touches the session (idle clock). Mutation because it writes.
export const meSession = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx: MutationCtx, { tokenHash }) => {
    const s = await liveSaSessionByHash(ctx, tokenHash);
    if (!s) return null;
    const now = Date.now();
    await ctx.db.patch(s._id, { lastSeenAt: now });
    return {
      adminId: s.adminId,
      write: s.write && !!s.writeExpiresAt && s.writeExpiresAt > now,
      writeExpiresAt: s.writeExpiresAt ?? null,
      expiresAt: s.expiresAt,
    };
  },
});

export const logoutSession = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const s = await ctx.db
      .query("saSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (s && !s.revokedAt) await ctx.db.patch(s._id, { revokedAt: Date.now() });
    return null;
  },
});

// ---------- HTTP ----------

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (isAllowedSaOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

function saJson(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,256})$/.exec(req.headers.get("Authorization") ?? "");
  return m ? m[1] : null;
}

export const saPreflight = httpAction(async (_ctx, req) => {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const saExchange = httpAction(async (ctx, req) => {
  let body: { token?: unknown };
  try {
    body = (await req.json()) as { token?: unknown };
  } catch {
    return saJson(req, 400, { error: "Bad JSON" });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return saJson(req, 400, { error: "token required" });

  let claims;
  try {
    claims = await verifyLaunchToken(token);
  } catch (e) {
    const reason = e instanceof LaunchTokenError ? e.message : "verification error";
    return saJson(req, 401, { error: "Token verification failed", reason });
  }

  const sessionToken = newSessionToken();
  const result = await ctx.runMutation(exchangeLaunchRef, {
    jti: claims.jti,
    exp: claims.exp,
    tokenHash: await sha256Hex(sessionToken),
    adminId: claims.sub,
    citadelSid: claims.citadelSid,
    write: claims.write,
  });
  if (!result.ok) return saJson(req, 401, { error: "Token already exchanged" });

  return saJson(req, 200, {
    token: sessionToken,
    expiresAt: result.expiresAt ?? null,
    write: claims.write,
    writeExpiresAt: result.writeExpiresAt ?? null,
  });
});

export const saMe = httpAction(async (ctx, req) => {
  const raw = bearerToken(req);
  if (!raw) return saJson(req, 401, { error: "NOT_SIGNED_IN" });
  const s = await ctx.runMutation(meRef, { tokenHash: await sha256Hex(raw) });
  if (!s) return saJson(req, 401, { error: "NOT_SIGNED_IN" });
  return saJson(req, 200, s);
});

export const saLogout = httpAction(async (ctx, req) => {
  const raw = bearerToken(req);
  if (raw) await ctx.runMutation(logoutRef, { tokenHash: await sha256Hex(raw) });
  return saJson(req, 200, { ok: true });
});
