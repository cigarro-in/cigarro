import { useState } from 'react';
import { Wallet, Check, Edit2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
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
      
      {/* Wallet Balance Section */}
      {user && walletBalance > 0 && (
        <div className="bg-canyon/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-canyon" />
              <span className="text-sm font-medium">Wallet Balance</span>
            </div>
            <span className="text-sm font-semibold text-canyon">{formatINR(walletBalance)}</span>
          </div>
          
          {walletAmountToUse === 0 ? (
            showCustomInput ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    min="1"
                    max={Math.min(walletBalance, getFinalTotal())}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-canyon text-canyon hover:bg-canyon hover:text-white"
                    onClick={handleApplyCustomAmount}
                  >
                    Apply
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomAmount('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-canyon text-canyon hover:bg-canyon hover:text-white"
                  onClick={() => {
                    const maxUse = Math.min(walletBalance, getFinalTotal());
                    setWalletAmountToUse(maxUse);
                    toast.success(`Using ${formatINR(maxUse)} from wallet`);
                  }}
                >
                  Use All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-canyon text-canyon hover:bg-canyon hover:text-white"
                  onClick={() => setShowCustomInput(true)}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Custom
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600">Wallet Applied</span>
                <span className="text-green-600 font-semibold">-{formatINR(walletAmountToUse)}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  setWalletAmountToUse(0);
                  toast.info('Wallet removed');
                }}
              >
                Remove Wallet
              </Button>
            </div>
          )}
        </div>
      )}
      
      <Separator />
      
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{formatINR(getFinalTotal())}</span>
      </div>

      {walletAmountToUse > 0 && (
        <div className="flex justify-between font-bold text-lg text-canyon">
          <span>Amount to Pay</span>
          <span>{formatINR(Math.max(0, getFinalTotal() - walletAmountToUse))}</span>
        </div>
      )}
    </div>
  );
}
