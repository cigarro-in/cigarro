import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export async function audit(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    adminUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    payload?: unknown;
  },
) {
  await ctx.db.insert("adminAuditLog", {
    orgId: args.orgId,
    adminUserId: args.adminUserId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    payload: args.payload ?? {},
    createdAt: Date.now(),
  });
}
