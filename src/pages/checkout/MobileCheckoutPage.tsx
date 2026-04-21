import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, MapPin, Wallet, ChevronRight, Truck, Clock, Zap, Minus, Plus, QrCode, Gift, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { OrderSummary, ShippingOptions, PaymentMethods } from '../../components/checkout';
import { AddressDrawer } from '../../components/checkout/address/AddressDrawer';
import { Address } from '../../components/checkout/address/AddressCard';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { validateCouponCode } from '../../utils/discounts';
import { getProductImageUrl } from '../../lib/supabase/storage';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { rupeesToPaise } from '../../lib/convex/money';

// Helper function to safely get brand name from various formats
const getBrandName = (brand: any): string => {
  if (!brand) return '';
  if (typeof brand === 'string') return brand;
  if (typeof brand === 'object') {
    if (Array.isArray(brand)) return brand[0]?.name || '';
    return brand.name || '';
  }
  return '';
};


export function MobileCheckoutPage() {
  const navigate = useNavigate();
  const { items: cartItems, updateQuantity, removeFromCart, totalPrice: cartTotalPrice, clearCart } = useCart();
  const { user } = useAuth();

  const org = useOrg();
  const convexWallet = useQuery(api.wallet.getMyBalance, org ? { orgId: org._id } : 'skip');
  const createConvexOrder = useMutation(api.orders.createOrder);

  // Determine checkout flow type using URL params as source of truth, initialized once
  const [isBuyNow] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('buynow') === 'true' || sessionStorage.getItem('isBuyNow') === 'true';
  });

  const [isRetryPayment] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('retry') === 'true' || sessionStorage.getItem('isRetryPayment') === 'true';
  });

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

  // URL params for effects
  const searchParams = new URLSearchParams(window.location.search);
  const urlRetryParam = searchParams.get('retry') === 'true';
  const urlBuyNowParam = searchParams.get('buynow') === 'true';

  // Clear sessionStorage on mount if this is a normal cart checkout (no URL params)
  useEffect(() => {
    if (!urlRetryParam && !urlBuyNowParam) {
      // This is a normal cart checkout - clear any stale flow data
      sessionStorage.removeItem('isRetryPayment');
      sessionStorage.removeItem('retryOrder');
      sessionStorage.removeItem('isBuyNow');
      sessionStorage.removeItem('buyNowItem');
    }
  }, [urlRetryParam, urlBuyNowParam]);

  // Get flow-specific data from sessionStorage
  const buyNowItemData = sessionStorage.getItem('buyNowItem');
  const initialBuyNowItem = isBuyNow && buyNowItemData ? JSON.parse(buyNowItemData) : null;

  // Local state for Buy Now item to handle quantity updates
  const [localBuyNowItem, setLocalBuyNowItem] = useState(initialBuyNowItem);

  // Update local state if sessionStorage changes (e.g. initial load)
  useEffect(() => {
    if (initialBuyNowItem) {
      setLocalBuyNowItem(initialBuyNowItem);
    }
  }, [buyNowItemData]);

  const retryOrderData = sessionStorage.getItem('retryOrder');
  const retryOrder = useMemo(() =>
    isRetryPayment && retryOrderData ? JSON.parse(retryOrderData) : null,
    [isRetryPayment, retryOrderData]
  );

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

  // Redirect if retry param exists but session data is missing (e.g. Back button after transaction)
  useEffect(() => {
    if (urlRetryParam && !retryOrderData) {
      console.warn('⚠️ Retry param present but session data missing. Redirecting to orders.');
      toast.error('Retry session expired. Please try again.');
      navigate('/orders');
    }
  }, [urlRetryParam, retryOrderData, navigate]);

  // Use Retry Order, Buy Now item, or cart items
  const items = isRetryPayment && retryOrder
    ? retryOrder.items
    : (isBuyNow && localBuyNowItem ? [localBuyNowItem] : cartItems);

  // Handle quantity updates for both Cart and Buy Now flows
  const handleUpdateQuantity = async (productId: string, quantity: number, variantId?: string, comboId?: string) => {
    // Check if we should update locally
    // Normalize undefined/null to null for comparison
    const targetVariantId = variantId || null;
    const targetComboId = comboId || null;
    const localVariantId = localBuyNowItem?.variant_id || null;
    const localComboId = localBuyNowItem?.combo_id || null;

    const isLocalUpdate = localBuyNowItem &&
      localBuyNowItem.id === productId &&
      localVariantId === targetVariantId &&
      localComboId === targetComboId;

    if (isLocalUpdate) {
      if (quantity <= 0) {
        // Return to product page if quantity becomes 0
        sessionStorage.removeItem('buyNowItem');
        sessionStorage.removeItem('isBuyNow');
        navigate(-1);
        return;
      }

      const updatedItem = { ...localBuyNowItem, quantity };
      setLocalBuyNowItem(updatedItem);
      sessionStorage.setItem('buyNowItem', JSON.stringify(updatedItem));
    } else {
      // Normal cart update
      await updateQuantity(productId, quantity, variantId, comboId);
    }
  };

  const totalPrice = isRetryPayment && retrySubtotal !== null
    ? retrySubtotal
    : (isBuyNow && localBuyNowItem
      ? (localBuyNowItem.variant_price || localBuyNowItem.price) * localBuyNowItem.quantity
      : cartTotalPrice);

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
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Referral state (Late Attachment)
  const [referralCode, setReferralCode] = useState('');
  const [isReferralEligible, setIsReferralEligible] = useState(false);
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);

  // Check referral eligibility on mount
  useEffect(() => {
    const checkEligibility = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('referrals')
          .select('referred_by_user_id, first_order_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking referral status:', error);
          return;
        }

        // Only show referral input if:
        // 1. No referral record exists (new user) OR
        // 2. Record exists but first_order_completed is false AND no referrer attached
        if (!data) {
          // New user - eligible
          setIsReferralEligible(true);
        } else if (data.first_order_completed === false && !data.referred_by_user_id) {
          // Existing user who hasn't completed first order and has no referrer
          setIsReferralEligible(true);
        } else {
          // User has completed first order or already has a referrer
          setIsReferralEligible(false);
          if (data.referred_by_user_id && !data.first_order_completed) {
            // Show that referral is already applied
            setReferralApplied(true);
          }
        }
      } catch (err) {
        console.error('Referral check error:', err);
      }
    };

    checkEligibility();
  }, [user?.id]);

  const handleApplyReferral = async () => {
    if (!referralCode.trim()) {
      toast.error('Please enter a referral code');
      return;
    }

    setIsApplyingReferral(true);
    try {
      const { data, error } = await supabase.rpc('attach_referral_code_late', {
        p_user_id: user!.id,
        p_referral_code: referralCode.trim()
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Referral code applied successfully!');
        setReferralApplied(true);
        setShowReferralInput(false);
        setReferralCode('');
      } else {
        if (data.error === 'already_has_referrer_or_first_order') {
          toast.error('Not eligible for referral code');
          setIsReferralEligible(false);
        } else if (data.error === 'invalid_or_self') {
          toast.error('Invalid referral code');
        } else {
          toast.error('Failed to apply referral code');
        }
      }
    } catch (error) {
      console.error('Error applying referral:', error);
      toast.error('Failed to apply referral code');
    } finally {
      setIsApplyingReferral(false);
    }
  };

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

  // Use ref for navigation state to avoid race conditions with empty cart redirect
  // on slower devices where state updates might lag behind context updates
  const isNavigatingRef = useRef(false);


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

  // Sync Convex wallet balance (paise) into local state (rupees)
  const fetchWalletBalance = useCallback(async () => {
    // No-op: balance is fed reactively from the useQuery below.
  }, []);

  useEffect(() => {
    if (convexWallet === undefined) {
      setIsWalletLoading(true);
      return;
    }
    setWalletBalance(convexWallet.balancePaise / 100);
    setIsWalletLoading(false);
  }, [convexWallet]);

  // Ref to hold latest values for fetchSavedAddresses to avoid dependency cycles
  const fetchContextRef = useRef({
    isRetryPayment,
    retryOrder,
    defaultUserName,
    defaultUserPhone
  });

  // Keep ref updated
  useEffect(() => {
    fetchContextRef.current = {
      isRetryPayment,
      retryOrder,
      defaultUserName,
      defaultUserPhone
    };
  });

  // Fetch saved addresses and auto-select (memoized to prevent re-render loops)
  const fetchSavedAddresses = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    // Use ref values to avoid dependency changes
    const { isRetryPayment, retryOrder, defaultUserName, defaultUserPhone } = fetchContextRef.current;
    try {
      // Always fetch saved addresses from database
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
      } else {
        setSavedAddresses([]);
      }

      // If retry payment, use the original shipping address for selection
      if (isRetryPayment && retryOrder?.shippingAddress) {
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
      } else if (addresses && addresses.length > 0) {
        // Auto-select first (most recent) address for normal checkout
        const addressToSelect = addresses[0];
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
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  }, [user?.id]); // Only depend on stable user.id

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

  // Build Convex orderItemV[] from the current items list
  const buildConvexItems = () =>
    items.map((item: any) => {
      const unitRupees = Number(item.variant_price ?? item.combo_price ?? item.price ?? 0);
      return {
        productId: String(item.id),
        variantId: item.variant_id ? String(item.variant_id) : undefined,
        name: String(item.name ?? 'Item'),
        qty: Number(item.quantity ?? 1),
        unitPricePaise: rupeesToPaise(unitRupees),
      };
    });

  // Unified payment handler — creates a Convex order, navigates to /transaction.
  // Convex handles wallet split, UPI URL generation, slot allocation, and verification.
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
    if (!org) {
      toast.error('Store is loading. Please try again in a moment.');
      return;
    }

    const shouldClearCart = !isBuyNow && !isRetryPayment;
    setIsProcessing(true);
    setIsCompletingOrder(true);

    try {
      const address = {
        line1: selectedAddress.address,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        name: selectedAddress.full_name || defaultUserName || 'Customer',
        phone: selectedAddress.phone || defaultUserPhone || '',
      };

      const walletAmountPaise = walletAmountToUse > 0 ? rupeesToPaise(walletAmountToUse) : 0;

      const result = await createConvexOrder({
        orgId: org._id,
        kind: 'purchase',
        items: buildConvexItems(),
        address,
        walletAmountPaise,
      });

      isNavigatingRef.current = true;

      // Open UPI app if we have a URL (skip for wallet-only orders)
      if (result.upiUrl) {
        try {
          window.location.href = result.upiUrl;
        } catch (err) {
          console.error('Failed to open UPI app:', err);
        }
      }

      navigate('/transaction', {
        state: {
          orderId: result.orderId,
          shouldClearCart,
        },
        replace: result.status === 'paid',
      });
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      const code = error?.data?.code ?? error?.message;
      const msg =
        code === 'SLOT_POOL_EXHAUSTED'
          ? 'Too many pending orders at this price — please retry in a few minutes.'
          : code === 'WALLET_INSUFFICIENT'
          ? 'Wallet balance is insufficient.'
          : code === 'ORG_INACTIVE'
          ? 'Store is currently unavailable.'
          : 'Payment failed. Please try again.';
      toast.error(msg);
      setIsCompletingOrder(false);
      isNavigatingRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Wallet-only payment — set slider to full total then submit
  const handleWalletPayment = async () => {
    const finalTotal = getFinalTotal();
    setWalletAmountToUse(finalTotal);
    await handlePayment();
  };

  // QR is just a different rendering of the UPI URL — same backend path
  const handleQRPayment = handlePayment;

  // Load data on mount
  useEffect(() => {
    if (user?.id) {
      fetchWalletBalance();
      // Only fetch addresses if we haven't loaded them yet to prevent re-render loops
      // The AddressDrawer will trigger updates when addresses are added/edited
      if (savedAddresses.length === 0) {
        fetchSavedAddresses();
      }
    }
  }, [user?.id]); // Removed fetch functions from dependency array to break infinite loop

  // Memoized callbacks for AddressDrawer to prevent re-renders
  const handleAddressDrawerOpenChange = useCallback((open: boolean) => {
    setShowAddressDialog(open);
  }, []);

  const handleAddressSelect = useCallback((addr: Address) => {
    setSelectedAddress(addr);
  }, []);

  // Redirect if no items (but not during order completion, navigation, or retry payment)
  useEffect(() => {
    // Check ref directly - safe even if component is unmounting or state is stale
    if (isNavigatingRef.current) return;

    if (items.length === 0 && !isCompletingOrder && !isBuyNow && !isRetryPayment) {
      navigate('/cart');
    }
  }, [items, navigate, isCompletingOrder, isBuyNow, isRetryPayment]);

  // REMOVED: Full page loading state to keep user on checkout page during processing
  // if (isCompletingOrder || isNavigating) {
  //   return (
  //     <div className="min-h-screen bg-background flex items-center justify-center">
  //       ...
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="text-center p-4">
          <h1 className="medium-title leading-tight text-2xl sm:text-3xl">Checkout</h1>
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
                      src={getProductImageUrl(item.image || item.gallery_images?.[0] || item.product_variants?.[0]?.images?.[0])}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = getProductImageUrl(); }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.name}{item.variant_name && ` (${item.variant_name})`}</h4>
                    {getBrandName(item.brand) && <p className="text-xs text-muted-foreground">{getBrandName(item.brand)}</p>}
                    <p className="text-sm font-semibold text-foreground">
                      {formatINR(item.variant_price || item.price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="w-8 h-8 rounded-lg border-2 border-coyote/30 bg-background text-dark hover:bg-dark hover:text-creme-light hover:border-dark transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      onClick={() => handleUpdateQuantity(item.id, Math.max(0, item.quantity - 1), item.variant_id, item.combo_id)}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                    <button
                      className="w-8 h-8 rounded-lg border-2 border-coyote/30 bg-background text-dark hover:bg-dark hover:text-creme-light hover:border-dark transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1, item.variant_id, item.combo_id)}
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

            {/* Referral Code Section - Late Attachment */}
            {(isReferralEligible || referralApplied) && (
              <div className="mb-4 pt-3 border-t border-dashed border-border/40">
                {referralApplied ? (
                  <div className="flex items-center gap-2 text-xs text-green-600 font-medium animate-in fade-in duration-300">
                    <CheckCircle className="w-3 h-3" />
                    <span>Referral code activated</span>
                  </div>
                ) : !showReferralInput ? (
                  <button
                    onClick={() => setShowReferralInput(true)}
                    className="text-sm text-accent hover:text-accent-dark font-medium flex items-center gap-2 transition-colors w-full"
                  >
                    <Gift className="w-4 h-4" />
                    Have a referral code?
                  </button>
                ) : (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                      <Input
                        placeholder="REFERRAL CODE"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="flex-1 uppercase h-9 placeholder:text-xs"
                        maxLength={10}
                      />
                      <Button
                        onClick={handleApplyReferral}
                        variant="secondary"
                        size="sm"
                        disabled={isApplyingReferral || !referralCode.trim()}
                        className="min-w-[70px] h-9 text-xs uppercase font-semibold tracking-wider"
                      >
                        {isApplyingReferral ? '...' : 'Apply'}
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowReferralInput(false)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                ? '✓ Pay with Wallet'
                : `Pay ${formatINR(Math.max(0, getFinalTotal() - walletAmountToUse))}`
            }
          </Button>
        </div>
      </div>

      {/* Payment Methods Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
          </DialogHeader>
          <PaymentMethods
            selectedPaymentMethod={selectedPaymentMethod}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
            setShowPaymentDialog={setShowPaymentDialog}
            handleQRPayment={handleQRPayment}
            handleWalletPayment={handleWalletPayment}
            walletBalance={walletBalance}
            getFinalTotal={getFinalTotal}
          />
        </DialogContent>
      </Dialog>

      {/* Address Drawer */}
      <AddressDrawer
        open={showAddressDialog}
        onOpenChange={handleAddressDrawerOpenChange}
        user={user}
        selectedAddress={selectedAddress}
        onAddressSelect={handleAddressSelect}
        savedAddresses={savedAddresses}
        onAddressesUpdate={fetchSavedAddresses}
      />
    </div>
  );
}
