export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatPaiseINR(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}
