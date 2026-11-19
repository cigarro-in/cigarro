import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// The UPI ID new orders pay to: the store's primary active paymentVpas row, else
// organizations.upiVpa (stores that predate paymentVpas). Null = no UPI ID, and
// checkout is closed (platformFees.checkoutAvailability / assertCheckoutOpen).
// Every reader (createOrder, getPaymentVpa, setup status) goes through this.
export async function payingVpaOf(ctx: QueryCtx | MutationCtx, org: Doc<"organizations">) {
  const active = await ctx.db
    .query("paymentVpas")
    .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
    .first();
  const vpa = active?.vpa ?? (org.upiVpa.trim() || null);
  return { vpa, activeVpa: active };
}
