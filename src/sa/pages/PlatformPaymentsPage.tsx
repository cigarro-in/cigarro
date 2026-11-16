// Super-admin "Platform payments": how merchants pay Cigarro (security deposit
// and marketplace dues). The platform org is an internal store; its UPI IDs,
// Gmail, SMS relay and claim review are the store functions called with saToken.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Input,
  Label,
  Page,
  Skeleton,
  Textarea,
  formatOrderNumber,
  useButtonFeedback,
  type BadgeTone,
  type Column,
} from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import { paiseToRupees, rupeesToPaise } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';
import { useSa } from '../SuperGate';
import { PlatformAutoConfirmCard } from '../payments/PlatformAutoConfirmCard';
import { formatCount, formatDateTime, runSa } from '../saUi';

const KIND_LABEL: Record<string, string> = { deposit: 'Security deposit', dues: 'Dues' };

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Waiting for payment', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  late_paid: { label: 'Paid late', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'info' },
  voided: { label: 'Voided', tone: 'neutral' },
};

function rupeeText(paise: number): string {
  return formatINR(paiseToRupees(paise));
}

export function PlatformPaymentsPage() {
  const { token, writeOpen } = useSa();
  const [params] = useSearchParams();
  const settings = useQuery(api.platformFees.saGetPlatformPaymentSettings, { saToken: token });
  const ensure = useMutation(api.platformFees.saEnsurePlatformOrg);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const ensuring = useRef(false);
  const [notice, setNotice] = useState<string | null>(
    params.get('gmail') === 'connected' ? 'Gmail connected for merchant payments.' : null,
  );

  // First load: create the platform org if the migration has not yet.
  useEffect(() => {
    if (!writeOpen || settings === undefined || settings.platformOrgId !== null || ensuring.current) return;
    ensuring.current = true;
    runSa(() => ensure({ saToken: token })).catch((err: Error) => {
      setEnsureError(err.message);
      ensuring.current = false;
    });
  }, [writeOpen, settings, token, ensure]);

  if (settings === undefined) {
    return (
      <Page title="Platform payments">
        <Card>
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-3 h-32 w-full" />
        </Card>
      </Page>
    );
  }

  const platformOrgId = settings.platformOrgId;

  return (
    <Page
      title="Platform payments"
      titleMeta={
        settings.ready ? (
          <Badge tone="success" dot>
            Taking payments
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            Not ready
          </Badge>
        )
      }
    >
      {notice && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}
      {ensureError && <Banner tone="critical">{ensureError}</Banner>}
      {platformOrgId === null ? (
        <Card>
          <EmptyState
            title="Platform account not set up yet"
            description="It is created the first time a super admin opens this page with write access."
          />
        </Card>
      ) : (
        <PlatformBody orgId={platformOrgId} token={token} writeOpen={writeOpen} settings={settings} />
      )}
    </Page>
  );
}

type Settings = FunctionReturnType<typeof api.platformFees.saGetPlatformPaymentSettings>;

function PlatformBody({
  orgId,
  token,
  writeOpen,
  settings,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  settings: Settings;
}) {
  const stores = useQuery(api.platform.listStores, { saToken: token });
  const storeName = (id: Id<'organizations'> | undefined) =>
    (id && stores?.find((s) => s._id === id)?.name) || '-';

  return (
    <>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <ReceivingCard orgId={orgId} token={token} writeOpen={writeOpen} payeeName={settings.payeeName ?? ''} />
        <PlatformAutoConfirmCard orgId={orgId} token={token} />
        <DefaultsCard token={token} writeOpen={writeOpen} defaultDepositPaise={settings.defaultDepositPaise} />
      </div>
      <ReviewQueue orgId={orgId} token={token} writeOpen={writeOpen} storeName={storeName} />
      <RecentPayments token={token} />
    </>
  );
}

// ---------- Receiving: payee name + UPI IDs ----------

function ReceivingCard({
  orgId,
  token,
  writeOpen,
  payeeName,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  payeeName: string;
}) {
  const vpas = useQuery(api.email.listVpas, { orgId, saToken: token });
  const upsertVpa = useMutation(api.email.upsertVpa);
  const deleteVpa = useMutation(api.email.deleteVpa);
  const saveName = useMutation(api.platformFees.saSetPlatformPaymentConfig);
  const nameFb = useButtonFeedback();
  const addFb = useButtonFeedback();
  const removeFb = useButtonFeedback();
  const [name, setName] = useState<string | null>(null);
  const [vpa, setVpa] = useState('');
  const [toRemove, setToRemove] = useState<Doc<'paymentVpas'> | null>(null);

  const rows = [...(vpas ?? [])].sort((a, b) => a.priority - b.priority);
  const nameValue = name ?? payeeName;

  const onSaveName = (e: FormEvent) => {
    e.preventDefault();
    void nameFb.run(() => runSa(() => saveName({ saToken: token, payeeName: nameValue })));
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const value = vpa.trim();
    const priority = rows.reduce((max, r) => Math.max(max, r.priority), 0) + 1;
    const ok = await addFb.run(() => runSa(() => upsertVpa({ orgId, vpa: value, active: true, priority, saToken: token })));
    if (ok !== undefined) setVpa('');
  };

  return (
    <Card title="Receiving">
      <div className="flex flex-col gap-5">
        <form onSubmit={onSaveName} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pp-payee">Name shown in UPI apps</Label>
            <Input
              id="pp-payee"
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
              disabled={!writeOpen || nameFb.busy}
              maxLength={80}
              required
            />
          </div>
          <div>
            <Button type="submit" variant="secondary" size="sm" state={nameFb.state} disabled={!writeOpen}>
              Save name
            </Button>
          </div>
          {nameFb.error && <Banner tone="critical">{nameFb.error.message}</Banner>}
        </form>

        <div className="border-t border-[var(--admin-border)] pt-4">
          <p className="mb-2 text-sm font-medium text-[var(--admin-text)]">UPI IDs</p>
          {vpas === undefined ? (
            <Skeleton className="h-9 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-[var(--admin-text-muted)]">No UPI ID yet. Merchants cannot pay until you add one.</p>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)] rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)]">
              {rows.map((r) => (
                <li key={r._id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-[var(--admin-text)]">{r.vpa}</p>
                    {r.label && <p className="truncate text-xs text-[var(--admin-text-muted)]">{r.label}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!r.active && <Badge tone="neutral">Off</Badge>}
                    <Button variant="plain" size="sm" disabled={!writeOpen} onClick={() => setToRemove(r)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={onAdd} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="pp-vpa">Add a UPI ID</Label>
              <Input
                id="pp-vpa"
                value={vpa}
                onChange={(e) => setVpa(e.target.value)}
                placeholder="cigarro@ybl"
                required
                disabled={!writeOpen || addFb.busy}
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="secondary" state={addFb.state} disabled={!writeOpen}>
              Add UPI ID
            </Button>
          </form>
          {addFb.error && (
            <div className="mt-2">
              <Banner tone="critical">{addFb.error.message}</Banner>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Remove ${toRemove?.vpa ?? 'this UPI ID'}?`}
        description="Merchant payments stop using this UPI ID. Payments already sent to it are still matched."
        confirmLabel="Remove UPI ID"
        critical
        onConfirm={async () => {
          if (!toRemove) return;
          await removeFb.run(() => runSa(() => deleteVpa({ orgId, vpaId: toRemove._id, saToken: token })));
        }}
      />
    </Card>
  );
}

// ---------- Defaults ----------

function DefaultsCard({ token, writeOpen, defaultDepositPaise }: { token: string; writeOpen: boolean; defaultDepositPaise: number }) {
  const save = useMutation(api.platformFees.saSetPlatformPaymentConfig);
  const fb = useButtonFeedback();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(paiseToRupees(defaultDepositPaise));

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    const rupees = Number(value);
    if (!Number.isFinite(rupees) || rupees <= 0) return;
    void fb.run(() => runSa(() => save({ saToken: token, defaultDepositPaise: rupeesToPaise(rupees) })));
  };

  return (
    <Card title="Defaults">
      <form onSubmit={onSave} className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pp-deposit">Default security deposit (₹)</Label>
          <Input
            id="pp-deposit"
            inputMode="decimal"
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!writeOpen || fb.busy}
            required
          />
          <p className="text-xs text-[var(--admin-text-muted)]">
            Used by every store that does not have its own amount. Changing it does not change deposits already paid.
          </p>
        </div>
        <div>
          <Button type="submit" variant="secondary" size="sm" state={fb.state} disabled={!writeOpen}>
            Save default
          </Button>
        </div>
        {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
      </form>
    </Card>
  );
}

// ---------- Review queue ----------

type Claim = Doc<'orders'>;

function ReviewQueue({
  orgId,
  token,
  writeOpen,
  storeName,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  storeName: (id: Id<'organizations'> | undefined) => string;
}) {
  const claims = useQuery(api.admin.listPaymentClaims, { orgId, saToken: token });
  const confirmClaim = useMutation(api.admin.confirmPaymentClaim);
  const rejectClaim = useMutation(api.admin.rejectPaymentClaim);
  const rejectFb = useButtonFeedback();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Claim | null>(null);
  const [reason, setReason] = useState('');

  const onConfirm = async (c: Claim) => {
    setBusyId(c._id);
    setRowError(null);
    setNotice(null);
    try {
      await runSa(() => confirmClaim({ orderId: c._id, saToken: token }));
      setNotice(`Confirmed ${rupeeText(c.cartTotalPaise)} from ${storeName(c.payerOrgId)}.`);
    } catch (err) {
      setRowError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejecting) return;
    const target = rejecting;
    const ok = await rejectFb.run(() =>
      runSa(() => rejectClaim({ orderId: target._id, reason: reason.trim(), saToken: token })),
    );
    if (ok === undefined) return;
    setNotice(`Rejected the UTR from ${storeName(target.payerOrgId)}.`);
    setRejecting(null);
    setReason('');
    rejectFb.reset();
  };

  const columns: Column<Claim>[] = [
    { id: 'store', header: 'Store', cell: (c) => <span className="truncate text-sm">{storeName(c.payerOrgId)}</span> },
    { id: 'kind', header: 'Kind', cell: (c) => <span className="text-sm">{KIND_LABEL[c.kind] ?? c.kind}</span> },
    { id: 'amount', header: 'Amount', align: 'right', cell: (c) => <span className="tabular-nums">{rupeeText(c.cartTotalPaise)}</span> },
    {
      id: 'utr',
      header: 'UTR',
      hideBelow: 'md',
      cell: (c) => <span className="font-mono text-xs">{c.paymentClaim?.utr ?? '-'}</span>,
    },
    {
      id: 'time',
      header: 'Sent',
      hideBelow: 'md',
      cell: (c) => <span className="text-xs text-[var(--admin-text-muted)]">{c.paymentClaim ? formatDateTime(c.paymentClaim.submittedAt) : '-'}</span>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '13rem',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="plain" size="sm" disabled={!writeOpen || busyId !== null} onClick={() => setRejecting(c)}>
            Reject
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={busyId === c._id}
            disabled={!writeOpen || (busyId !== null && busyId !== c._id)}
            onClick={() => void onConfirm(c)}
          >
            Confirm
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Review queue"
        padding="none"
        actions={
          claims ? (
            <span className="text-xs tabular-nums text-[var(--admin-text-muted)]">
              {formatCount(claims.length)} waiting
            </span>
          ) : undefined
        }
      >
        {notice && (
          <div className="p-3">
            <Banner tone="success" onDismiss={() => setNotice(null)}>
              {notice}
            </Banner>
          </div>
        )}
        {rowError && (
          <div className="p-3">
            <Banner tone="critical">{rowError}</Banner>
          </div>
        )}
        <DataTable
          columns={columns}
          rows={claims}
          getRowId={(c) => c._id}
          loading={claims === undefined}
          empty={
            <EmptyState
              title="Nothing to review"
              description="When a merchant sends a UTR that automatic confirmation did not match, it waits here."
            />
          }
        />
      </Card>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setReason('');
            rejectFb.reset();
          }
        }}
        title="Reject this payment?"
        description="The merchant sees the reason and can send a correct UTR."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={rejectFb.busy}>
              Cancel
            </Button>
            <Button type="submit" form="pp-reject" variant="critical" state={rejectFb.state} disabled={!writeOpen || reason.trim() === ''}>
              Reject payment
            </Button>
          </>
        }
      >
        <form id="pp-reject" onSubmit={onReject} className="flex flex-col gap-3">
          {rejecting && (
            <p className="text-[13px] text-[var(--admin-text-muted)]">
              {storeName(rejecting.payerOrgId)} · {rupeeText(rejecting.cartTotalPaise)} · UTR{' '}
              <span className="font-mono">{rejecting.paymentClaim?.utr ?? '-'}</span>
            </p>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pp-reason">Reason</Label>
            <Textarea
              id="pp-reason"
              rows={3}
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Amount does not match the deposit"
              required
              disabled={rejectFb.busy}
            />
          </div>
          {rejectFb.error && <Banner tone="critical">{rejectFb.error.message}</Banner>}
        </form>
      </Dialog>
    </>
  );
}

// ---------- Recent platform payments ----------

type PlatformOrder = Doc<'orders'> & { payerStore: { slug: string; name: string } | null };

function RecentPayments({ token }: { token: string }) {
  const rows = useQuery(api.platformFees.saListPlatformPaymentOrders, { saToken: token, limit: 50 }) as PlatformOrder[] | undefined;

  const columns: Column<PlatformOrder>[] = [
    { id: 'store', header: 'Store', cell: (o) => <span className="truncate text-sm">{o.payerStore?.name ?? '-'}</span> },
    { id: 'kind', header: 'Kind', cell: (o) => <span className="text-sm">{KIND_LABEL[o.kind] ?? o.kind}</span> },
    { id: 'amount', header: 'Amount', align: 'right', cell: (o) => <span className="tabular-nums">{rupeeText(o.cartTotalPaise)}</span> },
    {
      id: 'status',
      header: 'Status',
      cell: (o) => {
        const s = STATUS[o.status] ?? { label: o.status, tone: 'neutral' as const };
        return <Badge tone={s.tone} dot>{s.label}</Badge>;
      },
    },
    {
      id: 'order',
      header: 'Order',
      align: 'right',
      cell: (o) => <span className="tabular-nums text-sm">{formatOrderNumber(o.orderNumber) || '-'}</span>,
    },
  ];

  return (
    <Card title="Recent platform payments" padding="none" className="mt-3">
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(o) => o._id}
        loading={rows === undefined}
        empty={<EmptyState title="No payments yet" description="Security deposit and dues payments from stores appear here." />}
      />
    </Card>
  );
}
