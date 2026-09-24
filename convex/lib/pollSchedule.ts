// Event-driven Gmail check schedule. Pure (no Convex imports) so it can be
// unit-checked with tsx. No statistical adaptation: fixed offsets only.
//
// Model: each pending order triggers its own bounded chain of inbox checks.
// Every scheduled check re-validates the order/org state before touching the
// Gmail API, so paid/terminal orders and idle orgs cost zero Gmail calls.
export const ORDER_POLL_EARLY_OFFSETS_MS = [
  5_000, 12_000, 25_000, 45_000, 75_000, 120_000,
];

/** Steady cadence after the early backoff, until the order times out. */
export const ORDER_POLL_STEADY_MS = 60_000;

/** Sparse post-expiry reconciliation to catch late UPI credits. */
export const RECONCILE_OFFSETS_MS = [90_000, 6 * 60_000];

/** Payment statuses that stop all active checks for an order. */
export const TERMINAL_ORDER_STATUSES = [
  "paid",
  "late_paid",
  "cancelled",
  "expired",
  "refunded",
  "voided",
] as const;

export function isTerminalOrderStatus(status: string): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Full check offsets for a newly created order: early backoff, then a
 * bounded 60s cadence up to (and including) the order timeout.
 */
export function buildOrderPollOffsets(timeoutMs: number): number[] {
  // Non-positive timeout = no coverage window at all: no offsets. (Every
  // caller filters `ms <= timeoutMs` below, so this is the <= 0 edge.)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return [];
  // No check may fire after the order already timed out — drop early offsets
  // past the timeout (e.g. a 60s timeout keeps 5s..45s, not 75s/120s).
  const offsets = ORDER_POLL_EARLY_OFFSETS_MS.filter((ms) => ms <= timeoutMs);
  let t = 180_000;
  while (t <= timeoutMs) {
    offsets.push(t);
    t += ORDER_POLL_STEADY_MS;
  }
  return offsets;
}
