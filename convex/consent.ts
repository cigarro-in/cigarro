import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { assertTokenOrg, requireIdentity, requireOrgAdmin, requireSaSession } from "./lib/auth";

// Consent log. Append-only: this module only inserts rows. A changed decision
// is a new row with a later `at`; old rows are never patched or deleted.
//
// Who writes what:
// - recordAnonymous: age-gate confirmation for a visitor (no sign-in). Called
//   only by the Pages endpoint POST /api/consent, which adds the client IP from
//   CF-Connecting-IP.
// - linkAnonymous: on sign-in, copies the visitor's rows onto the user (new rows
//   with userId and linkedFrom; the originals stay untouched).
// - recordCheckoutConsent: signed-in checkout checkbox ("18+ and accept the
//   Terms"). Writes age_confirmation + terms_acceptance.
// - assertCheckoutConsent: used by orders.createOrder for purchases.

const ANON_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const TEXT_VERSION_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const PAGE_PATH_MAX = 300;
const USER_AGENT_MAX = 300;
const CUSTOMER_LOG_CAP = 200;
const CHECKOUT_KINDS = ["age_confirmation", "terms_acceptance"] as const;

function clip(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.slice(0, max);
}

function checkTextVersion(textVersion: string) {
  if (!TEXT_VERSION_RE.test(textVersion)) {
    throw new ConvexError({ code: "BAD_TEXT_VERSION" });
  }
}

async function requireOrg(ctx: MutationCtx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
  return org;
}

// Phone on the user's row for this store, if the customer has one.
async function phoneForUser(ctx: MutationCtx, orgId: Id<"organizations">, userId: string) {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.find((r) => r.orgId === orgId)?.phone;
}

// Public on purpose: the visitor has no session yet. Only the Pages endpoint
// calls it, and only for age_confirmation. Store comes from the edge hostname.
export const recordAnonymous = mutation({
  args: {
    orgId: v.id("organizations"),
    anonymousId: v.string(),
    granted: v.boolean(),
    textVersion: v.string(),
    pagePath: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrg(ctx, args.orgId);
    if (!ANON_ID_RE.test(args.anonymousId)) throw new ConvexError({ code: "BAD_ANONYMOUS_ID" });
    checkTextVersion(args.textVersion);
    return await ctx.db.insert("consentEvents", {
      orgId: args.orgId,
      anonymousId: args.anonymousId,
      kind: "age_confirmation",
      granted: args.granted,
      textVersion: args.textVersion,
      at: Date.now(),
      ip: clip(args.ip, 64),
      userAgent: clip(args.userAgent, USER_AGENT_MAX),
      pagePath: clip(args.pagePath, PAGE_PATH_MAX),
      source: "age_gate",
    });
  },
});

// Signed-in: carry the visitor's prior rows onto the user. Idempotent: a row
// that was already copied (linkedFrom) is skipped.
export const linkAnonymous = mutation({
  args: { orgId: v.id("organizations"), anonymousId: v.string() },
  handler: async (ctx, { orgId, anonymousId }) => {
    const identity = await requireIdentity(ctx);
    const org = await requireOrg(ctx, orgId);
    await assertTokenOrg(ctx, identity, org);
    if (!ANON_ID_RE.test(anonymousId)) throw new ConvexError({ code: "BAD_ANONYMOUS_ID" });
    const userId = identity.subject;

    const visitorRows = await ctx.db
      .query("consentEvents")
      .withIndex("by_org_anonymous", (q) => q.eq("orgId", orgId).eq("anonymousId", anonymousId))
      .collect();
    const pending = visitorRows.filter((r) => r.userId === undefined);
    if (pending.length === 0) return { linked: 0 };

    const alreadyLinked = new Set(
      (
        await ctx.db
          .query("consentEvents")
          .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
          .collect()
      )
        .map((r) => r.linkedFrom)
        .filter((id): id is Id<"consentEvents"> => id !== undefined),
    );
    const phone = await phoneForUser(ctx, orgId, userId);

    let linked = 0;
    for (const row of pending) {
      if (alreadyLinked.has(row._id)) continue;
      await ctx.db.insert("consentEvents", {
        orgId,
        userId,
        anonymousId,
        phone,
        kind: row.kind,
        granted: row.granted,
        textVersion: row.textVersion,
        // Keep the original decision time: that is when the visitor consented.
        at: row.at,
        ip: row.ip,
        userAgent: row.userAgent,
        pagePath: row.pagePath,
        source: "signup",
        linkedFrom: row._id,
      });
      linked += 1;
    }
    return { linked };
  },
});

// Signed-in checkout: the checkbox "I am 18+ and accept the Terms" records both
// kinds at once with the same wording version.
export const recordCheckoutConsent = mutation({
  args: {
    orgId: v.id("organizations"),
    textVersion: v.string(),
    pagePath: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, textVersion, pagePath }) => {
    const identity = await requireIdentity(ctx);
    const org = await requireOrg(ctx, orgId);
    await assertTokenOrg(ctx, identity, org);
    checkTextVersion(textVersion);
    const userId = identity.subject;
    const phone = await phoneForUser(ctx, orgId, userId);
    const now = Date.now();
    for (const kind of CHECKOUT_KINDS) {
      await ctx.db.insert("consentEvents", {
        orgId,
        userId,
        phone,
        kind,
        granted: true,
        textVersion,
        at: now,
        pagePath: clip(pagePath, PAGE_PATH_MAX),
        source: "checkout",
      });
    }
    return { ok: true };
  },
});

// Throws CONSENT_REQUIRED unless the customer's latest row for each checkout
// kind is granted. Called by orders.createOrder for kind "purchase".
export async function assertCheckoutConsent(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  userId: string,
) {
  const rows = await ctx.db
    .query("consentEvents")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .order("desc")
    .take(CUSTOMER_LOG_CAP);
  const latest = new Map<string, Doc<"consentEvents">>();
  for (const row of rows) {
    if (!latest.has(row.kind)) latest.set(row.kind, row);
  }
  const missing = CHECKOUT_KINDS.filter((kind) => latest.get(kind)?.granted !== true);
  if (missing.length > 0) {
    throw new ConvexError({ code: "CONSENT_REQUIRED", missing: missing.join(",") });
  }
}

// Admin: one customer's log, newest first (customer profile page).
export const listForCustomer = query({
  args: { orgId: v.id("organizations"), userId: v.string() },
  handler: async (ctx, { orgId, userId }) => {
    await requireOrgAdmin(ctx, orgId);
    const rows = await ctx.db
      .query("consentEvents")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .order("desc")
      .take(CUSTOMER_LOG_CAP);
    return rows.map((r) => ({
      _id: r._id,
      kind: r.kind,
      granted: r.granted,
      textVersion: r.textVersion,
      at: r.at,
      source: r.source,
      pagePath: r.pagePath ?? null,
      ip: r.ip ?? null,
      linked: r.linkedFrom !== undefined,
    }));
  },
});

// Super-admin: the whole log for one store, paginated so the browser can build
// a complete CSV (oldest first). Pages are read with paginate(), so no page
// is silently cut.
export const exportForStore = query({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, { saToken, orgId, cursor, numItems }) => {
    await requireSaSession(ctx, saToken);
    const size = Math.min(Math.max(Math.floor(numItems), 1), 1000);
    const page = await ctx.db
      .query("consentEvents")
      .withIndex("by_org_at", (q) => q.eq("orgId", orgId))
      .order("asc")
      .paginate({ cursor, numItems: size });
    return {
      rows: page.page.map((r) => ({
        _id: r._id,
        at: r.at,
        kind: r.kind,
        granted: r.granted,
        textVersion: r.textVersion,
        source: r.source,
        userId: r.userId ?? null,
        phone: r.phone ?? null,
        anonymousId: r.anonymousId ?? null,
        pagePath: r.pagePath ?? null,
        ip: r.ip ?? null,
        userAgent: r.userAgent ?? null,
        linkedFrom: r.linkedFrom ?? null,
      })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
