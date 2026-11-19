import { ConvexError, v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";

// Super-admin "Fresh start": clears one store's data in groups so the store can
// be handed over. Destructive. Rules:
//  - Every table is read through an index whose FIRST field is orgId (see
//    TABLE_SCOPE). Tables without such an index are not listed here at all.
//  - The organizations row, orgDomains, staff/admin/owner memberships and the
//    migrations table are never touched.
//  - The internal platform org (organizations.kind === "platform") is refused
//    by every function in this file.
//  - Writes need an open SA write window (requireSaWrite). Reads need a live SA
//    session (requireSaSession).
//  - The client drives clearBatch in a loop per table, groups 1 to 10 in order,
//    then the file groups 11 and 12 through the /api/sa/store-files Pages Function.

const BATCH = 200;
const PREVIEW_CAP = 5001; // count up to 5000, then show "5000+"
const STORE_SLUG_RE = /^[a-z0-9-]{1,50}$/;

// Table -> index whose first field is orgId. Verified against convex/schema.ts.
// memberships is special: clearing removes role "customer" only (by_org_role).
const TABLE_SCOPE = {
  // 1. Orders & payments
  orders: { index: "by_org_created" },
  invoices: { index: "by_org_created" },
  latePayments: { index: "by_org_status" },
  bankEmails: { index: "by_org_status" },
  paymentMessages: { index: "by_org_at" },
  smsRelayLog: { index: "by_org_at" },
  paymentSlots: { index: "by_org_base_state" },
  // 2. Customers
  users: { index: "by_org_phone" },
  memberships: { index: "by_org_user" },
  carts: { index: "by_org_user" },
  wishlists: { index: "by_org_user" },
  savedAddresses: { index: "by_org_user" },
  walletAccounts: { index: "by_org_user" },
  walletLedger: { index: "by_org_user_time" },
  referrals: { index: "by_org" },
  productReviews: { index: "by_org" },
  pushSubscriptions: { index: "by_org_endpoint" },
  consentEvents: { index: "by_org_at" },
  // 3. Marketing (marketingClicks has orgId but no org-leading index: not listed)
  marketingContacts: { index: "by_org" },
  marketingCampaigns: { index: "by_org" },
  marketingTemplates: { index: "by_org" },
  marketingSends: { index: "by_org" },
  // 4. Stock
  inventoryBalances: { index: "by_org" },
  inventoryMovements: { index: "by_org_time" },
  // 5. Catalog
  catalogBrands: { index: "by_org" },
  catalogCategories: { index: "by_org" },
  catalogProducts: { index: "by_org" },
  catalogVariants: { index: "by_org" },
  catalogProductCategories: { index: "by_org" },
  catalogCollections: { index: "by_org" },
  catalogCollectionProducts: { index: "by_org" },
  catalogCombos: { index: "by_org" },
  catalogComboItems: { index: "by_org" },
  discounts: { index: "by_org" },
  // 6. Content
  blogPosts: { index: "by_org" },
  blogCategories: { index: "by_org" },
  storePages: { index: "by_org" },
  heroSlides: { index: "by_org" },
  sectionConfigurations: { index: "by_org" },
  homepageComponentConfig: { index: "by_org" },
  orgRedirects: { index: "by_org" },
  // 7. Store settings
  siteSettings: { index: "by_org" },
  invoiceSettings: { index: "by_org" },
  // 8. Payment setup
  paymentVpas: { index: "by_org_active" },
  gmailConnections: { index: "by_org" },
  bankInboxes: { index: "by_org_active" },
  bankEmailTemplates: { index: "by_org" },
  smsRelays: { index: "by_org" },
  paymentPipelineSettings: { index: "by_org" },
  // 9. Platform fees
  platformLedger: { index: "by_org_created" },
  platformAccounts: { index: "by_org" },
  // 10. Activity log
  adminAuditLog: { index: "by_org_time" },
} as const;

export type ResetTable = keyof typeof TABLE_SCOPE;

const resetTableV = v.union(...(Object.keys(TABLE_SCOPE) as ResetTable[]).map((t) => v.literal(t)));

// Table groups 1-10 (cleared table by table), then the two file groups.
export const RESET_GROUPS = [
  { id: 1, label: "Orders & payments", tables: ["orders", "invoices", "latePayments", "bankEmails", "paymentMessages", "smsRelayLog", "paymentSlots"] },
  {
    id: 2,
    label: "Customers",
    tables: ["users", "memberships", "carts", "wishlists", "savedAddresses", "walletAccounts", "walletLedger", "referrals", "productReviews", "pushSubscriptions", "consentEvents"],
  },
  { id: 3, label: "Marketing", tables: ["marketingContacts", "marketingCampaigns", "marketingTemplates", "marketingSends"] },
  { id: 4, label: "Stock", tables: ["inventoryBalances", "inventoryMovements"] },
  {
    id: 5,
    label: "Catalog",
    tables: ["catalogBrands", "catalogCategories", "catalogProducts", "catalogVariants", "catalogProductCategories", "catalogCollections", "catalogCollectionProducts", "catalogCombos", "catalogComboItems", "discounts"],
  },
  { id: 6, label: "Content", tables: ["blogPosts", "blogCategories", "storePages", "heroSlides", "sectionConfigurations", "homepageComponentConfig", "orgRedirects"] },
  { id: 7, label: "Store settings", tables: ["siteSettings", "invoiceSettings"] },
  { id: 8, label: "Payment setup", tables: ["paymentVpas", "gmailConnections", "bankInboxes", "bankEmailTemplates", "smsRelays", "paymentPipelineSettings"] },
  { id: 9, label: "Platform fees", tables: ["platformLedger", "platformAccounts"] },
  { id: 10, label: "Activity log", tables: ["adminAuditLog"] },
  { id: 11, label: "Files used by the store", tables: [] },
  { id: 12, label: "Unused files", tables: [] },
] as const satisfies ReadonlyArray<{ id: number; label: string; tables: readonly ResetTable[] }>;

type IndexBuilder = { eq(field: string, value: unknown): IndexBuilder };
type OrgRows = {
  take(n: number): Promise<Doc<TableNames>[]>;
  collect(): Promise<Doc<TableNames>[]>;
};
type LooseReader = {
  query(table: string): { withIndex(name: string, build: (q: IndexBuilder) => IndexBuilder): OrgRows };
};

// Rows of one table for one org. Uses the table's org-leading index.
// customerOnly: memberships only, role "customer" (by_org_role).
function orgRows(ctx: QueryCtx | MutationCtx, table: ResetTable, orgId: Id<"organizations">, customerOnly = false): OrgRows {
  const reader = ctx.db as unknown as LooseReader;
  if (table === "memberships" && customerOnly) {
    return reader
      .query("memberships")
      .withIndex("by_org_role", (q) => q.eq("orgId", orgId).eq("role", "customer"));
  }
  const { index } = TABLE_SCOPE[table];
  return reader.query(table).withIndex(index, (q) => q.eq("orgId", orgId));
}

// Refuses the platform org and missing stores. Returns the org row.
async function resettableOrg(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
  if (org.kind === "platform") throw new ConvexError({ code: "PLATFORM_ORG_PROTECTED" });
  return org;
}

// Counts one table, capped: "5000+" is shown when the cap is reached.
async function countTable(ctx: QueryCtx, table: ResetTable, orgId: Id<"organizations">) {
  const rows = await orgRows(ctx, table, orgId, table === "memberships").take(PREVIEW_CAP);
  return rows.length >= PREVIEW_CAP ? { count: PREVIEW_CAP - 1, capped: true } : { count: rows.length, capped: false };
}

export const checkSaWrite = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    const s = await requireSaSession(ctx, saToken);
    return { ok: !!s.write && !!s.writeExpiresAt && s.writeExpiresAt > Date.now() };
  },
});

export const previewReset = query({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    const org = await resettableOrg(ctx, orgId);
    const groups = [];
    for (const g of RESET_GROUPS) {
      const tables = [];
      let total = 0;
      let capped = false;
      for (const table of g.tables) {
        const c = await countTable(ctx, table, orgId);
        tables.push({ table, count: c.capped ? "5000+" : c.count });
        total += c.count;
        capped = capped || c.capped;
      }
      groups.push({ id: g.id, label: g.label, tables, total: capped ? "5000+" : total });
    }
    return { slug: org.slug, name: org.name, groups };
  },
});

// Users of staff/admin/owner members are the store's own logins: never deleted.
// Walks past them, so kept rows never stall the batch loop.
async function clearCustomerUsers(ctx: MutationCtx, orgId: Id<"organizations">) {
  const members = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId))
    .collect();
  const protectedIds = new Set(members.filter((m) => m.role !== "customer").map((m) => m.userId));
  let deleted = 0;
  for await (const u of ctx.db.query("users").withIndex("by_org_phone", (q) => q.eq("orgId", orgId))) {
    if (protectedIds.has(u.userId)) continue;
    if (deleted >= BATCH) return { deleted, done: false };
    await ctx.db.delete(u._id);
    deleted++;
  }
  return { deleted, done: true };
}

// Deletes up to BATCH rows of one table for this org. done = nothing left in
// this table after this call.
export const clearBatch = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), table: resetTableV },
  handler: async (ctx, { saToken, orgId, table }) => {
    await requireSaWrite(ctx, saToken);
    await resettableOrg(ctx, orgId);
    if (table === "users") return await clearCustomerUsers(ctx, orgId);
    const rows = await orgRows(ctx, table, orgId, table === "memberships").take(BATCH);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, done: rows.length < BATCH };
  },
});

// One audit entry per finished group. Written WITHOUT orgId (platform row) so
// clearing the activity log (group 10) does not erase the record of the reset.
export const logReset = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    group: v.number(),
    deleted: v.record(v.string(), v.number()),
  },
  handler: async (ctx, { saToken, orgId, group, deleted }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const org = await resettableOrg(ctx, orgId);
    const meta = RESET_GROUPS.find((g) => g.id === group);
    if (!meta) throw new ConvexError({ code: "INVALID_GROUP" });
    await audit(ctx, {
      adminUserId: `sa:${sa.adminId}`,
      actorType: "super_admin",
      action: "store.fresh_start.group",
      targetType: "organizations",
      targetId: orgId,
      payload: { orgId, slug: org.slug, group, label: meta.label, deleted },
    });
    return { ok: true };
  },
});

// Every R2 key under asset_images/orgs/<slug>/ that the store's data mentions.
// Scans the organizations row and every table in groups 1-10 for this org, so
// keys kept in catalog/content are protected too. Uses collect(): if a table is
// too large for one query, Convex throws and nothing is returned (fails closed).
export const referencedFileKeys = query({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    const org = await resettableOrg(ctx, orgId);
    if (!STORE_SLUG_RE.test(org.slug)) throw new ConvexError({ code: "INVALID_SLUG" });
    // Both layouts: <slug>/images|documents/… (new, may appear inside a full CDN URL)
    // and asset_images/orgs/<slug>/… (pre-restructure). The lookbehind keeps
    // `smokeshop/` from matching inside `oldsmokeshop/`.
    const re = new RegExp(
      `(?<![A-Za-z0-9-])(?:asset_images/orgs/${org.slug}/|${org.slug}/(?:images|documents)/)[A-Za-z0-9._/-]+`,
      "g",
    );
    const keys = new Set<string>();
    const scan = (doc: unknown) => {
      for (const m of JSON.stringify(doc).matchAll(re)) {
        // Trailing punctuation from prose ("...webp.") is not part of the key.
        keys.add(m[0].replace(/[./]+$/, ""));
      }
    };
    scan(org);
    for (const g of RESET_GROUPS) {
      for (const table of g.tables) {
        const rows = await orgRows(ctx, table, orgId).collect();
        for (const row of rows) scan(row);
      }
    }
    return { slug: org.slug, keys: [...keys].sort() };
  },
});
