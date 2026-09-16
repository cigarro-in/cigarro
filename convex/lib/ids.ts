const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1

function randomSuffix(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function genDisplayOrderId(now = Date.now()): string {
  const d = new Date(now);
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `ORD-${yy}${mm}${dd}-${randomSuffix(5)}`;
}

// Customer-facing order number: five digits, 10000–99999. Scoped per org
// (uniqueness is checked against the org's orders at allocation time).
// Legacy rows predate the field — callers must fall back to displayOrderId
// when orderNumber is absent.
export const ORDER_NUMBER_MIN = 10000;
export const ORDER_NUMBER_MAX = 99999;

export function genOrderNumberCandidate(): number {
  return (
    ORDER_NUMBER_MIN +
    Math.floor(Math.random() * (ORDER_NUMBER_MAX - ORDER_NUMBER_MIN + 1))
  );
}

export function isValidOrderNumber(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= ORDER_NUMBER_MIN &&
    n <= ORDER_NUMBER_MAX
  );
}

// Read the customer-facing order number off a row (or row-like). Legacy rows
// predate the field — returns undefined so callers fall back to displayOrderId.
// Lives here (not orders.ts) so payments.ts can use it without importing
// the orders module.
export function orderNumberOf(order: { orderNumber?: unknown }): number | undefined {
  const n = (order as { orderNumber?: unknown }).orderNumber;
  return isValidOrderNumber(n) ? n : undefined;
}
