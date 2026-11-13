import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { orderNumberOf } from '../../../convex/lib/ids';
import {
  Button,
  Card,
  EmptyState,
  Page,
  PageLayout,
  SkeletonText,
  StatusBadge,
  deriveOrderStage,
  formatOrderDate,
  useButtonFeedback,
} from '../ui';
import { CustomerCard } from '../features/orders/CustomerCard';
import { InvoiceCard } from '../features/orders/InvoiceCard';
import { ItemsCard } from '../features/orders/ItemsCard';
import { NextActionCard } from '../features/orders/NextActionCard';
import { OrderTimeline } from '../features/orders/OrderTimeline';
import { PaymentSummaryCard } from '../features/orders/PaymentSummaryCard';
import { ShippingAddressCard } from '../features/orders/ShippingAddressCard';
import { orderNumberLabel, type OrderDoc } from '../features/orders/orderModel';

/** Order detail. Keyed by id so per-order form state never leaks between orders. */
export function OrderFormPage() {
  const { id } = useParams();
  return <OrderDetail key={id ?? 'none'} orderId={id} />;
}

function OrderDetail({ orderId }: { orderId?: string }) {
  const navigate = useNavigate();
  const order = useQuery(api.admin.getOrder, orderId ? { orderId: orderId as Id<'orders'> } : 'skip');

  if (order === undefined && orderId) {
    return (
      <Page title="Order" backTo="/orders">
        <PageLayout main={<Card><SkeletonText lines={6} /></Card>} aside={<Card><SkeletonText lines={4} /></Card>} />
      </Page>
    );
  }

  if (order === undefined || order === null) {
    return (
      <Page title="Order" backTo="/orders">
        <Card>
          <EmptyState
            title="Order not found"
            action={<Button onClick={() => navigate('/orders')}>Back to orders</Button>}
          />
        </Card>
      </Page>
    );
  }

  const stage = deriveOrderStage(order);
  const hasNumber = orderNumberOf(order) !== undefined;

  return (
    <Page
      title={hasNumber ? `Order ${orderNumberLabel(order)}` : 'Order'}
      backTo="/orders"
      titleMeta={<StatusBadge stage={stage} />}
    >
      <PageLayout
        main={
          <>
            <NextActionCard order={order} stage={stage} />
            <ItemsCard order={order} />
            <OrderTimeline order={order} stage={stage} />
            <PaymentSummaryCard order={order} />
          </>
        }
        aside={
          <>
            <CustomerCard order={order} />
            <ShippingAddressCard order={order} />
            <InvoiceCard order={order} />
            <DetailsCard order={order} />
          </>
        }
      />
    </Page>
  );
}

/** Internal id and placement time, collapsed. The ORD id is only ever shown here. */
function DetailsCard({ order }: { order: OrderDoc }) {
  const copy = useButtonFeedback();
  return (
    <Card padding="none">
      <details className="px-4 py-3 text-sm">
        <summary className="cursor-pointer select-none font-medium text-muted-foreground">Details</summary>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">Placed</span>
            <span className="text-right tabular-nums text-foreground">{formatOrderDate(order.createdAt, { withTime: true })}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Internal ID</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-xs text-foreground">{order.displayOrderId}</span>
              <Button
                size="sm"
                variant="plain"
                state={copy.state}
                successLabel="Copied"
                errorLabel="Failed"
                onClick={() => void copy.run(() => navigator.clipboard.writeText(order.displayOrderId))}
              >
                Copy
              </Button>
            </span>
          </div>
        </div>
      </details>
    </Card>
  );
}
