import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  FilterBar,
  FilterSelect,
  Label,
  Page,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  useButtonFeedback,
  Input,
} from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { formatCount, runSa, StatTile } from '../saUi';
import { listStoresRef } from '../refs';
import { MessageRow, OUTCOME, OUTCOME_ORDER, type Channel, type Outcome } from '../payments/shared';

type View = 'messages' | 'rules';

// Payments pipeline: every bank SMS and email across stores (Messages) and the
// decision rules every store uses unless its store page overrides them (Rules).
export function PaymentsPipelinePage() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'rules' ? 'rules' : 'messages';
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'messages') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };
  return (
    <Page title="Payments pipeline">
      <Card padding="none">
        <Tabs<View>
          className="mb-0 border-b-0"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'messages', label: 'Messages' },
            { id: 'rules', label: 'Rules' },
          ]}
        />
      </Card>
      {view === 'messages' ? <MessagesView /> : <RulesView />}
    </Page>
  );
}

// ---------- Messages ----------

const PAGE = 30;

export function MessagesView({ fixedOrgId }: { fixedOrgId?: Id<'organizations'> }) {
  const { token } = useSa();
  const [params, setParams] = useSearchParams();
  const stores = useQuery(listStoresRef, fixedOrgId ? 'skip' : { saToken: token });
  const storeParam = fixedOrgId ?? (params.get('store') as Id<'organizations'> | null) ?? undefined;
  const channel = (params.get('channel') as Channel | null) ?? undefined;
  const outcome = (params.get('outcome') as Outcome | null) ?? undefined;
  const [q, setQ] = useState(params.get('q') ?? '');

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) setParam('q', q.trim() || undefined);
    // Only the search text drives this.
  }, [q]);

  const summary = useQuery(api.pipeline.messageSummary, { saToken: token, orgId: storeParam });
  const { results, status, loadMore } = usePaginatedQuery(
    api.pipeline.listMessages,
    {
      saToken: token,
      orgId: storeParam,
      channel,
      outcome,
      search: q.trim() || undefined,
    },
    { initialNumItems: PAGE },
  );

  const tile = (o: Outcome, hint?: string) => (
    <button
      type="button"
      onClick={() => setParam('outcome', outcome === o ? undefined : o)}
      className={`text-left transition-transform duration-150 active:scale-[0.99] motion-reduce:transform-none ${
        outcome === o ? 'rounded-[var(--admin-radius)] ring-2 ring-[var(--admin-primary)]' : ''
      }`}
      aria-pressed={outcome === o}
    >
      <StatTile
        label={OUTCOME[o].label}
        value={summary ? formatCount(summary.counts[o]) : <Skeleton className="h-7 w-10" />}
        hint={hint}
        attention={(o === 'credit_unmatched' || o === 'setup_error') && !!summary && summary.counts[o] > 0}
      />
    </button>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tile('matched', 'Last 24 hours')}
        {tile('credit_unmatched', 'Last 24 hours')}
        {tile('duplicate', 'Last 24 hours')}
        {tile('ignored', 'Last 24 hours')}
        {tile('setup_error', 'Last 24 hours')}
      </div>

      <Card padding="none">
        <FilterBar
          className="border-b border-[var(--admin-border)]"
          search={{ value: q, onChange: setQ, placeholder: 'Search message text', debounceMs: 300 }}
        >
          {!fixedOrgId && (
            <FilterSelect
              label="Store"
              value={storeParam ?? 'all'}
              options={[
                { value: 'all', label: 'All stores' },
                ...(stores ?? []).map((s) => ({ value: s._id as string, label: s.name })),
              ]}
              onChange={(v) => setParam('store', v === 'all' ? undefined : v)}
            />
          )}
          <FilterSelect
            label="Channel"
            value={channel ?? 'all'}
            options={[
              { value: 'all', label: 'SMS and email' },
              { value: 'sms', label: 'SMS' },
              { value: 'email', label: 'Email' },
            ]}
            onChange={(v) => setParam('channel', v === 'all' ? undefined : v)}
          />
          <FilterSelect
            label="Outcome"
            value={outcome ?? 'all'}
            options={[{ value: 'all', label: 'All outcomes' }, ...OUTCOME_ORDER.map((o) => ({ value: o, label: OUTCOME[o].label }))]}
            onChange={(v) => setParam('outcome', v === 'all' ? undefined : v)}
          />
        </FilterBar>

        {status === 'LoadingFirstPage' ? (
          <div className="flex flex-col gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="No messages"
            description="Bank SMS from connected phones and bank emails from Gmail appear here as they arrive, with what the pipeline decided."
          />
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {results.map((m) => (
              <MessageRow key={m._id} m={m} showStore={!fixedOrgId && !storeParam} />
            ))}
          </ul>
        )}

        {status === 'CanLoadMore' || status === 'LoadingMore' ? (
          <div className="border-t border-[var(--admin-border)] px-4 py-3">
            <Button variant="secondary" size="sm" loading={status === 'LoadingMore'} onClick={() => loadMore(PAGE)}>
              Load more
            </Button>
          </div>
        ) : null}
      </Card>
    </>
  );
}

// ---------- Rules ----------

type SuffixRule = 'T' | 'S' | 'none' | 'P' | 'G';
export const SUFFIX_OPTIONS: { value: SuffixRule; label: string; hint: string }[] = [
  { value: 'T', label: 'T', hint: 'Transactional' },
  { value: 'S', label: 'S', hint: 'Service' },
  { value: 'none', label: 'No suffix', hint: 'Older headers' },
  { value: 'P', label: 'P', hint: 'Promotional' },
  { value: 'G', label: 'G', hint: 'Government' },
];

export function splitList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SuffixPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: SuffixRule[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Accepted sender suffixes">
      {SUFFIX_OPTIONS.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() =>
              onChange(
                (on ? value.filter((x) => x !== o.value) : [...value, o.value]).filter((x): x is SuffixRule =>
                  SUFFIX_OPTIONS.some((s) => s.value === x),
                ),
              )
            }
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-150 disabled:opacity-60 ${
              on
                ? 'border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-text-on-primary)]'
                : 'border-[var(--admin-border)] text-[var(--admin-text)] hover:bg-[var(--admin-neutral-soft)]'
            }`}
          >
            <span className="font-medium">{o.label}</span>
            <span className={on ? 'opacity-80' : 'text-[var(--admin-text-muted)]'}>{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--admin-text)]">{label}</span>
        <span className="block text-[13px] text-[var(--admin-text-muted)]">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

type Draft = {
  acceptedSuffixes: SuffixRule[];
  bankSenders: string;
  knownSendersOnly: boolean;
  allowPhoneSenders: boolean;
  creditKeywords: string;
  debitKeywords: string;
  dedupeMinutes: string;
};

function RulesView() {
  const { token, writeOpen } = useSa();
  const cfg = useQuery(api.pipeline.getGlobalConfig, { saToken: token });
  const save = useMutation(api.pipeline.setGlobalConfig);
  const fb = useButtonFeedback();
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!cfg || draft) return;
    const e = cfg.effective;
    setDraft({
      acceptedSuffixes: e.acceptedSuffixes as SuffixRule[],
      bankSenders: e.bankSenders.join('\n'),
      knownSendersOnly: e.knownSendersOnly,
      allowPhoneSenders: e.allowPhoneSenders,
      creditKeywords: e.creditKeywords.join(', '),
      debitKeywords: e.debitKeywords.join(', '),
      dedupeMinutes: String(Math.round(e.dedupeWindowMs / 60_000)),
    });
  }, [cfg, draft]);

  if (!cfg || !draft) {
    return (
      <Card>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-3 h-24 w-full" />
      </Card>
    );
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const minutes = parseFloat(draft.dedupeMinutes);
  const bad = !(minutes >= 0 && minutes <= 60) ? 'Duplicate window must be 0 to 60 minutes.' : null;
  const disabled = !writeOpen || fb.busy;

  const onSave = () =>
    fb.run(() =>
      runSa(() =>
        save({
          saToken: token,
          acceptedSuffixes: draft.acceptedSuffixes,
          bankSenders: splitList(draft.bankSenders).map((s) => s.toUpperCase()),
          knownSendersOnly: draft.knownSendersOnly,
          allowPhoneSenders: draft.allowPhoneSenders,
          creditKeywords: splitList(draft.creditKeywords),
          debitKeywords: splitList(draft.debitKeywords),
          dedupeWindowMs: Math.round(minutes * 60_000),
        }),
      ),
    );

  const resetDefaults = () => {
    const d = cfg.defaults;
    setDraft({
      acceptedSuffixes: d.acceptedSuffixes as SuffixRule[],
      bankSenders: d.bankSenders.join('\n'),
      knownSendersOnly: d.knownSendersOnly,
      allowPhoneSenders: d.allowPhoneSenders,
      creditKeywords: d.creditKeywords.join(', '),
      debitKeywords: d.debitKeywords.join(', '),
      dedupeMinutes: String(Math.round(d.dedupeWindowMs / 60_000)),
    });
  };

  return (
    <>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Card title="Which SMS count">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Accepted sender suffixes</Label>
              <SuffixPicker value={draft.acceptedSuffixes} onChange={(v) => set('acceptedSuffixes', v)} disabled={disabled} />
              <p className="text-xs text-[var(--admin-text-muted)]">
                TRAI headers end in a letter: AX-ICICIT-S is ICICIT with suffix S. Banks send T or S.
              </p>
            </div>
            <ToggleRow
              label="Only known banks"
              hint="Off: any credit SMS from an accepted header counts. On: only senders in the bank list."
              checked={draft.knownSendersOnly}
              onChange={(v) => set('knownSendersOnly', v)}
              disabled={disabled}
            />
            <ToggleRow
              label="Accept SMS from phone numbers"
              hint="Keep off. Anyone can text a store owner a fake credit from a phone number."
              checked={draft.allowPhoneSenders}
              onChange={(v) => set('allowPhoneSenders', v)}
              disabled={disabled}
            />
          </div>
        </Card>

        <Card title="Credit wording">
          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-credit">Credit words</Label>
              <Input
                id="pp-credit"
                value={draft.creditKeywords}
                onChange={(e) => set('creditKeywords', e.target.value)}
                disabled={disabled}
              />
              <p className="text-xs text-[var(--admin-text-muted)]">An SMS counts only with one of these and a rupee amount.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-debit">Debit words</Label>
              <Input
                id="pp-debit"
                value={draft.debitKeywords}
                onChange={(e) => set('debitKeywords', e.target.value)}
                disabled={disabled}
              />
              <p className="text-xs text-[var(--admin-text-muted)]">Any of these and the SMS is ignored, even with credit words.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-window">Duplicate window (minutes)</Label>
              <Input
                id="pp-window"
                inputMode="numeric"
                className="max-w-32"
                value={draft.dedupeMinutes}
                onChange={(e) => set('dedupeMinutes', e.target.value)}
                disabled={disabled}
              />
              <p className="text-xs text-[var(--admin-text-muted)]">
                The same credit by SMS and email is one payment when the UPI reference matches, or the amount matches inside
                this window and neither reference disagrees.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Known bank senders" className="lg:col-span-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pp-banks">Sender entities, one per line</Label>
            <Textarea
              id="pp-banks"
              rows={8}
              className="font-mono text-[13px]"
              value={draft.bankSenders}
              onChange={(e) => set('bankSenders', e.target.value)}
              disabled={disabled}
            />
            <p className="text-xs text-[var(--admin-text-muted)]">
              {formatCount(splitList(draft.bankSenders).length)} entries. Write the entity only (HDFCBK); prefixes and suffixes
              are ignored when matching. Stores can add more on their store page.
            </p>
          </div>
        </Card>
      </div>

      {bad && <Banner tone="warning">{bad}</Banner>}
      {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" state={fb.state} disabled={disabled || !!bad} onClick={() => void onSave()}>
          Save rules
        </Button>
        <Button variant="plain" disabled={disabled} onClick={resetDefaults}>
          Use defaults
        </Button>
      </div>
    </>
  );
}
