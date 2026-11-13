import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

// Bank-email alias for a new org. An alias is taken if any org's
// bankEmailAlias, or any bankInboxes address, already routes to a store.
// Inboxes are stored as full addresses, so check the common forms too.
const INBOX_DOMAIN = "cigarro.in";
const MAX_SUFFIX = 99;

async function aliasTaken(ctx: MutationCtx, alias: string): Promise<boolean> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_alias", (q) => q.eq("bankEmailAlias", alias))
    .first();
  if (org) return true;
  for (const addr of [alias, `${alias}@${INBOX_DOMAIN}`, `bank-${alias}@${INBOX_DOMAIN}`]) {
    const inbox = await ctx.db
      .query("bankInboxes")
      .withIndex("by_alias", (q) => q.eq("alias", addr))
      .first();
    if (inbox) return true;
  }
  return false;
}

export async function pickUniqueBankAlias(ctx: MutationCtx, base: string): Promise<string> {
  if (!(await aliasTaken(ctx, base))) return base;
  for (let n = 2; n <= MAX_SUFFIX; n++) {
    const candidate = `${base}-${n}`;
    if (!(await aliasTaken(ctx, candidate))) return candidate;
  }
  throw new ConvexError({ code: "ALIAS_EXHAUSTED" });
}
