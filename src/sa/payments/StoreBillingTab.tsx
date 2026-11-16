// Store page "Billing" tab: what the store owes Cigarro (marketplace fee, dues),
// its security deposit, the checkout lock, and the account statement.
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  Banner,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  useButtonFeedback,
  type Column,
} from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { paiseToRupees, rupeesToPaise } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';
import { useSa } from '../SuperGate';
import { formatDateTime, runSa } from '../saUi';
import { cleanNote } from '../../adminnew/features/payments/platformFeeFormat';

type Gate = 'enforced' | 'waived';
type StatementRow = {
  id: string;
  date: number;
  kind: string;
  particulars: string;
  creditPaise: number;
  debitPaise: number;
  balancePaise: number;
};

const GATE_TEXT: Record<Gate, string> = {
  enforced: 'Checkout stays closed until the store has automatic payment confirmation, a UPI ID and the deposit (if required).',
  waived: 'Checkout is open even if setup is not finished. Use for stores that predate the gate.',
};

function money(paise: number): string {
  return formatINR(paiseToRupees(paise));
}

function moneyOrDash(paise: number): string {
  return paise === 0 ? '-' : money(paise);
}

// Percent text for bps: 800 -> "8", 850 -> "8.5".
function pctText(bps: number): string {
  return String(Number((bps / 100).toFixed(2)));
}

function Notice({ text, onDismiss }: { text: string | null; onDismiss: () => void }) {
  if (!text) return null;
  return (
    <Banner tone="success" onDismiss={onDismiss}>
      {text}
    </Banner>
  );
}

export function StoreBillingTab({ orgId }: { orgId: Id<'organizations'> }) {
  const { token, writeOpen } = useSa();
  const billing = useQuery(api.platformFees.saGetStoreBilling, { saToken: token, orgId });
  const platform = useQuery(api.platformFees.saGetPlatformPaymentSettings, { saToken: token });
  const [notice, setNotice] = useState<string | null>(null);

  if (!billing) {
    return (
      <Card>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-3 h-32 w-full" />
      </Card>
    );
  }

  const { account, setup } = billing;
  const defaultDeposit = platform?.defaultDepositPaise;

  return (
    <>
      <Notice text={notice} onDismiss={() => setNotice(null)} />
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Card title="Account with Cigarro">
          <dl className="divide-y divide-[var(--admin-border)] text-sm">
            <Row label="Owed to Cigarro" value={money(account.duesPaise)} hint="Fees not yet paid" />
            <Row label="Deposit held" value={money(account.depositHeldPaise)} hint={account.depositRequired ? `Required ${money(account.depositAmountPaise)}` : 'Not required'} />
            <Row label="Deposit still due" value={money(account.depositDuePaise)} />
            <Row label="Fees this month" value={money(account.feesThisMonthPaise)} />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--admin-border)] pt-3">
            <SetupCardButton orgId={orgId} token={token} writeOpen={writeOpen} onDone={() => setNotice('The setup card shows again in the store admin.')} />
            <span className="text-[13px] text-[var(--admin-text-muted)]">
              Setup: {setup.complete ? 'complete' : 'not complete'}
            </span>
          </div>
        </Card>

        <FeeCard orgId={orgId} token={token} writeOpen={writeOpen} bps={billing.marketplaceFeeBps} onDone={setNotice} />
        <GateCard orgId={orgId} token={token} writeOpen={writeOpen} gate={billing.setupGate} onDone={setNotice} />
        <DepositCard
          orgId={orgId}
          token={token}
          writeOpen={writeOpen}
          required={billing.securityDepositRequired}
          depositPaise={billing.securityDepositPaise}
          effectivePaise={billing.effectiveSecurityDepositPaise}
          defaultPaise={defaultDeposit}
          onDone={setNotice}
        />
      </div>

      <StatementCard orgId={orgId} token={token} />

      <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
        <RefundForm orgId={orgId} token={token} writeOpen={writeOpen} heldPaise={account.depositHeldPaise} onDone={setNotice} />
        <AdjustmentForm orgId={orgId} token={token} writeOpen={writeOpen} onDone={setNotice} />
      </div>
    </>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="min-w-0 text-[var(--admin-text-muted)]">
        {label}
        {hint && <span className="block text-xs text-[var(--admin-text-subtle)]">{hint}</span>}
      </dt>
      <dd className="shrink-0 tabular-nums text-[var(--admin-text)]">{value}</dd>
    </div>
  );
}

function SetupCardButton({
  orgId,
  token,
  writeOpen,
  onDone,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  onDone: () => void;
}) {
  const reshow = useMutation(api.platformFees.saReshowSetupCard);
  const fb = useButtonFeedback();
  return (
    <Button
      variant="secondary"
      size="sm"
      state={fb.state}
      disabled={!writeOpen}
      onClick={async () => {
        const ok = await fb.run(() => runSa(() => reshow({ saToken: token, orgId })));
        if (ok !== undefined) onDone();
      }}
    >
      Show setup card again
    </Button>
  );
}

// ---------- Marketplace fee ----------

function FeeCard({
  orgId,
  token,
  writeOpen,
  bps,
  onDone,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  bps: number;
  onDone: (text: string) => void;
}) {
  const save = useMutation(api.platformFees.saSetMarketplaceFee);
  const fb = useButtonFeedback();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? pctText(bps);
  const pct = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= 50;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const next = Math.round(pct * 100);
    const ok = await fb.run(() => runSa(() => save({ saToken: token, orgId, feeBps: next })));
    if (ok === undefined) return;
    setDraft(null);
    onDone(`Marketplace fee set to ${pctText(next)}%.`);
  };

  return (
    <Card title="Marketplace fee">
      <form onSubmit={onSave} className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="bill-fee">Fee on each UPI sale (%)</Label>
          <Input
            id="bill-fee"
            inputMode="decimal"
            className="max-w-[10rem]"
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!writeOpen || fb.busy}
            aria-invalid={!valid}
          />
          <p className="text-xs text-[var(--admin-text-muted)]">
            Charged on the UPI amount of each paid order, from 0 to 50. Money the store takes through its wallet is not charged.
          </p>
        </div>
        <div>
          <Button type="submit" variant="secondary" size="sm" state={fb.state} disabled={!writeOpen || !valid}>
            Save fee
          </Button>
        </div>
        {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
      </form>
    </Card>
  );
}

// ---------- Checkout lock ----------

function GateCard({
  orgId,
  token,
  writeOpen,
  gate,
  onDone,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  gate: Gate;
  onDone: (text: string) => void;
}) {
  const save = useMutation(api.platformFees.saSetSetupGate);
  const fb = useButtonFeedback();
  const [draft, setDraft] = useState<Gate | null>(null);
  const value = draft ?? gate;

  const onSave = async () => {
    const ok = await fb.run(() => runSa(() => save({ saToken: token, orgId, gate: value })));
    if (ok === undefined) return;
    setDraft(null);
    onDone(value === 'enforced' ? 'Checkout is locked until setup is complete.' : 'Checkout is open without the setup check.');
  };

  return (
    <Card title="Checkout lock">
      <div className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="bill-gate">Checkout</Label>
          <Select value={value} onValueChange={(v) => setDraft(v as Gate)} disabled={!writeOpen || fb.busy}>
            <SelectTrigger id="bill-gate" className="w-full sm:max-w-[16rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enforced">Enforced</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[13px] text-[var(--admin-text-muted)]">{GATE_TEXT[value]}</p>
        </div>
        <div>
          <Button variant="secondary" size="sm" state={fb.state} disabled={!writeOpen || value === gate} onClick={() => void onSave()}>
            Save checkout lock
          </Button>
        </div>
        {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
      </div>
    </Card>
  );
}

// ---------- Security deposit ----------

function DepositCard({
  orgId,
  token,
  writeOpen,
  required,
  depositPaise,
  effectivePaise,
  defaultPaise,
  onDone,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  required: boolean;
  depositPaise: number | null;
  effectivePaise: number;
  defaultPaise: number | undefined;
  onDone: (text: string) => void;
}) {
  const save = useMutation(api.platformFees.saSetSecurityDeposit);
  const fb = useButtonFeedback();
  const [isRequired, setRequired] = useState<boolean | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const reqValue = isRequired ?? required;
  const amountValue = amount ?? (depositPaise === null ? '' : String(paiseToRupees(depositPaise)));
  const amountNum = Number(amountValue);
  const amountOk = amountValue.trim() === '' || (Number.isFinite(amountNum) && amountNum > 0);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!amountOk) return;
    const paise = amountValue.trim() === '' ? null : rupeesToPaise(amountNum);
    const ok = await fb.run(() =>
      runSa(() => save({ saToken: token, orgId, required: reqValue, securityDepositPaise: paise })),
    );
    if (ok === undefined) return;
    setRequired(null);
    setAmount(null);
    onDone(reqValue ? `Security deposit set to ${money(paise ?? defaultPaise ?? effectivePaise)}.` : 'Security deposit turned off.');
  };

  return (
    <Card title="Security deposit">
      <form onSubmit={onSave} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--admin-text)]">Required</p>
            <p className="text-[13px] text-[var(--admin-text-muted)]">The store pays this before checkout (when the lock is on).</p>
          </div>
          <Switch checked={reqValue} onCheckedChange={(v) => setRequired(v)} disabled={!writeOpen || fb.busy} aria-label="Security deposit required" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bill-deposit">Amount (₹)</Label>
          <Input
            id="bill-deposit"
            inputMode="decimal"
            className="max-w-[12rem]"
            value={amountValue}
            placeholder={defaultPaise !== undefined ? `Default ${money(defaultPaise)}` : 'Platform default'}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!writeOpen || fb.busy}
            aria-invalid={!amountOk}
          />
          <p className="text-xs text-[var(--admin-text-muted)]">
            Blank uses the platform default{depositPaise === null ? ` (${money(effectivePaise)} now)` : ''}.
          </p>
        </div>
        <div>
          <Button type="submit" variant="secondary" size="sm" state={fb.state} disabled={!writeOpen || !amountOk}>
            Save deposit
          </Button>
        </div>
        {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
      </form>
    </Card>
  );
}

// ---------- Statement ----------

function StatementCard({ orgId, token }: { orgId: Id<'organizations'>; token: string }) {
  // Cursor stack: the first page uses null; Next pushes the page's continue cursor.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const page = useQuery(api.platformFees.saListStatement, { saToken: token, orgId, cursor, limit: 20 });

  const columns: Column<StatementRow>[] = [
    {
      id: 'date',
      header: 'Date',
      width: '9.5rem',
      cell: (r) => <span className="text-xs tabular-nums text-[var(--admin-text-muted)]">{formatDateTime(r.date)}</span>,
    },
    { id: 'particulars', header: 'Particulars', cell: (r) => <span className="text-sm text-[var(--admin-text)]">{cleanNote(r.particulars)}</span> },
    { id: 'credit', header: 'Credit', align: 'right', hideBelow: 'sm', cell: (r) => <span className="tabular-nums">{moneyOrDash(r.creditPaise)}</span> },
    { id: 'debit', header: 'Debit', align: 'right', hideBelow: 'sm', cell: (r) => <span className="tabular-nums">{moneyOrDash(r.debitPaise)}</span> },
    { id: 'balance', header: 'Balance', align: 'right', cell: (r) => <span className="tabular-nums">{money(r.balancePaise)}</span> },
  ];

  const rows: StatementRow[] | undefined = page?.rows.map((r) => ({
    id: String(r.id),
    date: r.date,
    kind: r.kind,
    particulars: cleanNote(r.particulars),
    creditPaise: r.creditPaise,
    debitPaise: r.debitPaise,
    balancePaise: r.balancePaise,
  }));

  return (
    <Card
      title="Statement"
      padding="none"
      className="mt-3"
      actions={<span className="text-xs text-[var(--admin-text-muted)]">Balance is what the store owes. Negative means credit.</span>}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-[var(--admin-text-muted)]">Page {cursors.length}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={cursors.length <= 1} onClick={() => setCursors((c) => c.slice(0, -1))}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!page || page.nextCursor === null}
              onClick={() => page?.nextCursor && setCursors((c) => [...c, page.nextCursor as string])}
            >
              Next
            </Button>
          </div>
        </div>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        loading={page === undefined}
        empty={<EmptyState title="No entries yet" description="Fees, deposits and payments with Cigarro appear here." />}
      />
    </Card>
  );
}

// ---------- Records (money moved outside the app) ----------

function RecordNote() {
  return (
    <p className="text-xs text-[var(--admin-text-muted)]">
      These only record money moved outside the app. They do not send or move any money.
    </p>
  );
}

function RefundForm({
  orgId,
  token,
  writeOpen,
  heldPaise,
  onDone,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  heldPaise: number;
  onDone: (text: string) => void;
}) {
  const refund = useMutation(api.platformFees.saRefundDeposit);
  const fb = useButtonFeedback();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const num = Number(amount);
  const paise = Number.isFinite(num) && num > 0 ? rupeesToPaise(num) : 0;
  const tooMuch = paise > heldPaise;
  const valid = paise > 0 && !tooMuch;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const ok = await fb.run(() => runSa(() => refund({ saToken: token, orgId, amountPaise: paise, note: note.trim() })));
    if (ok === undefined) return;
    onDone(`Recorded a deposit refund of ${money(paise)}.`);
    setAmount('');
    setNote('');
  };

  return (
    <Card title="Record deposit refund">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rf-amount">Amount (₹)</Label>
          <Input
            id="rf-amount"
            inputMode="decimal"
            className="max-w-[12rem]"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!writeOpen || fb.busy}
            aria-invalid={tooMuch}
            required
          />
          <p className="text-xs text-[var(--admin-text-muted)]">
            {tooMuch ? `More than the ${money(heldPaise)} held.` : `Held now: ${money(heldPaise)}`}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rf-note">Note (optional)</Label>
          <Input id="rf-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} disabled={!writeOpen || fb.busy} />
        </div>
        <RecordNote />
        <div>
          <Button type="submit" variant="secondary" size="sm" state={fb.state} disabled={!writeOpen || !valid}>
            Record refund
          </Button>
        </div>
        {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
      </form>
    </Card>
  );
}

function AdjustmentForm({
  orgId,
  token,
  writeOpen,
  onDone,
}: {
  orgId: Id<'organizations'>;
  token: string;
  writeOpen: boolean;
  onDone: (text: string) => void;
}) {
  const adjust = useMutation(api.platformFees.saRecordAdjustment);
  const fb = useButtonFeedback();
  const [direction, setDirection] = useState<'owes_more' | 'owes_less'>('owes_more');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const num = Number(amount);
  const paise = Number.isFinite(num) && num > 0 ? rupeesToPaise(num) : 0;
  const valid = paise > 0 && note.trim() !== '';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const signed = direction === 'owes_more' ? paise : -paise;
    const ok = await fb.run(() =>
      runSa(() => adjust({ saToken: token, orgId, duesDeltaPaise: signed, note: note.trim() })),
    );
    if (ok === undefined) return;
    onDone(`Recorded an adjustment of ${money(paise)}.`);
    setAmount('');
    setNote('');
  };

  return (
    <Card title="Record adjustment">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="adj-dir">Change</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as 'owes_more' | 'owes_less')} disabled={!writeOpen || fb.busy}>
            <SelectTrigger id="adj-dir" className="w-full sm:max-w-[16rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owes_more">Store owes more</SelectItem>
              <SelectItem value="owes_less">Store owes less (credit)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adj-amount">Amount (₹)</Label>
          <Input
            id="adj-amount"
            inputMode="decimal"
            className="max-w-[12rem]"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!writeOpen || fb.busy}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adj-note">Note</Label>
          <Input id="adj-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} disabled={!writeOpen || fb.busy} required />
        </div>
        <RecordNote />
        <div>
          <Button type="submit" variant="secondary" size="sm" state={fb.state} disabled={!writeOpen || !valid}>
            Record adjustment
          </Button>
        </div>
        {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
      </form>
    </Card>
  );
}
