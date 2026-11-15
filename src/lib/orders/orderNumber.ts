// The only order identifier a person may see: the five-digit order number.
// Never render the internal display id (ORD-YYMMDD-XXXXX) from `displayOrderId`.
// Returns '' when the number is missing (legacy rows), so callers render nothing
// instead of falling back to the internal id. Bare digits, no '#'.

export function formatOrderNumber(n: unknown): string {
  if (typeof n === 'number' && Number.isInteger(n) && n >= 10000 && n <= 99999) return String(n);
  if (typeof n === 'string' && /^#?\d{5}$/.test(n.trim())) return n.trim().replace(/^#/, '');
  return '';
}
