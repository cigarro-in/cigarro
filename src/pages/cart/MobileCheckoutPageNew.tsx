import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, MapPin, Smartphone, Wallet, ChevronRight, Truck, Clock, Zap, Minus, Plus, QrCode } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { OrderSummary, ShippingOptions, AddressManager } from '../../components/checkout';
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
}

export function MobileCheckoutPageNew() {
  const navigate = useNavigate();
  const { items: cartItems, updateQuantity, removeFromCart, totalPrice: cartTotalPrice, clearCart } = useCart();
  const { user } = useAuth();

  const normalizeString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

  const userMetadata = ((user as unknown) as { user_metadata?: Record<string, unknown> })?.user_metadata ?? {};

  const metadataNameFromParts = normalizeString(
    [userMetadata.first_name, userMetadata.last_name]
      .filter(Boolean)
      .join(' ')
  );

  const defaultUserName =
    normalizeString(userMetadata.full_name) ??
    normalizeString(userMetadata.name) ??
    metadataNameFromParts ??
    (user?.email ? user.email.split('@')[0] : 'Customer');

  const defaultUserPhone =
    normalizeString(userMetadata.phone) ??
    normalizeString(userMetadata.contact) ??
    '';

  // Check for Buy Now flow
  const isBuyNow = sessionStorage.getItem('isBuyNow') === 'true';
  const buyNowItemData = sessionStorage.getItem('buyNowItem');
  const buyNowItem = isBuyNow && buyNowItemData ? JSON.parse(buyNowItemData) : null;

  // Check for Retry Payment flow
  const isRetryPayment = sessionStorage.getItem('isRetryPayment') === 'true';
  const retryOrderData = sessionStorage.getItem('retryOrder');
  const retryOrder = isRetryPayment && retryOrderData ? JSON.parse(retryOrderData) : null;

  // Retry order derived values
  const retrySubtotal = isRetryPayment && retryOrder
    ? (typeof retryOrder.subtotal === 'number'
        ? retryOrder.subtotal
        : (retryOrder.total + (retryOrder.discount || 0) - (retryOrder.shipping || 0)))
    : null;

  const retryShippingCost = isRetryPayment && retryOrder
    ? retryOrder.shipping || 0
    : null;

  const retryLuckyDiscount = isRetryPayment && retryOrder
    ? retryOrder.discount || 0
    : null;

  const retryDisplayOrderId = isRetryPayment && retryOrder
    ? retryOrder.displayOrderId || null
    : null;

  // Use Retry Order, Buy Now item, or cart items
  const items = isRetryPayment && retryOrder 
    ? retryOrder.items 
    : (isBuyNow && buyNowItem ? [buyNowItem] : cartItems);
  
  const totalPrice = isRetryPayment && retrySubtotal !== null
    ? retrySubtotal
    : (isBuyNow && buyNowItem 
      ? (buyNowItem.variant_price || buyNowItem.price) * buyNowItem.quantity 
      : cartTotalPrice);

  // Debug logging
  console.log('🔍 Checkout Page State:', {
    isRetryPayment,
    isBuyNow,
    itemsCount: items.length,
    totalPrice,
    retryOrderId: retryOrder?.orderId
  });

  // State management
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);

  // Dialog states
  const [showAddressDialog, setShowAddressDialog] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Lucky discount - use original discount for retry orders
  const [randomDiscount] = useState(() => {
    if (retryLuckyDiscount !== null) {
      return retryLuckyDiscount;
    }
    const paise = Math.floor(Math.random() * 99) + 1;
    const discount = paise / 100;
    return Math.max(0.01, Math.min(0.99, discount));
  });

  // QR code state
  const [qrCode, setQrCode] = useState<string>('');
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);

  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);

  // Shipping cost calculation
  const getShippingCost = () => {
    if (retryShippingCost !== null) {
      return retryShippingCost;
    }
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

      if (error) throw error;
      setWalletBalance(data || 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletBalance(0);
    } finally {
      setIsWalletLoading(false);
    }
  };

  // Fetch saved addresses and auto-select
  const fetchSavedAddresses = async () => {
    if (!user) return;

    // If retry payment, use the original shipping address
    if (isRetryPayment && retryOrder?.shippingAddress) {
      console.log('📍 Using retry order shipping address');

      const shippingAddress = retryOrder.shippingAddress as Record<string, unknown>;

      setSelectedAddress({
        id: normalizeString(shippingAddress.id),
        full_name:
          normalizeString(shippingAddress.full_name) ||
          normalizeString(shippingAddress.name) ||
          defaultUserName,
        phone:
          normalizeString(shippingAddress.phone) ||
          normalizeString(shippingAddress.contact) ||
          defaultUserPhone,
        address:
          normalizeString(shippingAddress.address) ||
          normalizeString(shippingAddress.line1) ||
          'Address unavailable',
        pincode:
          normalizeString(shippingAddress.pincode) ||
          normalizeString(shippingAddress.zipCode) ||
          normalizeString(shippingAddress.postcode) ||
          '000000',
        city:
          normalizeString(shippingAddress.city) ||
          normalizeString(shippingAddress.town) ||
          'Unknown',
        state:
          normalizeString(shippingAddress.state) ||
          normalizeString(shippingAddress.region) ||
          'Unknown',
        country: normalizeString(shippingAddress.country) || 'India',
        label:
          normalizeString(shippingAddress.label) ||
          normalizeString(shippingAddress.tag) ||
          'Saved address'
      });
      return;
    }

    try {
      const { data: addresses, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching addresses:', error);
        return;
      }

      if (addresses && addresses.length > 0) {
        setSavedAddresses(addresses);
        
        // Auto-select first (most recent) address
        const addressToSelect = addresses[0];
        
        console.log('📍 Auto-selecting address:', addressToSelect.label);
        
        setSelectedAddress({
          id: addressToSelect.id,
          full_name: addressToSelect.full_name,
          phone: addressToSelect.phone,
          address: addressToSelect.address,
          pincode: addressToSelect.pincode,
          city: addressToSelect.city,
          state: addressToSelect.state,
          country: addressToSelect.country || 'India',
          label: addressToSelect.label
        });
      } else {
        console.log('📍 No saved addresses found');
        setSavedAddresses([]);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
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
      payment_method: walletAmountToUse > 0 ? 'wallet' : 'upi',
      shipping_name: selectedAddress.full_name || defaultUserName,
      shipping_address: selectedAddress.address,
      shipping_city: selectedAddress.city,
      shipping_state: selectedAddress.state,
      shipping_zip_code: selectedAddress.pincode,
      shipping_country: selectedAddress.country || 'India',
      shipping_phone: selectedAddress.phone || defaultUserPhone,
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
      const orderItems = items.map((item: any) => ({
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

  // Helper function to trigger payment webhook
  const triggerPaymentWebhook = (transactionId: string, orderId: string, amount: number) => {
    const orderCreatedAt = new Date().toISOString();
    
    fetch('/payment-email-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_WEBHOOK_SECRET || 'wjfx2qo61pi97ckareu0'}`
      },
      body: JSON.stringify({
        orderId: transactionId,
        transactionId: transactionId,
        amount: amount,
        orderCreatedAt: orderCreatedAt,
        timestamp: new Date().toISOString()
      }),
      keepalive: true
    }).catch(err => console.log('Verification started on server:', err));
  };

  // Unified payment handler
  const handlePayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setShowAddressDialog(true);
      return;
    }

    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    // Determine if using wallet
    const usingWallet = walletAmountToUse > 0;
    const finalTotal = getFinalTotal();
    const walletAmountUsed = usingWallet ? walletAmountToUse : 0;
    const remainingAmount = finalTotal - walletAmountUsed;
    
    console.log('💳 Payment Handler:', {
      finalTotal,
      walletAmountToUse,
      walletAmountUsed,
      remainingAmount,
      usingWallet,
      isFullWalletPayment: remainingAmount === 0
    });

    setIsProcessing(true);

    try {
      const txnId = `TXN${Date.now().toString().slice(-8)}`;
      
      console.log('💰 Creating order with transaction ID:', txnId);
      
      // Save order first
      const order = await saveOrderToDatabase(txnId, 'pending');
      if (!order) {
        throw new Error('Failed to create order');
      }

      console.log('✅ Order saved:', order.id);

      // Process payment with wallet if applicable
      const { data: result, error } = await supabase.rpc('process_order_payment', {
        p_user_id: user.id,
        p_order_id: order.id,
        p_transaction_id: txnId,
        p_amount: finalTotal,
        p_payment_method: usingWallet ? 'wallet' : 'upi',
        p_use_wallet: usingWallet,
        p_wallet_amount: walletAmountUsed,
        p_metadata: {
          wallet_balance_before: walletBalance,
          wallet_amount_used: walletAmountUsed,
          remaining_amount: remainingAmount
        }
      });

      if (error) {
        console.error('❌ process_order_payment error:', error);
        throw error;
      }

      console.log('✅ process_order_payment result:', result);
      console.log('📊 Result details:', {
        success: result?.success,
        wallet_transaction_id: result?.wallet_transaction_id,
        gateway_transaction_id: result?.gateway_transaction_id,
        wallet_amount_used: result?.wallet_amount_used,
        gateway_amount: result?.gateway_amount
      });

      // Check if wallet covered full amount (no additional payment needed)
      if (remainingAmount === 0) {
        console.log('✅ Full payment from wallet - Order complete!');
        console.log('📝 Order ID:', order.id);
        console.log('✅ Order status updated by database function');

        // Show processing state
        navigate('/transaction', {
          state: {
            type: 'wallet_payment',
            transactionId: txnId,
            amount: finalTotal,
            orderId: order.id,
            displayOrderId: order.display_order_id,
            paymentMethod: 'wallet',
            walletAmountUsed: walletAmountUsed,
            autoComplete: true, // Flag to auto-complete after processing
            metadata: {
              wallet_payment: true,
              items_count: items.length
            }
          }
        });

        // Process in background
        setTimeout(async () => {
          try {
            // Verify wallet was deducted
            const newBalance = await supabase.rpc('get_wallet_balance', { p_user_id: user.id });
            console.log('💰 Wallet balance after payment:', {
              before: walletBalance,
              after: newBalance.data,
              deducted: walletBalance - (newBalance.data || 0),
              expected: walletAmountUsed
            });

            // Clear cart (both database and UI state)
            console.log('🗑️ Clearing cart...');
            await clearCart();
            console.log('✅ Cart cleared from database and UI');
            
            // Clear session storage
            sessionStorage.removeItem('buyNowItem');
            sessionStorage.removeItem('isBuyNow');
            sessionStorage.removeItem('retryOrder');
            sessionStorage.removeItem('isRetryPayment');
            
            // Refresh wallet balance in state
            setWalletBalance(newBalance.data || 0);
            setWalletAmountToUse(0);
          } catch (error) {
            console.error('Error in background processing:', error);
          }
        }, 100);
        
        return;
      }

      // Remaining amount - redirect to UPI payment
      console.log(`💳 ${usingWallet ? 'Partial wallet payment' : 'Full UPI payment'} - Remaining: ₹${remainingAmount}`);
      
      // Trigger webhook
      triggerPaymentWebhook(txnId, order.id, remainingAmount);
      
      // Generate UPI link
      const upiUrl = `upi://pay?pa=payments@cigarro.in&pn=Cigarro&am=${remainingAmount}&cu=INR&tn=Order%20${order.display_order_id}%20${txnId}`;
      
      // Open UPI app
      try {
        window.location.href = upiUrl;
      } catch (err) {
        console.error('Failed to open UPI app:', err);
      }
      
      // Navigate to transaction processing
      navigate('/transaction', {
        state: {
          type: 'order',
          transactionId: txnId,
          amount: remainingAmount,
          orderId: order.id,
          paymentMethod: 'upi',
          upiUrl,
          metadata: {
            wallet_amount_used: walletAmountUsed,
            is_partial_payment: usingWallet,
            original_amount: finalTotal,
            items_count: items.length,
            shipping_cost: getShippingCost(),
            discount: randomDiscount + (appliedDiscount?.discount_value || 0)
          }
        }
      });
    } catch (error) {
      console.error('❌ Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle UPI payment
  const handleUPIPayment = async (amount?: number, existingTxnId?: string) => {
    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setShowAddressDialog(true);
      return;
    }

    setIsProcessing(true);
    try {
      const txnId = existingTxnId || `TXN${Date.now().toString().slice(-8)}`;
      const paymentAmount = amount || Math.max(0, getFinalTotal() - walletAmountToUse);

      if (!existingTxnId) {
        const order = await saveOrderToDatabase(txnId, 'pending');
        if (!order) {
          toast.error('Failed to create order');
          return;
        }

        // Trigger webhook
        triggerPaymentWebhook(txnId, order.id, paymentAmount);
      }

      // Generate UPI URL
      const upiUrl = `upi://pay?pa=payments@cigarro.in&pn=Cigarro&am=${paymentAmount}&cu=INR&tn=Order%20${txnId}`;

      // Navigate to unified transaction page
      navigate('/transaction', {
        state: {
          type: 'order',
          transactionId: txnId,
          amount: paymentAmount,
          orderId: existingTxnId ? undefined : txnId,
          paymentMethod: 'upi',
          upiUrl: upiUrl,
          metadata: {
            items_count: items.length,
            shipping_cost: getShippingCost(),
            discount: randomDiscount + (appliedDiscount?.discount_value || 0)
          }
        }
      });
    } catch (error) {
      console.error('UPI payment error:', error);
      toast.error('Failed to initiate payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle QR payment
  const handleQRPayment = async () => {
    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setShowAddressDialog(true);
      return;
    }

    setIsProcessing(true);
    try {
      const txnId = `TXN${Date.now().toString().slice(-8)}`;
      const paymentAmount = Math.max(0, getFinalTotal() - walletAmountToUse);

      // Save order first
      const order = await saveOrderToDatabase(txnId, 'pending');
      if (!order) {
        throw new Error('Failed to create order');
      }

      // Process QR payment
      const { data: result, error } = await supabase.rpc('process_order_payment', {
        p_user_id: user.id,
        p_order_id: order.id,
        p_transaction_id: txnId,
        p_amount: paymentAmount,
        p_payment_method: 'qr',
        p_use_wallet: false,
        p_wallet_amount: 0,
        p_metadata: {
          order_id: order.id,
          items_count: items.length,
          shipping_cost: getShippingCost(),
          discount: randomDiscount + (appliedDiscount?.discount_value || 0),
          coupon_code: appliedDiscount?.discount_code || null
        }
      });

      if (error) throw error;

      // Trigger webhook
      triggerPaymentWebhook(txnId, order.id, paymentAmount);

      // Navigate to unified transaction page
      navigate('/transaction', {
        state: {
          type: 'order',
          transactionId: txnId,
          amount: paymentAmount,
          orderId: order.id,
          paymentMethod: 'qr',
          metadata: {
            items_count: items.length,
            shipping_cost: getShippingCost(),
            discount: randomDiscount + (appliedDiscount?.discount_value || 0)
          }
        }
      });
    } catch (error) {
      console.error('QR payment error:', error);
      toast.error('Failed to initiate payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchWalletBalance();
      fetchSavedAddresses();
    }
  }, [user]);

  // Redirect if no items (but not during order completion or retry payment)
  useEffect(() => {
    if (items.length === 0 && !isCompletingOrder && !isBuyNow && !isRetryPayment) {
      navigate('/cart');
    }
  }, [items, navigate, isCompletingOrder, isBuyNow, isRetryPayment]);

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
              {items.map((item: any) => (
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
              isRetryPayment={isRetryPayment}
              retryDisplayOrderId={retryDisplayOrderId}
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
          <Button
            onClick={handlePayment}
            disabled={isProcessing || !selectedAddress}
            className="w-full bg-dark hover:bg-canyon text-creme-light font-semibold py-4 rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 
              (getFinalTotal() - walletAmountToUse) <= 0 
                ? '✓ Complete Order' 
                : `Pay ${formatINR(Math.max(0, getFinalTotal() - walletAmountToUse))}`
            }
          </Button>
        </div>
      </div>

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
            savedAddresses={savedAddresses}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
