import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Plus, History, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { rupeesToPaise, paiseToRupees } from '../../lib/convex/money';

const REASON_LABELS: Record<string, string> = {
  order_debit: 'Order Payment',
  order_expired_refund: 'Order Expired Refund',
  order_cancelled_refund: 'Order Cancelled Refund',
  order_refund_admin: 'Order Refund',
  wallet_load_credit: 'Wallet Load',
  admin_credit: 'Admin Credit',
  late_payment_credit: 'Late Payment Credit',
};

export function WalletPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const org = useOrg();

  const balanceData = useQuery(api.wallet.getMyBalance, org ? { orgId: org._id } : 'skip');
  const ledger = useQuery(
    api.wallet.getMyLedger,
    org ? { orgId: org._id, limit: 50 } : 'skip',
  );
  const createOrder = useMutation(api.orders.createOrder);

  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isLoading = balanceData === undefined || ledger === undefined;
  const balanceRupees = balanceData ? paiseToRupees(balanceData.balancePaise) : 0;

  const handleLoadWallet = async () => {
    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }
    if (!org) {
      toast.error('Store is loading. Please try again.');
      return;
    }

    const amount = parseFloat(loadAmount);
    if (!amount || amount <= 0) return toast.error('Please enter a valid amount');
    if (amount < 10) return toast.error('Minimum load amount is ₹10');
    if (amount > 50000) return toast.error('Maximum load amount is ₹50,000');

    setIsProcessing(true);
    try {
      const result = await createOrder({
        orgId: org._id,
        kind: 'wallet_load',
        items: [
          {
            productId: 'wallet-load',
            name: 'Wallet Credit',
            qty: 1,
            unitPricePaise: rupeesToPaise(amount),
          },
        ],
      });

      setShowLoadDialog(false);
      setLoadAmount('');

      if (result.upiUrl) {
        try {
          window.location.href = result.upiUrl;
        } catch (e) {
          console.error('Failed to open UPI link:', e);
        }
      }

      navigate('/transaction', {
        state: { orderId: result.orderId },
        replace: result.status === 'paid',
      });
    } catch (error: any) {
      console.error('Wallet load error:', error);
      const code = error?.data?.code;
      toast.error(
        code === 'SLOT_POOL_EXHAUSTED'
          ? 'Too many pending loads at this amount — retry shortly.'
          : 'Failed to initiate wallet load',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to view your wallet</p>
            <Button onClick={() => navigate('/login')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-serif text-xl font-bold text-dark">My Wallet</h1>
        </div>
      </div>

      <div className="p-4">
        <Card className="border-2 border-border/40 bg-gradient-to-br from-dark to-canyon text-creme-light shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Available Balance</span>
              <Wallet className="w-5 h-5 opacity-90" />
            </div>
            <div className="text-4xl font-bold mb-4">
              {isLoading ? '...' : formatINR(balanceRupees)}
            </div>
            <Button
              onClick={() => setShowLoadDialog(true)}
              className="w-full bg-creme-light text-dark hover:bg-creme"
            >
              <Plus className="w-4 h-4 mr-2" />
              Load Wallet
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="p-4">
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : !ledger || ledger.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {ledger.map((tx: any) => (
                  <div
                    key={tx._id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-border/20"
                  >
                    <div className="flex items-center gap-3">
                      {tx.entryType === 'credit' ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium text-sm">
                          {REASON_LABELS[tx.reason] ?? tx.reason}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          tx.entryType === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {tx.entryType === 'credit' ? '+' : '-'}
                        {formatINR(paiseToRupees(tx.amountPaise))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bal: {formatINR(paiseToRupees(tx.balanceAfterPaise))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Load Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Enter Amount</label>
              <Input
                type="number"
                placeholder="₹ 0"
                value={loadAmount}
                onChange={(e) => setLoadAmount(e.target.value)}
                min="10"
                max="50000"
                step="10"
              />
              <p className="text-xs text-muted-foreground mt-1">Min: ₹10 | Max: ₹50,000</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[100, 500, 1000, 2000, 5000, 10000].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setLoadAmount(amt.toString())}
                >
                  ₹{amt}
                </Button>
              ))}
            </div>

            <Button
              onClick={handleLoadWallet}
              disabled={isProcessing || !loadAmount}
              className="w-full bg-dark hover:bg-canyon text-creme-light"
            >
              {isProcessing ? 'Processing...' : 'Proceed to Pay'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
