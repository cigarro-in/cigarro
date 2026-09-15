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
    // tn echoes the ref into the payer's app + the bank alert text, which is
    // what the email templates actually parse. Belt and suspenders with tr.
    tn: note ?? `Order ${referenceId}`,
  });
  return `upi://pay?${params.toString()}`;
}
