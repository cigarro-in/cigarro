import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { OrderConsentSheet } from '../../components/checkout/OrderConsentSheet';
import { InlineStatus } from '../../components/common/InlineStatus';
import { useAuthDialog } from '../../hooks/useAuth';
import { useCheckoutModel } from './useCheckoutModel';
import { AddressSection } from './desktop/AddressSection';
import { ItemsSection } from './desktop/ItemsSection';
import { DeliverySection } from './desktop/DeliverySection';
import { SummaryAside } from './desktop/SummaryAside';

// Desktop checkout. Same steps, data and order placement as
// MobileCheckoutPage (see useCheckoutModel.ts); laid out as stacked
// steps on the left and a sticky summary with the Pay button on the right.
export function CheckoutPage() {
  const model = useCheckoutModel();
  const { user, authLoading, opStatus, isRetryPayment, retryOrderNumber } = model;
  const { requestAuth } = useAuthDialog();
  const navigate = useNavigate();

  // Signed out: open the global sign-in dialog once auth has settled.
  useEffect(() => {
    if (authLoading || user) return;
    const timer = setTimeout(() => requestAuth(), 100);
    return () => clearTimeout(timer);
  }, [user, authLoading, requestAuth]);

  return (
    <>
      <Helmet>
        <title>Checkout</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <Link
                to="/cart"
                className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to cart
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Checkout</h1>
              {isRetryPayment && retryOrderNumber && (
                <p className="mt-1 text-sm text-muted-foreground">Paying again for order {retryOrderNumber}</p>
              )}
            </div>
          </div>

          {authLoading ? (
            <CheckoutSkeleton />
          ) : !user ? (
            <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
              <Lock className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Sign in to check out</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your cart is saved. Sign in with your phone number to choose an address and pay.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Button onClick={() => requestAuth()} className="h-11 bg-accent text-accent-foreground hover:bg-accent/90">
                  Sign in
                </Button>
                <Button variant="ghost" onClick={() => navigate('/products')} className="h-11">
                  Keep browsing
                </Button>
              </div>
            </div>
          ) : (
            <>
              {opStatus.kind && (
                <div className="mb-6">
                  <InlineStatus status={opStatus} />
                </div>
              )}
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                  <AddressSection model={model} />
                  <DeliverySection model={model} step={2} />
                  <ItemsSection model={model} step={3} />
                </div>
                <SummaryAside model={model} />
              </div>
            </>
          )}
        </div>
      </div>

      <OrderConsentSheet
        open={model.consentSheetOpen}
        onOpenChange={model.setConsentSheetOpen}
        onConfirm={model.confirmConsent}
      />
    </>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl bg-muted" />
        <Skeleton className="h-40 rounded-xl bg-muted" />
        <Skeleton className="h-56 rounded-xl bg-muted" />
      </div>
      <Skeleton className="h-96 rounded-xl bg-muted" />
    </div>
  );
}
