import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Check, Smartphone, RefreshCw, Wallet, X, Clock, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useOrg } from '../../lib/convex/useOrg';
import { formatPaiseINR } from '../../lib/convex/money';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';

interface TransactionState {
  orderId: Id<'orders'>;
  shouldClearCart?: boolean;
}

const looksLikeOrderId = (v: string) => /^[A-Za-z0-9]{8,}$/.test(v);

// Transaction-owned fullscreen shell: min-h-[100dvh] + safe-area padding.
// Bottom nav is hidden on /transaction in both shells, so bottom padding is
// just breathing room. overflow-y-auto stays as the short-viewport / zoom /
// keyboard fallback; overflow-x-clip stops the decorative blur (wider than
// small phones) from causing horizontal scroll. Never overflow-hidden.
const PAGE_SHELL =
  'min-h-[100dvh] overflow-y-auto overflow-x-clip bg-creme flex flex-col items-center px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]';

export function TransactionProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId: orderIdParam } = useParams();
  const { user } = useAuth();
  const { clearCart } = useCart();

  const state = location.state as TransactionState | null;
  const storedOrderId = sessionStorage.getItem('pendingOrderId');
  // Persistent route wins, then navigation state, then session fallback.
  const rawOrderId = orderIdParam ?? state?.orderId ?? storedOrderId ?? null;
  const malformed = rawOrderId != null && !looksLikeOrderId(String(rawOrderId));
  const orderId = malformed ? null : (rawOrderId as Id<'orders'> | null);

  const org = useOrg();
  const order = useQuery(
    api.orders.getMine,
    orderId ? { orderId } : 'skip',
  );

  const [qrCode, setQrCode] = useState<string>('');
  const [now, setNow] = useState(() => Date.now());
  const [refreshCount, setRefreshCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const MAX_MANUAL_REFRESH = 5;

  // Persist the route param so a refresh keeps context; bare /transaction
  // falls back to navigation state then session. No order id at all → home.
  // Malformed / not-owned ids render a safe inline state below, never a loop.
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (orderIdParam && looksLikeOrderId(orderIdParam)) sessionStorage.setItem('pendingOrderId', orderIdParam);
    else if (state?.orderId) sessionStorage.setItem('pendingOrderId', String(state.orderId));
    else if (!storedOrderId) navigate('/');
  }, [orderIdParam, state?.orderId, storedOrderId, user, navigate]);

  // Clear cart exactly once after mount (order-creation path). Ref-guarded,
  // not dep-guarded: clearCart identity changes per render and re-firing the
  // timeout stacked duplicate clears in the log storm.
  const clearedRef = useRef(false);
  useEffect(() => {
    if (!state?.shouldClearCart || clearedRef.current) return;
    clearedRef.current = true;
    const t = setTimeout(() => {
      clearCart().catch((err) => console.error('clearCart error', err));
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.shouldClearCart]);

  // Tick every second for countdown
  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [order?.status]);

  // Generate QR when we have a UPI URL
  useEffect(() => {
    if (!order?.upiUrl) return;
    QRCode.toDataURL(order.upiUrl)
      .then(setQrCode)
      .catch((err) => console.error('QR error', err));
  }, [order?.upiUrl]);

  // Clean up Buy-Now / retry session flags once a terminal state is reached
  useEffect(() => {
    if (!order) return;
    if (['paid', 'late_paid', 'expired', 'cancelled', 'refunded', 'voided'].includes(order.status)) {
      sessionStorage.removeItem('buyNowItem');
      sessionStorage.removeItem('isBuyNow');
      sessionStorage.removeItem('retryOrder');
      sessionStorage.removeItem('isRetryPayment');
      sessionStorage.removeItem('pendingOrderId');
    }
  }, [order?.status]);

  // ---------- Wake-on-return + refresh button ----------
  const lastPokeRef = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const wakeMutation = useMutation(api.gmail.wake);
  const retryMutation = useMutation(api.orders.retryOrder);
  // Returns true when a wake was actually sent (false = throttled) so the
  // manual-refresh counter only burns on real polls.
  const pokeWake = useCallback(
    async (source: 'wake' | 'refresh'): Promise<boolean> => {
      if (!orderId) return false;
      const now = Date.now();
      if (source === 'refresh' && now - lastPokeRef.current < 60_000) return false;
      if (source === 'wake' && now - lastPokeRef.current < 30_000) return false;
      lastPokeRef.current = now;
      try {
        await wakeMutation({ orderId, source });
      } catch (_) {
        /* non-fatal */
      }
      return true;
    },
    [orderId, wakeMutation],
  );

  // Visibility change: customer returns to tab after UPI app → poke immediately
  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void pokeWake('wake');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [order?.status, pokeWake]);

  const handleRefresh = useCallback(async () => {
    if (refreshCount >= MAX_MANUAL_REFRESH) return;
    setRefreshing(true);
    const poked = await pokeWake('refresh');
    if (poked) setRefreshCount((c) => c + 1);
    setTimeout(() => setRefreshing(false), 2000);
  }, [pokeWake, refreshCount]);

  // Reopen recovery: expired/cancelled orders get a fresh UPI attempt via
  // retryOrder (new order, new fingerprint), then land back here.
  const handleRetry = useCallback(async () => {
    if (!orderId || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const result = await retryMutation({ oldOrderId: orderId });
      setRetrying(false);
      sessionStorage.setItem('pendingOrderId', String(result.orderId));
      navigate(`/transaction/${result.orderId}`);
    } catch (e: unknown) {
      const err = e as { data?: { code?: string }; message?: string };
      setRetryError(err?.data?.code ?? err?.message ?? 'Retry failed');
      setRetrying(false);
    }
  }, [orderId, retrying, retryMutation, navigate]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // --- Loading state (waiting on order fetch) ---
  // order === undefined = loading; null = not found / not owned (safe UI below).
  if (order === undefined || !org) {
    return (
      <div className={PAGE_SHELL}>
        <div className="m-auto animate-pulse text-coyote font-sans">Loading transaction…</div>
      </div>
    );
  }

  // --- Invalid / not-owned order: safe inline state, no redirect loop ---
  if (malformed || order === null) {
    return (
      <div className={PAGE_SHELL}>
        <div className="m-auto text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <X className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-serif text-dark mb-2">Order not found</h2>
          <p className="text-coyote mb-5 text-sm leading-relaxed px-4">
            {malformed
              ? 'This payment link looks invalid. Please start again from your orders.'
              : 'This order isn’t available on this account. It may belong to a different number.'}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/orders')}
              className="w-full bg-dark text-creme-light hover:bg-canyon h-14 rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Go to Orders
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full text-coyote hover:text-dark"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isWalletOnly = order.verificationMethod === 'wallet_only';
  const amountPaise = order.finalAmountPaise > 0 ? order.finalAmountPaise : order.cartTotalPaise;
  // Five-digit customer order number; legacy rows fall back to displayOrderId.
  const rawNumber = (order as unknown as { orderNumber?: unknown }).orderNumber;
  const orderNumber =
    typeof rawNumber === 'number' && Number.isInteger(rawNumber) && rawNumber >= 10000 && rawNumber <= 99999
      ? rawNumber
      : null;
  const orderLabel = orderNumber ? `#${orderNumber}` : `#${order.displayOrderId}`;
  // Download reuses the already-generated QR data URL — same pixels, same
  // server-generated UPI URL. Never regenerate with different params.
  const qrFilename = `cigarro-order-${orderNumber ?? order.displayOrderId}-upi-qr.png`;
  const qrDownloadSupported =
    typeof document !== 'undefined' && 'download' in document.createElement('a');
  // Explicit UPI app choices: same params, app-specific scheme so the OS
  // opens the chosen app directly.
  const upiQuery = order.upiUrl?.split('?')[1] ?? '';
  const upiAppLinks = [
    { label: 'GPay', url: `tez://upi/pay?${upiQuery}` },
    { label: 'PhonePe', url: `phonepe://pay?${upiQuery}` },
    { label: 'Paytm', url: `paytmmp://pay?${upiQuery}` },
  ];
  const refreshExhausted = refreshCount >= MAX_MANUAL_REFRESH;
  // Fall back to the 10-min server default so the countdown never NaNs when
  // the org row hasn't loaded or predates the slotTimeoutMs field.
  const timeoutAt = order.createdAt + (org.slotTimeoutMs ?? 10 * 60 * 1000);
  const timeLeft = Math.max(0, Math.floor((timeoutAt - now) / 1000));

  // --- SUCCESS ---
  if (order.status === 'paid' || order.status === 'late_paid') {
    return (
      <div className={`${PAGE_SHELL} relative`}>
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-canyon/30"
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{
              x: (Math.random() - 0.5) * 500,
              y: (Math.random() - 0.5) * 500,
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{ duration: 2, ease: 'easeOut', delay: 0.1 }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="w-full max-w-sm relative z-10 m-auto"
        >
          <div className="bg-creme-light border border-coyote rounded-t-3xl p-5 text-center relative shadow-2xl">
            <div className="relative mb-4 mx-auto w-14 h-14 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 bg-green-500/20 rounded-full"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <div className="w-14 h-14 bg-green-100 text-green-700 rounded-full flex items-center justify-center shadow-inner relative z-10">
                <Check className="w-7 h-7" strokeWidth={3} />
              </div>
            </div>

            <h1 className="text-2xl font-serif text-dark mb-1">Payment Successful</h1>
            <p className="text-coyote text-sm mb-4">Your order has been confirmed</p>

            <div className="border-t border-b border-dashed border-coyote/30 py-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-coyote text-sm font-medium">Amount Paid</span>
                <span className="text-dark font-mono font-bold text-xl">{formatPaiseINR(amountPaise)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-coyote text-sm font-medium">Order</span>
                <span className="text-dark font-mono font-bold text-lg">{orderLabel}</span>
              </div>
            </div>
          </div>

          <div className="bg-creme-light border-x border-b border-coyote rounded-b-3xl p-4 relative">
            <div className="absolute top-[-10px] left-[-10px] w-5 h-5 bg-creme rounded-full border-r border-b border-coyote z-20" />
            <div className="absolute top-[-10px] right-[-10px] w-5 h-5 bg-creme rounded-full border-l border-b border-coyote z-20" />
            <div className="absolute top-[-1px] left-4 right-4 border-t-2 border-dashed border-coyote/30" />

            <Button
              onClick={() => navigate('/orders')}
              className="w-full bg-dark text-creme-light hover:bg-canyon h-14 rounded-xl font-medium mb-3 shadow-lg transition-transform active:scale-95"
            >
              Track Order
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full text-coyote hover:text-dark hover:bg-creme transition-colors"
            >
              Continue Shopping
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- EXPIRED / CANCELLED / FAILED ---
  if (order.status === 'expired' || order.status === 'cancelled' || order.status === 'refunded' || order.status === 'voided') {
    const isExpired = order.status === 'expired';
    const canRetry = order.status === 'expired' || order.status === 'cancelled';
    return (
      <div className={PAGE_SHELL}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm w-full m-auto"
        >
          <div className={`w-16 h-16 ${isExpired ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg`}>
            {isExpired ? <Clock className="w-8 h-8" strokeWidth={2.5} /> : <X className="w-8 h-8" strokeWidth={2.5} />}
          </div>

          <h2 className="text-2xl font-serif text-dark mb-2">
            {isExpired ? 'Payment Timed Out' : 'Payment Not Completed'}
          </h2>
          <p className="text-coyote mb-2 text-sm leading-relaxed px-4">
            {isExpired
              ? "We didn't receive your payment in time. If money was deducted, it will arrive shortly and we'll credit your wallet."
              : 'Your order was cancelled. Any wallet debit has been refunded.'}
          </p>
          <p className="text-xs text-coyote mb-5 font-mono">Order {orderLabel}</p>

          <div className="space-y-3">
            {canRetry && (
              <Button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full bg-dark text-creme-light hover:bg-canyon h-14 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Creating fresh payment…' : 'Retry payment'}
              </Button>
            )}
            {retryError && (
              <p className="text-sm text-red-600">Couldn't restart payment ({retryError}). Try again from Orders.</p>
            )}
            <Button
              onClick={() => navigate('/orders')}
              className={`w-full h-14 rounded-xl shadow-lg transition-transform active:scale-95 ${canRetry ? 'bg-transparent border border-coyote/30 text-dark hover:bg-creme-light' : 'bg-dark text-creme-light hover:bg-canyon'}`}
            >
              Retry from Orders
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/cart')}
              className="w-full text-coyote hover:text-dark"
            >
              Back to Cart
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- PENDING (UPI / QR) ---
  return (
    <div className={`${PAGE_SHELL} relative`}>
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-canyon/5 rounded-full blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="z-10 w-full max-w-sm text-center space-y-4 m-auto">
        <div className="relative flex justify-center">
          <motion.div
            className="w-14 h-14 rounded-full border-4 border-coyote/20 flex items-center justify-center bg-creme-light shadow-xl"
            animate={{
              borderColor: ['rgba(195,175,159,0.2)', 'rgba(140,70,48,0.5)', 'rgba(195,175,159,0.2)'],
              boxShadow: [
                '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                '0 25px 50px -12px rgba(140, 70, 48, 0.25)',
                '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isWalletOnly ? <Wallet className="w-6 h-6 text-canyon" /> : <Smartphone className="w-6 h-6 text-canyon" />}
          </motion.div>
        </div>

        <div className="space-y-3">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-serif text-dark"
          >
            Awaiting Payment
          </motion.h2>
          <p className="text-coyote font-sans text-sm">
            Approve the request in your UPI app. We'll confirm automatically.
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-flex items-center gap-2 bg-canyon/10 px-3 py-1 rounded-full text-canyon font-mono font-medium text-sm mt-2"
          >
            <Clock className="w-3.5 h-3.5" />
            {formatTime(timeLeft)}
          </motion.div>
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/50 border border-coyote/20 rounded-2xl p-4 backdrop-blur-sm shadow-sm"
        >
          <p className="text-xs text-coyote uppercase tracking-widest font-bold mb-1">Pay exactly</p>
          <p className="text-3xl font-mono tracking-tighter text-dark break-all">{formatPaiseINR(amountPaise)}</p>
          <p className="text-xs text-coyote mt-2 font-mono">Order {orderLabel}</p>
        </motion.div>

        <div className="space-y-3">
          {order.upiUrl && (
            <>
              <p className="text-xs text-coyote font-medium">Choose how to pay</p>
              <div className="grid grid-cols-2 gap-2">
                {upiAppLinks.map((app) => (
                  <button
                    key={app.label}
                    onClick={() => (window.location.href = app.url)}
                    className="h-11 rounded-xl border border-coyote/30 bg-white/60 text-sm font-bold text-dark hover:border-canyon hover:text-canyon transition-colors"
                  >
                    {app.label}
                  </button>
                ))}
                <button
                  onClick={() => (window.location.href = order.upiUrl as string)}
                  className="h-11 rounded-xl border border-coyote/30 bg-white/60 text-sm font-bold text-dark hover:border-canyon hover:text-canyon transition-colors"
                >
                  Other UPI app
                </button>
              </div>
            </>
          )}

          {qrCode && (
            <div>
              <div className="bg-white p-3 rounded-xl shadow-inner inline-block border border-coyote/20">
                <img src={qrCode} alt={`UPI QR for order ${orderLabel}`} className="w-36 h-36 mix-blend-multiply" />
                <p className="text-[11px] text-coyote mt-1.5 font-mono">Scan with any UPI app</p>
              </div>
              <div className="mt-2">
                {qrDownloadSupported ? (
                  <a
                    href={qrCode}
                    download={qrFilename}
                    aria-label={`Download UPI QR for order ${orderLabel}`}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-canyon hover:underline focus-visible:outline-2 focus-visible:outline-canyon rounded"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Download QR
                  </a>
                ) : (
                  <p className="text-xs text-coyote">Downloads aren’t supported here — long-press or screenshot the QR to save it.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center">
            <button
              onClick={handleRefresh}
              disabled={refreshing || refreshExhausted}
              className="text-sm text-canyon font-bold hover:underline transition-colors inline-flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Checking…' : refreshExhausted ? 'Refresh limit reached' : 'Refresh status'}
            </button>
          </div>
          {refreshExhausted && (
            <p className="text-xs text-coyote leading-relaxed">
              Still pending? Confirm you paid the exact amount above, then check Orders in a few minutes or contact support.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
