import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import { SYSTEM_TEMPLATES } from "./lib/email";

// ---------- Template installation ----------

/**
 * Install / refresh system-default bank-email templates.
 * Idempotent: updates existing system templates (orgId=undefined) by bankKey+label.
 * Run via `npx convex run email:seedSystemTemplates` or called from admin UI.
 */
export const seedSystemTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: Array<{ bankKey: string; label: string; action: string }> = [];
    for (const t of SYSTEM_TEMPLATES) {
      const existing = await ctx.db
        .query("bankEmailTemplates")
        .withIndex("by_bank_active", (q) =>
          q.eq("bankKey", t.bankKey),
        )
        .collect();
      const match = existing.find(
        (x) => x.orgId === undefined && x.label === t.label,
      );
      if (match) {
        await ctx.db.patch(match._id, {
          senderRegex: t.senderRegex,
          subjectRegex: t.subjectRegex,
          amountRegex: t.amountRegex,
          refRegex: t.refRegex,
          payerVpaRegex: t.payerVpaRegex,
          payerNameRegex: t.payerNameRegex,
          creditOnly: t.creditOnly,
          debitGuardRegex: t.debitGuardRegex,
          priority: t.priority,
          active: t.active,
        });
        results.push({ bankKey: t.bankKey, label: t.label, action: "updated" });
      } else {
        await ctx.db.insert("bankEmailTemplates", {
          ...t,
          orgId: undefined,
          createdAt: Date.now(),
        });
        results.push({ bankKey: t.bankKey, label: t.label, action: "inserted" });
      }
    }
    return results;
  },
});

// ---------- Admin: template CRUD ----------

export const listTemplates = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const orgSpecific = await ctx.db
      .query("bankEmailTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    // Also show system defaults (orgId=undefined).
    const system = await ctx.db
      .query("bankEmailTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", undefined))
      .collect();
    return [...orgSpecific, ...system];
  },
});

export const upsertTemplate = mutation({
  args: {
    orgId: v.id("organizations"),
    templateId: v.optional(v.id("bankEmailTemplates")),
    bankKey: v.string(),
    label: v.string(),
    active: v.boolean(),
    priority: v.number(),
    senderRegex: v.string(),
    subjectRegex: v.optional(v.string()),
    amountRegex: v.string(),
    refRegex: v.string(),
    payerVpaRegex: v.optional(v.string()),
    payerNameRegex: v.optional(v.string()),
    creditOnly: v.boolean(),
    debitGuardRegex: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    if (args.templateId) {
      const existing = await ctx.db.get(args.templateId);
      if (!existing) throw new ConvexError({ code: "NOT_FOUND" });
      if (existing.orgId !== args.orgId)
        throw new ConvexError({ code: "NOT_YOUR_TEMPLATE" });
      const { orgId: _o, templateId: _t, ...patch } = args;
      await ctx.db.patch(args.templateId, patch);
      return args.templateId;
    }
    return await ctx.db.insert("bankEmailTemplates", {
      orgId: args.orgId,
      bankKey: args.bankKey,
      label: args.label,
      active: args.active,
      priority: args.priority,
      senderRegex: args.senderRegex,
      subjectRegex: args.subjectRegex,
      amountRegex: args.amountRegex,
      refRegex: args.refRegex,
      payerVpaRegex: args.payerVpaRegex,
      payerNameRegex: args.payerNameRegex,
      creditOnly: args.creditOnly,
      debitGuardRegex: args.debitGuardRegex,
      createdAt: Date.now(),
    });
  },
});

// ---------- Admin: test harness ----------

/**
 * Dry-run the parser against a pasted email sample.
 * Returns which template matched and what was extracted — without persisting.
 * Use from the admin UI to validate a new template before activating it.
 */
export const testParse = query({
  args: {
    orgId: v.id("organizations"),
    from: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    const { parseWithTemplates } = await import("./lib/email");
    const orgTemplates = await ctx.db
      .query("bankEmailTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const systemTemplates = await ctx.db
      .query("bankEmailTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", undefined))
      .collect();
    const all = [...orgTemplates, ...systemTemplates].map((t) => ({
      _id: t._id,
      bankKey: t.bankKey,
      label: t.label,
      senderRegex: t.senderRegex,
      subjectRegex: t.subjectRegex,
      amountRegex: t.amountRegex,
      refRegex: t.refRegex,
      payerVpaRegex: t.payerVpaRegex,
      payerNameRegex: t.payerNameRegex,
      creditOnly: t.creditOnly,
      debitGuardRegex: t.debitGuardRegex,
      priority: t.priority,
      active: t.active,
    }));
    const result = parseWithTemplates(
      { from: args.from, subject: args.subject, body: args.body },
      all,
    );
    return {
      templatesTried: all.length,
      matched: !!result,
      result,
    };
  },
});

// ---------- Admin: inbox + VPA management ----------

export const listInboxes = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("bankInboxes")
      .withIndex("by_org_active", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const upsertInbox = mutation({
  args: {
    orgId: v.id("organizations"),
    inboxId: v.optional(v.id("bankInboxes")),
    alias: v.string(),
    label: v.optional(v.string()),
    bankKey: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    // Alias uniqueness (global)
    const conflict = await ctx.db
      .query("bankInboxes")
      .withIndex("by_alias", (q) => q.eq("alias", args.alias))
      .unique();
    if (conflict && conflict._id !== args.inboxId) {
      throw new ConvexError({ code: "ALIAS_TAKEN" });
    }
    if (args.inboxId) {
      await ctx.db.patch(args.inboxId, {
        alias: args.alias,
        label: args.label,
        bankKey: args.bankKey,
        active: args.active,
      });
      return args.inboxId;
    }
    return await ctx.db.insert("bankInboxes", {
      orgId: args.orgId,
      alias: args.alias,
      label: args.label,
      bankKey: args.bankKey,
      active: args.active,
      createdAt: Date.now(),
    });
  },
});

export const deleteInbox = mutation({
  args: { orgId: v.id("organizations"), inboxId: v.id("bankInboxes") },
  handler: async (ctx, { orgId, inboxId }) => {
    await requireOrgAdmin(ctx, orgId);
    const inbox = await ctx.db.get(inboxId);
    if (!inbox || inbox.orgId !== orgId)
      throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(inboxId);
  },
});

export const listVpas = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("paymentVpas")
      .withIndex("by_org_active", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const upsertVpa = mutation({
  args: {
    orgId: v.id("organizations"),
    vpaId: v.optional(v.id("paymentVpas")),
    vpa: v.string(),
    label: v.optional(v.string()),
    active: v.boolean(),
    priority: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    if (!/^[A-Za-z0-9._\-]+@[A-Za-z0-9.\-]+$/.test(args.vpa))
      throw new ConvexError({ code: "INVALID_VPA" });
    if (args.vpaId) {
      await ctx.db.patch(args.vpaId, {
        vpa: args.vpa,
        label: args.label,
        active: args.active,
        priority: args.priority,
      });
      return args.vpaId;
    }
    return await ctx.db.insert("paymentVpas", {
      orgId: args.orgId,
      vpa: args.vpa,
      label: args.label,
      active: args.active,
      priority: args.priority,
      createdAt: Date.now(),
    });
  },
});

export const deleteVpa = mutation({
  args: { orgId: v.id("organizations"), vpaId: v.id("paymentVpas") },
  handler: async (ctx, { orgId, vpaId }) => {
    await requireOrgAdmin(ctx, orgId);
    const row = await ctx.db.get(vpaId);
    if (!row || row.orgId !== orgId)
      throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(vpaId);
  },
});
