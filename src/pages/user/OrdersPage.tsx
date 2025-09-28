import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Clock, Truck, CheckCircle, XCircle, Eye, AlertCircle, CreditCard } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';

interface OrderItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  quantity: number;
}

interface Order {
  id: string;
  displayOrderId: string;
  items: OrderItem[];
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount?: number;
  status: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentConfirmed?: boolean;
  paymentConfirmedAt?: string;
  paymentVerified?: 'YES' | 'NO' | 'REJECTED';
  paymentVerifiedAt?: string;
  paymentRejectionReason?: string;
  createdAt: string;
  estimatedDelivery: string;
  trackingNumber?: string;
  // New shipping tracking fields
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
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
        items: order.order_items.map((item: any) => ({
          id: item.product_id,
          name: item.product_name,
          brand: item.product_brand,
          price: item.product_price, // Price is already in rupees
          image: item.product_image,
          quantity: item.quantity,
        })),
        subtotal: order.subtotal, // Already in rupees
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
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return <Clock className="w-4 h-4" />;
      case 'processing':
        return <Package className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'processing':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'shipped':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'delivered':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return 'Order Placed';
      case 'processing':
        return 'Payment Confirmed';
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-card border-border/20 max-w-md">
          <CardContent className="text-center p-8">
            <Package className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="font-serif-premium text-2xl text-foreground mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your orders.
            </p>
            <Button onClick={() => navigate('/')}>
              Back to Store
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-serif-premium text-2xl text-foreground">Your Orders</h1>
              <p className="text-muted-foreground">Track and manage your purchases</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {orders.length === 0 ? (
          <Card className="glass-card border-border/20">
            <CardContent className="text-center p-12">
              <Package className="w-16 h-16 text-accent mx-auto mb-4" />
              <h2 className="font-serif-premium text-2xl text-foreground mb-2">No Orders Yet</h2>
              <p className="text-muted-foreground mb-6">
                When you place your first order, it will appear here.
              </p>
              <Button onClick={() => navigate('/')} className="gold-gradient text-primary">
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.id} className="glass-card border-border/20 hover:border-accent/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-serif-premium text-lg text-foreground">Order #{order.displayOrderId}</h3>
                      <p className="text-sm text-muted-foreground">
                        Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif-premium text-xl text-accent">
                        {formatINR(order.total)}
                      </p>
                      <div className="flex flex-col gap-1">
                        <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                          {getStatusIcon(order.status)}
                          {getStatusText(order.status)}
                        </Badge>
                        {order.paymentVerified === 'REJECTED' && (
                          <Badge className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Payment Rejected
                          </Badge>
                        )}
                        {order.paymentVerified === 'NO' && order.paymentConfirmed && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Pending Verification
                          </Badge>
                        )}
                        {order.paymentVerified === 'YES' && (
                          <Badge className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Payment Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tracking Information */}
                  {(order.trackingId || order.shippingCompany) && (
                    <div className="mt-4 p-3 bg-muted/20 rounded-lg border border-border/20">
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="w-4 h-4 text-accent" />
                        <span className="text-muted-foreground">Tracking:</span>
                        {order.trackingId && (
                          <span className="text-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                            {order.trackingId}
                          </span>
                        )}
                        {order.shippingCompany && (
                          <span className="text-foreground text-xs">
                            via {order.shippingCompany}
                          </span>
                        )}
                        {order.trackingLink && (
                          <a 
                            href={order.trackingLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent/80 underline text-xs ml-2"
                          >
                            Track →
                          </a>
                        )}
                      </div>
                      {order.estimatedDelivery && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order Items Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {order.items.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-center space-x-3">
                        <div className="w-12 h-12 relative overflow-hidden rounded-lg">
                          <ImageWithFallback
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif-premium text-sm text-foreground truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.brand} • Qty: {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 2 && (
                      <div className="flex items-center justify-center text-sm text-muted-foreground">
                        +{order.items.length - 2} more items
                      </div>
                    )}
                  </div>

                  {/* Order Status Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Order Progress</span>
                      {order.trackingNumber && (
                        <span className="text-xs text-accent">Tracking: {order.trackingNumber}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        ['pending', 'processing', 'shipped', 'delivered'].includes(order.status) 
                          ? 'bg-accent' 
                          : 'bg-muted'
                      }`}></div>
                      <div className={`flex-1 h-1 ${
                        ['processing', 'shipped', 'delivered'].includes(order.status) 
                          ? 'bg-accent' 
                          : 'bg-muted'
                      }`}></div>
                      <div className={`w-3 h-3 rounded-full ${
                        ['processing', 'shipped', 'delivered'].includes(order.status) 
                          ? 'bg-accent' 
                          : 'bg-muted'
                      }`}></div>
                      <div className={`flex-1 h-1 ${
                        ['shipped', 'delivered'].includes(order.status) 
                          ? 'bg-accent' 
                          : 'bg-muted'
                      }`}></div>
                      <div className={`w-3 h-3 rounded-full ${
                        ['shipped', 'delivered'].includes(order.status) 
                          ? 'bg-accent' 
                          : 'bg-muted'
                      }`}></div>
                      <div className={`flex-1 h-1 ${
                        order.status === 'delivered' 
                          ? 'bg-accent' 
                          : 'bg-muted'
                      }`}></div>
                      <div className={`w-3 h-3 rounded-full ${
                        order.status === 'delivered' 
                          ? 'bg-accent' 
                          : 'bg-muted'
                      }`}></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span className={order.status === 'pending' ? 'text-accent font-medium' : ''}>Order Placed</span>
                      <span className={order.status === 'processing' ? 'text-accent font-medium' : ''}>Confirmed</span>
                      <span className={order.status === 'shipped' ? 'text-accent font-medium' : ''}>Shipped</span>
                      <span className={order.status === 'delivered' ? 'text-accent font-medium' : ''}>Delivered</span>
                    </div>
                  </div>

                  {/* Estimated Delivery */}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <div className="bg-muted/20 p-3 rounded-lg mb-4">
                      <p className="text-sm text-foreground">
                        <Truck className="w-4 h-4 inline mr-2 text-accent" />
                        Estimated delivery: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Dialog open={selectedOrder?.id === order.id} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass-card border-border/20 max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="font-serif-premium">Order Details - #{order.displayOrderId}</DialogTitle>
                        </DialogHeader>
                        
                        {selectedOrder && (
                          <div className="space-y-6">
                            {/* Order Status */}
                            <div className="flex items-center justify-between">
                              <Badge className={`${getStatusColor(selectedOrder.status)} flex items-center gap-2`}>
                                {getStatusIcon(selectedOrder.status)}
                                {getStatusText(selectedOrder.status)}
                              </Badge>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Order placed</p>
                                <p className="font-sans-premium text-sm">
                                  {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>

                            <Separator className="bg-border/20" />

                            {/* Items */}
                            <div>
                              <h4 className="font-serif-premium text-lg text-foreground mb-4">Items</h4>
                              <div className="space-y-4">
                                {selectedOrder.items.map((item) => (
                                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-border/20 rounded-lg">
                                    <div className="w-16 h-16 relative overflow-hidden rounded-lg">
                                      <ImageWithFallback
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <h5 className="font-serif-premium text-foreground">{item.name}</h5>
                                      <p className="text-sm text-muted-foreground">{item.brand}</p>
                                      <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-serif-premium text-foreground">
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
                              <h4 className="font-serif-premium text-lg text-foreground mb-4">Order Summary</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Subtotal</span>
                                  <span className="text-foreground">{formatINR(selectedOrder.subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Shipping</span>
                                  <span className="text-accent">
                                    {selectedOrder.shipping === 0 ? 'Free' : formatINR(selectedOrder.shipping)}
                                  </span>
                                </div>
                                {selectedOrder.discount && selectedOrder.discount > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Lucky Discount</span>
                                    <span className="text-green-600">-{formatINR(selectedOrder.discount)}</span>
                                  </div>
                                )}
                                {selectedOrder.tax > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span className="text-foreground">{formatINR(selectedOrder.tax)}</span>
                                  </div>
                                )}
                                <Separator className="my-2 bg-border/20" />
                                <div className="flex justify-between font-medium text-base">
                                  <span className="text-foreground">Total</span>
                                  <span className="text-accent">{formatINR(selectedOrder.total)}</span>
                                </div>
                              </div>
                            </div>

                            <Separator className="bg-border/20" />

                            {/* Delivery Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h4 className="font-serif-premium text-lg text-foreground mb-3">Delivery Address</h4>
                                <div className="text-sm space-y-1">
                                  <p className="text-foreground font-medium">{selectedOrder.shippingAddress.name}</p>
                                  <p className="text-muted-foreground">{selectedOrder.shippingAddress.address}</p>
                                  <p className="text-muted-foreground">
                                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zipCode}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Shipping Tracking Information */}
                              {(selectedOrder.shippingCompany || selectedOrder.trackingId || selectedOrder.trackingLink) && (
                                <div>
                                  <h4 className="font-serif-premium text-lg text-foreground mb-3">Shipping Tracking</h4>
                                  <div className="text-sm space-y-2">
                                    {selectedOrder.shippingCompany && (
                                      <div className="flex items-center gap-2">
                                        <Truck className="w-4 h-4 text-accent" />
                                        <span className="text-muted-foreground">Company:</span>
                                        <span className="text-foreground font-medium">{selectedOrder.shippingCompany}</span>
                                      </div>
                                    )}
                                    {selectedOrder.trackingId && (
                                      <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-accent" />
                                        <span className="text-muted-foreground">Tracking ID:</span>
                                        <span className="text-foreground font-mono bg-muted px-2 py-1 rounded text-xs">
                                          {selectedOrder.trackingId}
                                        </span>
                                      </div>
                                    )}
                                    {selectedOrder.trackingLink && (
                                      <div className="flex items-center gap-2">
                                        <a 
                                          href={selectedOrder.trackingLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-accent hover:text-accent/80 underline flex items-center gap-1"
                                        >
                                          Track Package
                                          <ArrowLeft className="w-3 h-3 rotate-180" />
                                        </a>
                                      </div>
                                    )}
                                    {selectedOrder.shippedAt && (
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-accent" />
                                        <span className="text-muted-foreground">Shipped:</span>
                                        <span className="text-foreground">
                                          {new Date(selectedOrder.shippedAt).toLocaleDateString('en-IN')}
                                        </span>
                                      </div>
                                    )}
                                    {selectedOrder.deliveredAt && (
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-muted-foreground">Delivered:</span>
                                        <span className="text-foreground">
                                          {new Date(selectedOrder.deliveredAt).toLocaleDateString('en-IN')}
                                        </span>
                                      </div>
                                    )}
                                    {selectedOrder.estimatedDelivery && (
                                      <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-accent" />
                                        <span className="text-muted-foreground">Est. Delivery:</span>
                                        <span className="text-foreground">
                                          {new Date(selectedOrder.estimatedDelivery).toLocaleDateString('en-IN')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              <div>
                                <h4 className="font-serif-premium text-lg text-foreground mb-3">Payment Information</h4>
                                <div className="text-sm space-y-1">
                                  <p className="text-foreground">{selectedOrder.paymentMethod} Payment</p>
                                  {selectedOrder.paymentConfirmed && selectedOrder.paymentConfirmedAt && (
                                    <>
                                      <p className="text-green-600 font-medium">✓ Payment Confirmed by Customer</p>
                                      <p className="text-muted-foreground">
                                        Confirmed on {new Date(selectedOrder.paymentConfirmedAt).toLocaleString('en-IN')}
                                      </p>
                                      <p className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded border border-yellow-200 mt-2">
                                        <strong>Note:</strong> Payment confirmed by customer. Manual verification pending at backend.
                                      </p>
                                    </>
                                  )}
                                  {selectedOrder.upiId && (
                                    <p className="text-muted-foreground">UPI ID: {selectedOrder.upiId}</p>
                                  )}
                                  {selectedOrder.trackingNumber && (
                                    <>
                                      <p className="text-foreground font-medium mt-3">Tracking Information</p>
                                      <p className="text-accent">{selectedOrder.trackingNumber}</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    {order.status === 'delivered' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gold-gradient text-primary"
                        onClick={async () => {
                          try {
                            // Create a batch of all products to add
                            const productsToAdd = order.items.map(item => ({
                              id: item.id,
                              name: item.name,
                              brand: item.brand,
                              price: item.price,
                              image: item.image,
                              slug: item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                              description: '', // Order items don't have description
                              is_active: true,
                              gallery_images: [item.image],
                              rating: 0,
                              review_count: 0,
                              created_at: new Date().toISOString()
                            }));

                            // Add all products to cart in a single batch
                            await addMultipleToCart(productsToAdd, order.items.map(item => item.quantity));
                            
                            toast.success(`${order.items.length} item(s) added to cart!`);
                            // Navigate to checkout page
                            navigate('/checkout');
                          } catch (error) {
                            console.error('Buy Again error:', error);
                            toast.error('Failed to add items to cart');
                          }
                        }}
                      >
                        Buy Again
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
