import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import { formatINR } from '../../utils/currency';
import {
  useMyOrders,
  useRetryOrder,
  type NormalizedOrder,
  type OrderUiStatus,
} from '../../hooks/data/useMyOrders';

type StatusMeta = { label: string; cls: string; icon: React.ComponentType<any> };

const uiStatusMeta: Record<OrderUiStatus, StatusMeta> = {
  pending:    { label: 'Payment pending', cls: 'vv-badge--warning', icon: Clock },
  placed:     { label: 'Order placed',    cls: 'vv-badge--info',    icon: Clock },
  processing: { label: 'Confirmed',       cls: 'vv-badge--info',    icon: Package },
  shipped:    { label: 'On the way',      cls: 'vv-badge--info',    icon: Truck },
  delivered:  { label: 'Delivered',       cls: 'vv-badge--success', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',       cls: 'vv-badge--danger',  icon: XCircle },
  returned:   { label: 'Returned',        cls: 'vv-badge--danger',  icon: XCircle },
};

// uiStatus folds expired / refunded / voided into "cancelled"; show the real
// payment outcome for those so the badge matches the detail.
const terminalPaymentLabel: Record<NormalizedOrder['paymentStatus'], string> = {
  pending: 'Payment pending',
  paid: 'Paid',
  late_paid: 'Paid',
  expired: 'Payment expired',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  voided: 'Voided',
};

function badgeFor(order: NormalizedOrder): StatusMeta {
  if (order.uiStatus === 'cancelled') {
    return {
      ...uiStatusMeta.cancelled,
      label: terminalPaymentLabel[order.paymentStatus] ?? 'Cancelled',
    };
  }
  return uiStatusMeta[order.uiStatus];
}

const RETRYABLE = new Set<NormalizedOrder['paymentStatus']>(['expired', 'cancelled']);

const DATE_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export function VividOrders() {
  const { orders, loading } = useMyOrders({ kind: 'purchase', limit: 50 });

  return (
    <>
      <SEOHead title="Your orders" description="Order history" url="/orders" type="website" />

      <div className="max-w-[880px] mx-auto px-4 py-6">
        <header className="vv-page-header">
          <h1 className="vv-page-title">Orders</h1>
          <p className="vv-page-subtitle">Track, review and reorder past purchases.</p>
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="vv-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/3 vv-skeleton" />
                    <div className="h-3 w-1/4 vv-skeleton" />
                  </div>
                  <div className="w-20 h-6 vv-skeleton" />
                </div>
                <div className="flex gap-2">
                  <div className="w-11 h-11 vv-skeleton" />
                  <div className="w-11 h-11 vv-skeleton" />
                </div>
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
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
            <p className="text-center text-xs text-[var(--vv-fg-muted)] py-4">
              Showing your latest {orders.length} order{orders.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function OrderCard({ order }: { order: NormalizedOrder }) {
  const navigate = useNavigate();
  const retry = useRetryOrder();
  const { status: opStatus, setError: setOpError } = useInlineStatus();
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const meta = badgeFor(order);
  const Icon = meta.icon;
  const numberLabel = order.orderNumber !== undefined ? String(order.orderNumber) : order.displayOrderId;
  const showsDisplayId = order.orderNumber !== undefined;
  const canContinue = order.paymentStatus === 'pending';
  const canRetry = RETRYABLE.has(order.paymentStatus);
  const shownItems = order.items.slice(0, 3);
  const extraItems = order.items.length - shownItems.length;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const result = await retry(order.id);
      if (result.upiUrl) {
        try {
          window.location.href = result.upiUrl;
        } catch (e) {
          console.error('Failed to open UPI link:', e);
        }
      }
      sessionStorage.setItem('pendingOrderId', result.orderId);
      navigate(`/transaction/${result.orderId}`, {
        state: { orderId: result.orderId, shouldClearCart: false },
        replace: result.status === 'paid',
      });
    } catch (error: any) {
      console.error('Retry payment error:', error);
      const code = error?.data?.code;
      if (code === 'NOT_RETRYABLE') {
        setOpError('This order can no longer be retried.');
      } else if (code === 'SLOT_POOL_EXHAUSTED' || code === 'LUCKY_POOL_EXHAUSTED') {
        setOpError('Too many pending orders at this price. Try again in a few minutes.');
      } else {
        setOpError('Failed to start the payment retry. Please try again.');
      }
    } finally {
      setRetrying(false);
    }
  };

  const paymentLine = order.isPaid
    ? { text: 'Payment received', cls: 'text-[var(--vv-success)]' }
    : order.paymentStatus === 'pending'
      ? { text: 'Awaiting UPI payment', cls: 'text-[var(--vv-warning)]' }
      : { text: terminalPaymentLabel[order.paymentStatus], cls: 'text-[var(--vv-danger)]' };

  const shippingLine = order.shippingStatus
    ? order.shippingStatus.replace(/^./, (c) => c.toUpperCase())
    : order.isPaid
      ? 'Not shipped yet'
      : null;

  return (
    <article className="vv-card p-4 md:p-5">
      {/* Header: number, date, status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] md:text-base font-semibold text-[var(--vv-fg)] break-all">
            Order {numberLabel}
          </h2>
          <p className="text-xs text-[var(--vv-fg-muted)] mt-0.5">
            {order.createdAt.toLocaleDateString('en-IN', DATE_OPTS)}
            {order.itemsCount > 0 && ` · ${order.itemsCount} item${order.itemsCount > 1 ? 's' : ''}`}
          </p>
          {showsDisplayId && (
            <p className="font-mono text-[11px] text-[var(--vv-fg-subtle)] mt-0.5 break-all">
              {order.displayOrderId}
            </p>
          )}
        </div>
        <span className={`vv-badge ${meta.cls} shrink-0 inline-flex items-center gap-1`}>
          <Icon className="w-3 h-3" aria-hidden="true" />
          {meta.label}
        </span>
      </div>

      {/* Item thumbnails */}
      {order.items.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          {shownItems.map((item, idx) => (
            <div
              key={`${item.productId}-${idx}`}
              className="w-11 h-11 rounded-[var(--vv-radius-sm,8px)] bg-[var(--vv-bg-inset)] overflow-hidden shrink-0"
            >
              <img
                src={item.imageUrl}
                alt={item.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {extraItems > 0 && (
            <div className="w-11 h-11 rounded-[var(--vv-radius-sm,8px)] bg-[var(--vv-bg-inset)] text-xs font-semibold text-[var(--vv-fg-muted)] grid place-items-center shrink-0">
              +{extraItems}
            </div>
          )}
          <div className="min-w-0 flex-1 ml-1">
            <p className="text-sm text-[var(--vv-fg)] truncate">
              {order.items[0].qty}× {order.items[0].name}
            </p>
            {order.items.length > 1 && (
              <p className="text-xs text-[var(--vv-fg-muted)] truncate">
                {order.items.slice(1, 3).map((it) => `${it.qty}× ${it.name}`).join(', ')}
                {extraItems > 0 && ` and ${extraItems} more`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Payment + shipping state */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="rounded-[var(--vv-radius-sm,8px)] bg-[var(--vv-bg-inset)] px-3 py-2">
          <p className="text-[var(--vv-fg-muted)]">Payment</p>
          <p className={`font-medium ${paymentLine.cls}`}>{paymentLine.text}</p>
        </div>
        <div className="rounded-[var(--vv-radius-sm,8px)] bg-[var(--vv-bg-inset)] px-3 py-2">
          <p className="text-[var(--vv-fg-muted)]">Shipping</p>
          <p className="font-medium text-[var(--vv-fg)]">{shippingLine ?? '—'}</p>
        </div>
      </div>

      {/* Footer: total + toggle */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--vv-border)] pt-3">
        <p className="text-sm font-bold text-[var(--vv-fg)]">Total {formatINR(order.total)}</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="vv-btn vv-btn-ghost vv-btn--sm"
        >
          {expanded ? 'Hide details' : 'View details'}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Actions */}
      {(canContinue || canRetry) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canContinue && (
            <button
              type="button"
              onClick={() => navigate(`/transaction/${order.id}`, { state: { orderId: order.id } })}
              className="vv-btn-primary vv-btn--sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Continue payment
            </button>
          )}
          {canRetry && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="vv-btn-primary vv-btn--sm inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
              {retrying ? 'Starting…' : 'Retry payment'}
            </button>
          )}
        </div>
      )}
      <div className="mt-2">
        <InlineStatus status={opStatus} />
      </div>

      {/* Detail (same card) */}
      {expanded && <OrderDetail order={order} />}
    </article>
  );
}

function OrderDetail({ order }: { order: NormalizedOrder }) {
  const hasTracking = !!(order.tracking && (order.tracking.carrier || order.tracking.number || order.tracking.url || order.tracking.notes));

  return (
    <div className="mt-4 space-y-4 border-t border-[var(--vv-border)] pt-4">
      {/* Items */}
      <section>
        <h3 className="vv-section-title mb-2">Items</h3>
        <ul className="space-y-2">
          {order.items.map((item, idx) => (
            <li key={`${item.productId}-${idx}`} className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-[var(--vv-radius-sm,8px)] bg-[var(--vv-bg-inset)] overflow-hidden shrink-0">
                <img src={item.imageUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--vv-fg)] break-words">{item.name}</p>
                <p className="text-xs text-[var(--vv-fg-muted)]">
                  Qty {item.qty} · {formatINR(item.unitPrice)} each
                </p>
              </div>
              <p className="text-sm font-semibold text-[var(--vv-fg)] shrink-0">
                {formatINR(item.unitPrice * item.qty)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Summary */}
      <section className="rounded-[var(--vv-radius-sm,8px)] bg-[var(--vv-bg-inset)] p-3 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-[var(--vv-fg-muted)]">Subtotal</span>
          <span className="text-[var(--vv-fg)]">{formatINR(order.subtotal)}</span>
        </div>
        {order.walletUsed > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--vv-fg-muted)]">Wallet used</span>
            <span className="text-[var(--vv-success)]">−{formatINR(order.walletUsed)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--vv-border)] pt-1.5 font-semibold">
          <span className="text-[var(--vv-fg)]">Total</span>
          <span className="text-[var(--vv-fg)]">{formatINR(order.total)}</span>
        </div>
      </section>

      {/* Tracking */}
      {hasTracking && (
        <section>
          <h3 className="vv-section-title mb-2 inline-flex items-center gap-2">
            <Truck className="w-4 h-4" aria-hidden="true" /> Shipping
          </h3>
          <div className="text-sm space-y-1 break-words">
            {order.tracking?.carrier && (
              <p><span className="text-[var(--vv-fg-muted)]">Carrier: </span>{order.tracking.carrier}</p>
            )}
            {order.tracking?.number && (
              <p><span className="text-[var(--vv-fg-muted)]">Tracking no.: </span><span className="font-mono text-xs">{order.tracking.number}</span></p>
            )}
            {order.shippedAt && (
              <p><span className="text-[var(--vv-fg-muted)]">Shipped: </span>{order.shippedAt.toLocaleDateString('en-IN', DATE_OPTS)}</p>
            )}
            {order.deliveredAt && (
              <p><span className="text-[var(--vv-fg-muted)]">Delivered: </span>{order.deliveredAt.toLocaleDateString('en-IN', DATE_OPTS)}</p>
            )}
            {order.tracking?.notes && (
              <p className="text-[var(--vv-fg-muted)]">{order.tracking.notes}</p>
            )}
            {order.tracking?.url && (
              <a
                href={order.tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--vv-brand)] font-medium hover:underline"
              >
                Track package <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Delivery address */}
      {order.address && (
        <section>
          <h3 className="vv-section-title mb-2 inline-flex items-center gap-2">
            <MapPin className="w-4 h-4" aria-hidden="true" /> Delivery address
          </h3>
          <div className="text-sm text-[var(--vv-fg-muted)] break-words">
            <p className="text-[var(--vv-fg)] font-medium">{order.address.name}</p>
            <p>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}</p>
            <p>{order.address.city}, {order.address.state} {order.address.pincode}</p>
          </div>
        </section>
      )}
    </div>
  );
}
