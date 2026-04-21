import { Link } from 'react-router-dom';
import { Package, Clock, Truck, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { formatINR } from '../../utils/currency';
import { useMyOrders, type OrderUiStatus, type NormalizedOrder } from '../../hooks/data/useMyOrders';

const statusMeta: Record<OrderUiStatus, { label: string; cls: string; icon: React.ComponentType<any> }> = {
  pending:    { label: 'Pending',    cls: 'vv-badge--warning', icon: Clock },
  placed:     { label: 'Placed',     cls: 'vv-badge--info',    icon: Clock },
  processing: { label: 'Processing', cls: 'vv-badge--info',    icon: Package },
  shipped:    { label: 'Shipped',    cls: 'vv-badge--info',    icon: Truck },
  delivered:  { label: 'Delivered',  cls: 'vv-badge--success', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  cls: 'vv-badge--danger',  icon: XCircle },
  returned:   { label: 'Returned',   cls: 'vv-badge--danger',  icon: XCircle },
};

export function VividOrders() {
  const { orders, loading } = useMyOrders({ kind: 'purchase', limit: 50 });

  return (
    <>
      <SEOHead title="Your orders" description="Order history" url="https://cigarro.in/orders" type="website" />

      <div className="max-w-[880px] mx-auto px-4 py-6">
        <header className="vv-page-header">
          <h1 className="vv-page-title">Orders</h1>
          <p className="vv-page-subtitle">Track, review and reorder past purchases.</p>
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="vv-card p-4 flex gap-3 items-center">
                <div className="w-10 h-10 rounded-full vv-skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 vv-skeleton" />
                  <div className="h-3 w-1/4 vv-skeleton" />
                </div>
                <div className="w-16 h-6 vv-skeleton" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="vv-empty">
            <div className="vv-empty-icon"><Package className="w-6 h-6" /></div>
            <p className="vv-empty-title">No orders yet</p>
            <p className="text-sm">Your placed orders will show up here.</p>
            <Link to="/products" className="vv-btn-primary mt-5 inline-flex">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OrderRow({ order }: { order: NormalizedOrder }) {
  const meta = statusMeta[order.uiStatus];
  const Icon = meta.icon;

  return (
    <Link
      to={`/orders?id=${order.id}`}
      className="vv-card p-4 flex items-center gap-4 hover:border-[var(--vv-border-strong)]"
    >
      <div className="w-11 h-11 rounded-full bg-[var(--vv-bg-inset)] text-[var(--vv-fg-muted)] grid place-items-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] font-semibold text-[var(--vv-fg)] truncate">
            #{order.displayOrderId}
          </p>
          <span className={`vv-badge ${meta.cls}`}>{meta.label}</span>
        </div>
        <p className="text-xs text-[var(--vv-fg-muted)] mt-1">
          {order.createdAt.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          {order.itemsCount > 0 && ` · ${order.itemsCount} item${order.itemsCount > 1 ? 's' : ''}`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-[var(--vv-fg)]">{formatINR(order.total)}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-[var(--vv-fg-subtle)] ml-1" />
    </Link>
  );
}
