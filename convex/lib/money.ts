// All money in integer paise. 1 rupee = 100 paise.
// Never use floats for amounts; parse/serialize at boundaries only.

export const rupeesToPaise = (rupees: number): number =>
  Math.round(rupees * 100);

export const paiseToRupees = (paise: number): number => paise / 100;

export const formatPaise = (paise: number): string =>
  `₹${(paise / 100).toFixed(2)}`;

export function assertPositiveInt(n: number, field: string): void {
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${field} must be a non-negative integer paise value`);
  }
}
