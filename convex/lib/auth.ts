import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import { Doc, Id } from "../_generated/dataModel";
import { sha256Hex } from "./citadelAuth";
import {
  PRE_RENAME_LEGACY_SLUG,
  isLegacyOrg,
  storeSlugTaken,
} from "./legacyOrg";
import { MutationCtx, QueryCtx } from "../_generated/server";

export type Role = Doc<"memberships">["role"];

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHORIZED" });
  return identity;
}

// Store binding for the JWT. phone-verify stamps an `org` claim (the store
// slug the token was minted for). A token whose claim differs from the store
// being acted on is rejected. Tokens with NO claim are legacy (minted before
// per-store auth) and are accepted for the legacy org only.
// Pre-rename tokens carry the claim `smokeshop` (the legacy org's old slug):
// they match the legacy org only while no store holds `smokeshop`, and match a
// store named `smokeshop` only if issued after that store was created (so a
// legacy token can never act on the new store).
// Convex exposes custom JWT claims as extra fields on UserIdentity.
export async function tokenMatchesOrg(
  ctx: QueryCtx | MutationCtx,
  identity: UserIdentity,
  org: { slug: string; _creationTime: number },
): Promise<boolean> {
  const claim = identity.org;
  if (claim === undefined || claim === null) return isLegacyOrg(org);
  if (claim !== PRE_RENAME_LEGACY_SLUG) return claim === org.slug;
  if (org.slug === PRE_RENAME_LEGACY_SLUG) {
    const iat = identity.iat;
    return typeof iat === "number" && iat * 1000 >= org._creationTime;
  }
  if (isLegacyOrg(org)) return !(await storeSlugTaken(ctx, PRE_RENAME_LEGACY_SLUG));
  return false;
}

export async function assertTokenOrg(
  ctx: QueryCtx | MutationCtx,
  identity: UserIdentity,
  org: { slug: string; _creationTime: number },
) {
  if (!(await tokenMatchesOrg(ctx, identity, org))) {
    throw new ConvexError({ code: "WRONG_STORE" });
  }
}

export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  allowedRoles?: Role[],
) {
  const identity = await requireIdentity(ctx);
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
  await assertTokenOrg(ctx, identity, org);
  // .first(), not .unique(): a duplicate membership row must not surface as a
  // plain Error (redacted to "Server Error" in prod).
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("orgId", orgId).eq("userId", identity.subject),
    )
    .first();
  if (!membership) throw new ConvexError({ code: "NOT_A_MEMBER" });
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new ConvexError({ code: "FORBIDDEN", role: membership.role });
  }
  return { identity, membership, userId: identity.subject };
}

// Read-side membership: never throws. Returns null for a signed-out caller,
// an unknown org, a wrong-store token, or a non-member. Customer read queries
// return an empty result for null; writes keep using requireMember.
export async function optionalMember(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const org = await ctx.db.get(orgId);
  if (!org || !(await tokenMatchesOrg(ctx, identity, org))) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("orgId", orgId).eq("userId", identity.subject),
    )
    .first();
  if (!membership) return null;
  return { identity, membership, userId: identity.subject };
}

export async function requireOrgAdmin(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
) {
  return requireMember(ctx, orgId, ["admin", "owner"]);
}

// ---------- Citadel super-admin sessions ----------
//
// The SPA holds an opaque token (sessionStorage) minted by /api/sa/exchange.
// Only its SHA-256 is stored (saSessions.tokenHash). Idle timeout is measured
// from lastSeenAt, which only mutations touch (queries are read-only).

const SA_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export type SaErrorCode = "NOT_SIGNED_IN" | "WRITE_REQUIRED" | "WRITE_EXPIRED";

function saError(code: SaErrorCode): never {
  throw new ConvexError({ code });
}

// Live session for a token hash, or null (missing, revoked, past hard cap,
// idle). Used by the HTTP layer, which only ever sees the hash.
export async function liveSaSessionByHash(
  ctx: QueryCtx | MutationCtx,
  tokenHash: string,
): Promise<Doc<"saSessions"> | null> {
  const s = await ctx.db
    .query("saSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!s || s.revokedAt) return null;
  const now = Date.now();
  if (s.expiresAt <= now) return null;
  if (now - s.lastSeenAt > SA_IDLE_TIMEOUT_MS) return null;
  return s;
}

// Live session for a raw token, or null.
export async function findLiveSaSession(
  ctx: QueryCtx | MutationCtx,
  saToken: string,
): Promise<Doc<"saSessions"> | null> {
  if (typeof saToken !== "string" || saToken.length < 20 || saToken.length > 256) {
    return null;
  }
  return liveSaSessionByHash(ctx, await sha256Hex(saToken));
}

// Read access for super-admin queries. Never writes.
export async function requireSaSession(
  ctx: QueryCtx | MutationCtx,
  saToken: string,
): Promise<Doc<"saSessions">> {
  const s = await findLiveSaSession(ctx, saToken);
  if (!s) saError("NOT_SIGNED_IN");
  return s;
}

// Write access: session must be live AND carry an unexpired write window.
// Touches lastSeenAt (mutations only).
export async function requireSaWrite(
  ctx: MutationCtx,
  saToken: string,
): Promise<Doc<"saSessions">> {
  const s = await requireSaSession(ctx, saToken);
  const now = Date.now();
  if (!s.write) saError("WRITE_REQUIRED");
  if (!s.writeExpiresAt || s.writeExpiresAt <= now) saError("WRITE_EXPIRED");
  await ctx.db.patch(s._id, { lastSeenAt: now });
  return s;
}

// OAuth/redirect targets: only cigarro.in (+ subdomains) over https, and
// localhost / 127.0.0.1 over http with an explicit port. Anything else is
// rejected (callers fall back to adminPaymentsFallback()).
export function isSafeReturnTo(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (u.protocol === "https:")
    return host === "cigarro.in" || host.endsWith(".cigarro.in");
  if (u.protocol === "http:")
    return (host === "localhost" || host === "127.0.0.1") && u.port !== "";
  return false;
}

export function adminPaymentsFallback(): string {
  const site = (process.env.SITE_URL ?? "https://cigarro.in").replace(/\/$/, "");
  return `${site}/admin/payments`;
}

export function safeReturnTo(raw: unknown): string {
  return isSafeReturnTo(raw) ? raw : adminPaymentsFallback();
}
