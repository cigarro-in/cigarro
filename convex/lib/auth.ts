import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import { Doc, Id } from "../_generated/dataModel";
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
// per-store auth, valid up to 30 days) and are accepted for smokeshop only.
// Convex exposes custom JWT claims as extra fields on UserIdentity.
export function assertTokenOrg(
  identity: UserIdentity,
  org: { slug: string },
) {
  const claim = identity.org;
  if (claim === undefined || claim === null) {
    if (org.slug === "smokeshop") return;
    throw new ConvexError({ code: "WRONG_STORE" });
  }
  if (claim !== org.slug) throw new ConvexError({ code: "WRONG_STORE" });
}

export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  allowedRoles?: Role[],
) {
  const identity = await requireIdentity(ctx);
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
  assertTokenOrg(identity, org);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("orgId", orgId).eq("userId", identity.subject),
    )
    .unique();
  if (!membership) throw new ConvexError({ code: "NOT_A_MEMBER" });
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new ConvexError({ code: "FORBIDDEN", role: membership.role });
  }
  return { identity, membership, userId: identity.subject };
}

export async function requireOrgAdmin(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
) {
  return requireMember(ctx, orgId, ["admin", "owner"]);
}

// Interim platform-admin gate: userIds listed (comma-separated) in the
// PLATFORM_ADMIN_USER_IDS Convex env var. Missing/empty env denies everyone.
function platformAdminIds(): string[] {
  return (process.env.PLATFORM_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Non-throwing variant for reads that must return null to non-admins.
export async function getPlatformAdminIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return platformAdminIds().includes(identity.subject) ? identity : null;
}

// Replaced by Citadel `requireSaWrite` once super-admin SSO lands.
export async function requirePlatformAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  if (!platformAdminIds().includes(identity.subject))
    throw new ConvexError({ code: "NOT_PLATFORM_ADMIN" });
  return identity;
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
