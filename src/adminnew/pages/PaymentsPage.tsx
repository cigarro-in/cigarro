import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  MailQuestion,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { paiseToRupees } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';

export function PaymentsPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const adminScan = useMutation(api.scheduler.adminScan);
  const [scanning, setScanning] = useState(false);

  const recentOrders = useQuery(
    api.admin.listRecentOrders,
    org ? { orgId: org._id, limit: 20 } : 'skip',
  );
  const unmatched = useQuery(
    api.admin.listUnmatchedEmails,
    org ? { orgId: org._id } : 'skip',
  );

  const pendingCount = recentOrders?.filter((o: any) => o.status === 'pending').length ?? 0;
  const unmatchedCount = unmatched?.length ?? 0;

  const handleScan = async () => {
    if (!org) return;
    setScanning(true);
    try {
      await adminScan({ orgId: org._id });
      toast.success('Scan triggered — results appear within seconds.');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Scan failed');
    } finally {
      setTimeout(() => setScanning(false), 4000);
    }
  };

  const tiles = [
    {
      label: 'Orders',
      description: 'All orders with payment status',
      icon: ShoppingCart,
      badge: pendingCount > 0 ? `${pendingCount} pending` : undefined,
      path: '/admin/orders',
    },
    {
      label: 'Unmatched Emails',
      description: 'Bank emails with no matching order',
      icon: MailQuestion,
      badge: unmatchedCount > 0 ? `${unmatchedCount}` : undefined,
      path: '/admin/payments/unmatched',
      urgent: unmatchedCount > 0,
    },
    {
      label: 'Payment Settings',
      description: 'UPI VPA, bank inbox, Apps Script connection',
      icon: SlidersHorizontal,
      path: '/admin/payments/settings',
    },
  ];

  const pending = (recentOrders ?? []).filter((o: any) => o.status === 'pending').slice(0, 5);

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader title="Payments" description="UPI payment operations">
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={scanning}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan inbox now'}
        </Button>
      </PageHeader>
      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tiles.map((t) => (
            <Card
              key={t.path}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(t.path)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--color-dark)] text-[var(--color-creme)] flex items-center justify-center shrink-0">
                  <t.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.label}</h3>
                    {t.badge && (
                      <Badge variant={t.urgent ? 'destructive' : 'secondary'}>{t.badge}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 truncate">{t.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Pending Orders</h3>
              <button
                onClick={() => navigate('/admin/orders')}
                className="text-sm text-blue-600 hover:underline"
              >
                View all
              </button>
            </div>
            {recentOrders === undefined ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-gray-500">No pending orders</p>
            ) : (
              <div className="space-y-2">
                {pending.map((o: any) => (
                  <div
                    key={o._id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/orders/${o._id}`)}
                  >
                    <div>
                      <p className="font-mono text-sm">#{o.displayOrderId}</p>
                      <p className="text-xs text-gray-500">
                        {o.address?.name || 'Wallet load'} • {new Date(o._creationTime).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatINR(paiseToRupees(o.finalAmountPaise))}</p>
                      <Badge variant="outline" className="text-xs">pending</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
