import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Plus, History, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  direction: 'credit' | 'debit';
  status: string;
  description: string;
  created_at: string;
  balance_after: number;
}

export function WalletPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch wallet balance
      const { data: balanceData, error: balanceError } = await supabase.rpc('get_wallet_balance', {
        p_user_id: user.id
      });

      if (balanceError) throw balanceError;
      setBalance(balanceData || 0);

      // Fetch transaction history
      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .select('id, type, amount, direction, status, description, created_at, balance_after')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txnError) throw txnError;
      setTransactions(txnData || []);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
      toast.error('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadWallet = async () => {
    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    const amount = parseFloat(loadAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount < 10) {
      toast.error('Minimum load amount is ₹10');
      return;
    }

    if (amount > 50000) {
      toast.error('Maximum load amount is ₹50,000');
      return;
    }

    setIsProcessing(true);
    try {
      // Create wallet load order using create_order RPC
      // Updated to use the new robust implementation (no fake products)
      const { data: orderResult, error: orderError } = await supabase.rpc('create_order', {
        p_items: [], // No items needed for wallet load
        p_shipping_address: null,
        p_shipping_method: null,
        p_coupon_code: null,
        p_lucky_discount: 0,
        p_user_id: user.id,
        p_is_wallet_load: true,
        p_custom_amount: amount // New parameter for direct amount
      });

      if (orderError) throw orderError;
      if (!orderResult || !orderResult.success) {
        throw new Error(orderResult?.message || 'Failed to create wallet load order');
      }

      console.log('✅ Wallet load order created:', orderResult);

      setShowLoadDialog(false);
      setLoadAmount('');

      // Try to open UPI app immediately
      if (orderResult.upi_deep_link) {
        try {
          window.location.href = orderResult.upi_deep_link;
        } catch (e) {
          console.error('Failed to open UPI link:', e);
        }
      }

      // Navigate to unified transaction page
      navigate('/transaction', {
        state: {
          type: 'order', // Now it's an order, not wallet_load
          transactionId: orderResult.transaction_id,
          amount: amount,
          orderId: orderResult.order_id,
          paymentMethod: 'upi',
          upiUrl: orderResult.upi_deep_link, // Backend-generated UPI link
          metadata: {
            source: 'wallet_page',
            is_wallet_load: true
          }
        }
      });
    } catch (error) {
      console.error('Wallet load error:', error);
      toast.error('Failed to initiate wallet load');
    } finally {
      setIsProcessing(false);
    }
  };

  const getTransactionIcon = (type: string, direction: string) => {
    if (direction === 'credit') {
      return <TrendingUp className="w-5 h-5 text-green-600" />;
    }
    return <TrendingDown className="w-5 h-5 text-red-600" />;
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      wallet_load_upi: 'Wallet Load (UPI)',
      wallet_load_card: 'Wallet Load (Card)',
      wallet_payment: 'Order Payment',
      order_partial_wallet: 'Partial Payment',
      referral_bonus_earned: 'Referral Bonus',
      referral_bonus_received: 'Welcome Bonus',
      refund_to_wallet: 'Refund',
      cashback: 'Cashback',
      admin_adjustment_credit: 'Admin Credit',
      admin_adjustment_debit: 'Admin Debit'
    };
    return labels[type] || type;
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
      {/* Header */}
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-serif text-xl font-bold text-dark">My Wallet</h1>
        </div>
      </div>

      {/* Balance Card */}
      <div className="p-4">
        <Card className="border-2 border-border/40 bg-gradient-to-br from-dark to-canyon text-creme-light shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-90">Available Balance</span>
              <Wallet className="w-5 h-5 opacity-90" />
            </div>
            <div className="text-4xl font-bold mb-4">
              {isLoading ? '...' : formatINR(balance)}
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

      {/* Transaction History */}
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
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-border/20"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(txn.type, txn.direction)}
                      <div>
                        <p className="font-medium text-sm">{getTransactionLabel(txn.type)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          txn.direction === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {txn.direction === 'credit' ? '+' : '-'}
                        {formatINR(txn.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {txn.status === 'completed' ? '✓' : '⏳'} {txn.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Load Wallet Dialog */}
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
              <p className="text-xs text-muted-foreground mt-1">
                Min: ₹10 | Max: ₹50,000
              </p>
            </div>

            {/* Quick amounts */}
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
