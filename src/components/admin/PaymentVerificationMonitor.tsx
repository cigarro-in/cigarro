import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign,
  FileText,
  AlertCircle,
  Eye
} from 'lucide-react';
import { formatINR } from '../../utils/currency';

// Using transactions table instead of dropped payment_verification_logs
interface Transaction {
  id: string;
  internal_transaction_id: string;
  order_id?: string;
  user_id: string;
  amount: number;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment_method?: string;
  verified: boolean;
  created_at: string;
  completed_at?: string;
  order?: {
    id: string;
    status: string;
    shipping_name: string;
    shipping_phone: string;
  };
}

interface VerificationStats {
  total: number;
  verified: number;
  pending: number;
  failed: number;
  success_rate: number;
}

export function PaymentVerificationMonitor() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<VerificationStats>({
    total: 0,
    verified: 0,
    pending: 0,
    failed: 0,
    success_rate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchTransactions();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('transactions_monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      // Fetch transactions with order details
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          order:orders (
            id,
            status,
            shipping_name,
            shipping_phone
          )
        `)
        .in('type', ['order_payment', 'order_partial_gateway', 'wallet_load_upi'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching transactions:', error);
        throw error;
      }

      setTransactions(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const verified = data?.filter(t => t.status === 'completed' && t.verified).length || 0;
      const pending = data?.filter(t => t.status === 'pending').length || 0;
      const failed = data?.filter(t => t.status === 'failed').length || 0;
      const success_rate = total > 0 ? (verified / total) * 100 : 0;

      setStats({ total, verified, pending, failed, success_rate });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string, verified: boolean) => {
    if (status === 'completed' && verified) {
      return <Badge className="bg-green-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
    }
    switch (status) {
      case 'completed':
        return <Badge className="bg-blue-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const viewDetails = (txn: Transaction) => {
    setSelectedTransaction(txn);
    setShowDetails(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Attempts</p>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Verified</p>
                <p className="text-3xl font-bold text-green-900">{stats.verified}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-900">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Failed</p>
                <p className="text-3xl font-bold text-red-900">{stats.failed}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Success Rate</p>
                <p className="text-3xl font-bold text-purple-900">{stats.success_rate.toFixed(1)}%</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="bg-creme-light border-coyote">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif-premium text-dark">Recent Payment Transactions</CardTitle>
          <Button
            onClick={fetchTransactions}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="border-canyon text-canyon hover:bg-canyon hover:text-creme"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-canyon" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-dark/60">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-dark/40" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-coyote">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Transaction ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-coyote/30 hover:bg-creme transition-colors">
                      <td className="py-3 px-4 text-sm text-dark">
                        {new Date(txn.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-coyote/20 px-2 py-1 rounded">
                          {txn.internal_transaction_id}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-sm text-dark">
                        <div>
                          <p className="font-medium">{txn.order?.shipping_name || 'N/A'}</p>
                          <p className="text-xs text-dark/60">{txn.order?.shipping_phone || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-dark">
                        {formatINR(txn.amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-dark">
                        <Badge variant="outline">{txn.type.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(txn.status, txn.verified)}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          onClick={() => viewDetails(txn)}
                          size="sm"
                          variant="ghost"
                          className="text-canyon hover:text-canyon hover:bg-canyon/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {showDetails && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="font-serif-premium text-dark flex items-center justify-between">
                <span>Transaction Details</span>
                <Button
                  onClick={() => setShowDetails(false)}
                  size="sm"
                  variant="ghost"
                >
                  ✕
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Transaction Info */}
              <div className="bg-creme-light p-4 rounded-lg border border-coyote">
                <h3 className="font-semibold text-dark mb-3">Transaction Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-dark/60">Transaction ID</p>
                    <code className="text-dark font-mono">{selectedTransaction.internal_transaction_id}</code>
                  </div>
                  <div>
                    <p className="text-dark/60">Amount</p>
                    <p className="text-dark font-semibold">{formatINR(selectedTransaction.amount)}</p>
                  </div>
                  <div>
                    <p className="text-dark/60">Type</p>
                    <p className="text-dark">{selectedTransaction.type.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-dark/60">Payment Method</p>
                    <p className="text-dark">{selectedTransaction.payment_method || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              {selectedTransaction.order && (
                <div className="bg-white p-4 rounded-lg border border-coyote">
                  <h3 className="font-semibold text-dark mb-3">Order Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-dark/60">Customer</p>
                      <p className="text-dark">{selectedTransaction.order.shipping_name}</p>
                    </div>
                    <div>
                      <p className="text-dark/60">Phone</p>
                      <p className="text-dark">{selectedTransaction.order.shipping_phone}</p>
                    </div>
                    <div>
                      <p className="text-dark/60">Order Status</p>
                      <p className="text-dark">{selectedTransaction.order.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className={`p-4 rounded-lg border ${selectedTransaction.verified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <h3 className="font-semibold text-dark mb-3">Verification Status</h3>
                <div className="flex items-center gap-3">
                  {selectedTransaction.verified ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <Clock className="w-6 h-6 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium text-dark">
                      {selectedTransaction.verified ? 'Payment Verified' : 'Awaiting Verification'}
                    </p>
                    <p className="text-xs text-dark/60">
                      Status: {selectedTransaction.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-creme-light p-4 rounded-lg border border-coyote">
                <h3 className="font-semibold text-dark mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dark/60">Created</span>
                    <span className="text-dark">{new Date(selectedTransaction.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  {selectedTransaction.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-dark/60">Completed</span>
                      <span className="text-dark">{new Date(selectedTransaction.completed_at).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
