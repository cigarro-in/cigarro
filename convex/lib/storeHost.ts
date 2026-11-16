import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// The store's own live web address: its active primary domain, else its active
// managed <slug>.cigarro.in subdomain. null when the store has neither (or is
// suspended). Links meant for a store's customers use this, never cigarro.in.
export async function liveStoreHostname(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
): Promise<string | null> {
  const org = await ctx.db.get(orgId);
  if (!org || !org.active) return null;
  const rows = await ctx.db
    .query("orgDomains")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const primary = rows.find((r) => r.kind === "primary" && r.status === "active");
  const managed = rows.find((r) => r.managed === true && r.status === "active");
  return primary?.hostname ?? managed?.hostname ?? null;
}
