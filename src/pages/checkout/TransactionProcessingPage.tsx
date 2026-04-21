import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Check, Smartphone, RefreshCw, Wallet, X, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useOrg } from '../../lib/convex/useOrg';
import { paiseToRupees, formatPaiseINR } from '../../lib/convex/money';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';

interface TransactionState {
  orderId: Id<'orders'>;
  shouldClearCart?: boolean;
}

export function TransactionProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { clearCart } = useCart();

  const state = location.state as TransactionState | null;
  const orderId = state?.orderId;

  const org = useOrg();
  const order = useQuery(
    api.orders.getMine,
    orderId ? { orderId } : 'skip',
  );

  const [qrCode, setQrCode] = useState<string>('');
  const [showQR, setShowQR] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Redirect if no order context
  useEffect(() => {
    if (!state || !user) navigate('/');
  }, [state, user, navigate]);

  // Clear cart once after mount (on successful order creation path)
  useEffect(() => {
    if (state?.shouldClearCart) {
      const t = setTimeout(() => {
        clearCart().catch((err) => console.error('clearCart error', err));
      }, 500);
      return () => clearTimeout(t);
    }
  }, [state?.shouldClearCart, clearCart]);

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
    if (['paid', 'late_paid', 'expired', 'cancelled', 'refunded'].includes(order.status)) {
      sessionStorage.removeItem('buyNowItem');
      sessionStorage.removeItem('isBuyNow');
      sessionStorage.removeItem('retryOrder');
      sessionStorage.removeItem('isRetryPayment');
    }
  }, [order?.status]);

  // ---------- Wake-on-return + refresh button ----------
  const lastPokeRef = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const wakeMutation = useMutation(api.scheduler.wake);
  const pokeWake = useCallback(
    async (source: 'wake' | 'refresh') => {
      if (!orderId) return;
      const now = Date.now();
      if (source === 'refresh' && now - lastPokeRef.current < 60_000) return;
      if (source === 'wake' && now - lastPokeRef.current < 30_000) return;
      lastPokeRef.current = now;
      try {
        await wakeMutation({ orderId, source });
      } catch (_) {
        /* non-fatal */
      }
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
    setRefreshing(true);
    await pokeWake('refresh');
    setTimeout(() => setRefreshing(false), 2000);
  }, [pokeWake]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // --- Loading state (waiting on order fetch) ---
  if (!order || !org) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-creme flex items-center justify-center">
        <div className="animate-pulse text-coyote font-sans">Loading transaction…</div>
      </div>
    );
  }

  const isWalletOnly = order.verificationMethod === 'wallet_only';
  const amountPaise = order.finalAmountPaise > 0 ? order.finalAmountPaise : order.cartTotalPaise;
  const timeoutAt = order.createdAt + org.slotTimeoutMs!;
  const timeLeft = Math.max(0, Math.floor((timeoutAt - now) / 1000));

  // --- SUCCESS ---
  if (order.status === 'paid' || order.status === 'late_paid') {
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-creme flex flex-col items-center justify-center p-6 overflow-hidden relative">
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
          className="w-full max-w-sm relative z-10"
        >
          <div className="bg-creme-light border border-coyote rounded-t-3xl p-8 text-center relative shadow-2xl">
            <div className="relative mb-6 mx-auto w-20 h-20 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 bg-green-500/20 rounded-full"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <div className="w-20 h-20 bg-green-100 text-green-700 rounded-full flex items-center justify-center shadow-inner relative z-10">
                <Check className="w-10 h-10" strokeWidth={3} />
              </div>
            </div>

            <h1 className="text-3xl font-serif text-dark mb-2">Payment Successful</h1>
            <p className="text-coyote text-sm mb-8">Your order has been confirmed</p>

            <div className="border-t border-b border-dashed border-coyote/30 py-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-coyote text-sm font-medium">Amount Paid</span>
                <span className="text-dark font-mono font-bold text-xl">{formatPaiseINR(amountPaise)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-coyote text-sm font-medium">Order ID</span>
                <span className="text-dark font-mono font-bold text-lg">#{order.displayOrderId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-coyote text-sm font-medium">Verified By</span>
                <span className="text-dark font-medium capitalize">
                  {order.verificationMethod?.replace('_', ' ') ?? 'pending'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-creme-light border-x border-b border-coyote rounded-b-3xl p-6 relative">
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
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-creme flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm w-full"
        >
          <div className={`w-24 h-24 ${isExpired ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg`}>
            {isExpired ? <Clock className="w-12 h-12" strokeWidth={2.5} /> : <X className="w-12 h-12" strokeWidth={2.5} />}
          </div>

          <h2 className="text-3xl font-serif text-dark mb-2">
            {isExpired ? 'Payment Timed Out' : 'Payment Not Completed'}
          </h2>
          <p className="text-coyote mb-8 text-sm leading-relaxed px-4">
            {isExpired
              ? "We didn't receive your payment in time. If money was deducted, it will arrive shortly and we'll credit your wallet."
              : 'Your order was cancelled. Any wallet debit has been refunded.'}
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/orders')}
              className="w-full bg-dark text-creme-light hover:bg-canyon h-14 rounded-xl shadow-lg transition-transform active:scale-95"
            >
              <RefreshCw className="w-5 h-5 mr-2" /> Retry from Orders
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
    <div className="fixed inset-0 z-50 min-h-screen bg-creme flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <motion.div
        className="absolute w-[500px] h-[500px] bg-canyon/5 rounded-full blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="z-10 w-full max-w-sm text-center space-y-12">
        <div className="relative flex justify-center">
          <motion.div
            className="w-24 h-24 rounded-full border-4 border-coyote/20 flex items-center justify-center bg-creme-light shadow-xl"
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
            {isWalletOnly ? <Wallet className="w-10 h-10 text-canyon" /> : <Smartphone className="w-10 h-10 text-canyon" />}
          </motion.div>
        </div>

        <div className="space-y-3">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-serif text-dark"
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
          className="bg-white/50 border border-coyote/20 rounded-2xl p-8 backdrop-blur-sm shadow-sm"
        >
          <p className="text-xs text-coyote uppercase tracking-widest font-bold mb-2">Pay exactly</p>
          <p className="text-5xl font-mono tracking-tighter text-dark">{formatPaiseINR(amountPaise)}</p>
          <p className="text-xs text-coyote mt-2 font-mono">Order #{order.displayOrderId}</p>
        </motion.div>

        <div className="space-y-4">
          {order.upiUrl && (
            <Button
              onClick={() => (window.location.href = order.upiUrl)}
              className="w-full bg-dark text-creme-light hover:bg-canyon h-14 rounded-xl text-lg font-medium shadow-lg transition-transform active:scale-95"
            >
              Pay via UPI App
            </Button>
          )}

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setShowQR((v) => !v)}
              className="text-sm text-canyon font-bold hover:underline transition-colors"
            >
              {showQR ? 'Hide QR Code' : 'Show QR Code'}
            </button>
            <span className="text-coyote/50">·</span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-sm text-canyon font-bold hover:underline transition-colors inline-flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Checking…' : 'Refresh status'}
            </button>
          </div>

          <AnimatePresence>
            {showQR && qrCode && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="bg-white p-4 rounded-xl shadow-inner inline-block border border-coyote/20 overflow-hidden"
              >
                <img src={qrCode} alt="QR" className="w-48 h-48 mix-blend-multiply" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
