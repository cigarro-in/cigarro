import type { Doc } from '../../../../convex/_generated/dataModel';

// Plain-English rules for discounts. Pure functions only (no Convex, no React),
// so the list, the form preview and any future storefront copy agree.

export type DiscountRow = Doc<'discounts'>;

/** The simple kinds an admin picks from. Stored values match the backend. */
export type DiscountKind = 'percentage' | 'fixed_amount' | 'cart_value';

export const KIND_OPTIONS: Array<{ kind: DiscountKind; title: string; example: string }> = [
  { kind: 'percentage', title: 'Percentage off', example: 'For example, 10% off the bill' },
  { kind: 'fixed_amount', title: 'Fixed amount off', example: 'For example, ₹100 off the bill' },
  { kind: 'cart_value', title: 'Amount off big orders', example: 'For example, ₹200 off when the bill is over ₹999' },
];

export const APPLIES_LABEL: Record<string, string> = {
  all: 'all products',
  products: 'selected products',
  combos: 'selected combos',
  variants: 'selected variants',
};

export function rupees(amount: number): string {
  const n = Number.isInteger(amount) ? amount : Math.round(amount * 100) / 100;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function isCustomerOnly(d: { allowed_user_ids?: string[] }): boolean {
  return (d.allowed_user_ids?.length ?? 0) > 0;
}

/** "10% off orders over ₹999, until 30 Nov" */
export function summarizeDiscount(d: Pick<DiscountRow, 'type' | 'value' | 'min_cart_value' | 'max_discount_amount' | 'applicable_to' | 'start_date' | 'end_date' | 'allowed_user_ids'>): string {
  const isPercent = d.type === 'percentage';
  const head = isPercent ? `${d.value}% off` : `${rupees(d.value)} off`;
  const cap = isPercent && d.max_discount_amount ? ` (up to ${rupees(d.max_discount_amount)})` : '';
  const min = d.min_cart_value ?? 0;
  const applies = d.applicable_to ?? 'all';

  let scope: string;
  if (applies === 'all') scope = min > 0 ? ` on orders over ${rupees(min)}` : ' on all orders';
  else scope = ` on ${APPLIES_LABEL[applies] ?? 'selected items'}${min > 0 ? `, orders over ${rupees(min)}` : ''}`;

  let when = '';
  if (d.start_date && d.end_date) when = `, ${shortDate(d.start_date)} to ${shortDate(d.end_date)}`;
  else if (d.end_date) when = `, until ${shortDate(d.end_date)}`;
  else if (d.start_date) when = `, from ${shortDate(d.start_date)}`;

  const who = isCustomerOnly(d)
    ? `, only for ${d.allowed_user_ids!.length} ${d.allowed_user_ids!.length === 1 ? 'customer' : 'customers'}`
    : '';

  return `${head}${cap}${scope}${when}${who}`;
}

export type DiscountStatus = 'active' | 'scheduled' | 'expired' | 'used_up' | 'off';

export const STATUS_LABEL: Record<DiscountStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  used_up: 'Used up',
  off: 'Off',
};

export function discountStatus(d: Pick<DiscountRow, 'is_active' | 'start_date' | 'end_date' | 'usage_limit' | 'usage_count'>, now = Date.now()): DiscountStatus {
  if (!d.is_active) return 'off';
  if (d.end_date && d.end_date < now) return 'expired';
  if (d.usage_limit && (d.usage_count ?? 0) >= d.usage_limit) return 'used_up';
  if (d.start_date && d.start_date > now) return 'scheduled';
  return 'active';
}

/** Plain uses text: "12 of 50 used", "12 used", "Unlimited". */
export function usesText(d: Pick<DiscountRow, 'usage_count' | 'usage_limit'>): string {
  const used = d.usage_count ?? 0;
  return d.usage_limit ? `${used} of ${d.usage_limit} used` : `${used} used`;
}

/** Form state: all inputs as strings so the admin can clear a field while typing. */
export interface DiscountDraft {
  kind: DiscountKind;
  name: string;
  code: string;
  description: string;
  value: string;
  minOrder: string;
  maxDiscount: string;
  usageLimit: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  appliesTo: 'all' | 'products' | 'combos' | 'variants';
  productIds: string[];
  customerIds: string[];
  isActive: boolean;
}

export const EMPTY_DRAFT: DiscountDraft = {
  kind: 'percentage',
  name: '',
  code: '',
  description: '',
  value: '',
  minOrder: '',
  maxDiscount: '',
  usageLimit: '',
  startDate: '',
  endDate: '',
  appliesTo: 'all',
  productIds: [],
  customerIds: [],
  isActive: true,
};

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Draft -> summary input (so the preview uses the same code path as the list). */
export function draftToSummaryInput(f: DiscountDraft) {
  return {
    type: f.kind,
    value: num(f.value) ?? 0,
    min_cart_value: f.kind === 'percentage' || f.kind === 'fixed_amount' || f.kind === 'cart_value' ? num(f.minOrder) : undefined,
    max_discount_amount: f.kind === 'percentage' ? num(f.maxDiscount) : undefined,
    applicable_to: f.appliesTo,
    start_date: dayToMs(f.startDate, 'start'),
    end_date: dayToMs(f.endDate, 'end'),
    allowed_user_ids: f.customerIds,
  };
}

/** yyyy-mm-dd -> local ms. End dates run to the end of that day. */
export function dayToMs(day: string, edge: 'start' | 'end'): number | undefined {
  if (!day) return undefined;
  return new Date(`${day}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}`).getTime();
}

const msToDay = (ms?: number | null) => {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Stored row -> form draft. Legacy 'cart_value' rows keep their kind. */
export function rowToDraft(row: DiscountRow): DiscountDraft {
  const kind: DiscountKind =
    row.type === 'percentage' || row.type === 'fixed_amount' || row.type === 'cart_value' ? row.type : 'fixed_amount';
  const applies = (['all', 'products', 'combos', 'variants'] as const).includes(row.applicable_to as never)
    ? (row.applicable_to as DiscountDraft['appliesTo'])
    : 'all';
  return {
    kind,
    name: row.name ?? '',
    code: row.code ?? '',
    description: row.description ?? '',
    value: row.value ? String(row.value) : '',
    minOrder: row.min_cart_value ? String(row.min_cart_value) : '',
    maxDiscount: row.max_discount_amount ? String(row.max_discount_amount) : '',
    usageLimit: row.usage_limit ? String(row.usage_limit) : '',
    startDate: msToDay(row.start_date),
    endDate: msToDay(row.end_date),
    appliesTo: applies,
    productIds: row.product_ids ?? [],
    customerIds: row.allowed_user_ids ?? [],
    isActive: row.is_active !== false,
  };
}

/** Validation messages for the form. Empty array = ready to save. */
export function validateDraft(f: DiscountDraft): string[] {
  const errors: string[] = [];
  if (!f.name.trim()) errors.push('Give this discount a name.');
  const value = parseFloat(f.value);
  if (!(value > 0)) errors.push(f.kind === 'percentage' ? 'Enter a percentage greater than 0.' : 'Enter an amount greater than 0.');
  if (f.kind === 'percentage' && value > 100) errors.push('A percentage cannot be more than 100.');
  if (f.kind === 'cart_value' && !(parseFloat(f.minOrder) > 0))
    errors.push('Enter the minimum order amount for this discount.');
  if (f.startDate && f.endDate && f.endDate < f.startDate) errors.push('The end date is before the start date.');
  if (f.appliesTo === 'products' && f.productIds.length === 0) errors.push('Pick at least one product, or choose "all products".');
  return errors;
}
