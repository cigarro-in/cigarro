import { useState } from 'react';
import { CheckCircle, Lock } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { OrderSummary } from '../../../components/checkout';
import { formatINR } from '../../../utils/currency';
import { STORE_CLOSED_MESSAGE, type CheckoutModel } from '../useCheckoutModel';

// Sticky right column: offers, totals (shared OrderSummary: lucky, coupon,
// shipping, wallet) and the one Pay button.
export function SummaryAside({ model }: { model: CheckoutModel }) {
  const {
    user, items, subtotal, luckyDiscount, isRetryPayment, retryOrderNumber,
    appliedDiscount, couponCode, setCouponCode, isValidatingCoupon, applyCoupon,
    referral, getShippingCost, getFinalTotal,
    walletBalance, isWalletLoading, walletAmountToUse, setWalletAmountToUse,
    selectedAddress, amountDue, isProcessing, placeOrder, storeClosed,
  } = model;
  const [referralOpen, setReferralOpen] = useState(false);

  const payLabel = isProcessing
    ? 'Placing order…'
    : amountDue <= 0
      ? 'Pay with wallet'
      : `Pay ${formatINR(amountDue)}`;

  return (
    <aside className="sticky top-24 space-y-4">
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-5 text-base font-semibold text-foreground">Order summary</h2>

        {/* Coupon */}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void applyCoupon();
          }}
        >
          <Input
            placeholder="Coupon code"
            aria-label="Coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="h-10 flex-1"
          />
          <Button type="submit" variant="outline" className="h-10" disabled={isValidatingCoupon || !couponCode.trim()}>
            {isValidatingCoupon ? 'Checking…' : 'Apply'}
          </Button>
        </form>
        {appliedDiscount && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-3.5 w-3.5" />
            {appliedDiscount.discount_name || 'Coupon'} applied
          </p>
        )}

        {/* Referral (new customers only) */}
        {referral.visible && (
          <div className="mt-3">
            {referral.applied ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                <CheckCircle className="h-3.5 w-3.5" /> Referral code activated
              </p>
            ) : referralOpen ? (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await referral.apply()) setReferralOpen(false);
                }}
              >
                <Input
                  placeholder="Referral code"
                  aria-label="Referral code"
                  value={referral.code}
                  onChange={(e) => referral.setCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="h-10 flex-1 uppercase"
                  autoFocus
                />
                <Button type="submit" variant="outline" className="h-10" disabled={referral.isApplying || !referral.code.trim()}>
                  {referral.isApplying ? 'Applying…' : 'Apply'}
                </Button>
                <Button type="button" variant="ghost" className="h-10 px-2 text-muted-foreground" onClick={() => setReferralOpen(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setReferralOpen(true)}
                className="text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Have a referral code?
              </button>
            )}
          </div>
        )}

        <div className="my-5 border-t border-border" />

        <OrderSummary
          items={items}
          totalPrice={subtotal}
          randomDiscount={luckyDiscount}
          isRetryPayment={isRetryPayment}
          retryOrderNumber={retryOrderNumber}
          appliedDiscount={appliedDiscount}
          getShippingCost={getShippingCost}
          getFinalTotal={getFinalTotal}
          user={user}
          walletBalance={walletBalance}
          walletAmountToUse={walletAmountToUse}
          setWalletAmountToUse={setWalletAmountToUse}
        />
        {isWalletLoading && <Skeleton className="mt-3 h-6 w-40 bg-muted" />}

        {storeClosed && (
          <p className="mt-3 text-center text-sm text-muted-foreground" role="status">
            {STORE_CLOSED_MESSAGE}
          </p>
        )}
        <Button
          onClick={() => void placeOrder()}
          disabled={isProcessing || !selectedAddress || storeClosed}
          aria-busy={isProcessing}
          className="mt-6 h-12 w-full rounded-lg bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {payLabel}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          {selectedAddress ? (
            <>
              <Lock className="h-3 w-3" />
              {amountDue <= 0 ? 'Paid from your wallet balance.' : 'Pay with any UPI app. The QR code opens next.'}
            </>
          ) : (
            'Add a delivery address to continue.'
          )}
        </p>
      </div>
    </aside>
  );
}
