// Per-store allowlist of bank SMS sender IDs for the SMS relay.
//
// Indian bank SMS come from alphanumeric sender IDs, usually with a 2-letter
// telco prefix: "VM-HDFCBK", "AD-HDFCBK", "AX-ICICIT". Entries are either:
//   "HDFCBK"          the bare ID, any prefix ("VM-HDFCBK", "AD-HDFCBK", ...)
//   "VM-HDFCBK"       the exact sender string
//   "+919876543210"   a phone-number sender (rare, but some banks use one)
// Case-insensitive. Empty list = the relay accepts nothing.

const ENTRY_RE = /^(?:[A-Z0-9]{2}-)?[A-Z0-9]{3,11}$|^\+?[0-9]{8,15}$/;
export const MAX_SMS_SENDERS = 25;

/** Uppercase, trim, dedupe. Returns null if an entry is malformed. */
export function normalizeSmsSenders(input: string[]): string[] | null {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const s = raw.trim().toUpperCase();
    if (!s) continue;
    if (!ENTRY_RE.test(s)) return null;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** True when the sender string matches an allowlist entry. Empty list = false. */
export function smsSenderAllowed(
  sender: string,
  allowlist: string[] | undefined | null,
): boolean {
  if (!allowlist || allowlist.length === 0) return false;
  const s = sender.trim().toUpperCase();
  const id = s.includes("-") ? s.slice(s.lastIndexOf("-") + 1) : s;
  return allowlist.some((raw) => {
    const e = raw.trim().toUpperCase();
    return e.includes("-") || e.startsWith("+") ? e === s : e === id;
  });
}
