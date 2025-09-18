import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Smartphone, Monitor, CheckCircle, Copy, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface PaymentData {
  orderId: string;
  amount: number;
  originalAmount: number;
  discount: number;
  items: any[];
  shippingInfo: any;
  preloadedQRCode?: string;
}

export function UPIPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { items, clearCart } = useCart();
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [orderId, setOrderId] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Get payment data from navigation state or redirect if missing
  useEffect(() => {
    if (location.state?.paymentData) {
      const data = location.state.paymentData as PaymentData;
      setPaymentData(data);
      setOrderId(data.orderId);
      
      // Use preloaded QR code if available, otherwise generate new one
      if (data.preloadedQRCode) {
        // Update the preloaded QR code with actual order ID and amount
        generateQRCode(data.orderId, data.amount);
      } else {
        generateQRCode(data.orderId, data.amount);
      }
    } else {
      // Redirect to checkout if no payment data
      navigate('/checkout');
    }
  }, [location.state, navigate]);

  const generateQRCode = async (orderID: string, amount: number) => {
    try {
      // Create UPI payment URL
      const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${amount}&tid=${orderID}&tn=${orderID}`;
      
      // Generate QR code
      const qrDataURL = await QRCode.toDataURL(upiURL, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeDataURL(qrDataURL);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  const handleMobilePayment = () => {
    if (!paymentData) return;
    
    // Create UPI deep link
    const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${paymentData.amount}&tid=${paymentData.orderId}&tn=${paymentData.orderId}`;
    
    // Try to open UPI app
    window.location.href = upiURL;
    
    // Start checking payment status after a delay
    setTimeout(() => {
      checkPaymentStatus();
    }, 5000);
  };

  const checkPaymentStatus = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate payment verification (in real app, you'd check with payment gateway)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo purposes, randomly succeed or ask user to confirm
      const success = Math.random() > 0.3; // 70% success rate for demo
      
      if (success) {
        await processSuccessfulPayment();
      } else {
        // Ask user to confirm payment manually
        const confirmed = window.confirm('Did you complete the payment in your UPI app? Click OK if payment was successful.');
        if (confirmed) {
          await processSuccessfulPayment();
        } else {
          toast.error('Payment not completed. Please try again.');
          setIsProcessing(false);
        }
      }
    } catch (error) {
      console.error('Payment verification failed:', error);
      setPaymentStatus('failed');
      toast.error('Payment verification failed');
      setIsProcessing(false);
    }
  };

  const processSuccessfulPayment = async () => {
    if (!paymentData || !user) return;

    try {
      // Create order in database
      const orderData = {
        id: paymentData.orderId,
        user_id: user.id,
        status: 'processing', // Mark as processing after payment confirmation
        subtotal: paymentData.originalAmount,
        tax: 0, // No tax as requested
        shipping: 0, // Free shipping
        total: paymentData.amount,
        discount: paymentData.discount,
        payment_method: 'UPI',
        payment_confirmed: true, // Add flag for manual verification
        payment_confirmed_at: new Date().toISOString(),
        shipping_name: `${paymentData.shippingInfo.firstName} ${paymentData.shippingInfo.lastName}`,
        shipping_address: paymentData.shippingInfo.address,
        shipping_city: paymentData.shippingInfo.city,
        shipping_state: paymentData.shippingInfo.state,
        shipping_zip_code: paymentData.shippingInfo.zipCode,
        shipping_country: paymentData.shippingInfo.country || 'India',
        estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = paymentData.items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_brand: item.brand,
        product_price: item.price,
        product_image: item.gallery_images?.[0] || item.image,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      await clearCart();

      setPaymentStatus('success');
      toast.success('Payment confirmed! Order is now being processed.');
      
      // Redirect to orders page after a delay
      setTimeout(() => {
        navigate('/orders');
      }, 3000);

    } catch (error) {
      console.error('Failed to process order:', error);
      setPaymentStatus('failed');
      toast.error('Failed to process order. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyUPILink = () => {
    if (!paymentData) return;
    
    const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${paymentData.amount}&tid=${paymentData.orderId}&tn=${paymentData.orderId}`;
    navigator.clipboard.writeText(upiURL);
    toast.success('UPI link copied to clipboard');
  };

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-background py-12" style={{transform: 'scale(1.8)', transformOrigin: 'top left', width: '55.56%', marginBottom: '80%'}}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-serif-premium text-3xl text-foreground mb-4">Order Confirmed!</h1>
            <p className="font-sans-premium text-muted-foreground mb-8">
              Your payment has been confirmed and your order is now being processed.
            </p>
            <div className="glass-card p-6 mb-8">
              <div className="flex items-center justify-between text-sm">
                <span className="font-sans-premium text-muted-foreground">Order ID</span>
                <span className="font-sans-premium text-foreground">{orderId}</span>
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-sans-premium text-muted-foreground">Amount Paid</span>
                <span className="font-serif-premium text-xl text-accent">₹{paymentData.amount.toFixed(2)}</span>
              </div>
              {paymentData.discount > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-sans-premium text-muted-foreground">Discount Applied</span>
                    <span className="font-serif-premium text-green-600">-₹{paymentData.discount.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            <Button onClick={() => navigate('/orders')} className="bg-accent text-accent-foreground hover:bg-accent/90 mr-4">
              View Orders
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12" style={{transform: 'scale(1.8)', transformOrigin: 'top left', width: '55.56%', marginBottom: '80%'}}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif-premium text-2xl text-foreground">UPI Payment</h1>
          <p className="text-muted-foreground">Complete your payment securely</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Methods */}
          <div className="space-y-6">
            {/* Mobile Payment */}
            <Card className="glass-card border-border/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 font-serif-premium">
                  <Smartphone className="w-5 h-5 text-accent" />
                  <span>Pay with UPI App</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click the button below to open your UPI app and complete the payment.
                </p>
                <Button 
                  onClick={handleMobilePayment}
                  disabled={isProcessing}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 mr-2" />
                      Open UPI App
                    </>
                  )}
                </Button>
                <div className="text-xs text-muted-foreground text-center">
                  Works with Google Pay, PhonePe, Paytm, and other UPI apps
                </div>
              </CardContent>
            </Card>

            {/* Desktop QR Code */}
            <Card className="glass-card border-border/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 font-serif-premium">
                  <Monitor className="w-5 h-5 text-accent" />
                  <span>Scan QR Code</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with any UPI app on your phone to complete the payment.
                </p>
                <div className="flex justify-center">
                  {qrCodeDataURL ? (
                    <div className="p-4 bg-white rounded-lg border">
                      <img src={qrCodeDataURL} alt="UPI Payment QR Code" className="w-48 h-48" />
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  onClick={copyUPILink}
                  className="w-full"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy UPI Link
                </Button>
                <div className="text-xs text-muted-foreground text-center">
                  After payment, click "Check Payment Status" below
                </div>
              </CardContent>
            </Card>

            {/* Check Payment Status */}
            <Button 
              onClick={checkPaymentStatus}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Checking...</span>
                </div>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Check Payment Status
                </>
              )}
            </Button>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="glass-card border-border/20 sticky top-24">
              <CardHeader>
                <CardTitle className="font-serif-premium">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {paymentData.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-sans-premium text-sm text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-serif-premium text-sm text-accent">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator className="bg-border/20" />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-sans-premium text-muted-foreground">Subtotal</span>
                    <span className="font-sans-premium text-foreground">₹{paymentData.originalAmount.toFixed(2)}</span>
                  </div>
                  {paymentData.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="font-sans-premium text-muted-foreground">Lucky Discount</span>
                      <span className="font-sans-premium text-green-600">-₹{paymentData.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="font-sans-premium text-muted-foreground">Shipping</span>
                    <span className="font-sans-premium text-accent">Free</span>
                  </div>
                </div>

                <Separator className="bg-border/20" />

                <div className="flex justify-between">
                  <span className="font-serif-premium text-lg text-foreground">Total</span>
                  <span className="font-serif-premium text-xl text-accent">₹{paymentData.amount.toFixed(2)}</span>
                </div>

                <div className="mt-6 p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="text-center">
                    <p className="font-sans-premium text-sm text-foreground">Payment Details</p>
                    <p className="text-xs text-muted-foreground mt-1">Order ID: {orderId}</p>
                    <p className="text-xs text-muted-foreground">Merchant: Cigarro</p>
                    <p className="text-xs text-muted-foreground">UPI ID: hrejuh@upi</p>
                  </div>
                </div>

                {paymentData.discount > 0 && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-center">
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        🎉 Lucky Discount Applied!
                      </Badge>
                      <p className="text-xs text-green-700 mt-2">
                        You saved ₹{paymentData.discount.toFixed(2)} on this order!
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
