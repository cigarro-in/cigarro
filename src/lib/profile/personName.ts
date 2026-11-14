// A real person name is required for every profile, admin user and address.
// The legacy default "Customer" (and similar placeholders) is never a name.
// Keep in sync with convex/lib/personName.ts.

const PLACEHOLDER_NAMES = new Set(['customer', 'guest', 'unknown', 'admin']);

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;

export function cleanPersonName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

export function isPlaceholderName(raw: string | null | undefined): boolean {
  return PLACEHOLDER_NAMES.has(cleanPersonName(raw).toLowerCase());
}

export function isRealPersonName(raw: string | null | undefined): boolean {
  const clean = cleanPersonName(raw);
  return clean.length >= NAME_MIN_LENGTH && clean.length <= NAME_MAX_LENGTH && !isPlaceholderName(clean);
}

// Inline validation message, or null when the name can be saved.
export function personNameError(raw: string | null | undefined): string | null {
  const clean = cleanPersonName(raw);
  if (!clean) return 'Full name is required';
  if (clean.length < NAME_MIN_LENGTH) return `Name must be at least ${NAME_MIN_LENGTH} characters`;
  if (clean.length > NAME_MAX_LENGTH) return `Name must be ${NAME_MAX_LENGTH} characters or fewer`;
  if (isPlaceholderName(clean)) return 'Enter your real name';
  return null;
}

// Name to show for a stored value: the real name, or '' when missing.
export function realNameOrEmpty(raw: string | null | undefined): string {
  return isRealPersonName(raw) ? cleanPersonName(raw) : '';
}

// Admin/customer display: real name, else the phone, else a neutral label.
export function customerDisplayName(
  name: string | null | undefined,
  phone?: string | null,
  fallback = 'No name'
): string {
  if (isRealPersonName(name)) return cleanPersonName(name);
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits) return phone!.trim();
  return fallback;
}
