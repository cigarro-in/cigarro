import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Truck, Shield, Check, MapPin, User, Mail, Phone, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';

interface CheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface PaymentInfo {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

export function Checkout({ open, onOpenChange }: CheckoutProps) {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [orderNumber, setOrderNumber] = useState('');
  
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();

  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  });

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
  });

  const subtotal = totalPrice;
  const shipping = 0; // Free shipping
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + shipping + tax;

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('payment');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate order number
      const orderNum = `PM-${Date.now().toString().slice(-6)}`;
      setOrderNumber(orderNum);
      
      // Clear cart after successful payment
      await clearCart();
      
      setCurrentStep('confirmation');
      
      toast.success('Order placed successfully!');
    } catch (error) {
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (currentStep === 'confirmation') {
      // Reset state when closing after successful order
      setCurrentStep('shipping');
      setOrderNumber('');
    }
    onOpenChange(false);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/20 max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-serif-premium text-2xl text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-accent" />
            Secure Checkout
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          <div className={`flex items-center space-x-2 ${currentStep === 'shipping' ? 'text-accent' : currentStep === 'payment' || currentStep === 'confirmation' ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${currentStep === 'shipping' ? 'border-accent bg-accent text-primary' : currentStep === 'payment' || currentStep === 'confirmation' ? 'border-accent bg-accent text-primary' : 'border-muted-foreground'}`}>
              {currentStep === 'payment' || currentStep === 'confirmation' ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <span className="font-sans-premium text-sm">Shipping</span>
          </div>
          
          <div className={`w-8 h-px ${currentStep === 'payment' || currentStep === 'confirmation' ? 'bg-accent' : 'bg-muted-foreground'}`}></div>
          
          <div className={`flex items-center space-x-2 ${currentStep === 'payment' ? 'text-accent' : currentStep === 'confirmation' ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${currentStep === 'payment' ? 'border-accent bg-accent text-primary' : currentStep === 'confirmation' ? 'border-accent bg-accent text-primary' : 'border-muted-foreground'}`}>
              {currentStep === 'confirmation' ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <span className="font-sans-premium text-sm">Payment</span>
          </div>
          
          <div className={`w-8 h-px ${currentStep === 'confirmation' ? 'bg-accent' : 'bg-muted-foreground'}`}></div>
          
          <div className={`flex items-center space-x-2 ${currentStep === 'confirmation' ? 'text-accent' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${currentStep === 'confirmation' ? 'border-accent bg-accent text-primary' : 'border-muted-foreground'}`}>
              {currentStep === 'confirmation' ? <Check className="w-4 h-4" /> : '3'}
            </div>
            <span className="font-sans-premium text-sm">Confirmation</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-h-[60vh] overflow-y-auto">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {/* Shipping Step */}
              {currentStep === 'shipping' && (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="font-serif-premium text-xl text-foreground mb-4 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-accent" />
                      Shipping Information
                    </h3>
                    
                    <form onSubmit={handleShippingSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={shippingInfo.firstName}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, firstName: e.target.value }))}
                            required
                            className="bg-input-background border-border/20"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={shippingInfo.lastName}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, lastName: e.target.value }))}
                            required
                            className="bg-input-background border-border/20"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={shippingInfo.email}
                          onChange={(e) => setShippingInfo(prev => ({ ...prev, email: e.target.value }))}
                          required
                          className="bg-input-background border-border/20"
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={shippingInfo.phone}
                          onChange={(e) => setShippingInfo(prev => ({ ...prev, phone: e.target.value }))}
                          required
                          className="bg-input-background border-border/20"
                        />
                      </div>

                      <div>
                        <Label htmlFor="address">Street Address</Label>
                        <Input
                          id="address"
                          value={shippingInfo.address}
                          onChange={(e) => setShippingInfo(prev => ({ ...prev, address: e.target.value }))}
                          required
                          className="bg-input-background border-border/20"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={shippingInfo.city}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, city: e.target.value }))}
                            required
                            className="bg-input-background border-border/20"
                          />
                        </div>
                        <div>
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={shippingInfo.state}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, state: e.target.value }))}
                            required
                            className="bg-input-background border-border/20"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="zipCode">ZIP Code</Label>
                          <Input
                            id="zipCode"
                            value={shippingInfo.zipCode}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, zipCode: e.target.value }))}
                            required
                            className="bg-input-background border-border/20"
                          />
                        </div>
                        <div>
                          <Label htmlFor="country">Country</Label>
                          <Input
                            id="country"
                            value={shippingInfo.country}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, country: e.target.value }))}
                            required
                            className="bg-input-background border-border/20"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full gold-gradient text-primary font-sans-premium font-medium glow-on-hover group"
                      >
                        Continue to Payment
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* Payment Step */}
              {currentStep === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="font-serif-premium text-xl text-foreground mb-4 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-accent" />
                      Payment Information
                    </h3>

                    <form onSubmit={handlePaymentSubmit} className="space-y-6">
                      {/* Payment Method Selection */}
                      <div>
                        <Label className="text-base mb-3 block">Payment Method</Label>
                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                          <div className="flex items-center space-x-2 p-3 border border-border/20 rounded-lg">
                            <RadioGroupItem value="card" id="card" />
                            <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                              <CreditCard className="w-4 h-4" />
                              Credit/Debit Card
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {paymentMethod === 'card' && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="cardNumber">Card Number</Label>
                            <Input
                              id="cardNumber"
                              value={paymentInfo.cardNumber}
                              onChange={(e) => setPaymentInfo(prev => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
                              placeholder="1234 5678 9012 3456"
                              maxLength={19}
                              required
                              className="bg-input-background border-border/20"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="expiryDate">Expiry Date</Label>
                              <Input
                                id="expiryDate"
                                value={paymentInfo.expiryDate}
                                onChange={(e) => setPaymentInfo(prev => ({ ...prev, expiryDate: formatExpiryDate(e.target.value) }))}
                                placeholder="MM/YY"
                                maxLength={5}
                                required
                                className="bg-input-background border-border/20"
                              />
                            </div>
                            <div>
                              <Label htmlFor="cvv">CVV</Label>
                              <Input
                                id="cvv"
                                value={paymentInfo.cvv}
                                onChange={(e) => setPaymentInfo(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                placeholder="123"
                                maxLength={4}
                                required
                                className="bg-input-background border-border/20"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="cardholderName">Cardholder Name</Label>
                            <Input
                              id="cardholderName"
                              value={paymentInfo.cardholderName}
                              onChange={(e) => setPaymentInfo(prev => ({ ...prev, cardholderName: e.target.value }))}
                              required
                              className="bg-input-background border-border/20"
                            />
                          </div>
                        </div>
                      )}

                      {/* Security Notice */}
                      <div className="flex items-start gap-2 p-3 bg-muted/20 rounded-lg border border-border/20">
                        <Shield className="w-4 h-4 text-accent mt-0.5" />
                        <div>
                          <p className="font-sans-premium text-sm text-foreground">
                            Your payment information is secure and encrypted
                          </p>
                          <p className="font-sans-premium text-xs text-muted-foreground">
                            We use industry-standard 256-bit SSL encryption
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCurrentStep('shipping')}
                          className="flex-1"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back to Shipping
                        </Button>
                        <Button
                          type="submit"
                          disabled={isProcessing}
                          className="flex-1 gold-gradient text-primary font-sans-premium font-medium glow-on-hover"
                        >
                          {isProcessing ? 'Processing...' : `Place Order - $${total.toFixed(2)}`}
                        </Button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* Confirmation Step */}
              {currentStep === 'confirmation' && (
                <motion.div
                  key="confirmation"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-6 py-8"
                >
                  <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  
                  <div>
                    <h3 className="font-serif-premium text-2xl text-foreground mb-2">
                      Order Confirmed!
                    </h3>
                    <p className="font-sans-premium text-muted-foreground mb-4">
                      Thank you for your purchase. Your order has been successfully placed.
                    </p>
                    
                    <div className="inline-block bg-muted/20 px-4 py-2 rounded-lg border border-border/20">
                      <p className="font-sans-premium text-sm text-muted-foreground">Order Number</p>
                      <p className="font-serif-premium text-lg text-accent font-medium">{orderNumber}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• A confirmation email has been sent to {shippingInfo.email}</p>
                    <p>• Your order will be processed within 1-2 business days</p>
                    <p>• You will receive a tracking number once shipped</p>
                  </div>

                  <Button
                    onClick={handleClose}
                    className="gold-gradient text-primary font-sans-premium font-medium glow-on-hover"
                  >
                    Continue Shopping
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="glass-card p-6 rounded-lg border border-border/20 sticky top-0">
              <h3 className="font-serif-premium text-lg text-foreground mb-4">Order Summary</h3>
              
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-16 h-16 relative">
                      <ImageWithFallback
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-md"
                      />
                      {item.limited && (
                        <Badge className="absolute -top-1 -right-1 bg-accent text-primary text-xs">
                          LTD
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif-premium text-sm text-foreground line-clamp-2">
                        {item.name}
                      </h4>
                      <p className="font-sans-premium text-xs text-muted-foreground">
                        {item.brand}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="font-sans-premium text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </span>
                        <span className="font-sans-premium text-sm font-medium text-foreground">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4 bg-border/20" />
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-accent">Free</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-foreground">${tax.toFixed(2)}</span>
                </div>
                <Separator className="my-2 bg-border/20" />
                <div className="flex justify-between font-medium text-lg">
                  <span className="text-foreground">Total</span>
                  <span className="text-accent">${total.toFixed(2)}</span>
                </div>
              </div>

              {currentStep !== 'confirmation' && (
                <div className="mt-4 p-3 bg-muted/20 rounded-lg border border-border/20">
                  <p className="font-sans-premium text-xs text-muted-foreground text-center">
                    Free shipping • Secure checkout • 30-day returns
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}