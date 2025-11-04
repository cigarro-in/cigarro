import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, MapPin, Smartphone, Wallet, ChevronRight, Truck, Clock, Zap, Minus, Plus, QrCode } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { OrderSummary, PaymentMethods, ShippingOptions, AddressManager } from '../../components/checkout';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { validateCouponCode } from '../../utils/discounts';

interface Address {
  id?: string;
  full_name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
  label: string;
  is_primary?: boolean;
}

export function MobileCheckoutPageNew() {
  const navigate = useNavigate();
  const { items: cartItems, updateQuantity, removeFromCart, totalPrice: cartTotalPrice, clearCart } = useCart();
  const { user } = useAuth();

  // Check for Buy Now flow
  const isBuyNow = sessionStorage.getItem('isBuyNow') === 'true';
  const buyNowItemData = sessionStorage.getItem('buyNowItem');
  const buyNowItem = isBuyNow && buyNowItemData ? JSON.parse(buyNowItemData) : null;

  // Use Buy Now item or cart items
  const items = isBuyNow && buyNowItem ? [buyNowItem] : cartItems;
  const totalPrice = isBuyNow && buyNowItem 
    ? (buyNowItem.variant_price || buyNowItem.price) * buyNowItem.quantity 
    : cartTotalPrice;

  // State management
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);

  // Dialog states
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Lucky discount
  const [randomDiscount] = useState(() => {
    const paise = Math.floor(Math.random() * 99) + 1;
    const discount = paise / 100;
    return Math.max(0.01, Math.min(0.99, discount));
  });

  // QR code state
  const [qrCode, setQrCode] = useState('');

  // Shipping cost calculation
  const getShippingCost = () => {
    const option = selectedShipping;
    if (option === 'standard') return 0;
    if (option === 'express') return 99;
    if (option === 'priority') return 199;
    return 0;
  };

  // Final total calculation
  const getFinalTotal = () => {
    const shipping = getShippingCost();
    const discount = randomDiscount + (appliedDiscount?.discount_value || 0);
    return Math.max(0, totalPrice + shipping - discount);
  };

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    if (!user) return;

    setIsWalletLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_wallet_balance', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching wallet balance:', error);
        setWalletBalance(0);
      } else {
        console.log('✅ Wallet balance:', data);
        setWalletBalance(data || 0);
      }
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
      setWalletBalance(0);
    } finally {
      setIsWalletLoading(false);
    }
  };

  // Validate and apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    setIsValidatingCoupon(true);
    try {
      const result = await validateCouponCode(couponCode.trim());
      
      if (result.isValid && result.discount) {
        setAppliedDiscount(result.discount);
        toast.success(`Coupon applied! You saved ₹${result.discount.discount_value || 0}`);
      } else {
        toast.error(result.message || 'Invalid coupon code');
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      toast.error('Failed to validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Save order to database
  const saveOrderToDatabase = async (txnId: string, status: string) => {
    if (!user || !selectedAddress) return null;

    const orderCreatedAt = new Date().toISOString();
    const finalTotal = getFinalTotal();
    const shipping = getShippingCost();
    const discount = randomDiscount + (appliedDiscount?.discount_value || 0);

    const orderData = {
      user_id: user.id,
      transaction_id: txnId,
      status,
      subtotal: totalPrice,
      shipping,
      discount,
      tax: 0,
      total: finalTotal,
      discount_code: appliedDiscount?.discount_code || null,
      discount_id: appliedDiscount?.discount_id || null,
      payment_method: selectedPaymentMethod,
      shipping_name: selectedAddress.full_name,
      shipping_address: selectedAddress.address,
      shipping_city: selectedAddress.city,
      shipping_state: selectedAddress.state,
      shipping_zip_code: selectedAddress.pincode,
      shipping_country: selectedAddress.country || 'India',
      shipping_phone: selectedAddress.phone,
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: orderCreatedAt
    };

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error('Error saving order:', orderError);
        throw new Error('Failed to save order');
      }

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_brand: item.brand || 'Premium',
        product_price: item.variant_price || item.price,
        product_image: item.image || (item.gallery_images && item.gallery_images[0]) || '',
        quantity: item.quantity,
        variant_id: item.variant_id || null,
        variant_name: item.variant_name || null,
        combo_id: item.combo_id || null,
        combo_name: item.combo_name || null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error saving order items:', itemsError);
        throw new Error('Failed to save order items');
      }

      return order;
    } catch (error) {
      console.error('Error in saveOrderToDatabase:', error);
      throw error;
    }
  };

  // Handle wallet payment
  const handleWalletPayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setShowAddressDialog(true);
      return;
    }

    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    if (walletBalance === 0) {
      toast.error('No wallet balance available');
      return;
    }

    setIsProcessing(true);

    try {
      const txnId = `TXN${Date.now().toString().slice(-8)}`;
      const finalTotal = getFinalTotal();
      const walletAmountUsed = Math.min(walletBalance, finalTotal);
      
      // Save order first
      const order = await saveOrderToDatabase(txnId, 'pending');
      if (!order) {
        throw new Error('Failed to create order');
      }

      // Process wallet payment
      const { data: result, error } = await supabase.rpc('process_order_payment', {
        p_user_id: user.id,
        p_order_id: order.id,
        p_transaction_id: txnId,
        p_amount: finalTotal,
        p_payment_method: 'wallet',
        p_use_wallet: true,
        p_wallet_amount: walletAmountUsed,
        p_metadata: {
          wallet_balance_before: walletBalance,
          wallet_amount_used: walletAmountUsed
        }
      });

      if (error) throw error;

      if (walletAmountUsed >= finalTotal) {
        // Full wallet payment - order completed
        clearCart();
        toast.success('🎉 Order completed with wallet!');
        navigate('/orders', { replace: true });
      } else {
        // Partial wallet payment - continue with UPI
        const remainingAmount = finalTotal - walletAmountUsed;
        toast.success(`₹${walletAmountUsed} deducted from wallet. Pay remaining ₹${remainingAmount} via UPI.`);
        handleUPIPayment(remainingAmount, txnId);
      }
    } catch (error) {
      console.error('Wallet payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle QR payment
  const handleQRPayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setShowAddressDialog(true);
      return;
    }

    const txnId = `TXN${Date.now().toString().slice(-8)}`;
    const paymentAmount = Math.max(0, getFinalTotal() - walletAmountToUse);

    try {
      const qrCodeData = await QRCodeLib.toString(paymentAmount.toString(), { type: 'terminal' });
      setQrCode(qrCodeData);

      // Save order first
      const order = await saveOrderToDatabase(txnId, 'pending');
      if (!order) {
        throw new Error('Failed to create order');
      }

      // Process QR payment
      const { data: result, error } = await supabase.rpc('process_order_payment', {
        p_order_id: order.id,
        p_transaction_id: txnId,
        p_amount: paymentAmount,
        p_payment_method: 'qr',
        p_metadata: {
          order_id: order.id,
          items_count: items.length,
          shipping_cost: getShippingCost(),
          discount: randomDiscount + (appliedDiscount?.discount_value || 0),
          coupon_code: appliedDiscount?.discount_code || null
        }
      });

      if (error) throw error;

      toast.success('QR code generated. Scan to pay.');
    } catch (error) {
      console.error('QR payment error:', error);
      toast.error('Failed to generate QR code');
    }
  };

  // Handle UPI payment
  const handleUPIPayment = async (amount?: number, existingTxnId?: string) => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setShowAddressDialog(true);
      return;
    }

    const txnId = existingTxnId || `TXN${Date.now().toString().slice(-8)}`;
    const paymentAmount = amount || Math.max(0, getFinalTotal() - walletAmountToUse);

    try {
      if (!existingTxnId) {
        const order = await saveOrderToDatabase(txnId, 'pending');
        if (!order) {
          toast.error('Failed to create order');
          return;
        }
      }

      const upiUrl = `upi://pay?pa=payments@cigarro.in&pn=Cigarro&am=${paymentAmount}&cu=INR&tn=Order%20Payment%20${txnId}`;
      window.location.href = upiUrl;
      
      toast.success('UPI app opened. Complete payment and return here.');
    } catch (error) {
      console.error('UPI payment error:', error);
      toast.error('Failed to open UPI app');
    }
  };

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchWalletBalance();
    }
  }, [user]);

  // Redirect if no items
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items, navigate]);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cart')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-serif text-xl font-bold text-dark">Checkout</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Items Card */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <h3 className="font-serif text-lg mb-4">Order Items ({items.length})</h3>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={`${item.id}-${item.variant_id || 'default'}`} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border/20">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted/20 flex-shrink-0">
                    <img
                      src={item.image || item.gallery_images?.[0] || '/placeholder-product.jpg'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.name}{item.variant_name && ` (${item.variant_name})`}</h4>
                    <p className="text-sm font-semibold text-foreground">
                      {formatINR(item.variant_price || item.price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="w-8 h-8 rounded-lg border-2 border-coyote/30 bg-background text-dark hover:bg-dark hover:text-creme-light hover:border-dark transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1), item.variant_id)}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                    <button
                      className="w-8 h-8 rounded-lg border-2 border-coyote/30 bg-background text-dark hover:bg-dark hover:text-creme-light hover:border-dark transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant_id)}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Options */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <ShippingOptions
              selectedShipping={selectedShipping}
              onSelectShipping={setSelectedShipping}
            />
          </CardContent>
        </Card>

        {/* Price Breakdown */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <h3 className="font-serif text-lg mb-4">Price Details</h3>
            
            {/* Coupon Section */}
            <div className="mb-4">
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                <Button 
                  onClick={handleApplyCoupon} 
                  variant="outline" 
                  size="sm"
                  disabled={isValidatingCoupon}
                >
                  <Tag className="w-4 h-4" />
                </Button>
              </div>
              {appliedDiscount && (
                <div className="flex items-center justify-between text-xs text-green-600">
                  <span>✓ {appliedDiscount.discount_name || 'Coupon'} applied</span>
                </div>
              )}
            </div>

            <OrderSummary
              items={items}
              totalPrice={totalPrice}
              randomDiscount={randomDiscount}
              appliedDiscount={appliedDiscount}
              getShippingCost={getShippingCost}
              getFinalTotal={getFinalTotal}
              user={user}
              walletBalance={walletBalance}
              walletAmountToUse={walletAmountToUse}
              setWalletAmountToUse={setWalletAmountToUse}
            />
          </CardContent>
        </Card>
      </div>

      {/* Sticky Bottom Section */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border/40 z-50">
        {/* Address Row */}
        <div className="px-4 py-3 border-b border-border/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <MapPin className="w-5 h-5 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {selectedAddress ? (
                  <div>
                    <p className="text-sm font-medium truncate">{selectedAddress.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedAddress.address}, {selectedAddress.city}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No address selected</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddressDialog(true)}
              className="flex-shrink-0"
            >
              {selectedAddress ? 'Change' : 'Add Address'}
            </Button>
          </div>
        </div>

        {/* Payment Row */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Payment Method Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPaymentDialog(true)}
              className="flex items-center gap-2 flex-shrink-0"
            >
              {selectedPaymentMethod === 'upi' && <Smartphone className="w-4 h-4" />}
              {selectedPaymentMethod === 'wallet' && <Wallet className="w-4 h-4" />}
              {selectedPaymentMethod === 'qr' && <QrCode className="w-4 h-4" />}
              <span className="text-xs">
                {selectedPaymentMethod === 'upi' && 'UPI App'}
                {selectedPaymentMethod === 'wallet' && 'Wallet'}
                {selectedPaymentMethod === 'qr' && 'QR Code'}
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </Button>

            {/* Pay Button */}
            <Button
              onClick={() => {
                if (!selectedAddress) {
                  toast.error('Please select a delivery address first');
                  setShowAddressDialog(true);
                  return;
                }
                if (selectedPaymentMethod === 'upi') {
                  handleUPIPayment();
                } else if (selectedPaymentMethod === 'wallet') {
                  handleWalletPayment();
                } else if (selectedPaymentMethod === 'qr') {
                  handleQRPayment();
                } else {
                  setShowPaymentDialog(true);
                }
              }}
              disabled={isProcessing}
              className="flex-1 bg-dark hover:bg-canyon text-creme-light font-semibold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : `Pay ${formatINR(Math.max(0, getFinalTotal() - walletAmountToUse))}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Methods Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
          </DialogHeader>
          <PaymentMethods
            selectedPaymentMethod={selectedPaymentMethod}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
            setShowPaymentDialog={setShowPaymentDialog}
            handleUPIPayment={() => handleUPIPayment()}
            handleWalletPayment={handleWalletPayment}
            handleQRPayment={() => handleQRPayment()}
            walletBalance={walletBalance}
            getFinalTotal={() => Math.max(0, getFinalTotal() - walletAmountToUse)}
          />
        </DialogContent>
      </Dialog>

      {/* Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add/Edit Address</DialogTitle>
          </DialogHeader>
          <AddressManager 
            user={user}
            selectedAddress={selectedAddress} 
            onAddressSelect={setSelectedAddress}
            showDialog={showAddressDialog}
            onDialogChange={setShowAddressDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
