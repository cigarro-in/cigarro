// Per-store allowlist of bank/UPI alert senders. When a store has a non-empty
// list, bank emails from any other sender are ignored (both the Gmail poller
// and the forwarding webhook go through ingestBankEmail). Empty = no filter.
//
// Entry forms (case-insensitive):
//   "alerts@hdfcbank.net"  exact address
//   "hdfcbank.net"         every address on that domain

const ENTRY_RE = /^(?:[a-z0-9._+-]+@)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
export const MAX_BANK_SENDERS = 25;

/** Lowercase, trim, drop a leading "@", dedupe. Returns null if an entry is malformed. */
export function normalizeBankSenders(input: string[]): string[] | null {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const s = raw.trim().toLowerCase().replace(/^@/, "");
    if (!s) continue;
    if (!ENTRY_RE.test(s)) return null;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Bare address from a From header such as `"HDFC Bank" <alerts@hdfcbank.net>`. */
export function senderAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m?.[1] ?? from).trim().toLowerCase();
}

/** True when the list is empty (no filter) or the From header matches an entry. */
export function isBankSenderAllowed(
  from: string,
  allowlist: string[] | undefined | null,
): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  const addr = senderAddress(from);
  const domain = addr.split("@")[1] ?? "";
  return allowlist.some((raw) => {
    const entry = raw.trim().toLowerCase().replace(/^@/, "");
    return entry.includes("@") ? addr === entry : domain === entry;
  });
}
