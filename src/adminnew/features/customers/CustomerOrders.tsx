import { Link, useNavigate } from 'react-router-dom';
import { formatINR } from '../../../utils/currency';
import { formatOrderDate, formatOrderNumber } from '../../../lib/orders/format';
import { Card, DataTable, EmptyState, Pagination, StatusBadge, type Column } from '../../ui';
import { useClientPages } from '../../hooks/usePagination';
import { ShoppingBag } from 'lucide-react';
import type { CustomerProfileOrder } from './customerModel';

const LIST_KEY = 'customerOrders';
const ITEMS_SHOWN = 2;

function Items({ order }: { order: CustomerProfileOrder }) {
  const shown = order.items.slice(0, ITEMS_SHOWN);
  const more = order.items.length - shown.length;
  return (
    <span className="flex flex-col gap-0.5 text-muted-foreground">
      {shown.map((item, i) => (
        <span key={`${item.productId}-${i}`} className="truncate">
          <Link
            to={`/products/${item.productId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground hover:underline"
          >
            {item.name}
          </Link>
          <span className="tabular-nums"> × {item.qty}</span>
        </span>
      ))}
      {more > 0 && <span className="text-xs">+{more} more</span>}
    </span>
  );
}

/** Every order of the customer (bounded by the profile query), each row opens the order detail. */
export function CustomerOrders({ orders, ordersCapped }: { orders: CustomerProfileOrder[]; ordersCapped: boolean }) {
  const navigate = useNavigate();
  const pages = useClientPages(orders, LIST_KEY, 'customer-orders');

  const columns: Column<CustomerProfileOrder>[] = [
    {
      id: 'order',
      header: 'Order',
      cell: (o) => (
        <span className="flex flex-col">
          <span className="font-medium tabular-nums">{formatOrderNumber(o.orderNumber) || 'Order'}</span>
          <span className="text-xs text-muted-foreground">{formatOrderDate(o.created_at)}</span>
        </span>
      ),
    },
    { id: 'items', header: 'Items', hideBelow: 'md', cell: (o) => <Items order={o} /> },
    {
      id: 'status',
      header: 'Status',
      cell: (o) => <StatusBadge order={{ status: o.payment_status, shippingStatus: o.shipping_status }} />,
    },
    { id: 'total', header: 'Total', align: 'right', cell: (o) => <span className="tabular-nums">{formatINR(o.total)}</span> },
  ];

  return (
    <Card title="Orders" padding="none" actions={ordersCapped ? <span className="text-xs text-muted-foreground">Newest 200</span> : undefined}>
      <DataTable
        columns={columns}
        rows={pages.pageItems}
        getRowId={(o) => o.id}
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        rowLabel={(o) => `Open order ${formatOrderNumber(o.orderNumber) || ''}`.trim()}
        empty={<EmptyState icon={<ShoppingBag />} title="No orders yet" />}
      />
      {orders.length > 0 && (
        <Pagination
          page={pages.page}
          pageCount={pages.pageCount}
          onPageChange={pages.setPage}
          summary={pages.summary}
          pageSize={pages.pageSize}
          onPageSizeChange={pages.setPageSize}
        />
      )}
    </Card>
  );
}
