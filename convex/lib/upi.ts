import { paiseToRupees } from "./money";

export interface BuildUpiUrlArgs {
  vpa: string;
  payeeName?: string;
  amountPaise: number;
  referenceId: string; // our displayOrderId
  note?: string;
}

export function buildUpiUrl({
  vpa,
  payeeName,
  amountPaise,
  referenceId,
  note,
}: BuildUpiUrlArgs): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName ?? "Merchant",
    am: paiseToRupees(amountPaise).toFixed(2),
    cu: "INR",
    tr: referenceId,
    ...(note ? { tn: note } : {}),
  });
  return `upi://pay?${params.toString()}`;
}
