import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  MailQuestion,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { useState } from 'react';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { paiseToRupees } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';

export function PaymentsPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const checkInbox = useAction(api.gmail.triggerPoll);
  const [checking, setChecking] = useState(false);

  const recentOrders = useQuery(
    api.admin.listRecentOrders,
    org ? { orgId: org._id, limit: 20 } : 'skip',
  );
  const unmatched = useQuery(
    api.admin.listUnmatchedEmails,
    org ? { orgId: org._id } : 'skip',
  );
  const recentEmails = useQuery(
    api.admin.listRecentBankEmails,
    org ? { orgId: org._id, limit: 10 } : 'skip',
  );

  const pendingCount = recentOrders?.filter((o: any) => o.status === 'pending').length ?? 0;
  const unmatchedCount = unmatched?.length ?? 0;

  const handleCheckInbox = async () => {
    setChecking(true);
    try {
      const r: any = await checkInbox({ maxMessages: 20 });
      if (r?.error) {
        toast.error(`Inbox check failed: ${r.error}`);
      } else if (r?.skipped) {
        toast.message(`Skipped: ${r.skipped}`);
      } else if ((r?.fetched ?? 0) === 0) {
        toast.message('Inbox check complete — no new bank emails.');
      } else {
        toast.success(
          `Checked — ${r.fetched} email${r.fetched === 1 ? '' : 's'}${r.matched ? `, ${r.matched} matched` : ''}${r.duplicates ? `, ${r.duplicates} duplicate` : ''}`,
        );
      }
    } catch (e: any) {
      toast.error(e?.data?.code || e?.message || 'Inbox check failed');
    } finally {
      setChecking(false);
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
      description: 'UPI VPA, Gmail polling, bank senders',
      icon: SlidersHorizontal,
      path: '/admin/payments/settings',
    },
  ];

  const pending = (recentOrders ?? []).filter((o: any) => o.status === 'pending').slice(0, 5);

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader title="Payments" description="UPI payment operations">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckInbox}
            disabled={checking}
            title="Poll Gmail now for new bank-alert emails"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check inbox now'}
          </Button>
        </div>
      </PageHeader>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tiles.map((t) => (
            <AdminCard
              key={t.path}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(t.path)}
            >
              <AdminCardContent className="p-5 flex items-center gap-4">
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
              </AdminCardContent>
            </AdminCard>
          ))}
        </div>

        <RecentBankEmailsCard
          emails={recentEmails}
          navigate={navigate}
        />

        <AdminCard>
          <AdminCardContent className="p-5">
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
          </AdminCardContent>
        </AdminCard>
      </div>
    </div>
  );
}

function RecentBankEmailsCard({
  emails,
  navigate,
}: {
  emails: any[] | undefined;
  navigate: (path: string) => void;
}) {
  return (
    <AdminCard>
      <AdminCardHeader className="flex flex-row items-center justify-between">
        <AdminCardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4" /> Recent bank emails
        </AdminCardTitle>
        <button
          onClick={() => navigate('/admin/payments/unmatched')}
          className="text-sm text-blue-600 hover:underline"
        >
          View unmatched
        </button>
      </AdminCardHeader>
      <AdminCardContent>
        {emails === undefined ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : emails.length === 0 ? (
          <p className="text-sm text-gray-500">
            No emails ingested yet. Click <b>Check inbox now</b> after a bank transaction.
          </p>
        ) : (
          <div className="divide-y">
            {emails.map((e) => (
              <BankEmailRow key={e._id} email={e} />
            ))}
          </div>
        )}
      </AdminCardContent>
    </AdminCard>
  );
}

function BankEmailRow({ email }: { email: any }) {
  const statusColor =
    email.status === 'matched' ? 'bg-green-100 text-green-800' :
    email.status === 'duplicate' ? 'bg-yellow-100 text-yellow-800' :
    email.status === 'no_match' ? 'bg-orange-100 text-orange-800' :
    email.status === 'parse_failed' ? 'bg-red-100 text-red-800' :
    'bg-gray-100 text-gray-800';

  return (
    <div className="py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">
            {email.amountPaise > 0 ? formatINR(paiseToRupees(email.amountPaise)) : '—'}
          </span>
          <Badge className={statusColor}>{email.status}</Badge>
          {email.bankKey && (
            <Badge variant="outline" className="text-xs">
              {email.bankKey.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="text-xs text-gray-600 truncate">
          {email.senderEmail}
          {email.payerVpa && <span> · payer: <b>{email.payerVpa}</b></span>}
          {email.payerName && <span> ({email.payerName})</span>}
        </div>
        {email.upiRef && (
          <div className="text-xs text-gray-500 font-mono truncate">
            ref: {email.upiRef}
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500 shrink-0">
        {new Date(email.receivedAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
