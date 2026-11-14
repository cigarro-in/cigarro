import { ConvexError } from "convex/values";

// A real person name is required wherever a profile, admin user or address is
// written. Placeholder values (legacy default "Customer") never count as a
// name. Keep in sync with src/lib/profile/personName.ts.
const PLACEHOLDER_NAMES = new Set(["customer", "guest", "unknown", "admin"]);

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;

export function cleanPersonName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

export function isPlaceholderName(raw: string | null | undefined): boolean {
  return PLACEHOLDER_NAMES.has(cleanPersonName(raw).toLowerCase());
}

export function isRealPersonName(raw: string | null | undefined): boolean {
  const clean = cleanPersonName(raw);
  return (
    clean.length >= NAME_MIN_LENGTH &&
    clean.length <= NAME_MAX_LENGTH &&
    !isPlaceholderName(clean)
  );
}

// Returns the cleaned name or throws NAME_REQUIRED. Use on every write that
// creates or edits a profile, user, member or address.
export function requireRealPersonName(raw: string | null | undefined): string {
  if (!isRealPersonName(raw)) {
    throw new ConvexError({ code: "NAME_REQUIRED" });
  }
  return cleanPersonName(raw);
}

// Admin-facing label for a customer: the real name, else the phone (never a
// placeholder such as "Customer"), else the fallback.
export function displayCustomerName(
  name: string | null | undefined,
  phone: string | null | undefined,
  fallback = "Unknown",
): string {
  if (isRealPersonName(name)) return cleanPersonName(name);
  const trimmed = (phone ?? "").trim();
  return trimmed !== "" ? trimmed : fallback;
}
