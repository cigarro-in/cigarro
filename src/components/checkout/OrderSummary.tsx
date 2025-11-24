import { useState } from 'react';
import { Wallet, Check, Edit2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { formatINR } from '../../utils/currency';
import { toast } from 'sonner';

interface OrderSummaryProps {
  items: any[];
  totalPrice: number;
  randomDiscount: number;
  isRetryPayment?: boolean;
  retryDisplayOrderId?: string | null;
  appliedDiscount: any;
  getShippingCost: () => number;
  getFinalTotal: () => number;
  user: any;
  walletBalance: number;
  walletAmountToUse: number;
  setWalletAmountToUse: (amount: number) => void;
}

export function OrderSummary({
  items,
  totalPrice,
  randomDiscount,
  isRetryPayment = false,
  retryDisplayOrderId = null,
  appliedDiscount,
  getShippingCost,
  getFinalTotal,
  user,
  walletBalance,
  walletAmountToUse,
  setWalletAmountToUse
}: OrderSummaryProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const handleApplyCustomAmount = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > walletBalance) {
      toast.error(`Amount cannot exceed wallet balance (${formatINR(walletBalance)})`);
      return;
    }
    if (amount > getFinalTotal()) {
      toast.error(`Amount cannot exceed order total (${formatINR(getFinalTotal())})`);
      return;
    }
    setWalletAmountToUse(amount);
    setShowCustomInput(false);
    setCustomAmount('');
    toast.success(`Using ${formatINR(amount)} from wallet`);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span>Subtotal ({items.length} items)</span>
        <span>{formatINR(totalPrice)}</span>
      </div>
      
      {randomDiscount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-green-600">
            <span>{isRetryPayment ? 'Original Lucky Discount' : 'Lucky Discount'}</span>
            <span>-{formatINR(randomDiscount)}</span>
          </div>
          {isRetryPayment && (
            <p className="text-xs text-muted-foreground">
              Preserved from order {retryDisplayOrderId ?? 'retry'}
            </p>
          )}
        </div>
      )}
      
      {appliedDiscount && (
        <div className="flex justify-between text-sm text-green-600">
          <span>{appliedDiscount.discount_name || 'Coupon Discount'}</span>
          <span>-{formatINR(appliedDiscount.discount_amount)}</span>
        </div>
      )}
      
      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span>{getShippingCost() === 0 ? 'Free' : formatINR(getShippingCost())}</span>
      </div>
      
      <Separator />
      
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{formatINR(getFinalTotal())}</span>
      </div>

      {/* Wallet Balance Section - Compact */}
      {user && walletBalance > 0 && (
        <div className="py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch 
                checked={walletAmountToUse > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setWalletAmountToUse(Math.min(walletBalance, getFinalTotal()));
                    toast.success('Wallet applied');
                  } else {
                    setWalletAmountToUse(0);
                    setShowCustomInput(false);
                  }
                }}
              />
              <span className="text-sm font-medium text-foreground">
                Use Wallet {walletAmountToUse > 0 && <span className="text-canyon font-mono ml-1">({formatINR(walletBalance)})</span>}
              </span>
            </div>
          </div>

          {/* Active Wallet Deduction Line Item */}
          {walletAmountToUse > 0 && (
            <div className="flex justify-between items-center text-sm pl-14">
              {showCustomInput ? (
                <div className="flex gap-2 items-center animate-in fade-in flex-1">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="h-7 w-full bg-white text-xs"
                    min="1"
                    max={Math.min(walletBalance, getFinalTotal())}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 text-[10px] bg-canyon text-white hover:bg-canyon/90 px-2"
                    onClick={handleApplyCustomAmount}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomAmount('');
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => setShowCustomInput(true)}
                    className="text-[10px] text-muted-foreground hover:text-canyon underline decoration-dotted underline-offset-2 transition-colors"
                  >
                    Edit Amount
                  </button>
                  <span className="font-medium text-green-600">-{formatINR(walletAmountToUse)}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {walletAmountToUse > 0 && (
        <div className="flex justify-between font-bold text-lg text-canyon">
          <span>Amount to Pay</span>
          <span>{formatINR(Math.max(0, getFinalTotal() - walletAmountToUse))}</span>
        </div>
      )}
    </div>
  );
}
