import { ConvexError } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

export type Role = Doc<"memberships">["role"];

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHORIZED" });
  return identity;
}

export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  allowedRoles?: Role[],
) {
  const identity = await requireIdentity(ctx);
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

// TODO(multi-tenant): introduce requireSuperAdmin gated by
// SUPER_ADMIN_USER_IDS env var when more than one tenant exists. For now
// appConfig.set accepts any org owner.
