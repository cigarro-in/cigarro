import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, Smartphone, RefreshCw, Wallet, ArrowRight, X, ShoppingBag } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import QRCode from 'qrcode';
import { useCart } from '../../hooks/useCart';
import { motion, AnimatePresence } from 'framer-motion';

type TransactionType = 'order' | 'wallet_load' | 'order_retry' | 'wallet_payment';
type TransactionStatus = 'processing' | 'completed' | 'failed' | 'timeout';

interface TransactionData {
  type: TransactionType;
  transactionId: string;
  amount: number;
  orderId?: string;
  displayOrderId?: string;
  paymentMethod: 'upi' | 'qr' | 'wallet';
  upiUrl?: string;
  autoComplete?: boolean;
  walletAmountUsed?: number;
  shouldClearCart?: boolean;
  metadata?: Record<string, any>;
}

export function TransactionProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { clearCart } = useCart();
  
  const transactionData = location.state as TransactionData;
  
  const [status, setStatus] = useState<TransactionStatus>('processing');
  const [qrCode, setQrCode] = useState<string>('');
  const [showQR, setShowQR] = useState(false);
  const [verifiedData, setVerifiedData] = useState<any>(null);
  
  // Polling ref to clear interval on unmount
  const pollingRef = useRef<{ interval: NodeJS.Timeout | null }>({ interval: null });

  useEffect(() => {
    if (!transactionData || !user) {
      navigate('/');
      return;
    }

    initializeTransaction();
    return () => {
      if (pollingRef.current.interval) clearInterval(pollingRef.current.interval);
    };
  }, []);

  const initializeTransaction = async () => {
    try {
      // --- WALLET PAYMENTS (Instant) ---
      if (transactionData.paymentMethod === 'wallet' || (transactionData.type === 'wallet_payment' && transactionData.autoComplete)) {
        // Simulate a brief "unlocking" delay for UX feel
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Auto-verify if needed (unless it was a direct pre-verified wallet move)
        if (!transactionData.autoComplete) {
             const { error: verifyError } = await supabase.rpc('verify_order_payment', {
              p_transaction_id: transactionData.transactionId,
              p_amount: transactionData.amount,
              p_bank_name: null,
              p_upi_reference: null,
              p_verification_method: 'automatic',
              p_email_verification_id: null
            });

            if (verifyError) throw verifyError;
        }

        await finalizeSuccess();
        return;
      }

      // --- EXTERNAL PAYMENTS (UPI/QR) ---
      
      // ALWAYS Generate QR Code for non-wallet payments
      const upiString = transactionData.upiUrl || 
        `upi://pay?pa=payments@cigarro.in&pn=Cigarro&am=${transactionData.amount}&cu=INR&tn=Order-${transactionData.transactionId}`;
      const qrDataUrl = await QRCode.toDataURL(upiString);
      setQrCode(qrDataUrl);
      
      if (transactionData.paymentMethod === 'qr') setShowQR(true);

      // Start Polling
      startPolling();

    } catch (error) {
      console.error('Transaction initialization error:', error);
      setStatus('failed');
    }
  };

  const startPolling = () => {
    const interval = setInterval(async () => {
      await checkTransactionStatus();
    }, 3000); // Fast polling 3s
    pollingRef.current.interval = interval;
  };

  const checkTransactionStatus = async () => {
    try {
        let isSuccess = false;
        let data = null;

        if (transactionData.type === 'wallet_load') {
            const { data: tx } = await supabase
                .from('transactions')
                .select('*')
                .eq('internal_transaction_id', transactionData.transactionId)
                .eq('user_id', user!.id)
                .single();
            if (tx && tx.status === 'completed') {
                isSuccess = true;
                data = tx;
            }
        } else {
            const { data: order } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('transaction_id', transactionData.transactionId)
                .single();
            if (order && order.payment_verified === 'YES') {
                isSuccess = true;
                data = order;
            }
        }

        if (isSuccess) {
            if (pollingRef.current.interval) clearInterval(pollingRef.current.interval);
            setVerifiedData(data);
            await finalizeSuccess();
        }
    } catch (error) {
        console.error('Polling error', error);
    }
  };

  const finalizeSuccess = async () => {
    // Only clear cart if explicitly allowed (default to true for normal checkout)
    // shouldClearCart is undefined for normal checkout (legacy), so check for false explicitly
    if (transactionData.shouldClearCart !== false) {
      await clearCart();
    }
    sessionStorage.removeItem('buyNowItem');
    sessionStorage.removeItem('isBuyNow');
    sessionStorage.removeItem('retryOrder');
    sessionStorage.removeItem('isRetryPayment');
    setStatus('completed');
  };

  // --- VIEWS ---

  if (status === 'processing') {
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-creme flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Pulse */}
        <motion.div 
            className="absolute w-[500px] h-[500px] bg-canyon/5 rounded-full blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <div className="z-10 w-full max-w-sm text-center space-y-12">
            {/* Icon Animation */}
            <div className="relative flex justify-center">
                <motion.div
                    className="w-24 h-24 rounded-full border-4 border-coyote/20 flex items-center justify-center bg-creme-light shadow-xl"
                    animate={{ 
                        borderColor: ["rgba(195,175,159,0.2)", "rgba(140,70,48,0.5)", "rgba(195,175,159,0.2)"],
                        boxShadow: ["0 20px 25px -5px rgba(0, 0, 0, 0.1)", "0 25px 50px -12px rgba(140, 70, 48, 0.25)", "0 20px 25px -5px rgba(0, 0, 0, 0.1)"]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    {transactionData.paymentMethod === 'wallet' ? (
                        <Wallet className="w-10 h-10 text-canyon" />
                    ) : (
                        <Smartphone className="w-10 h-10 text-canyon" />
                    )}
                </motion.div>
            </div>

            {/* Status Text */}
            <div className="space-y-3">
                <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-serif text-dark"
                >
                    {transactionData.paymentMethod === 'wallet' ? 'Unlocking Vault...' : 'Securely Connecting...'}
                </motion.h2>
                <p className="text-coyote font-sans text-sm">
                    {transactionData.paymentMethod === 'wallet' 
                        ? 'Processing your wallet payment'
                        : 'Please approve the request on your UPI app'
                    }
                </p>
            </div>

            {/* Amount */}
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white/50 border border-coyote/20 rounded-2xl p-8 backdrop-blur-sm shadow-sm"
            >
                <p className="text-xs text-coyote uppercase tracking-widest font-bold mb-2">Total Amount</p>
                <p className="text-5xl font-mono tracking-tighter text-dark">{formatINR(transactionData.amount)}</p>
            </motion.div>

            {/* UPI Actions (Only for UPI/QR) */}
            {transactionData.paymentMethod !== 'wallet' && (
                <div className="space-y-4">
                    {transactionData.upiUrl && (
                        <Button 
                            onClick={() => window.location.href = transactionData.upiUrl!}
                            className="w-full bg-dark text-creme-light hover:bg-canyon h-14 rounded-xl text-lg font-medium shadow-lg transition-transform active:scale-95"
                        >
                            Pay via UPI App
                        </Button>
                    )}
                    
                    <button 
                        onClick={() => setShowQR(!showQR)}
                        className="text-sm text-canyon font-bold hover:underline transition-colors"
                    >
                        {showQR ? 'Hide QR Code' : 'Show QR Code'}
                    </button>

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
            )}
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="fixed inset-0 z-50 min-h-screen bg-creme flex flex-col items-center justify-center p-6 overflow-hidden relative">
        {/* Confetti Effect (Simple CSS Dots) */}
        {[...Array(12)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-canyon/30"
                initial={{ 
                    x: 0, 
                    y: 0,
                    opacity: 0 
                }}
                animate={{ 
                    x: (Math.random() - 0.5) * 500, 
                    y: (Math.random() - 0.5) * 500,
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0]
                }}
                transition={{ 
                    duration: 2, 
                    ease: "easeOut", 
                    delay: 0.1 
                }}
            />
        ))}

        <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="w-full max-w-sm relative z-10"
        >
            {/* The "Ticket" Receipt */}
            <div className="bg-creme-light border border-coyote rounded-t-3xl p-8 text-center relative shadow-2xl">
                {/* Success Icon with Ripple */}
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
                        <span className="text-dark font-mono font-bold text-xl">{formatINR(transactionData.amount)}</span>
                    </div>
                    
                    {/* Display Order ID if available */}
                    {(transactionData.displayOrderId || verifiedData?.display_order_id) && (
                        <div className="flex justify-between items-center">
                            <span className="text-coyote text-sm font-medium">Order ID</span>
                            <span className="text-dark font-mono font-bold text-lg">
                                #{transactionData.displayOrderId || verifiedData?.display_order_id}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <span className="text-coyote text-sm font-medium">Transaction ID</span>
                        <span className="text-dark font-mono text-xs bg-creme px-2 py-1 rounded">{transactionData.transactionId.slice(-8)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-coyote text-sm font-medium">Payment Mode</span>
                        <span className="text-dark font-medium capitalize">{transactionData.paymentMethod}</span>
                    </div>
                </div>
            </div>
            
            {/* Ticket Bottom (Perforated look) */}
            <div className="bg-creme-light border-x border-b border-coyote rounded-b-3xl p-6 relative">
                 {/* Perforation Circles */}
                 <div className="absolute top-[-10px] left-[-10px] w-5 h-5 bg-creme rounded-full border-r border-b border-coyote z-20"></div>
                 <div className="absolute top-[-10px] right-[-10px] w-5 h-5 bg-creme rounded-full border-l border-b border-coyote z-20"></div>
                 
                 <div className="absolute top-[-1px] left-4 right-4 border-t-2 border-dashed border-coyote/30"></div>

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

  // Failed State
  return (
    <div className="fixed inset-0 z-50 min-h-screen bg-creme flex flex-col items-center justify-center p-6">
        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-sm w-full"
        >
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <X className="w-12 h-12" strokeWidth={2.5} />
            </div>
            
            <h2 className="text-3xl font-serif text-dark mb-2">Payment Failed</h2>
            <p className="text-coyote mb-8 text-sm leading-relaxed px-4">
                We couldn't verify your payment. If money was deducted, it will be refunded automatically within 5-7 days.
            </p>

            <div className="space-y-3">
                <Button 
                    onClick={() => navigate(-1)}
                    className="w-full bg-dark text-creme-light hover:bg-canyon h-14 rounded-xl shadow-lg transition-transform active:scale-95"
                >
                    <RefreshCw className="w-5 h-5 mr-2" /> Try Again
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
