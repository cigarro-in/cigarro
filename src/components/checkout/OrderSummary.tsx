import { useState } from 'react';
import { Wallet, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { formatINR } from '../../utils/currency';
import { toast } from 'sonner';

interface OrderSummaryProps {
  items: any[];
  totalPrice: number;
  randomDiscount: number;
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
  appliedDiscount,
  getShippingCost,
  getFinalTotal,
  user,
  walletBalance,
  walletAmountToUse,
  setWalletAmountToUse
}: OrderSummaryProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span>Subtotal ({items.length} items)</span>
        <span>{formatINR(totalPrice)}</span>
      </div>
      
      <div className="flex justify-between text-sm text-green-600">
        <span>Lucky Discount</span>
        <span>-{formatINR(randomDiscount)}</span>
      </div>
      
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
            <Button
              size="sm"
              variant="outline"
              className="w-full border-canyon text-canyon hover:bg-canyon hover:text-white"
              onClick={() => {
                const maxUse = Math.min(walletBalance, getFinalTotal());
                setWalletAmountToUse(maxUse);
                toast.success(`Using ${formatINR(maxUse)} from wallet`);
              }}
            >
              Use All
            </Button>
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
