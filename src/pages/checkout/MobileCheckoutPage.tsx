import { useState, useEffect, useCallback } from 'react';
import { Tag, MapPin, Gift, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { QuantityStepper } from '../../components/cart/QuantityStepper';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { OrderSummary, ShippingOptions } from '../../components/checkout';
import { AddressDrawer } from '../../components/checkout/address/AddressDrawer';
import { InlineStatus } from '../../components/common/InlineStatus';
import { formatINR } from '../../utils/currency';
import { getProductImageUrl } from '../../lib/images/urls';
import { OrderConsentSheet } from '../../components/checkout/OrderConsentSheet';
import { useCheckoutModel } from './useCheckoutModel';

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


// Mobile checkout. State and order placement live in useCheckoutModel
// (shared with the desktop CheckoutPage); this file is layout only.
export function MobileCheckoutPage() {
  const {
    user, opStatus,
    isRetryPayment, retryDisplayOrderId,
    items, subtotal: totalPrice, updateItemQuantity: handleUpdateQuantity,
    luckyDiscount,
    activeShippingId, setSelectedShipping, getShippingCost,
    couponCode, setCouponCode, appliedDiscount, isValidatingCoupon, applyCoupon: handleApplyCoupon,
    referral,
    walletBalance, walletAmountToUse, setWalletAmountToUse,
    savedAddresses, selectedAddress, selectAddress: handleAddressSelect, refreshAddresses, addressAttention,
    consentSheetOpen, setConsentSheetOpen, confirmConsent: handleConsentConfirm,
    getFinalTotal, isProcessing, placeOrder: handlePayment,
  } = useCheckoutModel({ openUpiApp: true, syncSelectedAddress: false });
  const {
    visible: showReferral,
    applied: referralApplied,
    code: referralCode,
    setCode: setReferralCode,
    isApplying: isApplyingReferral,
  } = referral;

  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);

  // No address, or a name missing on it: open the address drawer.
  useEffect(() => {
    if (addressAttention > 0) setShowAddressDialog(true);
  }, [addressAttention]);

  const handleApplyReferral = async () => {
    if (await referral.apply()) setShowReferralInput(false);
  };

  // Memoized callback for AddressDrawer to prevent re-renders
  const handleAddressDrawerOpenChange = useCallback((open: boolean) => {
    setShowAddressDialog(open);
  }, []);

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
        <InlineStatus status={opStatus} />
        {/* Items Card */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <h3 className="font-serif text-lg mb-4">Order Items ({items.length})</h3>
            <div className="space-y-4">
              {items.map((item: any) => (
                <div key={`${item.id}-${item.variant_id || 'default'}-${item.combo_id || 'none'}`} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border/20">
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

                  <QuantityStepper
                    quantity={item.quantity}
                    onChange={(next) => handleUpdateQuantity(item.id, next, item.variant_id, item.combo_id)}
                    min={0}
                    size="lg"
                    className="gap-2"
                    buttonClassName="rounded-lg border-2 border-coyote/30 bg-background text-dark hover:bg-dark hover:text-creme-light hover:border-dark active:scale-95"
                    valueClassName="text-foreground"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Options */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <ShippingOptions
              selectedShipping={activeShippingId}
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
            {showReferral && (
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
              randomDiscount={luckyDiscount}
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

      <OrderConsentSheet
        open={consentSheetOpen}
        onOpenChange={setConsentSheetOpen}
        onConfirm={handleConsentConfirm}
      />

      {/* Address Drawer */}
      <AddressDrawer
        open={showAddressDialog}
        onOpenChange={handleAddressDrawerOpenChange}
        user={user}
        selectedAddress={selectedAddress}
        onAddressSelect={handleAddressSelect}
        savedAddresses={savedAddresses}
        onAddressesUpdate={refreshAddresses}
      />
    </div>
  );
}
