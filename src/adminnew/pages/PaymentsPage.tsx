import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  MailQuestion,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Mail,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { paiseToRupees } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';

type TraceStep = {
  step: string;
  ok: boolean;
  ms: number;
  [k: string]: any;
};
type ScanResult = {
  ok?: boolean;
  skipped?: string;
  error?: string;
  message?: string;
  body?: string;
  fetched?: number;
  ingested?: number;
  matched?: number;
  duplicates?: number;
  parseFailures?: number;
  skippedMissingFields?: number;
  ingestResults?: Array<{
    messageId: string;
    from?: string;
    matched?: boolean;
    duplicate?: boolean;
    parsed?: boolean;
    orgNotFound?: boolean;
    via?: string;
  }>;
  trace?: TraceStep[];
  totalMs?: number;
  timeoutMs?: number;
  reason?: string;
};

export function PaymentsPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const adminScan = useAction(api.scheduler.adminScan);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{ at: Date; result: ScanResult } | null>(null);

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

  const handleScan = async () => {
    if (!org) return;
    setScanning(true);
    setLastScan(null);
    try {
      const result = (await adminScan({ orgId: org._id })) as ScanResult;
      setLastScan({ at: new Date(), result });
      if (result?.error) {
        toast.error(`Scan failed: ${result.error}`);
      } else if (result?.skipped) {
        toast.message(`Scan skipped: ${result.skipped}`);
      } else {
        const { ingested = 0, matched = 0, duplicates = 0 } = result;
        toast.success(
          `Scanned — ${ingested} email${ingested === 1 ? '' : 's'}${matched ? `, ${matched} matched` : ''}${duplicates ? `, ${duplicates} duplicate` : ''}`,
        );
      }
    } catch (e: any) {
      toast.error(e?.data?.code || e?.message || 'Scan failed');
    } finally {
      setScanning(false);
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

        {lastScan && <ScanResultCard at={lastScan.at} result={lastScan.result} />}

        <RecentBankEmailsCard
          emails={recentEmails}
          navigate={navigate}
        />

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

function ScanResultCard({ at, result }: { at: Date; result: ScanResult }) {
  const failed = !!result.error;
  const skipped = !!result.skipped;
  const { fetched = 0, ingested = 0, matched = 0, duplicates = 0, parseFailures = 0 } = result;
  const [traceOpen, setTraceOpen] = useState(true);

  return (
    <Card className={failed ? 'border-red-300' : skipped ? 'border-yellow-300' : 'border-green-300'}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {failed ? (
              <XCircle className="w-5 h-5 text-red-600" />
            ) : skipped ? (
              <Clock className="w-5 h-5 text-yellow-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
            <h3 className="font-semibold">Last scan</h3>
            <Badge variant="outline" className="text-xs">
              {result.reason || 'admin_scan'}
            </Badge>
            {typeof result.totalMs === 'number' && (
              <Badge variant="outline" className="text-xs">
                {result.totalMs}ms total
              </Badge>
            )}
          </div>
          <span className="text-xs text-gray-500">{at.toLocaleTimeString()}</span>
        </div>

        {failed && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
            <div className="font-semibold text-red-800">{result.error}</div>
            {result.message && (
              <div className="text-red-700 mt-1">{result.message}</div>
            )}
            {result.timeoutMs && (
              <div className="text-red-600 text-xs mt-1">timeout was {result.timeoutMs}ms</div>
            )}
            {result.body && (
              <pre className="mt-2 text-xs text-red-900 bg-red-100 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {result.body}
              </pre>
            )}
            <div className="text-xs text-gray-600 mt-2">
              {result.error === 'gas_fetch_timeout' && (
                <>GAS took longer than the timeout. Cold starts can be slow on first run of the day — retry once. If persistent, check your Apps Script Executions log.</>
              )}
              {result.error === 'gas_fetch_failed' && (
                <>Network or GAS error before a response came back. Verify the webhook URL in Payment Settings ends with <code>/exec</code>.</>
              )}
              {result.error?.startsWith('gas_http_') && (
                <>GAS returned a non-2xx status. 401/403 means secret mismatch; 500 means Apps Script threw — check Executions log.</>
              )}
              {result.error === 'gas_response_not_json' && (
                <>GAS returned a non-JSON response. Usually means the script errored during Gmail access. Check Executions log.</>
              )}
            </div>
          </div>
        )}

        {skipped && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-900">
            Skipped: <b>{result.skipped}</b>
            {result.skipped === 'no_pending_orders' && (
              <div className="text-yellow-800 text-xs mt-1">
                A scheduled poke found no active orders. Manual scans bypass this.
              </div>
            )}
            {result.skipped === 'no_gas_config' && (
              <div className="text-yellow-800 text-xs mt-1">
                No Apps Script webhook URL/secret saved. Go to Payment Settings → Connect Gmail.
              </div>
            )}
          </div>
        )}

        {!failed && !skipped && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Fetched" value={fetched} />
            <Stat label="Ingested" value={ingested} />
            <Stat label="Matched" value={matched} tone={matched > 0 ? 'good' : 'neutral'} />
            <Stat label="Duplicates" value={duplicates} />
            <Stat label="Parse failed" value={parseFailures} tone={parseFailures > 0 ? 'bad' : 'neutral'} />
          </div>
        )}

        {/* Per-email breakdown */}
        {result.ingestResults && result.ingestResults.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Emails processed</h4>
            <div className="divide-y rounded-lg border text-sm">
              {result.ingestResults.map((r, i) => (
                <div key={i} className="p-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs truncate">{r.from || 'unknown sender'}</div>
                    <div className="text-xs text-gray-500 truncate">msg: {r.messageId}</div>
                  </div>
                  <div className="flex gap-1">
                    {r.matched && <Badge className="bg-green-100 text-green-800">matched</Badge>}
                    {r.duplicate && <Badge className="bg-yellow-100 text-yellow-800">duplicate</Badge>}
                    {r.parsed === false && <Badge className="bg-red-100 text-red-800">parse failed</Badge>}
                    {r.orgNotFound && <Badge className="bg-red-100 text-red-800">org not found</Badge>}
                    {r.via && <Badge variant="outline" className="text-xs">{r.via}</Badge>}
                    {!r.matched && !r.duplicate && r.parsed !== false && !r.orgNotFound && (
                      <Badge variant="outline" className="text-xs">no match</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full step trace (collapsible) */}
        {result.trace && result.trace.length > 0 && (
          <div>
            <button
              onClick={() => setTraceOpen((v) => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {traceOpen ? 'Hide' : 'Show'} step-by-step trace ({result.trace.length} steps)
            </button>
            {traceOpen && (
              <div className="mt-2 rounded-lg border bg-gray-50 font-mono text-[11px] divide-y">
                {result.trace.map((step, i) => (
                  <div key={i} className={`p-2 ${step.ok ? 'text-gray-800' : 'text-red-700 bg-red-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={step.ok ? 'text-green-700' : 'text-red-600'}>
                        {step.ok ? '✓' : '✗'}
                      </span>
                      <b className="text-[12px]">{step.step}</b>
                      <span className="text-gray-500">{step.ms}ms</span>
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-gray-600">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(step).filter(
                            ([k]) => !['step', 'ok', 'ms'].includes(k),
                          ),
                        ),
                        null,
                        1,
                      )}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'good' | 'neutral' | 'bad' }) {
  const color =
    tone === 'good' ? 'text-green-700' :
    tone === 'bad' ? 'text-red-700' :
    'text-gray-900';
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4" /> Recent bank emails
        </CardTitle>
        <button
          onClick={() => navigate('/admin/payments/unmatched')}
          className="text-sm text-blue-600 hover:underline"
        >
          View unmatched
        </button>
      </CardHeader>
      <CardContent>
        {emails === undefined ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : emails.length === 0 ? (
          <p className="text-sm text-gray-500">
            No emails ingested yet. Click <b>Scan inbox now</b> after a bank transaction.
          </p>
        ) : (
          <div className="divide-y">
            {emails.map((e) => (
              <BankEmailRow key={e._id} email={e} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
