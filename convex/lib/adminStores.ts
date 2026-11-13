import type { QueryCtx } from "../_generated/server";
import { normalizePhoneE164 } from "./phone";
import { LEGACY_ORG_SLUG } from "./legacyOrg";

export interface AdminStoreRow {
  slug: string;
  name: string;
  // The userId this phone has in that store (users row). Memberships key on it.
  userId: string;
  role: "owner" | "admin";
}

// Every active store where this phone's users row holds owner/admin membership.
// Users are per store, so one phone can own several userIds; this joins them.
// Legacy rows (no orgId) belong to the legacy store.
export async function adminStoresForPhone(
  ctx: QueryCtx,
  rawPhone: string,
): Promise<AdminStoreRow[]> {
  const phone = normalizePhoneE164(rawPhone) ?? rawPhone;
  if (!phone) return [];
  const rows = await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .collect();
  const out: AdminStoreRow[] = [];
  for (const row of rows) {
    const org = row.orgId
      ? await ctx.db.get(row.orgId)
      : await ctx.db
          .query("organizations")
          .withIndex("by_slug", (q) => q.eq("slug", LEGACY_ORG_SLUG))
          .unique();
    if (!org || !org.active) continue;
    if (out.some((s) => s.slug === org.slug)) continue;
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", row.userId))
      .first();
    if (!membership) continue;
    if (membership.role !== "owner" && membership.role !== "admin") continue;
    out.push({ slug: org.slug, name: org.name, userId: row.userId, role: membership.role });
  }
  return out;
}
