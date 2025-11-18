import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, Truck, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, MapPin, CreditCard as PaymentIcon, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';

interface OrderItem {
  id: string;
  name: string;
  variant_name?: string;
  brand: string;
  price: number;
  image: string;
  quantity: number;
}

interface Order {
  id: string;
  displayOrderId: string;
  transactionId?: string;
  items: OrderItem[];
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount?: number;
  status: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending';
  paymentConfirmed?: boolean;
  paymentConfirmedAt?: string;
  paymentVerified?: 'YES' | 'NO' | 'REJECTED';
  paymentVerifiedAt?: string;
  paymentRejectionReason?: string;
  createdAt: string;
  estimatedDelivery: string;
  trackingNumber?: string;
  shippingCompany?: string;
  trackingId?: string;
  trackingLink?: string;
  shippingMethod?: string;
  shippingNotes?: string;
  shippedAt?: string;
  deliveredAt?: string;
  deliveryNotes?: string;
  deliveryProofUrl?: string;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  paymentMethod: string;
  upiId?: string;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addMultipleToCart } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [paymentStage, setPaymentStage] = useState<'processing' | 'verifying' | 'confirmed' | 'pending'>('processing');
  const [retryingOrder, setRetryingOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch orders');
    } else {
      const formattedOrders = data?.map((order: any) => ({
        id: order.id,
        displayOrderId: order.display_order_id || 'N/A',
        transactionId: order.transaction_id,
        items: order.order_items.map((item: any) => ({
          id: item.product_id,
          name: item.product_name,
          variant_name: item.variant_name,
          brand: item.product_brand,
          price: item.product_price,
          image: item.product_image,
          quantity: item.quantity,
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        discount: order.discount || 0,
        total: order.total,
        status: order.status,
        paymentConfirmed: order.payment_confirmed,
        paymentConfirmedAt: order.payment_confirmed_at,
        paymentVerified: order.payment_verified,
        paymentVerifiedAt: order.payment_verified_at,
        paymentRejectionReason: order.payment_rejection_reason,
        createdAt: order.created_at,
        estimatedDelivery: order.estimated_delivery,
        shippingCompany: order.shipping_company,
        trackingId: order.tracking_id,
        trackingLink: order.tracking_link,
        shippingMethod: order.shipping_method,
        shippingNotes: order.shipping_notes,
        shippedAt: order.shipped_at,
        deliveredAt: order.delivered_at,
        deliveryNotes: order.delivery_notes,
        deliveryProofUrl: order.delivery_proof_url,
        shippingAddress: {
          name: order.shipping_name,
          address: order.shipping_address,
          city: order.shipping_city,
          state: order.shipping_state,
          zipCode: order.shipping_zip_code,
        },
        paymentMethod: order.payment_method,
        upiId: order.upi_id,
      })) || [];
      setOrders(formattedOrders);
    }
    setIsLoading(false);
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return <Clock className="w-3.5 h-3.5" />;
      case 'processing':
        return <Package className="w-3.5 h-3.5" />;
      case 'shipped':
        return <Truck className="w-3.5 h-3.5" />;
      case 'delivered':
        return <CheckCircle className="w-3.5 h-3.5" />;
      case 'cancelled':
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'placed':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'processing':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'shipped':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'delivered':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'Payment Pending';
      case 'placed':
        return 'Order Placed';
      case 'processing':
        return 'Confirmed';
      case 'shipped':
        return 'On the Way';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const handleBuyAgain = async (order: Order) => {
    try {
      const productsToAdd = order.items.map(item => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        price: item.price,
        image: item.image,
        slug: item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: '',
        is_active: true,
        gallery_images: [item.image],
        rating: 0,
        review_count: 0,
        created_at: new Date().toISOString()
      }));

      await addMultipleToCart(productsToAdd, order.items.map(item => item.quantity));
      toast.success(`${order.items.length} item(s) added to cart!`);
      navigate('/checkout');
    } catch (error) {
      console.error('Buy Again error:', error);
      toast.error('Failed to add items to cart');
    }
  };

  const handleRetryPayment = async (order: Order) => {
    try {
      // Generate NEW unique transaction ID for retry payment
      const newTransactionId = `TXN${Date.now().toString().slice(-8)}`;
      console.log('🔄 Retry payment with new transaction ID:', newTransactionId);

      // Update order with new transaction ID
      console.log('🔄 Updating order with new transaction ID...');
      console.log('🎯 Order ID:', order.id);
      console.log('🆕 Old transaction ID:', order.transactionId);
      console.log('🆕 New transaction ID:', newTransactionId);
      
      const { data: updateData, error: updateError } = await supabase
        .from('orders')
        .update({ 
          transaction_id: newTransactionId,
          payment_verified: 'NO',
          payment_confirmed: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select();

      if (updateError) {
        console.error('❌ Error updating transaction ID:', updateError);
        toast.error('Failed to update order. Please try again.');
        return;
      }
      
      console.log('✅ Order updated successfully:', updateData);

      // Trigger server-side verification with NEW transaction ID
      const orderCreatedAt = new Date().toISOString();
      
      fetch('/payment-email-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_WEBHOOK_SECRET || 'wjfx2qo61pi97ckareu0'}`
        },
        body: JSON.stringify({
          orderId: newTransactionId,
          transactionId: newTransactionId,
          amount: order.total,
          orderCreatedAt: orderCreatedAt,
          timestamp: new Date().toISOString()
        }),
        keepalive: true
      }).catch(err => console.log('Verification started on server:', err));

      // Generate UPI payment link
      const upiId = 'hrejuh@upi';
      const merchantName = 'Cigarro';
      const note = `Order ${order.displayOrderId}`;
      
      const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}` +
        `&pn=${encodeURIComponent(merchantName)}` +
        `&am=${order.total}` +
        `&tn=${encodeURIComponent(note)}` +
        '&cu=INR';

      // Navigate to unified transaction page
      navigate('/transaction', {
        state: {
          type: 'order_retry',
          transactionId: newTransactionId,
          amount: order.total,
          orderId: order.id,
          paymentMethod: 'upi',
          upiUrl: upiLink,
          metadata: {
            original_transaction_id: order.transactionId,
            order_display_id: order.displayOrderId,
            retry_attempt: true
          }
        }
      });
      
    } catch (error) {
      console.error('Retry payment error:', error);
      toast.error('Failed to retry payment. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="border-2 border-border/40 bg-card shadow-md max-w-md w-full">
          <CardContent className="text-center p-8">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-serif text-2xl text-foreground mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your orders.
            </p>
            <Button 
              onClick={() => navigate('/')}
              className="bg-dark text-creme-light px-6 py-2.5 rounded-full font-medium text-sm uppercase tracking-wide transition-all duration-300 hover:bg-canyon"
            >
              Back to Store
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Orders - Cigarro</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Header */}
        <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4">
          <div className="text-center">
            <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
              My Orders
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-lg h-32 animate-pulse border-2 border-border/30 shadow-md" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="border-2 border-border/40 bg-card shadow-md">
            <CardContent className="text-center p-12">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-serif text-2xl text-foreground mb-2">No Orders Yet</h2>
              <p className="text-muted-foreground mb-6">
                When you place your first order, it will appear here.
              </p>
              <Button 
                onClick={() => navigate('/')} 
                className="bg-dark text-creme-light px-6 py-2.5 rounded-full font-medium text-sm uppercase tracking-wide transition-all duration-300 hover:bg-canyon"
              >
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 md:space-y-5">
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              
              return (
                <Card 
                  key={order.id} 
                  className="border-2 border-border/40 bg-card overflow-hidden transition-all duration-300 hover:border-accent/50 shadow-md hover:shadow-lg"
                >
                  {/* Compact Header - Always Visible */}
                  <div 
                    className="p-4 md:p-5 cursor-pointer active:bg-muted/20 transition-colors bg-card"
                    onClick={() => toggleOrderExpansion(order.id)}
                  >
                    {/* Order ID and Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="font-serif text-base md:text-lg text-foreground font-medium mb-1">
                          Order #{order.displayOrderId}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(order.status)} flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0`}>
                        {getStatusIcon(order.status)}
                        <span>{getStatusText(order.status)}</span>
                      </Badge>
                    </div>

                    {/* Product Preview */}
                    <div className="flex items-center gap-3 mb-3">
                      {order.items && order.items.length > 0 ? (
                        <>
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted/20 flex-shrink-0">
                            <ImageWithFallback
                              src={order.items[0].image}
                              alt={order.items[0].name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-sm text-foreground font-medium truncate">
                              {order.items[0].name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.items[0].brand} • {formatINR(order.items[0].price)}
                            </p>
                            {order.items.length > 1 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                +{order.items.length - 1} more {order.items.length === 2 ? 'item' : 'items'}
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No items found</p>
                      )}
                    </div>

                    {/* Quick Status Info */}
                    {(order.trackingId || order.shippingCompany || order.estimatedDelivery) && (
                      <div className="bg-muted/20 rounded-lg p-3 mb-3 space-y-1.5 border border-border/20">
                        {(order.trackingId || order.shippingCompany) && (
                          <div className="flex items-center gap-2 text-xs">
                            <Truck className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                            <span className="text-muted-foreground">
                              {order.shippingCompany && `${order.shippingCompany}`}
                              {order.trackingId && ` • ${order.trackingId}`}
                            </span>
                          </div>
                        )}
                        {order.estimatedDelivery && order.status !== 'delivered' && (
                          <div className="flex items-center gap-2 text-xs">
                            <Clock className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                            <span className="text-muted-foreground">
                              Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer Summary */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/20">
                      <div className="font-sans text-base font-semibold text-foreground">
                        Total: {formatINR(order.total)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <span>{isExpanded ? 'Tap to collapse' : 'Tap to expand'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Content */}
                  {isExpanded && (
                    <div className="border-t-2 border-border/40 bg-muted/10 animate-in slide-in-from-top-2 duration-300">
                      <div className="p-4 md:p-5 space-y-4">
                        {/* All Order Items */}
                        <div>
                          <h4 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Order Items ({order.items.length})
                          </h4>
                          <div className="space-y-3">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border/30 shadow-sm">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/20 flex-shrink-0">
                                  <ImageWithFallback
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-sans text-sm text-foreground font-medium truncate">
                                    {item.name}{item.variant_name && ` (${item.variant_name})`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.brand} • Qty: {item.quantity}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-sans text-sm font-semibold text-foreground">
                                    {formatINR(item.price * item.quantity)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatINR(item.price)} each
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Separator className="bg-border/20" />

                        {/* Order Summary */}
                        <div>
                          <h4 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                            Order Summary
                          </h4>
                          <div className="space-y-2 text-sm bg-card rounded-lg p-3 border border-border/30 shadow-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span className="text-foreground font-medium">{formatINR(order.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Shipping</span>
                              <span className="text-foreground font-medium">
                                {order.shipping === 0 ? 'Free' : formatINR(order.shipping)}
                              </span>
                            </div>
                            {order.discount && order.discount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Discount</span>
                                <span className="text-green-600 font-medium">-{formatINR(order.discount)}</span>
                              </div>
                            )}
                            {order.tax > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tax</span>
                                <span className="text-foreground font-medium">{formatINR(order.tax)}</span>
                              </div>
                            )}
                            <Separator className="my-2 bg-border/20" />
                            <div className="flex justify-between text-base">
                              <span className="text-foreground font-semibold">Total</span>
                              <span className="text-foreground font-bold">{formatINR(order.total)}</span>
                            </div>
                          </div>
                        </div>

                        <Separator className="bg-border/20" />

                        {/* Shipping Tracking */}
                        {(order.shippingCompany || order.trackingId || order.trackingLink) && (
                          <>
                            <div>
                              <h4 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Shipping Tracking
                              </h4>
                              <div className="space-y-2 text-sm bg-card rounded-lg p-3 border border-border/30 shadow-sm">
                                {order.shippingCompany && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Company:</span>
                                    <span className="text-foreground font-medium">{order.shippingCompany}</span>
                                  </div>
                                )}
                                {order.trackingId && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Tracking ID:</span>
                                    <span className="text-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                                      {order.trackingId}
                                    </span>
                                  </div>
                                )}
                                {order.trackingLink && (
                                  <a 
                                    href={order.trackingLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-accent hover:text-accent/80 font-medium transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Track Package
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {order.shippedAt && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Shipped:</span>
                                    <span className="text-foreground">
                                      {new Date(order.shippedAt).toLocaleDateString('en-IN')}
                                    </span>
                                  </div>
                                )}
                                {order.deliveredAt && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                    <span className="text-muted-foreground">Delivered:</span>
                                    <span className="text-foreground">
                                      {new Date(order.deliveredAt).toLocaleDateString('en-IN')}
                                    </span>
                                  </div>
                                )}
                                {order.estimatedDelivery && order.status !== 'delivered' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Est. Delivery:</span>
                                    <span className="text-foreground">
                                      {new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Separator className="bg-border/20" />
                          </>
                        )}

                        {/* Delivery Address */}
                        <div>
                          <h4 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Delivery Address
                          </h4>
                          <div className="text-sm bg-card rounded-lg p-3 border border-border/30 shadow-sm space-y-1">
                            <p className="text-foreground font-medium">{order.shippingAddress.name}</p>
                            <p className="text-muted-foreground">{order.shippingAddress.address}</p>
                            <p className="text-muted-foreground">
                              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                            </p>
                          </div>
                        </div>

                        <Separator className="bg-border/20" />

                        {/* Payment Information */}
                        <div>
                          <h4 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                            <PaymentIcon className="w-4 h-4" />
                            Payment
                          </h4>
                          <div className="text-sm bg-card rounded-lg p-3 border border-border/30 shadow-sm space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Method:</span>
                              <span className="text-foreground font-medium">{order.paymentMethod}</span>
                            </div>
                            {order.upiId && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">UPI ID:</span>
                                <span className="text-foreground font-mono text-xs">{order.upiId}</span>
                              </div>
                            )}
                            {order.paymentVerified === 'YES' && (
                              <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="font-medium">Payment Verified</span>
                              </div>
                            )}
                            {order.paymentVerified === 'NO' && order.paymentConfirmed && (
                              <div className="flex items-center gap-2 text-yellow-600">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="font-medium">Pending Verification</span>
                              </div>
                            )}
                            {order.paymentVerified === 'REJECTED' && (
                              <div className="flex items-center gap-2 text-red-600">
                                <XCircle className="w-3.5 h-3.5" />
                                <span className="font-medium">Payment Rejected</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                          {/* Retry Payment Button - Show for unpaid orders */}
                          {(!order.paymentConfirmed || order.paymentVerified === 'NO' || order.paymentVerified === 'REJECTED') && order.status === 'pending' && (
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryPayment(order);
                              }}
                              className="flex-1 bg-canyon text-creme-light px-4 py-2.5 rounded-full font-medium text-sm uppercase tracking-wide transition-all duration-300 hover:bg-canyon/90 flex items-center justify-center gap-2"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Retry Payment
                            </Button>
                          )}
                          
                          {order.status === 'delivered' && (
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBuyAgain(order);
                              }}
                              className="flex-1 bg-dark text-creme-light px-4 py-2.5 rounded-full font-medium text-sm uppercase tracking-wide transition-all duration-300 hover:bg-canyon"
                            >
                              Buy Again
                            </Button>
                          )}
                          
                          <Button 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add contact support functionality
                              toast.info('Contact support feature coming soon!');
                            }}
                            className="flex-1 border border-border bg-background text-foreground px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-300 hover:bg-muted/50"
                          >
                            Contact Support
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Confirmation Full Screen Overlay */}
      {isConfirmingPayment && retryingOrder && (
        <div className="fixed inset-0 z-[9999] bg-creme flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-md">
            {paymentStage === 'processing' || paymentStage === 'verifying' ? (
              <div className="text-center space-y-6">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 rounded-full border-4 border-canyon/30"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-canyon animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-canyon animate-pulse" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-serif text-dark">
                    {paymentStage === 'verifying' ? 'Verifying Payment...' : 'Complete Payment in UPI App'}
                  </h2>
                  <p className="text-base text-dark/70 font-sans">
                    Return here after completing payment. We'll verify automatically.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-coyote/30" />
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 300)}`}
                        className="text-canyon transition-all duration-1000" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-dark">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-creme-light rounded-2xl p-5 border-2 border-coyote/20">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Amount</span>
                      <span className="text-lg font-bold text-dark">{formatINR(retryingOrder.total)}</span>
                    </div>
                    <div className="h-px bg-coyote/20"></div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Order ID</span>
                      <span className="text-dark font-mono text-xs">{retryingOrder.displayOrderId}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : paymentStage === 'confirmed' ? (
              <div className="text-center space-y-6">
                <div className="relative mx-auto w-28 h-28">
                  <div className="relative w-28 h-28 rounded-full bg-green-500 flex items-center justify-center shadow-2xl">
                    <CheckCircle className="w-14 h-14 text-white" strokeWidth={3} />
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-serif text-dark">Payment Confirmed!</h2>
                  <p className="text-base text-dark/70 font-sans">Your payment has been verified successfully</p>
                </div>
                <div className="bg-creme-light rounded-2xl p-6 border-2 border-green-500/30">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-dark/60 font-medium">Order Total</span>
                      <span className="text-2xl font-bold text-green-600">{formatINR(retryingOrder.total)}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setIsConfirmingPayment(false); setRetryingOrder(null); }}
                  className="w-full bg-dark text-creme-light py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 hover:bg-canyon">
                  Close
                </button>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className="relative mx-auto w-28 h-28">
                  <div className="relative w-28 h-28 rounded-full bg-yellow-500 flex items-center justify-center shadow-2xl">
                    <Clock className="w-14 h-14 text-white" strokeWidth={3} />
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-serif text-dark">Verification Pending</h2>
                  <p className="text-base text-dark/70 font-sans">We'll verify your payment shortly</p>
                </div>
                <button onClick={() => { setIsConfirmingPayment(false); setRetryingOrder(null); }}
                  className="w-full bg-dark text-creme-light py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 hover:bg-canyon">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
