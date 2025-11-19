import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, Wallet, ShoppingBag, RefreshCw, QrCode as QrCodeIcon, ArrowLeft, Smartphone } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import QRCode from 'qrcode';
import { useCart } from '../../hooks/useCart';

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
  metadata?: Record<string, any>;
}

export function TransactionProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { clearCart } = useCart();
  
  const transactionData = location.state as TransactionData;
  
  const [status, setStatus] = useState<TransactionStatus>('processing');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [qrCode, setQrCode] = useState<string>('');
  const [showQR, setShowQR] = useState(false);
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!transactionData || !user) {
      toast.error('Invalid transaction');
      navigate('/');
      return;
    }

    initializeTransaction();
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, []);

  const initializeTransaction = async () => {
    try {
      // For full wallet payments with autoComplete flag
      if (transactionData.type === 'wallet_payment' && transactionData.autoComplete) {
        console.log('💰 Processing full wallet payment...');
        
        // Show processing for 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Clear cart and session storage
        await clearCart();
        sessionStorage.removeItem('buyNowItem');
        sessionStorage.removeItem('isBuyNow');
        
        console.log('✅ Wallet payment complete, navigating to success...');
        
        // Navigate to success page
        navigate('/order-success', {
          state: {
            orderId: transactionData.orderId,
            displayOrderId: transactionData.displayOrderId,
            amount: transactionData.amount,
            paymentMethod: 'wallet',
            walletAmountUsed: transactionData.walletAmountUsed
          },
          replace: true
        });
        return;
      }

      // For wallet payments that need verification
      if (transactionData.paymentMethod === 'wallet' && !transactionData.autoComplete) {
        // Auto-verify wallet payment
        const { error: verifyError } = await supabase.rpc('verify_order_payment', {
          p_transaction_id: transactionData.transactionId,
          p_amount: transactionData.amount,
          p_bank_name: null,
          p_upi_reference: null,
          p_verification_method: 'automatic',
          p_email_verification_id: null
        });

        if (verifyError) {
          console.error('Failed to verify wallet payment:', verifyError);
          setStatus('failed');
          toast.error('Payment verification failed');
          return;
        }

        // Clear cart and session storage
        clearCart();
        sessionStorage.removeItem('buyNowItem');
        sessionStorage.removeItem('isBuyNow');

        // Fetch order data and show success
        const { data: orderData } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('transaction_id', transactionData.transactionId)
          .single();

        if (orderData) {
          setVerifiedData(orderData);
          setStatus('completed');
          toast.success(' Order completed with wallet!');
          
          // Navigate to orders page after 2 seconds
          setTimeout(() => {
            navigate('/orders', { replace: true });
          }, 2000);
        }
        
        return;
      }

      // Generate QR code for both UPI and QR payment methods
      const upiString = transactionData.upiUrl || 
        `upi://pay?pa=payments@cigarro.in&pn=Cigarro&am=${transactionData.amount}&cu=INR&tn=${getTransactionDescription()}%20${transactionData.transactionId}`;
      const qrDataUrl = await QRCode.toDataURL(upiString);
      setQrCode(qrDataUrl);

      // Auto-show QR if payment method is QR
      if (transactionData.paymentMethod === 'qr') {
        setShowQR(true);
      }

      // Start countdown timer
      startCountdown();

      // Start polling for payment verification
      startPolling();
    } catch (error) {
      console.error('Transaction initialization error:', error);
      toast.error('Failed to initialize transaction');
      setStatus('failed');
    }
  };

  const getTransactionDescription = () => {
    switch (transactionData.type) {
      case 'order':
        return 'Order Payment';
      case 'wallet_load':
        return 'Wallet Load';
      case 'order_retry':
        return 'Order Retry';
      default:
        return 'Payment';
    }
  };

  const getTransactionIcon = () => {
    switch (transactionData.type) {
      case 'order':
      case 'order_retry':
        return <ShoppingBag className="w-12 h-12" />;
      case 'wallet_load':
        return <Wallet className="w-12 h-12" />;
      default:
        return <Clock className="w-12 h-12" />;
    }
  };

  const startCountdown = () => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPolling = () => {
    const interval = setInterval(async () => {
      await checkTransactionStatus();
    }, 5000); // Poll every 5 seconds

    setPollingInterval(interval);
  };

  const checkTransactionStatus = async () => {
    try {
      if (transactionData.type === 'wallet_load') {
        // Check wallet transaction
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('internal_transaction_id', transactionData.transactionId)
          .eq('user_id', user!.id)
          .single();

        if (error) throw error;

        if (data && data.status === 'completed') {
          handleSuccess(data);
        }
      } else {
        // Check order transaction
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('transaction_id', transactionData.transactionId)
          .single();

        if (error) throw error;

        if (data && data.payment_verified === 'YES') {
          handleSuccess(data);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  const handleSuccess = (data: any) => {
    if (pollingInterval) clearInterval(pollingInterval);
    setVerifiedData(data);
    setStatus('completed');
    toast.success('Payment verified successfully!');
  };

  const handleTimeout = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    setStatus('timeout');
    toast.error('Transaction timed out');
  };

  const handleRetry = () => {
    navigate(-1);
  };

  const handleViewOrder = () => {
    navigate('/orders');
  };

  const handleViewWallet = () => {
    navigate('/wallet');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Processing State
  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-serif text-xl font-bold text-dark">Payment Processing</h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-w-2xl mx-auto">
          {/* Header Card */}
          <Card className="border-2 border-border/40 shadow-lg mb-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-canyon/10 text-canyon">
                  {getTransactionIcon()}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-serif font-bold mb-1">
                    {getTransactionDescription()}
                  </h2>
                  <p className="text-3xl font-bold text-dark">
                    {formatINR(transactionData.amount)}
                  </p>
                </div>
              </div>

              {/* Timer - Only show for non-wallet payments */}
              {transactionData.paymentMethod !== 'wallet' && (
                <div className="bg-creme-light/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-canyon" />
                      <span className="font-medium">Time Remaining</span>
                    </div>
                    <span className="text-2xl font-bold text-canyon">
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Options Card */}
          <Card className="border-2 border-border/40 shadow-lg mb-4">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Payment Options</h3>

              {/* Show UPI/QR buttons only for non-wallet payments */}
              {transactionData.paymentMethod !== 'wallet' && (
                <>
                  {/* UPI Apps Button */}
                  {transactionData.upiUrl && (
                    <Button
                      onClick={() => window.location.href = transactionData.upiUrl!}
                      className="w-full bg-dark hover:bg-canyon text-creme-light mb-3"
                      size="lg"
                    >
                      <Smartphone className="w-5 h-5 mr-2" />
                      Open UPI App
                    </Button>
                  )}

                  {/* Show QR Code Button */}
                  <Button
                    onClick={() => setShowQR(!showQR)}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <QrCodeIcon className="w-5 h-5 mr-2" />
                    {showQR ? 'Hide QR Code' : 'Pay via QR Code'}
                  </Button>

                  {/* QR Code Display */}
                  {showQR && qrCode && (
                    <div className="mt-4 text-center">
                      <div className="bg-white p-4 rounded-lg border-2 border-border/40 inline-block">
                        <img src={qrCode} alt="Payment QR Code" className="w-64 h-64" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Scan with any UPI app to pay
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Wallet payment message */}
              {transactionData.paymentMethod === 'wallet' && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-green-600 mb-2">
                    <Wallet className="w-5 h-5" />
                    <span className="font-semibold">Wallet Payment</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {transactionData.metadata?.is_full_payment
                      ? 'Your order is being processed...'
                      : 'Verifying wallet deduction...'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction Details Card */}
          <Card className="border-2 border-border/40 shadow-lg mb-4">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono font-medium">{transactionData.transactionId}</span>
                </div>
                {transactionData.orderId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID</span>
                    <span className="font-mono font-medium">{transactionData.orderId.slice(0, 8)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium uppercase">{transactionData.paymentMethod}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="border-2 border-border/40 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-canyon border-t-transparent" />
                <span>Waiting for payment confirmation...</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Complete the payment and stay on this page
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success State
  if (status === 'completed' && verifiedData) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4 p-4">
            <h1 className="font-serif text-xl font-bold text-green-600">Payment Successful!</h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-w-2xl mx-auto">
          {/* Success Card */}
          <Card className="border-2 border-green-500/40 shadow-lg mb-4">
            <CardContent className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-600 mb-4">
                <CheckCircle className="w-16 h-16" />
              </div>
              <h2 className="text-2xl font-serif font-bold mb-2 text-green-600">
                Payment Successful!
              </h2>
              <p className="text-3xl font-bold text-dark">
                {formatINR(transactionData.amount)}
              </p>
            </CardContent>
          </Card>

          {/* Transaction Details */}
          <Card className="border-2 border-border/40 shadow-lg mb-4">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Transaction Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono font-medium">{transactionData.transactionId}</span>
                </div>
                
                {transactionData.type === 'wallet_load' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New Balance</span>
                    <span className="font-bold text-green-600">
                      {formatINR(verifiedData.balance_after || 0)}
                    </span>
                  </div>
                )}

                {(transactionData.type === 'order' || transactionData.type === 'order_retry') && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Order ID</span>
                      <span className="font-mono font-medium">{verifiedData.id?.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Items</span>
                      <span className="font-medium">{verifiedData.order_items?.length || 0} items</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium text-green-600">Confirmed</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span className="font-medium">
                    {new Date().toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            {transactionData.type === 'wallet_load' && (
              <Button
                onClick={handleViewWallet}
                className="w-full bg-dark hover:bg-canyon text-creme-light"
                size="lg"
              >
                View Wallet
              </Button>
            )}

            {(transactionData.type === 'order' || transactionData.type === 'order_retry') && (
              <Button
                onClick={handleViewOrder}
                className="w-full bg-dark hover:bg-canyon text-creme-light"
                size="lg"
              >
                View Order Details
              </Button>
            )}

            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Failed/Timeout State
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4 p-4">
          <h1 className="font-serif text-xl font-bold text-red-600">
            {status === 'timeout' ? 'Transaction Timed Out' : 'Payment Failed'}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Error Card */}
        <Card className="border-2 border-red-500/40 shadow-lg mb-4">
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 text-red-600 mb-4">
              <XCircle className="w-16 h-16" />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-2 text-red-600">
              {status === 'timeout' ? 'Transaction Timed Out' : 'Payment Failed'}
            </h2>
            <p className="text-muted-foreground mb-4">
              {status === 'timeout'
                ? 'We did not receive payment confirmation within the time limit.'
                : 'Something went wrong with your payment.'}
            </p>
          </CardContent>
        </Card>

        {/* Transaction Details */}
        <Card className="border-2 border-border/40 shadow-lg mb-4">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Transaction Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono font-medium">{transactionData.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatINR(transactionData.amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            className="w-full bg-dark hover:bg-canyon text-creme-light"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Back to Home
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-center text-muted-foreground mt-4">
          If money was deducted from your account, it will be refunded within 5-7 business days.
        </p>
      </div>
    </div>
  );
}
