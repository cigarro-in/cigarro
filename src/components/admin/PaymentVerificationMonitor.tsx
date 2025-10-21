import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Mail, 
  DollarSign,
  FileText,
  AlertCircle,
  Eye,
  Search
} from 'lucide-react';
import { formatINR } from '../../utils/currency';

interface PaymentLog {
  id: string;
  order_id: string;
  transaction_id: string;
  amount: number;
  status: 'pending' | 'verified' | 'failed';
  email_found: boolean;
  email_parsed: boolean;
  amount_matched: boolean;
  bank_name: string | null;
  upi_reference: string | null;
  error_message: string | null;
  created_at: string;
  verified_at: string | null;
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
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [stats, setStats] = useState<VerificationStats>({
    total: 0,
    verified: 0,
    pending: 0,
    failed: 0,
    success_rate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<PaymentLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchLogs();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('payment_verification_logs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_verification_logs'
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching payment verification logs...');
      // Fetch logs with order details
      const { data: logsData, error: logsError } = await supabase
        .from('payment_verification_logs')
        .select(`
          *,
          order:orders!payment_verification_logs_order_id_fkey (
            id,
            status,
            shipping_name,
            shipping_phone
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) {
        console.error('Error fetching logs:', logsError);
        throw logsError;
      }

      console.log('Fetched logs:', logsData);
      setLogs(logsData || []);

      // Calculate stats
      const total = logsData?.length || 0;
      const verified = logsData?.filter(l => l.status === 'verified').length || 0;
      const pending = logsData?.filter(l => l.status === 'pending').length || 0;
      const failed = logsData?.filter(l => l.status === 'failed').length || 0;
      const success_rate = total > 0 ? (verified / total) * 100 : 0;

      setStats({ total, verified, pending, failed, success_rate });
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch verification logs');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStepStatus = (completed: boolean) => {
    return completed ? (
      <CheckCircle2 className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const viewDetails = (log: PaymentLog) => {
    setSelectedLog(log);
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

      {/* Logs Table */}
      <Card className="bg-creme-light border-coyote">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif-premium text-dark">Recent Verification Logs</CardTitle>
          <Button
            onClick={fetchLogs}
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
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-dark/60">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-dark/40" />
              <p>No verification logs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-coyote">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Order ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Steps</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Bank</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-coyote/30 hover:bg-creme transition-colors">
                      <td className="py-3 px-4 text-sm text-dark">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-coyote/20 px-2 py-1 rounded">
                          {log.transaction_id}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-sm text-dark">
                        <div>
                          <p className="font-medium">{log.order?.shipping_name || 'N/A'}</p>
                          <p className="text-xs text-dark/60">{log.order?.shipping_phone || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-dark">
                        {formatINR(log.amount)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1" title="Email Found">
                            <Mail className="w-4 h-4 text-dark/40" />
                            {getStepStatus(log.email_found)}
                          </div>
                          <div className="flex items-center gap-1" title="Email Parsed">
                            <Search className="w-4 h-4 text-dark/40" />
                            {getStepStatus(log.email_parsed)}
                          </div>
                          <div className="flex items-center gap-1" title="Amount Matched">
                            <DollarSign className="w-4 h-4 text-dark/40" />
                            {getStepStatus(log.amount_matched)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-dark">
                        {log.bank_name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          onClick={() => viewDetails(log)}
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
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="font-serif-premium text-dark flex items-center justify-between">
                <span>Verification Details</span>
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
              {/* Order Info */}
              <div className="bg-creme-light p-4 rounded-lg border border-coyote">
                <h3 className="font-semibold text-dark mb-3">Order Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-dark/60">Transaction ID</p>
                    <code className="text-dark font-mono">{selectedLog.transaction_id}</code>
                  </div>
                  <div>
                    <p className="text-dark/60">Amount</p>
                    <p className="text-dark font-semibold">{formatINR(selectedLog.amount)}</p>
                  </div>
                  <div>
                    <p className="text-dark/60">Customer</p>
                    <p className="text-dark">{selectedLog.order?.shipping_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-dark/60">Phone</p>
                    <p className="text-dark text-xs">{selectedLog.order?.shipping_phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Verification Steps */}
              <div className="bg-white p-4 rounded-lg border border-coyote">
                <h3 className="font-semibold text-dark mb-3">Verification Process</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {getStepStatus(selectedLog.email_found)}
                    <div>
                      <p className="font-medium text-dark">Email Found</p>
                      <p className="text-xs text-dark/60">
                        {selectedLog.email_found ? 'Payment email received in inbox' : 'No matching email found'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStepStatus(selectedLog.email_parsed)}
                    <div>
                      <p className="font-medium text-dark">Email Parsed</p>
                      <p className="text-xs text-dark/60">
                        {selectedLog.email_parsed ? 'Successfully extracted payment details' : 'Failed to parse email content'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStepStatus(selectedLog.amount_matched)}
                    <div>
                      <p className="font-medium text-dark">Amount Matched</p>
                      <p className="text-xs text-dark/60">
                        {selectedLog.amount_matched ? 'Payment amount matches order total' : 'Amount mismatch detected'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {selectedLog.bank_name && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-dark mb-3">Payment Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-dark/60">Bank</p>
                      <p className="text-dark font-medium">{selectedLog.bank_name}</p>
                    </div>
                    {selectedLog.upi_reference && (
                      <div>
                        <p className="text-dark/60">UPI Reference</p>
                        <code className="text-dark text-xs">{selectedLog.upi_reference}</code>
                      </div>
                    )}
                    {selectedLog.verified_at && (
                      <div>
                        <p className="text-dark/60">Verified At</p>
                        <p className="text-dark">{new Date(selectedLog.verified_at).toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedLog.error_message && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Error Details
                  </h3>
                  <p className="text-sm text-red-800">{selectedLog.error_message}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="bg-creme-light p-4 rounded-lg border border-coyote">
                <h3 className="font-semibold text-dark mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dark/60">Created</span>
                    <span className="text-dark">{new Date(selectedLog.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  {selectedLog.verified_at && (
                    <div className="flex justify-between">
                      <span className="text-dark/60">Verified</span>
                      <span className="text-dark">{new Date(selectedLog.verified_at).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {selectedLog.verified_at && (
                    <div className="flex justify-between">
                      <span className="text-dark/60">Duration</span>
                      <span className="text-dark font-semibold">
                        {Math.round((new Date(selectedLog.verified_at).getTime() - new Date(selectedLog.created_at).getTime()) / 1000)}s
                      </span>
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
