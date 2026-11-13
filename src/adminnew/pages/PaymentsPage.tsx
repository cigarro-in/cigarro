import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { PageHeader } from '../components/shared/PageHeader';
import { Req, ReqError, isBlank } from '../components/shared/requiredFields';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { adminAbsoluteUrl } from '../lib/paths';
import { convexUrl } from '../../lib/convex/client';
import { paiseToRupees } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';
import { orderNumberOf } from '../../../convex/lib/ids';

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

  // After returning from the Google OAuth bounce, strip the query param.
  // No toast at all: the card flipping to Active in place is the
  // confirmation. (A success toast here would violate the errors-only policy
  // and fire on every return from Google.)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('gmail') === 'connected') {
      navigate(location.pathname, { replace: true });
    }
  }, []);

  const { status: opStatus, setError: setOpError } = useInlineStatus();

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
  // null = caller is not an admin of this org (UI shows "Unavailable").
  const gmailStatus = useQuery(
    api.gmail.getGmailStatus,
    org ? { orgId: org._id } : 'skip',
  );

  const pendingCount = recentOrders?.filter((o: any) => o.status === 'pending').length ?? 0;
  const unmatchedCount = unmatched?.length ?? 0;

  const tabs: Array<{ id: Tab; label: string; badge?: number | string; urgent?: boolean }> = [
    { id: 'overview', label: 'Overview', badge: pendingCount > 0 ? `${pendingCount} pending` : undefined },
    { id: 'unmatched', label: 'Unmatched', badge: unmatchedCount > 0 ? unmatchedCount : undefined, urgent: unmatchedCount > 0 },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Payments" description="UPI payment operations" />
      <div className="mx-auto flex max-w-400 flex-col gap-4 px-4 py-4 sm:px-6">
        <InlineStatus status={opStatus} />
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
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
            onOpenOrder={(id: string) => navigate(`/orders/${id}`)}
            onViewOrders={() => navigate('/orders')}
          />
        )}
        {tab === 'unmatched' && <UnmatchedTab emails={unmatched} />}
        {tab === 'settings' && (
          <SettingsTab org={org} settings={settings} gmailStatus={gmailStatus} />
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
          <button onClick={props.onViewUnmatched} className="text-sm text-info hover:underline">
            View unmatched
          </button>
        </AdminCardHeader>
        <AdminCardContent>
          {recentEmails === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : recentEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No emails ingested yet. Bank alerts appear here automatically after a bank transaction.
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
            <button onClick={props.onViewOrders} className="text-sm text-info hover:underline">
              View all
            </button>
          </div>
          {recentOrders === undefined ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending orders</p>
          ) : (
            <div className="space-y-2">
              {pending.map((o: any) => (
                <div
                  key={o._id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted cursor-pointer"
                  onClick={() => props.onOpenOrder(o._id)}
                >
                  <div>
                    <p className="font-mono text-sm font-semibold">#{orderNumberOf(o) ?? o.displayOrderId}</p>
                    {orderNumberOf(o) !== undefined && (
                      <p className="font-mono text-[11px] text-muted-foreground">{o.displayOrderId}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
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
        <AdminCard><AdminCardContent className="p-6 text-center text-muted-foreground">No unmatched emails</AdminCardContent></AdminCard>
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
  const [open, setOpen] = useState(false);
  const statusColor =
    email.status === 'matched' ? 'bg-success-muted text-success' :
    email.status === 'duplicate' ? 'bg-warning-muted text-warning' :
    email.status === 'no_match' ? 'bg-warning-muted text-warning' :
    email.status === 'no_candidate' ? 'bg-warning-muted text-warning' :
    email.status === 'parse_failed' ? 'bg-destructive text-destructive-foreground' :
    email.status === 'ignored' ? 'bg-muted text-muted-foreground' :
    'bg-muted text-foreground';
  const statusHint =
    email.status === 'no_candidate' ? ' — no pending order within ₹2' :
    email.status === 'parse_failed' ? ' — amount unreadable, check template' :
    '';

  return (
    <div className="py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">
            {email.amountPaise > 0 ? formatINR(paiseToRupees(email.amountPaise)) : '—'}
          </span>
          <Badge className={statusColor}>{email.status}{statusHint}</Badge>
          {email.bankKey && (
            <Badge variant="outline" className="text-xs">
              {email.bankKey.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {email.senderEmail}
          {email.payerVpa && <span> · payer: <b>{email.payerVpa}</b></span>}
          {email.payerName && <span> ({email.payerName})</span>}
        </div>
        {email.upiRef && (
          <div className="text-xs text-muted-foreground font-mono truncate">
            ref: {email.upiRef}
          </div>
        )}
        {email.subject && (
          <div className="text-xs text-muted-foreground italic truncate">{email.subject}</div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs text-info hover:underline"
        >
          {open ? 'Hide full email' : 'View full email'}
        </button>
        {open && email.rawBody && (
          <pre className="mt-2 text-xs text-foreground whitespace-pre-wrap break-words max-h-96 overflow-auto rounded border bg-muted p-3 font-mono">
            {email.rawBody}
          </pre>
        )}
      </div>
      <div className="text-xs text-muted-foreground shrink-0">
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

function SettingsTab(props: { org: any; settings: any; gmailStatus: any }) {
  const { org, settings, gmailStatus } = props;
  const update = useMutation(api.organizations.updateSettings);

  const [upiVpa, setUpiVpa] = useState('');
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [luckyEnabled, setLuckyEnabled] = useState(true);
  const [slotTimeoutMin, setSlotTimeoutMin] = useState('10');
  const [quarantineMin, setQuarantineMin] = useState('20');
  const [slotsPerBase, setSlotsPerBase] = useState('100');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Inline save confirmation (replaces the old success toast).
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const { status: settingsStatus, setError: setSettingsError } = useInlineStatus();

  useEffect(() => {
    if (!settings) return;
    setUpiVpa(settings.upiVpa);
    setWalletEnabled(settings.walletEnabled);
    setLuckyEnabled(settings.luckyEnabled ?? true);
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
      setSettingsError('Primary UPI VPA is required');
      return;
    }
    if (slotMinBad || quarantineBad || slotsBad) {
      setSettingsError('Slot settings are out of range (see red fields)');
      return;
    }
    setSaving(true);
    try {
      await update({
        orgId: org._id,
        upiVpa: upiVpa.trim(),
        walletEnabled,
        luckyEnabled,
        slotTimeoutMs: Math.round(parseFloat(slotTimeoutMin) * 60000),
        quarantineMs: Math.round(parseFloat(quarantineMin) * 60000),
        slotsPerBase: parseInt(slotsPerBase, 10),
      });
      // No success toast: the inline note + persisted field values confirm it.
      setSavedNote(`Saved ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e: any) {
      setSettingsError(e?.data?.code || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (settings === undefined) return <p>Loading...</p>;

  return (
    <div className="max-w-180 space-y-4">
      <InlineStatus status={settingsStatus} />
      <GmailConnectionCard
        status={gmailStatus}
        orgId={org?._id}
        callbackUrl={GMAIL_CALLBACK_URL}
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
            <p className="text-xs text-muted-foreground mt-1">
              This is the VPA embedded in the UPI deep-link customers see.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Wallet Enabled</Label>
            <Switch checked={walletEnabled} onCheckedChange={setWalletEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Lucky Discount</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                1–99p fingerprint for exact-amount matching. Only needed at high traffic — off = exact rupee totals.
              </p>
            </div>
            <Switch checked={luckyEnabled} onCheckedChange={setLuckyEnabled} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveGeneral} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            {savedNote && <span className="text-xs text-success">{savedNote}</span>}
          </div>
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
              <p className="text-xs text-muted-foreground mt-1">How long a UPI slot is held (1–60 min).</p>
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
              <p className="text-xs text-muted-foreground mt-1">Late-arrival grace window after expiry.</p>
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
              <p className="text-xs text-muted-foreground mt-1">
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

      <p className="text-xs text-muted-foreground">
        Platform bank-sender config moved to the super-admin app (Platform config).
      </p>
    </div>
  );
}

function GmailConnectionCard(props: {
  status: any;
  orgId: any;
  callbackUrl: string;
}) {
  const s = props.status;
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { status: gmailOpStatus, setError: setGmailError, clear: clearGmailStatus } = useInlineStatus();
  const connectUrl = useAction(api.gmail.getOAuthUrl);
  const disconnect = useAction(api.gmail.disconnectGmail);

  // Per-store connection state. undefined = loading, null = not connected
  // (or caller is not an org admin).
  const connState: 'loading' | 'active' | 'needs_reconnect' | 'none' =
    s === undefined ? 'loading'
      : s === null ? 'none'
      : s.status === 'active' ? 'active'
      : s.status === 'needs_reconnect' ? 'needs_reconnect'
      : 'none';

  const handleConnect = async () => {
    if (!props.orgId) {
      setGmailError('No store selected');
      return;
    }
    setConnecting(true);
    clearGmailStatus();
    try {
      const r = await connectUrl({
        orgId: props.orgId,
        returnTo: adminAbsoluteUrl('/payments/settings') + '?gmail=connected',
      });
      window.location.href = r.url;
    } catch (e: any) {
      setGmailError(e?.data?.code || e?.message || 'Could not start Google connect');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!props.orgId) return;
    if (!confirm('Disconnect Gmail for this store? Order auto-confirm stops until you reconnect.')) return;
    setDisconnecting(true);
    clearGmailStatus();
    try {
      const r: any = await disconnect({ orgId: props.orgId });
      // The card flips to Not connected in place. If Google could not confirm
      // the revoke, say so inline so the admin can remove access manually.
      if (r && r.revoked === false) {
        setGmailError(
          'Disconnected here, but Google did not confirm revocation. Remove the app at myaccount.google.com/permissions to be sure.',
        );
      }
    } catch (e: any) {
      setGmailError(e?.data?.code || 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const lastErrorAt = s?.lastErrorAt ? new Date(s.lastErrorAt).toLocaleString() : null;
  const lastSuccessAt = s?.lastSuccessAt ? new Date(s.lastSuccessAt).toLocaleString() : null;

  return (
    <AdminCard>
      <AdminCardHeader className="flex flex-row items-center justify-between">
        <AdminCardTitle>Bank-email connection</AdminCardTitle>
        {connState === 'loading' ? (
          <Badge variant="outline">Loading…</Badge>
        ) : connState === 'active' ? (
          <Badge className="bg-success-muted text-success"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
        ) : connState === 'needs_reconnect' ? (
          <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Reconnect needed</Badge>
        ) : (
          <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Not connected</Badge>
        )}
      </AdminCardHeader>
      <AdminCardContent className="space-y-3">
        <InlineStatus status={gmailOpStatus} />

        {connState === 'needs_reconnect' && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
            <p className="text-sm font-semibold text-destructive">
              Gmail access expired or was revoked
              {s.accountEmail ? <> for <b>{s.accountEmail}</b></> : null}.
            </p>
            <p className="text-xs text-destructive">
              Bank alerts are not being read, so pending orders will not auto-confirm
              until you reconnect.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Opening Google…' : 'Reconnect Gmail'}
            </Button>
          </div>
        )}

        {connState === 'active' && (
          <p className="text-sm text-muted-foreground">
            Reading bank alerts{s.accountEmail ? <> from <b>{s.accountEmail}</b></> : null}.
            Pending orders auto-confirm — no schedule to manage.
          </p>
        )}

        {connState === 'none' && (
          <>
            <p className="text-sm text-muted-foreground">
              Connect the inbox that receives this store's bank alerts. Approve read-only
              access once — done.
            </p>
            {s === null && (
              <p className="text-xs text-muted-foreground">
                Connection status is only visible to organization owners and admins.
              </p>
            )}
            {s && !s.configured && (
              <p className="text-xs text-warning bg-warning-muted border border-warning-muted rounded p-2">
                Server keys missing (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_TOKEN_KEY).
                Add them in the Convex dashboard → Settings → Environment Variables first.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              First time only: add this redirect URI in your Google Cloud OAuth client:{' '}
              <code className="font-mono break-all">{props.callbackUrl}</code>
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Opening Google…' : 'Connect with Google'}
            </Button>
          </>
        )}

        {s?.lastError && (
          <InlineStatus
            status={{
              kind: 'error',
              message: `Last error${lastErrorAt ? ` (${lastErrorAt})` : ''}: ${s.lastError}`,
            }}
          />
        )}
        {connState === 'active' && (
          <p className="text-xs text-muted-foreground">
            Last successful check: {lastSuccessAt ?? 'none yet'}
          </p>
        )}
        {s && s.lastPollAt && connState !== 'loading' && (
          <p className="text-xs text-muted-foreground">
            Last poll: {new Date(s.lastPollAt).toLocaleString()}
          </p>
        )}

        <div className="flex items-center gap-2">
          {(connState === 'active' || connState === 'needs_reconnect') && (
            <Button
              size="sm"
              variant="outline"
              className="border-border text-destructive hover:bg-muted"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          )}
        </div>
      </AdminCardContent>
    </AdminCard>
  );
}

