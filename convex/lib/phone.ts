// Single normalization point for phone numbers stored in Convex.
// E.164 (`+919876543210`). Identity lookups (by_phone) and profile writes
// must all go through here — a raw `8509067208` vs `+918509067208` mismatch
// silently forks a second users row and strands memberships (the lockout).
export function normalizePhoneE164(raw: unknown): string | undefined {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `+91${digits.slice(1)}`;
  return `+${digits}`;
}
