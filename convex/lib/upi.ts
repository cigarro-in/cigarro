import { paiseToRupees } from "./money";

export interface BuildUpiUrlArgs {
  vpa: string;
  payeeName?: string;
  amountPaise: number;
  referenceId: string; // our displayOrderId (stable; bank-email ref matching)
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

// Explicit customer UPI app choices. Same params, app-specific scheme so the
// OS opens the chosen app directly. Unknown apps fall back to the generic
// upi:// URL (lets the OS show the app picker).
export type UpiAppId = "gpay" | "phonepe" | "paytm" | "bhim" | "generic";

const UPI_APP_SCHEMES: Record<UpiAppId, string> = {
  gpay: "tez://upi/pay",
  phonepe: "phonepe://pay",
  paytm: "paytmmp://pay",
  bhim: "bhim://pay",
  generic: "upi://pay",
};

export function buildUpiAppUrl(app: UpiAppId, baseUpiUrl: string): string {
  if (app === "generic") return baseUpiUrl;
  const query = baseUpiUrl.split("?")[1] ?? "";
  return `${UPI_APP_SCHEMES[app]}?${query}`;
}
