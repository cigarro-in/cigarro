// Pure rules for orgDomains status. No Convex imports so they stay unit-testable.
// Status is never set by hand: it is derived from the Cloudflare Pages domain
// status on every check (convex/domains.ts applyCfState).

export type DerivedDomainStatus = "pending" | "active" | "error";

export function deriveDomainStatus(cfStatus: string): DerivedDomainStatus {
  if (cfStatus === "active") return "active";
  if (
    cfStatus === "error" ||
    cfStatus === "blocked" ||
    cfStatus === "deactivated" ||
    cfStatus === "absent" ||
    cfStatus === "deleted"
  ) {
    return "error";
  }
  // initializing, pending, and anything unrecognised: still waiting on Cloudflare.
  return "pending";
}

export const STATUS_HISTORY_LIMIT = 5;

export function appendStatusHistory<T>(history: readonly T[] | undefined, entry: T): T[] {
  return [...(history ?? []), entry].slice(-STATUS_HISTORY_LIMIT);
}
