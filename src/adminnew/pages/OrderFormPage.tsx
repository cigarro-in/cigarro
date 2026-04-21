import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Ban,
  MapPin,
  Phone,
  CreditCard,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { paiseToRupees } from '../../lib/convex/money';

type PaymentStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'late_paid' | 'refunded' | 'voided';
type ShippingStatus = 'awaiting' | 'processing' | 'shipped' | 'delivered' | 'returned';

const paymentBadge = (s: PaymentStatus) => {
  if (s === 'paid' || s === 'late_paid') return 'bg-green-100 text-green-800';
  if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
  if (s === 'refunded') return 'bg-gray-100 text-gray-800';
  return 'bg-red-100 text-red-800';
};

const shippingBadge = (s?: ShippingStatus) => {
  switch (s) {
    case 'processing': return 'bg-blue-100 text-blue-800';
    case 'shipped': return 'bg-purple-100 text-purple-800';
    case 'delivered': return 'bg-green-100 text-green-800';
    case 'returned': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const shippingIcon = (s?: ShippingStatus) => {
  switch (s) {
    case 'processing': return <Package className="w-4 h-4" />;
    case 'shipped': return <Truck className="w-4 h-4" />;
    case 'delivered': return <CheckCircle2 className="w-4 h-4" />;
    case 'returned': return <Ban className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

export function OrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const order = useQuery(
    api.admin.getOrder,
    id ? { orderId: id as any } : 'skip',
  );
  const markPaid = useMutation(api.admin.markPaid);
  const voidOrder = useMutation(api.admin.voidOrder);
  const refund = useMutation(api.admin.refundOrder);
  const updateShipping = useMutation(api.admin.updateShipping);

  const [saving, setSaving] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!order) return;
    setCarrier(order.trackingCarrier || '');
    setTrackingNumber(order.trackingNumber || '');
    setTrackingUrl(order.trackingUrl || '');
    setNotes(order.shippingNotes || '');
  }, [order?._id]);

  if (order === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Order not found</h3>
          <Button onClick={() => navigate('/admin/orders')} className="mt-4">
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const isPaid = order.status === 'paid' || order.status === 'late_paid';
  const isTerminal = ['refunded', 'voided', 'expired', 'cancelled'].includes(order.status);
  const shipStatus = (order.shippingStatus || (isPaid ? 'awaiting' : undefined)) as
    | ShippingStatus
    | undefined;

  const handleMarkPaid = async () => {
    setSaving(true);
    try {
      await markPaid({ orderId: order._id, reference: `admin:${new Date().toISOString()}` });
      toast.success('Marked paid');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!confirm('Void this order? Wallet debits (if any) will be refunded.')) return;
    setSaving(true);
    try {
      await voidOrder({ orderId: order._id, reason: 'admin void from order page' });
      toast.success('Voided');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRefund = async (toWallet: boolean) => {
    const msg = toWallet
      ? 'Refund to the customer wallet?'
      : 'Flag for manual bank refund? (no wallet credit)';
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      await refund({ orderId: order._id, toWallet });
      toast.success('Refund recorded');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleShipStatus = async (next: ShippingStatus) => {
    setSaving(true);
    try {
      await updateShipping({ orderId: order._id, shippingStatus: next });
      toast.success(`Shipping → ${next}`);
    } catch (e: any) {
      toast.error(e?.data?.code || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTracking = async () => {
    setSaving(true);
    try {
      await updateShipping({
        orderId: order._id,
        trackingCarrier: carrier.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
        shippingNotes: notes.trim() || undefined,
      });
      toast.success('Tracking saved');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const subtotal = paiseToRupees(order.cartTotalPaise);
  const walletUsed = paiseToRupees(order.walletDebitPaise);
  const total = paiseToRupees(order.finalAmountPaise);
  const createdAt = new Date(order._creationTime);

  return (
    <div className="w-full min-h-screen bg-[var(--color-creme)] pb-20">
      <PageHeader
        title={`Order #${order.displayOrderId}`}
        description={`${createdAt.toLocaleDateString()} at ${createdAt.toLocaleTimeString()}`}
        backUrl="/admin/orders"
      >
        <Badge className={paymentBadge(order.status as PaymentStatus)}>
          {order.status}
        </Badge>
        {shipStatus && (
          <Badge className={shippingBadge(shipStatus)}>
            {shippingIcon(shipStatus)}
            <span className="ml-1">{shipStatus}</span>
          </Badge>
        )}
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_360px] gap-6 mt-6">
        {/* LEFT */}
        <div className="space-y-6">
          <AdminCard>
            <AdminCardHeader><AdminCardTitle>Customer</AdminCardTitle></AdminCardHeader>
            <AdminCardContent>
              <div className="font-medium">{order.address?.name || 'N/A'}</div>
              <div className="text-sm text-gray-500 flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                {order.address?.phone || 'N/A'}
              </div>
              <div className="text-xs text-gray-400 mt-1">User ID: {order.userId}</div>
            </AdminCardContent>
          </AdminCard>

          {order.address && (
            <AdminCard>
              <AdminCardHeader><AdminCardTitle>Shipping Address</AdminCardTitle></AdminCardHeader>
              <AdminCardContent>
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-2 mt-1 text-gray-400 shrink-0" />
                  <div>
                    <div className="font-medium">{order.address.name}</div>
                    <div className="text-sm text-gray-600">{order.address.line1}</div>
                    {order.address.line2 && (
                      <div className="text-sm text-gray-600">{order.address.line2}</div>
                    )}
                    <div className="text-sm text-gray-600">
                      {order.address.city}, {order.address.state} {order.address.pincode}
                    </div>
                  </div>
                </div>
              </AdminCardContent>
            </AdminCard>
          )}

          <AdminCard>
            <AdminCardHeader><AdminCardTitle>Order Items</AdminCardTitle></AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      {item.variantId && (
                        <div className="text-xs text-gray-500">Variant: {item.variantId}</div>
                      )}
                      <div className="text-sm text-gray-500">Qty: {item.qty}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatINR(paiseToRupees(item.unitPricePaise * item.qty))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatINR(paiseToRupees(item.unitPricePaise))} each
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCardContent>
          </AdminCard>

          {isPaid && order.kind === 'purchase' && (
            <AdminCard>
              <AdminCardHeader><AdminCardTitle>Tracking</AdminCardTitle></AdminCardHeader>
              <AdminCardContent>
                <div className="space-y-3">
                  <div>
                    <Label>Carrier</Label>
                    <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Delhivery, BlueDart, ..." />
                  </div>
                  <div>
                    <Label>Tracking Number</Label>
                    <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
                  </div>
                  <div>
                    <Label>Tracking URL</Label>
                    <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <Label>Shipping Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <Button onClick={handleSaveTracking} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Tracking'}
                  </Button>
                </div>
              </AdminCardContent>
            </AdminCard>
          )}
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          <AdminCard>
            <AdminCardHeader><AdminCardTitle>Payment Actions</AdminCardTitle></AdminCardHeader>
            <AdminCardContent className="space-y-2">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Payment status</span>
                <Badge className={paymentBadge(order.status as PaymentStatus)}>
                  {order.status}
                </Badge>
              </div>
              {order.status === 'pending' && (
                <>
                  <Button onClick={handleMarkPaid} disabled={saving} className="w-full">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Paid
                  </Button>
                  <Button onClick={handleVoid} disabled={saving} variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                    <Ban className="w-4 h-4 mr-2" /> Void Order
                  </Button>
                </>
              )}
              {isPaid && (
                <>
                  <Button onClick={() => handleRefund(true)} disabled={saving} variant="outline" className="w-full">
                    Refund → Wallet
                  </Button>
                  <Button onClick={() => handleRefund(false)} disabled={saving} variant="outline" className="w-full">
                    Flag Manual Refund
                  </Button>
                </>
              )}
              {isTerminal && (
                <p className="text-sm text-gray-500">Order is in a terminal state; no payment actions available.</p>
              )}
            </AdminCardContent>
          </AdminCard>

          {isPaid && order.kind === 'purchase' && (
            <AdminCard>
              <AdminCardHeader><AdminCardTitle>Shipping Status</AdminCardTitle></AdminCardHeader>
              <AdminCardContent className="space-y-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Current</span>
                  <Badge className={shippingBadge(shipStatus)}>
                    {shippingIcon(shipStatus)}<span className="ml-1">{shipStatus || 'awaiting'}</span>
                  </Badge>
                </div>
                {(shipStatus === 'awaiting' || !shipStatus) && (
                  <Button onClick={() => handleShipStatus('processing')} disabled={saving} className="w-full">
                    <Package className="w-4 h-4 mr-2" /> Mark Processing
                  </Button>
                )}
                {shipStatus === 'processing' && (
                  <Button onClick={() => handleShipStatus('shipped')} disabled={saving} className="w-full">
                    <Truck className="w-4 h-4 mr-2" /> Mark Shipped
                  </Button>
                )}
                {shipStatus === 'shipped' && (
                  <Button onClick={() => handleShipStatus('delivered')} disabled={saving} className="w-full">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Delivered
                  </Button>
                )}
                {shipStatus === 'delivered' && (
                  <p className="text-sm text-green-700">Delivered {order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : ''}</p>
                )}
                {shipStatus !== 'returned' && shipStatus !== 'delivered' && (
                  <Button onClick={() => handleShipStatus('returned')} disabled={saving} variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                    Mark Returned
                  </Button>
                )}
              </AdminCardContent>
            </AdminCard>
          )}

          <AdminCard>
            <AdminCardHeader><AdminCardTitle>Summary</AdminCardTitle></AdminCardHeader>
            <AdminCardContent>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {walletUsed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Wallet used</span>
                  <span className="text-green-600">-{formatINR(walletUsed)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Total charged</span>
                <span className="font-bold text-lg">{formatINR(total)}</span>
              </div>
            </AdminCardContent>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader><AdminCardTitle>Payment Info</AdminCardTitle></AdminCardHeader>
            <AdminCardContent className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Method</span>
                <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> UPI</span>
              </div>
              {order.verificationMethod && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Verified via</span>
                  <span>{order.verificationMethod}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid at</span>
                  <span>{new Date(order.paidAt).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Amount w/ slot offset</span>
                <span className="font-mono">{formatINR(paiseToRupees(order.finalAmountPaise))}</span>
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
