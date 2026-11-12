import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Writes an adminAuditLog row. Store-scoped writes pass orgId (actor defaults
// to store_admin, the pre-SSO behaviour). Platform (super-admin) writes omit
// orgId and pass actorType "super_admin".
export async function audit(
  ctx: MutationCtx,
  args: {
    orgId?: Id<"organizations">;
    adminUserId: string;
    actorType?: "store_admin" | "super_admin";
    action: string;
    targetType: string;
    targetId: string;
    payload?: unknown;
  },
) {
  await ctx.db.insert("adminAuditLog", {
    ...(args.orgId ? { orgId: args.orgId } : {}),
    adminUserId: args.adminUserId,
    actorType: args.actorType ?? "store_admin",
    actorId: args.adminUserId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    payload: args.payload ?? {},
    createdAt: Date.now(),
  });
}
