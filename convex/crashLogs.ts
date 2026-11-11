import { internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { requireOrgAdmin } from './lib/auth';
import { crashPath, crashReport, crashSource, redactCrashText } from './lib/crashLog';

// Only the secret-authenticated HTTP action can write. Failed mutations cannot
// log in their own transaction: that write would be rolled back with the crash.
export const record = internalMutation({
  args: { orgSlug: v.optional(v.string()), orgId: v.optional(v.id('organizations')), reporter: v.string(), report: crashReport },
  handler: async (ctx, { orgSlug, orgId, reporter, report }) => {
    const org = orgId ? await ctx.db.get(orgId)
      : orgSlug ? await ctx.db.query('organizations').withIndex('by_slug', q => q.eq('slug', orgSlug)).unique() : null;
    if (!org) return { accepted: false };
    const now = Date.now();
    const recent = await ctx.db.query('crashLogs')
      .withIndex('by_reporter_created', q => q.eq('reporter', reporter).gte('createdAt', now - 60_000))
      .take(20);
    if (recent.length >= 20) return { accepted: false };
    const id = await ctx.db.insert('crashLogs', {
      orgId: org._id, reporter, createdAt: now, source: report.source,
      message: redactCrashText(report.message, 2000),
      stack: redactCrashText(report.stack),
      componentStack: redactCrashText(report.componentStack),
      path: crashPath(report.path),
      userAgent: redactCrashText(report.userAgent, 500),
      build: redactCrashText(report.build, 100),
      operation: redactCrashText(report.operation, 200),
      requestId: redactCrashText(report.requestId, 100),
      status: report.status,
    });
    return { accepted: true, id };
  },
});

export const list = query({
  args: { orgId: v.id('organizations'), source: v.optional(crashSource), limit: v.optional(v.number()) },
  handler: async (ctx, { orgId, source, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    const count = Math.max(1, Math.min(200, Math.floor(limit ?? 50)));
    return source
      ? ctx.db.query('crashLogs').withIndex('by_org_source_created', q => q.eq('orgId', orgId).eq('source', source)).order('desc').take(count)
      : ctx.db.query('crashLogs').withIndex('by_org_created', q => q.eq('orgId', orgId)).order('desc').take(count);
  },
});

export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db.query('crashLogs').withIndex('by_created', q => q.lt('createdAt', Date.now() - 14 * 86_400_000)).take(200);
    for (const row of expired) await ctx.db.delete(row._id);
    if (expired.length === 200) await ctx.scheduler.runAfter(0, internal.crashLogs.prune, {});
  },
});
