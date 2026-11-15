import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { convex } from '../../lib/convex/client';
import { useOrg } from '../../lib/convex/useOrg';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { useAddresses } from '../../lib/convex/useAddresses';
import { rupeesToPaise } from '../../lib/convex/money';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { useMyProfile, toPhone10 } from '../../hooks/data/useMyProfile';
import { useShippingMethods } from '../../hooks/data/useContent';
import { useOrderConsent } from '../../hooks/data/useOrderConsent';
import { useInlineStatus } from '../../components/common/InlineStatus';
import type { Address } from '../../components/checkout/address/AddressCard';
import { validateCouponCode } from '../../utils/discounts';
import { trackBeginCheckout, trackPurchase } from '../../lib/analytics/ga';
import { cleanPersonName, isRealPersonName } from '../../lib/profile/personName';

// Checkout state and order placement shared by the desktop CheckoutPage and
// MobileCheckoutPage (flows, totals, lucky, coupon, referral, wallet, consent,
// createOrder args, error codes), so both pages place the same order.

export interface CheckoutModelOptions {
  // Mobile hands off to the UPI app (result.upiUrl) after createOrder.
  // Desktop has no UPI app and goes straight to the QR on /transaction.
  openUpiApp?: boolean;
  // Replace the selected address with the fresh saved row after it is
  // edited. Mobile re-selects the saved address from AddressDrawer instead.
  syncSelectedAddress?: boolean;
}

const normalizeString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

function readJson(key: string): any {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Retry orders carry the address in whatever shape the order stored.
function addressFromRetry(raw: Record<string, unknown>, name: string, phone: string): Address {
  return {
    id: normalizeString(raw.id),
    full_name: normalizeString(raw.full_name) || normalizeString(raw.name) || name,
    phone: normalizeString(raw.phone) || normalizeString(raw.contact) || phone,
    address: normalizeString(raw.address) || normalizeString(raw.line1) || 'Address unavailable',
    pincode: normalizeString(raw.pincode) || normalizeString(raw.zipCode) || normalizeString(raw.postcode) || '000000',
    city: normalizeString(raw.city) || normalizeString(raw.town) || 'Unknown',
    state: normalizeString(raw.state) || normalizeString(raw.region) || 'Unknown',
    country: normalizeString(raw.country) || 'India',
    label: normalizeString(raw.label) || normalizeString(raw.tag) || 'Saved address',
  };
}

export function useCheckoutModel({ openUpiApp = false, syncSelectedAddress = true }: CheckoutModelOptions = {}) {
  const { slug: orgSlug } = useOrgInfo();
  const navigate = useNavigate();
  const { items: cartItems, updateQuantity, totalPrice: cartTotalPrice } = useCart();
  const { user, isLoading: authLoading } = useAuth();
  const org = useOrg();
  const { status: opStatus, setError: setOpError } = useInlineStatus();

  // ---- Flow type: cart, buy now, or retry (URL first, session fallback) ----
  const [urlFlags] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return { retry: p.get('retry') === 'true', buyNow: p.get('buynow') === 'true' };
  });
  const [isBuyNow] = useState(() => urlFlags.buyNow || sessionStorage.getItem('isBuyNow') === 'true');
  const [isRetryPayment] = useState(() => urlFlags.retry || sessionStorage.getItem('isRetryPayment') === 'true');

  // Plain cart checkout: drop stale buy-now / retry data.
  useEffect(() => {
    if (!urlFlags.retry && !urlFlags.buyNow) {
      sessionStorage.removeItem('isRetryPayment');
      sessionStorage.removeItem('retryOrder');
      sessionStorage.removeItem('isBuyNow');
      sessionStorage.removeItem('buyNowItem');
    }
  }, [urlFlags]);

  const [buyNowItem, setBuyNowItem] = useState<any>(() => (isBuyNow ? readJson('buyNowItem') : null));
  const [retryOrder] = useState<any>(() => (isRetryPayment ? readJson('retryOrder') : null));

  // Retry param without session data (e.g. Back after a transaction).
  useEffect(() => {
    if (urlFlags.retry && !retryOrder) {
      setOpError('Retry session expired. Please try again.');
      navigate('/orders');
    }
  }, [urlFlags, retryOrder, navigate, setOpError]);

  const items: any[] = isRetryPayment && retryOrder
    ? retryOrder.items
    : (isBuyNow && buyNowItem ? [buyNowItem] : cartItems);

  const retrySubtotal: number | null = isRetryPayment && retryOrder
    ? (typeof retryOrder.subtotal === 'number'
      ? retryOrder.subtotal
      : retryOrder.total + (retryOrder.discount || 0) - (retryOrder.shipping || 0))
    : null;
  const retryShippingCost: number | null = isRetryPayment && retryOrder ? retryOrder.shipping || 0 : null;
  const retryLuckyDiscount: number | null = isRetryPayment && retryOrder ? retryOrder.discount || 0 : null;
  const retryDisplayOrderId: string | null = isRetryPayment && retryOrder ? retryOrder.displayOrderId || null : null;

  const subtotal: number = retrySubtotal !== null
    ? retrySubtotal
    : (isBuyNow && buyNowItem
      ? (buyNowItem.variant_price || buyNowItem.price) * buyNowItem.quantity
      : cartTotalPrice);

  const updateItemQuantity = async (productId: string, quantity: number, variantId?: string, comboId?: string) => {
    const isBuyNowItem = buyNowItem &&
      buyNowItem.id === productId &&
      (buyNowItem.variant_id || null) === (variantId || null) &&
      (buyNowItem.combo_id || null) === (comboId || null);
    if (isBuyNowItem) {
      if (quantity <= 0) {
        sessionStorage.removeItem('buyNowItem');
        sessionStorage.removeItem('isBuyNow');
        navigate(-1);
        return;
      }
      const updated = { ...buyNowItem, quantity };
      setBuyNowItem(updated);
      sessionStorage.setItem('buyNowItem', JSON.stringify(updated));
      return;
    }
    await updateQuantity(productId, quantity, variantId, comboId);
  };

  // GA4 begin_checkout, once per entry.
  const checkoutTrackedRef = useRef(false);
  useEffect(() => {
    if (checkoutTrackedRef.current || items.length === 0) return;
    checkoutTrackedRef.current = true;
    trackBeginCheckout(items, Number(subtotal ?? 0));
  }, [items, subtotal]);

  // ---- Lucky discount: 1–99 paise, kept from the source order on retry ----
  const luckyOn = (org as any)?.luckyEnabled ?? true;
  const [randomDiscount] = useState(() => {
    if (retryLuckyDiscount !== null) return retryLuckyDiscount;
    const paise = Math.floor(Math.random() * 99) + 1;
    return Math.max(0.01, Math.min(0.99, paise / 100));
  });
  const luckyDiscount = isRetryPayment ? randomDiscount : luckyOn ? randomDiscount : 0;

  // ---- Shipping (admin-configured methods) ----
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const { methods: shippingMethods } = useShippingMethods();
  const activeShippingId = shippingMethods.some((m) => m.id === selectedShipping)
    ? selectedShipping
    : (shippingMethods[0]?.id ?? 'standard');
  const getShippingCost = () =>
    retryShippingCost !== null
      ? retryShippingCost
      : shippingMethods.find((m) => m.id === activeShippingId)?.priceRupees ?? 0;

  // ---- Coupon ----
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      setOpError('Please enter a coupon code');
      return;
    }
    setIsValidatingCoupon(true);
    try {
      const result = await validateCouponCode(orgSlug, couponCode.trim());
      if (result.isValid && result.discount) {
        setAppliedDiscount(result.discount);
      } else {
        setOpError(result.message || 'Invalid coupon code');
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setOpError('Failed to validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const getFinalTotal = () => {
    const coupon = appliedDiscount?.discount_amount ?? appliedDiscount?.discount_value ?? 0;
    return Math.max(0, subtotal + getShippingCost() - (luckyDiscount + coupon));
  };

  // ---- Referral (late attachment for new customers) ----
  const [referralCode, setReferralCode] = useState('');
  const [isReferralEligible, setIsReferralEligible] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    convex
      .query(api.referrals.checkEligibility, { orgSlug })
      .then((gate: any) => {
        if (cancelled) return;
        setIsReferralEligible(!!gate.eligible);
        if (!gate.eligible && gate.applied) setReferralApplied(true);
      })
      .catch((err: unknown) => console.error('Referral check error:', err));
    return () => { cancelled = true; };
  }, [user?.id, orgSlug]);

  const applyReferral = async (): Promise<boolean> => {
    if (!referralCode.trim()) {
      setOpError('Please enter a referral code');
      return false;
    }
    setIsApplyingReferral(true);
    try {
      const data = await convex.mutation(api.referrals.attachReferralLate, {
        orgSlug,
        referredUserId: user!.id,
        referralCode: referralCode.trim(),
      });
      if (data.success) {
        setReferralApplied(true);
        setReferralCode('');
        return true;
      }
      if (data.error === 'User already referred') {
        setOpError('Not eligible for referral code');
        setIsReferralEligible(false);
      } else if (data.error === 'Invalid referral code' || data.error === 'Cannot refer yourself') {
        setOpError('Invalid referral code');
      } else {
        setOpError('Failed to apply referral code');
      }
    } catch (error) {
      console.error('Error applying referral:', error);
      setOpError('Failed to apply referral code');
    } finally {
      setIsApplyingReferral(false);
    }
    return false;
  };

  // ---- Wallet (Convex balance in paise, UI in rupees) ----
  const convexWallet = useQuery(api.wallet.getMyBalance, org && user ? { orgId: org._id } : 'skip');
  const walletBalance = convexWallet ? convexWallet.balancePaise / 100 : 0;
  const isWalletLoading = !!user && convexWallet === undefined;
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);

  // ---- Address ----
  const { profileName, profilePhone10 } = useMyProfile();
  const defaultUserName = profileName || normalizeString(user?.name) || '';
  const defaultUserPhone = profilePhone10 || toPhone10(user?.phone);
  const { addresses: savedAddresses, isLoading: addressesLoading, fetchNow: fetchAddressesNow } = useAddresses(user);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const addressInitRef = useRef(false);

  // Pick once: retry keeps its original address; otherwise explicit default,
  // else newest (listAddresses is oldest-first). Same rule as mobile.
  useEffect(() => {
    if (addressInitRef.current || !user) return;
    if (isRetryPayment && retryOrder?.shippingAddress) {
      addressInitRef.current = true;
      setSelectedAddress(addressFromRetry(retryOrder.shippingAddress, defaultUserName, defaultUserPhone));
      return;
    }
    if (addressesLoading || savedAddresses.length === 0) return;
    addressInitRef.current = true;
    const pick = savedAddresses.find((r) => r.is_default) ?? savedAddresses[savedAddresses.length - 1];
    setSelectedAddress({ ...pick, country: pick.country || 'India' });
  }, [user, addressesLoading, savedAddresses, isRetryPayment, retryOrder, defaultUserName, defaultUserPhone]);

  // Keep the selected card in sync after an edit of that address.
  useEffect(() => {
    if (!syncSelectedAddress || !selectedAddress?.id) return;
    const fresh = savedAddresses.find((a) => a.id === selectedAddress.id);
    if (fresh && (fresh.address !== selectedAddress.address || fresh.full_name !== selectedAddress.full_name
      || fresh.phone !== selectedAddress.phone || fresh.pincode !== selectedAddress.pincode
      || fresh.label !== selectedAddress.label)) {
      setSelectedAddress({ ...fresh, country: fresh.country || 'India' });
    }
  }, [syncSelectedAddress, savedAddresses, selectedAddress]);

  // ---- Consent (one-time declaration before a first order) ----
  const orderConsent = useOrderConsent(org?._id, !!user);
  const [consentSheetOpen, setConsentSheetOpen] = useState(false);
  const consentConfirmedRef = useRef(false);

  // ---- Order placement ----
  const createConvexOrder = useMutation(api.orders.createOrder);
  const paymentIdempotencyKeyRef = useRef<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isNavigatingRef = useRef(false);
  // Set when the address step needs attention (no address, missing name).
  const [addressAttention, setAddressAttention] = useState(0);

  const placeOrder = async () => {
    if (!selectedAddress) {
      setOpError('Please select a delivery address');
      setAddressAttention((n) => n + 1);
      return;
    }
    if (!isRealPersonName(selectedAddress.full_name)) {
      setOpError('Add your full name to the delivery address before placing the order.');
      setAddressAttention((n) => n + 1);
      return;
    }
    if (!user) {
      setOpError('Please sign in to continue');
      return;
    }
    if (!org) {
      setOpError('Store is loading. Please try again in a moment.');
      return;
    }
    if (orderConsent.needed && !consentConfirmedRef.current) {
      setConsentSheetOpen(true);
      return;
    }

    const shouldClearCart = !isBuyNow && !isRetryPayment;
    setIsProcessing(true);
    try {
      const idempotencyKey = paymentIdempotencyKeyRef.current ??= (
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      const couponName = appliedDiscount?.discount_name || appliedDiscount?.name;
      const result = await createConvexOrder({
        orgSlug,
        orgId: org._id,
        kind: 'purchase',
        // Unit prices are snapshots; the server re-prices from the catalog.
        items: items.map((item: any) => ({
          productId: String(item.id),
          variantId: item.variant_id ? String(item.variant_id) : undefined,
          name: String(item.name ?? 'Item'),
          qty: Number(item.quantity ?? 1),
          unitPricePaise: rupeesToPaise(Number(item.variant_price ?? item.combo_price ?? item.price ?? 0)),
        })),
        address: {
          line1: selectedAddress.address,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          name: cleanPersonName(selectedAddress.full_name || defaultUserName),
          phone: selectedAddress.phone || defaultUserPhone || '',
        },
        idempotencyKey,
        walletAmountPaise: walletAmountToUse > 0 ? rupeesToPaise(walletAmountToUse) : 0,
        discountId: appliedDiscount?.discount_id ?? undefined,
        discountLabel: couponName ?? undefined,
        // Lucky 1–99p: visible discount + server-side payment fingerprint.
        luckyPaise: rupeesToPaise(luckyDiscount),
        shippingMethod: activeShippingId,
        shippingPricePaise: rupeesToPaise(getShippingCost()),
      });

      isNavigatingRef.current = true;
      trackPurchase(String(result.orderId), Number(subtotal ?? 0), items);

      // Mobile: open the UPI app (skipped for wallet-only orders). Desktop
      // goes straight to the transaction page, which shows the QR.
      if (openUpiApp && result.upiUrl) {
        try {
          window.location.href = result.upiUrl;
        } catch (err) {
          console.error('Failed to open UPI app:', err);
        }
      }

      sessionStorage.setItem('pendingOrderId', String(result.orderId));
      navigate(`/transaction/${result.orderId}`, {
        state: { orderId: result.orderId, shouldClearCart },
        replace: result.status === 'paid',
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      const code = error?.data?.code ?? error?.message;
      if (code === 'CONSENT_REQUIRED') {
        consentConfirmedRef.current = false;
        setConsentSheetOpen(true);
        return;
      }
      setOpError(
        code === 'SLOT_POOL_EXHAUSTED' || code === 'LUCKY_POOL_EXHAUSTED'
          ? 'Too many pending orders at this price — please retry in a few minutes.'
          : code === 'NAME_REQUIRED'
          ? 'Add your full name to the delivery address before placing the order.'
          : code === 'WALLET_INSUFFICIENT'
          ? 'Wallet balance is insufficient.'
          : code === 'ORG_INACTIVE'
          ? 'Store is currently unavailable.'
          : 'Payment failed. Please try again.',
      );
      isNavigatingRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmConsent = async () => {
    await orderConsent.confirm();
    consentConfirmedRef.current = true;
    setConsentSheetOpen(false);
    await placeOrder();
  };

  // Empty cart → back to the cart (not while placing, buying now, or retrying).
  useEffect(() => {
    if (isNavigatingRef.current) return;
    if (items.length === 0 && !isProcessing && !isBuyNow && !isRetryPayment) {
      navigate('/cart');
    }
  }, [items, navigate, isProcessing, isBuyNow, isRetryPayment]);

  const amountDue = Math.max(0, getFinalTotal() - walletAmountToUse);

  // A customer's own pick is never replaced by the automatic first pick.
  const selectAddress = useCallback((addr: Address) => {
    addressInitRef.current = true;
    setSelectedAddress(addr);
  }, []);

  // Re-read saved addresses now (AddressDrawer awaits this after a save).
  const refreshAddresses = useCallback(async () => {
    await fetchAddressesNow();
  }, [fetchAddressesNow]);

  return {
    user, authLoading, opStatus,
    isRetryPayment, retryDisplayOrderId,
    items, subtotal, updateItemQuantity,
    luckyDiscount,
    activeShippingId, setSelectedShipping, getShippingCost,
    couponCode, setCouponCode, appliedDiscount, isValidatingCoupon, applyCoupon,
    referral: {
      visible: isReferralEligible || referralApplied,
      applied: referralApplied,
      code: referralCode,
      setCode: setReferralCode,
      isApplying: isApplyingReferral,
      apply: applyReferral,
    },
    walletBalance, isWalletLoading, walletAmountToUse, setWalletAmountToUse,
    savedAddresses: savedAddresses as Address[], addressesLoading, selectedAddress, selectAddress, refreshAddresses, addressAttention,
    consentSheetOpen, setConsentSheetOpen, confirmConsent,
    getFinalTotal, amountDue, isProcessing, placeOrder,
  };
}

export type CheckoutModel = ReturnType<typeof useCheckoutModel>;
