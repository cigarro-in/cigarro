import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { MessageCircle, Phone } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { formatINR } from '../../../utils/currency';
import { Button, Card, EmptyState } from '../../ui';
import { customerName, orderNumberLabel, phoneDigits, whatsappUrl, type OrderDoc } from './orderModel';

/** Name links to the customer page; phone, WhatsApp and totals for this customer. */
export function CustomerCard({ order }: { order: OrderDoc }) {
  const org = useOrg();
  const summary = useQuery(
    api.adminStats.getCustomerForAdmin,
    org ? { orgId: org._id, userId: order.userId } : 'skip',
  );

  const name = customerName(order);
  const phone = order.address?.phone ?? '';
  const digits = phoneDigits(phone);
  const waHref = whatsappUrl(phone, `Hi ${name}, this is ${org?.name ?? 'the store'} about your order ${orderNumberLabel(order)}.`);

  if (!order.address && !summary) {
    return (
      <Card title="Customer">
        <EmptyState title="No customer details" />
      </Card>
    );
  }

  return (
    <Card title="Customer">
      <div className="flex flex-col gap-3">
        <Link
          to={`/customers/${encodeURIComponent(order.userId)}`}
          className="w-fit text-base font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {name}
        </Link>

        {digits && (
          <a href={`tel:+${digits}`} className="flex w-fit items-center gap-2 text-sm text-foreground">
            <Phone className="size-4 text-muted-foreground" aria-hidden />
            {phone}
          </a>
        )}

        {waHref && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden />
                WhatsApp
              </a>
            </Button>
          </div>
        )}

        {summary && (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{summary.orderCount}</span> orders ·{' '}
            <span className="font-semibold tabular-nums text-foreground">{formatINR(summary.totalSpent)}</span> spent
          </p>
        )}
      </div>
    </Card>
  );
}
