// Server copy of the pure stage logic in src/lib/orders/orderStage.ts and the
// list filter table in src/adminnew/features/orders/orderModel.ts. Keep these in
// step with the client copies: the admin orders list filters on the server, and
// the client derives the same stage for the badge it shows.

export type ServerOrderStage =
  | "unpaid"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "returned";

export function deriveOrderStage(order: {
  status?: string | null;
  paymentStatus?: string | null;
  shippingStatus?: string | null;
}): ServerOrderStage {
  const payment = order.paymentStatus ?? order.status ?? "pending";
  switch (payment) {
    case "pending":
      return "unpaid";
    case "refunded":
      return "refunded";
    case "expired":
    case "cancelled":
    case "voided":
      return "cancelled";
    default:
      break; // paid / late_paid: the shipping lifecycle decides
  }
  switch (order.shippingStatus) {
    case "processing":
      return "preparing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "returned":
      return "returned";
    default:
      return "paid";
  }
}

/** Stage filter ids used by the admin orders list. "all" has no stage list. */
export const STAGE_FILTER_STAGES: Record<string, readonly ServerOrderStage[] | null> = {
  all: null,
  unpaid: ["unpaid"],
  paid: ["paid"],
  preparing: ["preparing"],
  shipped: ["shipped"],
  delivered: ["delivered"],
  closed: ["cancelled", "refunded", "returned"],
};

/** Text the admin list search matches: order number, customer, phone, item names (lower-cased). */
export function orderSearchTextServer(order: {
  orderNumber?: unknown;
  address?: { name?: string; phone?: string } | null;
  items?: { name: string }[] | null;
}, orderNumberLabel: string): string {
  const name = order.address?.name?.trim() || "Unknown customer";
  return [
    orderNumberLabel,
    name,
    order.address?.phone ?? "",
    ...(order.items ?? []).map((item) => item.name),
  ]
    .join(" ")
    .toLowerCase();
}
