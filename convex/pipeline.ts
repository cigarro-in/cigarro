// Payments pipeline: the decision config (global + per-store override), the
// cross-store message log, and the super-admin views over messages and orders.
// Merchants never see any of this; their admin shows connection status only.
//
// Every SA function takes `saToken`: reads use requireSaSession, writes use
// requireSaWrite (write window + audit as actorType "super_admin").

import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  ALL_SUFFIX_RULES,
  DEFAULT_PIPELINE_CONFIG,
  type PipelineConfig,
  type SuffixRule,
} from "./lib/bankMessage";
import { normalizeSmsSenders } from "./lib/smsSenders";
import { MAX_BANK_SENDERS, normalizeBankSenders } from "./lib/bankSenders";

// ---------- Config resolution ----------

type SettingsRow = Doc<"paymentPipelineSettings">;

async function settingsRow(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations"> | undefined,
): Promise<SettingsRow | null> {
  return await ctx.db
    .query("paymentPipelineSettings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
}

function suffixes(list: string[] | undefined): SuffixRule[] | undefined {
  if (!list) return undefined;
  return list.filter((s): s is SuffixRule => (ALL_SUFFIX_RULES as string[]).includes(s));
}

function globalFrom(row: SettingsRow | null): PipelineConfig {
  const d = DEFAULT_PIPELINE_CONFIG;
  return {
    acceptedSuffixes: suffixes(row?.acceptedSuffixes) ?? d.acceptedSuffixes,
    bankSenders: row?.bankSenders ?? d.bankSenders,
    knownSendersOnly: row?.knownSendersOnly ?? d.knownSendersOnly,
    allowPhoneSenders: row?.allowPhoneSenders ?? d.allowPhoneSenders,
    creditKeywords: row?.creditKeywords ?? d.creditKeywords,
    debitKeywords: row?.debitKeywords ?? d.debitKeywords,
    dedupeWindowMs: row?.dedupeWindowMs ?? d.dedupeWindowMs,
  };
}

/**
 * Effective config for one store: store override field, else global row, else
 * code default. Store `bankSenders` are added to the global list. A legacy
 * merchant SMS allowlist (organizations.allowedSmsSenders) still counts as
 * known senders and turns on known-only unless the store override says otherwise.
 */
export async function loadPipelineConfig(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
): Promise<PipelineConfig> {
  const global = globalFrom(await settingsRow(ctx, undefined));
  const store = await settingsRow(ctx, orgId);
  const org = await ctx.db.get(orgId);
  const legacy = org?.allowedSmsSenders ?? [];
  const extra = [...(store?.bankSenders ?? []), ...legacy];
  return {
    acceptedSuffixes: suffixes(store?.acceptedSuffixes) ?? global.acceptedSuffixes,
    bankSenders: [...new Set([...global.bankSenders, ...extra])],
    knownSendersOnly: store?.knownSendersOnly ?? (legacy.length > 0 ? true : global.knownSendersOnly),
    allowPhoneSenders: store?.allowPhoneSenders ?? global.allowPhoneSenders,
    creditKeywords: store?.creditKeywords ?? global.creditKeywords,
    debitKeywords: store?.debitKeywords ?? global.debitKeywords,
    dedupeWindowMs: store?.dedupeWindowMs ?? global.dedupeWindowMs,
  };
}

// ---------- Message log ----------

export type MessageOutcome = Doc<"paymentMessages">["outcome"];
export type PaymentMessageInput = Omit<Doc<"paymentMessages">, "_id" | "_creationTime">;

const MAX_BODY = 8000;

export async function recordPaymentMessage(ctx: MutationCtx, entry: PaymentMessageInput) {
  return await ctx.db.insert("paymentMessages", {
    ...entry,
    body: entry.body.slice(0, MAX_BODY),
    sender: entry.sender.slice(0, 200),
  });
}

// ---------- SA: settings ----------

const MAX_KEYWORDS = 40;
const MAX_WINDOW_MS = 60 * 60 * 1000;

const configFields = {
  acceptedSuffixes: v.optional(v.array(v.string())),
  bankSenders: v.optional(v.array(v.string())),
  knownSendersOnly: v.optional(v.boolean()),
  allowPhoneSenders: v.optional(v.boolean()),
  creditKeywords: v.optional(v.array(v.string())),
  debitKeywords: v.optional(v.array(v.string())),
  dedupeWindowMs: v.optional(v.number()),
};

type ConfigPatch = {
  acceptedSuffixes?: string[];
  bankSenders?: string[];
  knownSendersOnly?: boolean;
  allowPhoneSenders?: boolean;
  creditKeywords?: string[];
  debitKeywords?: string[];
  dedupeWindowMs?: number;
};

function cleanKeywords(list: string[]): string[] {
  const out = [...new Set(list.map((w) => w.trim().toLowerCase()).filter(Boolean))];
  if (out.length > MAX_KEYWORDS || out.some((w) => w.length > 40)) {
    throw new ConvexError({ code: "INVALID_KEYWORDS" });
  }
  return out;
}

/** Validates and normalizes a patch. Undefined fields stay undefined (inherit). */
function cleanPatch(p: ConfigPatch): ConfigPatch {
  const out: ConfigPatch = {};
  if (p.acceptedSuffixes !== undefined) {
    const s = suffixes(p.acceptedSuffixes.map((x) => x.trim()));
    if (!s || s.length !== p.acceptedSuffixes.length) throw new ConvexError({ code: "INVALID_SUFFIX" });
    out.acceptedSuffixes = [...new Set(s)];
  }
  if (p.bankSenders !== undefined) {
    // Entities only: prefixes/suffixes are stripped by the matcher anyway.
    const n = normalizeSmsSenders(p.bankSenders);
    if (n === null || n.length > 300) throw new ConvexError({ code: "INVALID_SENDER" });
    out.bankSenders = n;
  }
  if (p.knownSendersOnly !== undefined) out.knownSendersOnly = p.knownSendersOnly;
  if (p.allowPhoneSenders !== undefined) out.allowPhoneSenders = p.allowPhoneSenders;
  if (p.creditKeywords !== undefined) out.creditKeywords = cleanKeywords(p.creditKeywords);
  if (p.debitKeywords !== undefined) out.debitKeywords = cleanKeywords(p.debitKeywords);
  if (p.dedupeWindowMs !== undefined) {
    if (!Number.isFinite(p.dedupeWindowMs) || p.dedupeWindowMs < 0 || p.dedupeWindowMs > MAX_WINDOW_MS) {
      throw new ConvexError({ code: "INVALID_WINDOW" });
    }
    out.dedupeWindowMs = Math.round(p.dedupeWindowMs);
  }
  return out;
}

function storedFields(row: SettingsRow | null) {
  return {
    acceptedSuffixes: row?.acceptedSuffixes ?? null,
    bankSenders: row?.bankSenders ?? null,
    knownSendersOnly: row?.knownSendersOnly ?? null,
    allowPhoneSenders: row?.allowPhoneSenders ?? null,
    creditKeywords: row?.creditKeywords ?? null,
    debitKeywords: row?.debitKeywords ?? null,
    dedupeWindowMs: row?.dedupeWindowMs ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

export const getGlobalConfig = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const row = await settingsRow(ctx, undefined);
    return { stored: storedFields(row), effective: globalFrom(row), defaults: DEFAULT_PIPELINE_CONFIG };
  },
});

export const setGlobalConfig = mutation({
  args: { saToken: v.string(), ...configFields },
  handler: async (ctx, { saToken, ...patch }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const clean = cleanPatch(patch);
    const row = await settingsRow(ctx, undefined);
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { ...clean, updatedAt: now, updatedBy: sa.adminId });
    else await ctx.db.insert("paymentPipelineSettings", { ...clean, updatedAt: now, updatedBy: sa.adminId });
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.pipeline.global_updated",
      targetType: "paymentPipelineSettings",
      targetId: "global",
      payload: { fields: Object.keys(clean) },
    });
    return { ok: true };
  },
});

export const getStoreConfig = query({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    const row = await settingsRow(ctx, orgId);
    const relay = await ctx.db
      .query("smsRelays")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const gmail = await ctx.db
      .query("gmailConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    return {
      override: storedFields(row),
      global: globalFrom(await settingsRow(ctx, undefined)),
      effective: await loadPipelineConfig(ctx, orgId),
      legacySmsSenders: org.allowedSmsSenders ?? [],
      emailSenders: org.allowedBankSenders ?? [],
      relay: relay
        ? {
            active: relay.active,
            tokenLast4: relay.tokenLast4,
            createdAt: relay.createdAt,
            rotatedAt: relay.rotatedAt ?? null,
            lastSmsAt: relay.lastSmsAt ?? null,
            lastCreditSmsAt: relay.lastCreditSmsAt ?? null,
            lastConfirmedAt: relay.lastConfirmedAt ?? null,
            lastSetupErrorAt: relay.lastSetupErrorAt ?? null,
            lastSetupError: relay.lastSetupError ?? null,
          }
        : null,
      gmail: gmail
        ? { status: gmail.status, accountEmail: gmail.accountEmail, lastSuccessAt: gmail.lastSuccessAt ?? null }
        : null,
      serverNow: Date.now(),
    };
  },
});

/**
 * Sets the store override. Each field: a value overrides, `null` in `clear`
 * returns that field to the global setting.
 */
export const setStoreConfig = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    ...configFields,
    clear: v.optional(v.array(v.string())),
    clearLegacySmsSenders: v.optional(v.boolean()),
    /** Bank email senders for this store (organizations.allowedBankSenders). Empty = any. */
    emailSenders: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { saToken, orgId, clear, clearLegacySmsSenders, emailSenders, ...patch }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    const clean = cleanPatch(patch);
    const unset: Record<string, undefined> = {};
    for (const f of clear ?? []) {
      if (f in configFields) unset[f] = undefined;
    }
    const row = await settingsRow(ctx, orgId);
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { ...unset, ...clean, updatedAt: now, updatedBy: sa.adminId });
    else await ctx.db.insert("paymentPipelineSettings", { orgId, ...clean, updatedAt: now, updatedBy: sa.adminId });
    if (clearLegacySmsSenders) await ctx.db.patch(orgId, { allowedSmsSenders: undefined });
    if (emailSenders !== undefined) {
      const n = normalizeBankSenders(emailSenders);
      if (n === null || n.length > MAX_BANK_SENDERS) throw new ConvexError({ code: "INVALID_SENDER" });
      await ctx.db.patch(orgId, { allowedBankSenders: n });
    }
    await audit(ctx, {
      orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.pipeline.store_updated",
      targetType: "organization",
      targetId: orgId,
      payload: {
        set: Object.keys(clean),
        cleared: Object.keys(unset),
        clearLegacySmsSenders: !!clearLegacySmsSenders,
        emailSenders: emailSenders !== undefined,
      },
    });
    return { ok: true };
  },
});

// ---------- SA: messages ----------

const outcomeV = v.union(
  v.literal("matched"),
  v.literal("credit_unmatched"),
  v.literal("ignored"),
  v.literal("duplicate"),
  v.literal("setup_error"),
);

const DAY_MS = 24 * 60 * 60 * 1000;

type OrderBrief = {
  _id: Id<"orders">;
  orderNumber: number | null;
  displayOrderId: string;
  orgId: Id<"organizations">;
  finalAmountPaise: number;
  status: string;
  createdAt: number;
};

function brief(o: Doc<"orders">): OrderBrief {
  return {
    _id: o._id,
    orderNumber: o.orderNumber ?? null,
    displayOrderId: o.displayOrderId,
    orgId: o.orgId,
    finalAmountPaise: o.finalAmountPaise,
    status: o.status,
    createdAt: o.createdAt,
  };
}

/** Orders of the store with the same rupee amount (any paise), created within a day of `at`. */
async function nearbyOrders(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  amountPaise: number,
  at: number,
): Promise<OrderBrief[]> {
  if (amountPaise <= 0) return [];
  const lo = Math.floor(amountPaise / 100) * 100;
  const rows = await ctx.db
    .query("orders")
    .withIndex("by_org_final_status", (q) =>
      q.eq("orgId", orgId).gte("finalAmountPaise", lo - 100).lt("finalAmountPaise", lo + 200),
    )
    .take(200);
  return rows
    .filter((o) => Math.abs(o.createdAt - at) <= DAY_MS)
    .sort((a, b) => Math.abs(a.finalAmountPaise - amountPaise) - Math.abs(b.finalAmountPaise - amountPaise))
    .slice(0, 5)
    .map(brief);
}

export const listMessages = query({
  args: {
    saToken: v.string(),
    orgId: v.optional(v.id("organizations")),
    channel: v.optional(v.union(v.literal("sms"), v.literal("email"))),
    outcome: v.optional(outcomeV),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { saToken, orgId, channel, outcome, search, paginationOpts }) => {
    await requireSaSession(ctx, saToken);
    const text = search?.trim();
    let page;
    if (text) {
      page = await ctx.db
        .query("paymentMessages")
        .withSearchIndex("search_body", (q) => {
          let s = q.search("body", text);
          if (orgId) s = s.eq("orgId", orgId);
          if (channel) s = s.eq("channel", channel);
          if (outcome) s = s.eq("outcome", outcome);
          return s;
        })
        .paginate(paginationOpts);
    } else {
      const base =
        orgId && outcome
          ? ctx.db.query("paymentMessages").withIndex("by_org_outcome_at", (q) => q.eq("orgId", orgId).eq("outcome", outcome))
          : orgId
            ? ctx.db.query("paymentMessages").withIndex("by_org_at", (q) => q.eq("orgId", orgId))
            : outcome
              ? ctx.db.query("paymentMessages").withIndex("by_outcome_at", (q) => q.eq("outcome", outcome))
              : ctx.db.query("paymentMessages").withIndex("by_at");
      const ordered = base.order("desc");
      page = await (channel ? ordered.filter((q) => q.eq(q.field("channel"), channel)) : ordered).paginate(
        paginationOpts,
      );
    }

    const orgCache = new Map<string, { name: string; slug: string } | null>();
    const rows = await Promise.all(
      page.page.map(async (m) => {
        if (!orgCache.has(m.orgId)) {
          const o = await ctx.db.get(m.orgId);
          orgCache.set(m.orgId, o ? { name: o.name, slug: o.slug } : null);
        }
        const order = m.orderId ? await ctx.db.get(m.orderId) : null;
        const candidates =
          m.outcome === "credit_unmatched" && m.amountPaise
            ? await nearbyOrders(ctx, m.orgId, m.amountPaise, m.at)
            : [];
        return {
          ...m,
          store: orgCache.get(m.orgId) ?? null,
          order: order ? brief(order) : null,
          candidates,
        };
      }),
    );
    return { page: rows, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Counts of the latest messages by outcome (last 24 hours, capped scan). */
export const messageSummary = query({
  args: { saToken: v.string(), orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    const since = Date.now() - DAY_MS;
    const rows = orgId
      ? await ctx.db
          .query("paymentMessages")
          .withIndex("by_org_at", (q) => q.eq("orgId", orgId).gte("at", since))
          .take(5000)
      : await ctx.db
          .query("paymentMessages")
          .withIndex("by_at", (q) => q.gte("at", since))
          .take(5000);
    const counts: Record<MessageOutcome, number> = {
      matched: 0,
      credit_unmatched: 0,
      ignored: 0,
      duplicate: 0,
      setup_error: 0,
    };
    let sms = 0;
    let email = 0;
    for (const r of rows) {
      counts[r.outcome]++;
      if (r.channel === "sms") sms++;
      else email++;
    }
    return { counts, sms, email, total: rows.length, capped: rows.length >= 5000 };
  },
});

// ---------- SA: orders ----------

type MatchSource = "sms" | "email" | "manual" | "wallet" | null;

async function matchSource(ctx: QueryCtx, o: Doc<"orders">): Promise<MatchSource> {
  if (o.verificationMethod === "admin_manual") return "manual";
  if (o.verificationMethod === "wallet_only") return "wallet";
  if (o.verificationMethod === "email") {
    const e = o.bankEmailId ? await ctx.db.get(o.bankEmailId) : null;
    return e?.channel === "sms" ? "sms" : "email";
  }
  return null;
}

async function customer(ctx: QueryCtx, o: Doc<"orders">): Promise<{ name: string | null; phone: string | null }> {
  if (o.address?.name) return { name: o.address.name, phone: o.address.phone ?? null };
  const user = await ctx.db
    .query("users")
    .withIndex("by_user", (q) => q.eq("userId", o.userId))
    .first();
  return { name: user?.name ?? null, phone: user?.phone ?? null };
}

async function orderRow(ctx: QueryCtx, o: Doc<"orders">) {
  return {
    ...brief(o),
    baseAmountPaise: o.baseAmountPaise,
    slotOffsetPaise: o.slotOffsetPaise,
    walletDebitPaise: o.walletDebitPaise,
    kind: o.kind,
    shippingStatus: o.shippingStatus ?? null,
    paidAt: o.paidAt ?? null,
    terminalAt: o.terminalAt ?? null,
    customer: await customer(ctx, o),
    source: await matchSource(ctx, o),
  };
}

export const listStoreOrders = query({
  args: { saToken: v.string(), orgId: v.id("organizations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { saToken, orgId, paginationOpts }) => {
    await requireSaSession(ctx, saToken);
    const page = await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
      .order("desc")
      .paginate(paginationOpts);
    const rows = await Promise.all(page.page.map((o) => orderRow(ctx, o)));
    return { page: rows, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

const UNMATCHED_STATUSES = ["no_match", "no_candidate", "unmatched", "quarantine_late"] as const;

function statusReason(e: Doc<"bankEmails">): string {
  switch (e.status) {
    case "matched":
      return "Confirmed the order";
    case "duplicate":
      return "Same payment received again";
    case "no_match":
      return "No pending order with this exact amount";
    case "no_candidate":
      return "No pending order near this amount";
    case "unmatched":
      return e.amountPaise > 0 ? "Not matched" : "Amount could not be read";
    case "quarantine_late":
      return "Held for review";
    case "parse_failed":
      return "Could not be read";
    default:
      return e.adminNote ?? "Ignored";
  }
}

async function evidenceRow(ctx: QueryCtx, e: Doc<"bankEmails">, role: "confirmed" | "duplicate" | "linked") {
  const msg = await ctx.db
    .query("paymentMessages")
    .withIndex("by_bank_email", (q) => q.eq("bankEmailId", e._id))
    .first();
  return {
    bankEmailId: e._id,
    role,
    channel: e.channel ?? "email",
    at: e.receivedAt,
    sender: e.senderEmail,
    subject: e.subject ?? null,
    body: msg?.body ?? e.rawBody,
    amountPaise: e.amountPaise,
    upiRef: e.upiRef ?? null,
    status: e.status,
    reason: msg?.reason ?? statusReason(e),
    duplicateOfEmailId: e.duplicateOfEmailId ?? null,
  };
}

export const getStoreOrder = query({
  args: { saToken: v.string(), orderId: v.id("orders") },
  handler: async (ctx, { saToken, orderId }) => {
    await requireSaSession(ctx, saToken);
    const o = await ctx.db.get(orderId);
    if (!o) return null;
    const store = await ctx.db.get(o.orgId);

    // Evidence: rows that confirmed or point at this order, plus their duplicates.
    const linked = await ctx.db
      .query("bankEmails")
      .withIndex("by_matched_order", (q) => q.eq("matchedOrderId", orderId))
      .take(50);
    const byId = new Map<string, Doc<"bankEmails">>();
    for (const e of linked) byId.set(e._id, e);
    if (o.bankEmailId && !byId.has(o.bankEmailId)) {
      const e = await ctx.db.get(o.bankEmailId);
      if (e) byId.set(e._id, e);
    }
    for (const e of [...byId.values()]) {
      const dups = await ctx.db
        .query("bankEmails")
        .withIndex("by_duplicate_of", (q) => q.eq("duplicateOfEmailId", e._id))
        .take(20);
      for (const d of dups) byId.set(d._id, d);
    }
    const evidence = await Promise.all(
      [...byId.values()]
        .sort((a, b) => a.receivedAt - b.receivedAt)
        .map((e) =>
          evidenceRow(
            ctx,
            e,
            e._id === o.bankEmailId ? "confirmed" : e.status === "duplicate" ? "duplicate" : "linked",
          ),
        ),
    );

    // Possible matches: unmatched credits of this store within a day, same rupees.
    const lo = o.createdAt - DAY_MS;
    const hi = o.createdAt + DAY_MS;
    const rupees = Math.floor(o.finalAmountPaise / 100);
    const possible: Awaited<ReturnType<typeof evidenceRow>>[] = [];
    for (const status of UNMATCHED_STATUSES) {
      const rows = await ctx.db
        .query("bankEmails")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", o.orgId).eq("status", status).gte("receivedAt", lo).lte("receivedAt", hi),
        )
        .take(300);
      for (const e of rows) {
        if (e.amountPaise <= 0) continue;
        if (Math.floor(e.amountPaise / 100) !== rupees && Math.abs(e.amountPaise - o.finalAmountPaise) > 100) continue;
        possible.push(await evidenceRow(ctx, e, "linked"));
      }
    }
    possible.sort(
      (a, b) =>
        Math.abs(a.amountPaise - o.finalAmountPaise) - Math.abs(b.amountPaise - o.finalAmountPaise) ||
        Math.abs(a.at - o.createdAt) - Math.abs(b.at - o.createdAt),
    );

    return {
      order: {
        ...(await orderRow(ctx, o)),
        items: o.items.map((i) => ({ name: i.name, qty: i.qty, unitPricePaise: i.unitPricePaise })),
        cartTotalPaise: o.cartTotalPaise,
        discountPaise: o.discountPaise ?? 0,
        shippingPricePaise: o.shippingPricePaise ?? 0,
        payerVpa: o.payerVpa ?? null,
        payerName: o.payerName ?? null,
        payingVpa: o.payingVpa ?? null,
        extraCreditsPaise: o.extraCreditsPaise ?? 0,
      },
      store: store ? { _id: store._id, name: store.name, slug: store.slug } : null,
      evidence,
      possibleMatches: possible.slice(0, 10),
      serverNow: Date.now(),
    };
  },
});
