import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, RefreshCw, XCircle } from 'lucide-react';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { Req, ReqError, isBlank } from '../components/shared/requiredFields';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { convexUrl } from '../../lib/convex/client';
import { paiseToRupees } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';

// The browser knows the .cloud URL; the OAuth callback lives on .site.
const GMAIL_CALLBACK_URL =
  convexUrl.replace('.convex.cloud', '.convex.site') + '/gmailOAuthCallback';

type Tab = 'overview' | 'unmatched' | 'settings';

function initialTab(pathname: string): Tab {
  if (pathname.endsWith('/unmatched')) return 'unmatched';
  if (pathname.endsWith('/settings')) return 'settings';
  return 'overview';
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const org = useOrg();
  const [tab, setTab] = useState<Tab>(() => initialTab(location.pathname));

  // Keep tab in sync when arriving via a deep link / sidebar.
  useEffect(() => {
    setTab(initialTab(location.pathname));
  }, [location.pathname]);

  // Toast after returning from the Google OAuth bounce.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('gmail') === 'connected') {
      toast.success('Gmail connected — flip on polling');
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const settings = useQuery(
    api.organizations.getSettings,
    org ? { orgId: org._id } : 'skip',
  );
  const appConfig = useQuery(api.appConfig.get, {});
  const gmailStatus = useQuery(api.gmail.getGmailStatus, {});

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

  const tabs: Array<{ id: Tab; label: string; badge?: number | string; urgent?: boolean }> = [
    { id: 'overview', label: 'Overview', badge: pendingCount > 0 ? `${pendingCount} pending` : undefined },
    { id: 'unmatched', label: 'Unmatched', badge: unmatchedCount > 0 ? unmatchedCount : undefined, urgent: unmatchedCount > 0 },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader title="Payments" description="UPI payment operations">
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
      </PageHeader>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex gap-2 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-[var(--color-dark)] text-[var(--color-dark)]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
              {t.badge !== undefined && (
                <Badge variant={t.urgent ? 'destructive' : 'secondary'} className="ml-2">
                  {t.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab
            recentOrders={recentOrders}
            recentEmails={recentEmails}
            onViewUnmatched={() => setTab('unmatched')}
            onOpenOrder={(id: string) => navigate(`/admin/orders/${id}`)}
            onViewOrders={() => navigate('/admin/orders')}
          />
        )}
        {tab === 'unmatched' && <UnmatchedTab emails={unmatched} />}
        {tab === 'settings' && (
          <SettingsTab org={org} settings={settings} appConfig={appConfig} gmailStatus={gmailStatus} />
        )}
      </div>
    </div>
  );
}

// ---------- Overview ----------

function OverviewTab(props: {
  recentOrders: any[] | undefined;
  recentEmails: any[] | undefined;
  onViewUnmatched: () => void;
  onOpenOrder: (id: string) => void;
  onViewOrders: () => void;
}) {
  const { recentOrders, recentEmails } = props;
  const pending = (recentOrders ?? []).filter((o: any) => o.status === 'pending').slice(0, 5);

  return (
    <div className="space-y-6">
      <AdminCard>
        <AdminCardHeader className="flex flex-row items-center justify-between">
          <AdminCardTitle className="text-base">Recent bank emails</AdminCardTitle>
          <button onClick={props.onViewUnmatched} className="text-sm text-blue-600 hover:underline">
            View unmatched
          </button>
        </AdminCardHeader>
        <AdminCardContent>
          {recentEmails === undefined ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : recentEmails.length === 0 ? (
            <p className="text-sm text-gray-500">
              No emails ingested yet. Click <b>Check inbox now</b> after a bank transaction.
            </p>
          ) : (
            <div className="divide-y">
              {recentEmails.map((e) => (
                <BankEmailRow key={e._id} email={e} />
              ))}
            </div>
          )}
        </AdminCardContent>
      </AdminCard>

      <AdminCard>
        <AdminCardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Pending Orders</h3>
            <button onClick={props.onViewOrders} className="text-sm text-blue-600 hover:underline">
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
                  onClick={() => props.onOpenOrder(o._id)}
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
  );
}

// ---------- Unmatched ----------

function UnmatchedTab(props: { emails: any[] | undefined }) {
  const { emails } = props;
  return (
    <div className="space-y-3">
      {emails === undefined && <p>Loading...</p>}
      {emails && emails.length === 0 && (
        <AdminCard><AdminCardContent className="p-6 text-center text-gray-600">No unmatched emails</AdminCardContent></AdminCard>
      )}
      {emails && emails.length > 0 && (
        <AdminCard>
          <AdminCardContent className="divide-y">
            {emails.map((em: any) => (
              <BankEmailRow key={em._id} email={em} />
            ))}
          </AdminCardContent>
        </AdminCard>
      )}
    </div>
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
        {email.subject && (
          <div className="text-xs text-gray-500 italic truncate">{email.subject}</div>
        )}
      </div>
      <div className="text-xs text-gray-500 shrink-0">
        {new Date(email.receivedAt ?? email._creationTime).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}

// ---------- Settings ----------

function SettingsTab(props: { org: any; settings: any; appConfig: any; gmailStatus: any }) {
  const { org, settings, appConfig, gmailStatus } = props;
  const update = useMutation(api.organizations.updateSettings);
  const setAppConfig = useMutation(api.appConfig.set);
  const setGmailConfig = useMutation(api.gmail.setGmailConfig);
  const triggerGmailPoll = useAction(api.gmail.triggerPoll);

  const [upiVpa, setUpiVpa] = useState('');
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [slotTimeoutMin, setSlotTimeoutMin] = useState('10');
  const [quarantineMin, setQuarantineMin] = useState('20');
  const [slotsPerBase, setSlotsPerBase] = useState('100');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setUpiVpa(settings.upiVpa);
    setWalletEnabled(settings.walletEnabled);
    setSlotTimeoutMin(String(Math.round(settings.slotTimeoutMs / 60000)));
    setQuarantineMin(String(Math.round(settings.quarantineMs / 60000)));
    setSlotsPerBase(String(settings.slotsPerBase));
  }, [settings]);

  const slotMin = parseFloat(slotTimeoutMin);
  const quarantine = parseFloat(quarantineMin);
  const slots = parseInt(slotsPerBase, 10);
  const slotMinBad = !(slotMin >= 1 && slotMin <= 60);
  const quarantineBad = !(quarantine >= 0 && quarantine <= 1440);
  const slotsBad = !(Number.isInteger(slots) && slots >= 10 && slots <= 1000);

  const handleSaveGeneral = async () => {
    if (!org) return;
    setSaveAttempted(true);
    if (isBlank(upiVpa)) {
      toast.error('Primary UPI VPA is required');
      return;
    }
    if (slotMinBad || quarantineBad || slotsBad) {
      toast.error('Slot settings are out of range (see red fields)');
      return;
    }
    setSaving(true);
    try {
      await update({
        orgId: org._id,
        upiVpa: upiVpa.trim(),
        walletEnabled,
        slotTimeoutMs: Math.round(parseFloat(slotTimeoutMin) * 60000),
        quarantineMs: Math.round(parseFloat(quarantineMin) * 60000),
        slotsPerBase: parseInt(slotsPerBase, 10),
      });
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckInbox = async () => {
    try {
      const r: any = await triggerGmailPoll({ maxMessages: 20 });
      if (r?.error) toast.error(r.error);
      else if (r?.skipped) toast.message(`Skipped: ${r.skipped}`);
      else
        toast.success(
          `Checked ${r?.fetched ?? 0} email(s)` +
            (r?.matched ? `, ${r.matched} matched` : ', none matched a pending order'),
        );
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || 'Check failed');
    }
  };

  if (settings === undefined) return <p>Loading...</p>;

  return (
    <div className="max-w-[720px] space-y-4">
      <GmailConnectionCard
        status={gmailStatus}
        callbackUrl={GMAIL_CALLBACK_URL}
        onToggle={async (enabled) => {
          try {
            await setGmailConfig({
              enabled,
              ...(enabled && org ? { orgId: org._id } : {}),
            });
            toast.success(enabled ? 'Gmail polling enabled' : 'Gmail polling disabled');
          } catch (e: any) {
            toast.error(e?.data?.code || 'Failed to save');
          }
        }}
        onCheckInbox={handleCheckInbox}
      />

      <AdminCard>
        <AdminCardHeader><AdminCardTitle>UPI &amp; Slots</AdminCardTitle></AdminCardHeader>
        <AdminCardContent className="space-y-4">
          <div>
            <Label>Primary UPI VPA <Req /></Label>
            <Input
              value={upiVpa}
              onChange={(e) => setUpiVpa(e.target.value)}
              placeholder="store@ybl"
              aria-invalid={saveAttempted && isBlank(upiVpa)}
            />
            <ReqError show={saveAttempted && isBlank(upiVpa)} />
            <p className="text-xs text-gray-500 mt-1">
              This is the VPA embedded in the UPI deep-link customers see.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Wallet Enabled</Label>
            <Switch checked={walletEnabled} onCheckedChange={setWalletEnabled} />
          </div>
          <Button onClick={handleSaveGeneral} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </AdminCardContent>
      </AdminCard>

      <AdminCard>
        <AdminCardHeader>
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            {advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Advanced
          </button>
        </AdminCardHeader>
        {advancedOpen && (
          <AdminCardContent className="space-y-4">
            <div>
              <Label>Slot Timeout (minutes) <Req /></Label>
              <Input
                type="number"
                value={slotTimeoutMin}
                onChange={(e) => setSlotTimeoutMin(e.target.value)}
                min="1"
                max="60"
                aria-invalid={saveAttempted && slotMinBad}
              />
              <ReqError show={saveAttempted && slotMinBad}>
                Must be between 1 and 60 minutes
              </ReqError>
              <p className="text-xs text-gray-500 mt-1">How long a UPI slot is held (1–60 min).</p>
            </div>
            <div>
              <Label>Quarantine (minutes) <Req /></Label>
              <Input
                type="number"
                value={quarantineMin}
                onChange={(e) => setQuarantineMin(e.target.value)}
                min="0"
                max="1440"
                aria-invalid={saveAttempted && quarantineBad}
              />
              <ReqError show={saveAttempted && quarantineBad}>
                Must be between 0 and 1440 minutes
              </ReqError>
              <p className="text-xs text-gray-500 mt-1">Late-arrival grace window after expiry.</p>
            </div>
            <div>
              <Label>Slots Per Base Amount <Req /></Label>
              <Input
                type="number"
                value={slotsPerBase}
                onChange={(e) => setSlotsPerBase(e.target.value)}
                min="10"
                max="1000"
                aria-invalid={saveAttempted && slotsBad}
              />
              <ReqError show={saveAttempted && slotsBad}>
                Must be a whole number between 10 and 1000
              </ReqError>
              <p className="text-xs text-gray-500 mt-1">
                Unique paise offsets. Higher = more concurrent orders at same base.
              </p>
            </div>
            <div>
              <Label>Bank Email Alias (legacy)</Label>
              <Input value={settings.bankEmailAlias} disabled />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveGeneral} disabled={saving} variant="secondary">
                Save slot settings
              </Button>
            </div>
          </AdminCardContent>
        )}
      </AdminCard>

      <PlatformConfigCard
        customSenders={(appConfig as any)?.customBankSenders ?? []}
        defaultSenders={(appConfig as any)?.defaultBankSenders ?? []}
        mergedSenders={appConfig?.bankSenders ?? []}
        onSave={async (sendersCsv) => {
          try {
            await setAppConfig({
              bankSenders: sendersCsv
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter(Boolean),
            });
            toast.success('Platform config saved');
          } catch (e: any) {
            const code = e?.data?.code;
            if (code === 'NOT_PLATFORM_OWNER')
              toast.error('Only owners can edit platform config');
            else toast.error(code || 'Save failed');
          }
        }}
      />
    </div>
  );
}

function GmailConnectionCard(props: {
  status: any;
  callbackUrl: string;
  onToggle: (enabled: boolean) => void;
  onCheckInbox: () => void;
}) {
  const s = props.status;
  const [connecting, setConnecting] = useState(false);
  const connectUrl = useAction(api.gmail.getOAuthUrl);
  const disconnect = useMutation(api.gmail.disconnectGmail);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const r = await connectUrl({
        redirectUri: props.callbackUrl,
        returnTo: `${window.location.origin}/admin/payments/settings?gmail=connected`,
      });
      window.location.href = r.url;
    } catch (e: any) {
      toast.error(e?.data?.code || e?.message || 'Could not start Google connect');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Gmail? Order auto-confirm will stop.')) return;
    try {
      await disconnect({});
      toast.success('Gmail disconnected');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Disconnect failed');
    }
  };

  return (
    <AdminCard>
      <AdminCardHeader className="flex flex-row items-center justify-between">
        <AdminCardTitle>Bank-email connection</AdminCardTitle>
        {s === undefined ? (
          <Badge variant="outline">Loading…</Badge>
        ) : s.enabled && s.connected ? (
          <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Polling</Badge>
        ) : s.connected ? (
          <Badge variant="outline">Connected</Badge>
        ) : (
          <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Not connected</Badge>
        )}
      </AdminCardHeader>
      <AdminCardContent className="space-y-3">
        {s?.connected ? (
          <p className="text-sm text-gray-600">
            Reading bank alerts{s.accountEmail ? <> from <b>{s.accountEmail}</b></> : null} every
            5 minutes so orders auto-confirm.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Connect the inbox that receives bank alerts. Approve read-only
              access once — done.
            </p>
            {s && !s.configured && (
              <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
                Server keys missing (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET).
                Add them in the Convex dashboard → Settings → Environment Variables first.
              </p>
            )}
            <p className="text-xs text-gray-500">
              First time only: add this redirect URI in your Google Cloud OAuth client:{' '}
              <code className="font-mono break-all">{props.callbackUrl}</code>
            </p>
            <Button onClick={handleConnect} disabled={connecting || !s?.configured}>
              {connecting ? 'Opening Google…' : 'Connect with Google'}
            </Button>
          </>
        )}
        {s && s.lastError && (
          <p className="text-xs text-red-700">Last error: {s.lastError}</p>
        )}
        {s && s.lastPollAt && (
          <p className="text-xs text-gray-500">
            Last poll: {new Date(s.lastPollAt).toLocaleString()}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={!!s?.enabled} onCheckedChange={props.onToggle} disabled={!s?.connected} />
          <Label>Poll every 5 min</Label>
          <span className="flex-1" />
          {s?.connected && s?.connectedVia === 'google' && (
            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={props.onCheckInbox} disabled={!s?.connected}>
            <RefreshCw className="w-4 h-4 mr-2" /> Check inbox now
          </Button>
        </div>
      </AdminCardContent>
    </AdminCard>
  );
}

function PlatformConfigCard(props: {
  customSenders: string[];
  defaultSenders: string[];
  mergedSenders: string[];
  onSave: (sendersCsv: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [sendersCsv, setSendersCsv] = useState(props.customSenders.join('\n'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSendersCsv(props.customSenders.join('\n'));
  }, [props.customSenders]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await props.onSave(sendersCsv);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard>
      <AdminCardHeader>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Platform Config (owners only)
        </button>
      </AdminCardHeader>
      {open && (
        <AdminCardContent className="space-y-4">
          <p className="text-xs text-gray-500">
            These settings apply to every tenant. Only users with an <b>owner</b> role
            on any org can save.
          </p>
          <div>
            <Label>Additional bank-alert senders</Label>
            <textarea
              className="w-full rounded-md border border-gray-300 p-2 text-sm font-mono"
              rows={4}
              value={sendersCsv}
              onChange={(e) => setSendersCsv(e.target.value)}
              placeholder={'@icicibank.com\nalerts@sbi.co.in'}
            />
            <p className="text-xs text-gray-500 mt-1">
              One per line. Gmail <code>from:</code> patterns. These are <b>added</b>
              to the built-in defaults (HDFC) — they don't replace them. Max 20 entries.
            </p>
            <div className="mt-3 rounded-lg bg-gray-50 border p-3 text-xs">
              <p className="font-semibold mb-1">Currently searched ({props.mergedSenders.length})</p>
              <ul className="space-y-0.5">
                {props.mergedSenders.map((s) => (
                  <li key={s} className="font-mono text-gray-700">
                    {s}
                    {props.defaultSenders.includes(s) && (
                      <span className="text-gray-400 ml-2">(default)</span>
                    )}
                    {props.customSenders.includes(s) && !props.defaultSenders.includes(s) && (
                      <span className="text-blue-600 ml-2">(custom)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save platform config'}
          </Button>
        </AdminCardContent>
      )}
    </AdminCard>
  );
}
