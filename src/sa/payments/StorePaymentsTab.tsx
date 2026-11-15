// Store page "Payments" tab: how this store's payments get confirmed (phone,
// Gmail), the store's overrides of the global pipeline rules, and its messages.
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { Badge, Banner, Button, Card, Input, Label, Skeleton, Textarea, useButtonFeedback } from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { HealthDot, KeyValues, formatCount, relativeTime, runSa } from '../saUi';
import { MessagesView, SuffixPicker, ToggleRow, splitList } from '../pages/PaymentsPipelinePage';

type Field = 'acceptedSuffixes' | 'bankSenders' | 'knownSendersOnly' | 'allowPhoneSenders' | 'creditKeywords' | 'debitKeywords';

function OverrideSection({
  title,
  overridden,
  onToggle,
  globalValue,
  disabled,
  children,
}: {
  title: string;
  overridden: boolean;
  onToggle: (on: boolean) => void;
  globalValue: ReactNode;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--admin-text)]">{title}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(!overridden)}
          className="text-[13px] font-medium text-[var(--admin-primary)] hover:underline disabled:opacity-60"
        >
          {overridden ? 'Use global' : 'Override'}
        </button>
      </div>
      {overridden ? (
        children
      ) : (
        <p className="text-[13px] text-[var(--admin-text-muted)]">
          <Badge tone="neutral">Global</Badge> <span className="ml-1">{globalValue}</span>
        </p>
      )}
    </div>
  );
}

type Draft = {
  acceptedSuffixes: string[] | null;
  bankSenders: string | null;
  knownSendersOnly: boolean | null;
  allowPhoneSenders: boolean | null;
  creditKeywords: string | null;
  debitKeywords: string | null;
  emailSenders: string;
};

const SUFFIX_TEXT: Record<string, string> = { T: 'T', S: 'S', none: 'no suffix', P: 'P', G: 'G' };

export function StorePaymentsTab({ orgId }: { orgId: Id<'organizations'> }) {
  const { token, writeOpen } = useSa();
  const data = useQuery(api.pipeline.getStoreConfig, { saToken: token, orgId });
  const save = useMutation(api.pipeline.setStoreConfig);
  const fb = useButtonFeedback();
  const legacyFb = useButtonFeedback();
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!data || draft) return;
    const o = data.override;
    setDraft({
      acceptedSuffixes: o.acceptedSuffixes,
      bankSenders: o.bankSenders ? o.bankSenders.join('\n') : null,
      knownSendersOnly: o.knownSendersOnly,
      allowPhoneSenders: o.allowPhoneSenders,
      creditKeywords: o.creditKeywords ? o.creditKeywords.join(', ') : null,
      debitKeywords: o.debitKeywords ? o.debitKeywords.join(', ') : null,
      emailSenders: data.emailSenders.join('\n'),
    });
  }, [data, draft]);

  if (!data || !draft) {
    return (
      <Card>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-3 h-32 w-full" />
      </Card>
    );
  }

  const g = data.global;
  const now = data.serverNow;
  const disabled = !writeOpen || fb.busy;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const onSave = () => {
    const clear: Field[] = [];
    const args: {
      acceptedSuffixes?: string[];
      bankSenders?: string[];
      knownSendersOnly?: boolean;
      allowPhoneSenders?: boolean;
      creditKeywords?: string[];
      debitKeywords?: string[];
    } = {};
    if (draft.acceptedSuffixes === null) clear.push('acceptedSuffixes');
    else args.acceptedSuffixes = draft.acceptedSuffixes;
    if (draft.bankSenders === null) clear.push('bankSenders');
    else args.bankSenders = splitList(draft.bankSenders).map((s) => s.toUpperCase());
    if (draft.knownSendersOnly === null) clear.push('knownSendersOnly');
    else args.knownSendersOnly = draft.knownSendersOnly;
    if (draft.allowPhoneSenders === null) clear.push('allowPhoneSenders');
    else args.allowPhoneSenders = draft.allowPhoneSenders;
    if (draft.creditKeywords === null) clear.push('creditKeywords');
    else args.creditKeywords = splitList(draft.creditKeywords);
    if (draft.debitKeywords === null) clear.push('debitKeywords');
    else args.debitKeywords = splitList(draft.debitKeywords);
    return fb.run(() =>
      runSa(() =>
        save({
          saToken: token,
          orgId,
          ...args,
          clear,
          emailSenders: splitList(draft.emailSenders).map((s) => s.toLowerCase()),
        }),
      ),
    );
  };

  const relay = data.relay;
  const phoneLine = !relay
    ? 'Never set up'
    : !relay.active
      ? 'Disconnected'
      : relay.lastSetupErrorAt && relay.lastSetupErrorAt > (relay.lastCreditSmsAt ?? 0)
        ? `Setup error ${relativeTime(relay.lastSetupErrorAt, now)}: ${relay.lastSetupError ?? ''}`
        : relay.lastCreditSmsAt
          ? `Bank SMS ${relativeTime(relay.lastCreditSmsAt, now)}`
          : 'Set up, no bank SMS yet';
  const phoneOk = !!relay?.active && !!relay.lastSmsAt && now - relay.lastSmsAt < 24 * 3600_000 && !phoneLine.startsWith('Setup error');

  return (
    <>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Card title="Confirmation sources">
          <div className="flex flex-col gap-3">
            <HealthDot ok={phoneOk} label={`Phone: ${phoneLine}`} />
            <HealthDot
              ok={data.gmail?.status === 'active'}
              label={
                data.gmail
                  ? `Gmail: ${data.gmail.status === 'active' ? 'connected' : data.gmail.status.replace('_', ' ')}${
                      data.gmail.accountEmail ? ` (${data.gmail.accountEmail})` : ''
                    }`
                  : 'Gmail: not connected'
              }
            />
            {relay && (
              <div className="border-t border-[var(--admin-border)] pt-3">
                <KeyValues
                  items={[
                    { label: 'Phone set up', value: relativeTime(relay.rotatedAt ?? relay.createdAt, now) },
                    { label: 'Last SMS of any kind', value: relativeTime(relay.lastSmsAt ?? undefined, now) },
                    { label: 'Last order confirmed by SMS', value: relativeTime(relay.lastConfirmedAt ?? undefined, now) },
                    { label: 'Token ends', value: relay.tokenLast4, mono: true },
                  ]}
                />
              </div>
            )}
            <Link
              to={`/sa/payments?store=${orgId}`}
              className="text-[13px] font-medium text-[var(--admin-primary)] hover:underline"
            >
              Open in the Messages view
            </Link>
          </div>
        </Card>

        <Card title="Bank email senders">
          <div className="grid gap-1.5">
            <Label htmlFor="sp-email">Only mail from these counts (empty = any bank on the global list)</Label>
            <Textarea
              id="sp-email"
              rows={4}
              className="font-mono text-[13px]"
              placeholder={'hdfcbank.net\nalerts@icicibank.com'}
              value={draft.emailSenders}
              onChange={(e) => set('emailSenders', e.target.value)}
              disabled={disabled}
            />
            <p className="text-xs text-[var(--admin-text-muted)]">An address or a whole domain, one per line, up to 25.</p>
          </div>
        </Card>

        <Card title="Rule overrides" className="lg:col-span-2">
          <div className="flex flex-col gap-4">
            {data.legacySmsSenders.length > 0 && (
              <Banner
                tone="info"
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    state={legacyFb.state}
                    disabled={disabled}
                    onClick={() =>
                      void legacyFb.run(() => runSa(() => save({ saToken: token, orgId, clearLegacySmsSenders: true })))
                    }
                  >
                    Remove old list
                  </Button>
                }
              >
                The store saved its own SMS sender list before ({data.legacySmsSenders.join(', ')}). It still counts as known banks
                and turns on Only known banks for this store.
              </Banner>
            )}

            <OverrideSection
              title="Accepted sender suffixes"
              overridden={draft.acceptedSuffixes !== null}
              onToggle={(on) => set('acceptedSuffixes', on ? [...g.acceptedSuffixes] : null)}
              globalValue={g.acceptedSuffixes.map((s) => SUFFIX_TEXT[s] ?? s).join(', ')}
              disabled={disabled}
            >
              <SuffixPicker value={draft.acceptedSuffixes ?? []} onChange={(v) => set('acceptedSuffixes', v)} disabled={disabled} />
            </OverrideSection>

            <OverrideSection
              title="Extra bank senders for this store"
              overridden={draft.bankSenders !== null}
              onToggle={(on) => set('bankSenders', on ? '' : null)}
              globalValue={`${formatCount(g.bankSenders.length)} known banks`}
              disabled={disabled}
            >
              <Textarea
                rows={3}
                className="font-mono text-[13px]"
                placeholder={'MYBANK'}
                value={draft.bankSenders ?? ''}
                onChange={(e) => set('bankSenders', e.target.value)}
                disabled={disabled}
                aria-label="Extra bank senders"
              />
              <p className="text-xs text-[var(--admin-text-muted)]">Added to the global list for this store only.</p>
            </OverrideSection>

            <OverrideSection
              title="Only known banks"
              overridden={draft.knownSendersOnly !== null}
              onToggle={(on) => set('knownSendersOnly', on ? g.knownSendersOnly : null)}
              globalValue={g.knownSendersOnly ? 'On' : 'Off'}
              disabled={disabled}
            >
              <ToggleRow
                label="Only known banks"
                hint="Accept credit SMS only from senders on the bank list."
                checked={!!draft.knownSendersOnly}
                onChange={(v) => set('knownSendersOnly', v)}
                disabled={disabled}
              />
            </OverrideSection>

            <OverrideSection
              title="Phone-number senders"
              overridden={draft.allowPhoneSenders !== null}
              onToggle={(on) => set('allowPhoneSenders', on ? g.allowPhoneSenders : null)}
              globalValue={g.allowPhoneSenders ? 'Accepted' : 'Rejected'}
              disabled={disabled}
            >
              <ToggleRow
                label="Accept SMS from phone numbers"
                hint="Only for a bank that sends from a long number. Anyone can fake these."
                checked={!!draft.allowPhoneSenders}
                onChange={(v) => set('allowPhoneSenders', v)}
                disabled={disabled}
              />
            </OverrideSection>

            <OverrideSection
              title="Credit words"
              overridden={draft.creditKeywords !== null}
              onToggle={(on) => set('creditKeywords', on ? g.creditKeywords.join(', ') : null)}
              globalValue={g.creditKeywords.join(', ')}
              disabled={disabled}
            >
              <Input
                value={draft.creditKeywords ?? ''}
                onChange={(e) => set('creditKeywords', e.target.value)}
                disabled={disabled}
                aria-label="Credit words"
              />
            </OverrideSection>

            <OverrideSection
              title="Debit words"
              overridden={draft.debitKeywords !== null}
              onToggle={(on) => set('debitKeywords', on ? g.debitKeywords.join(', ') : null)}
              globalValue={g.debitKeywords.join(', ')}
              disabled={disabled}
            >
              <Input
                value={draft.debitKeywords ?? ''}
                onChange={(e) => set('debitKeywords', e.target.value)}
                disabled={disabled}
                aria-label="Debit words"
              />
            </OverrideSection>
          </div>
        </Card>
      </div>

      {(fb.error || legacyFb.error) && <Banner tone="critical">{(fb.error ?? legacyFb.error)?.message}</Banner>}
      <div>
        <Button variant="primary" state={fb.state} disabled={disabled} onClick={() => void onSave()}>
          Save store payment rules
        </Button>
      </div>

      <MessagesView fixedOrgId={orgId} />
    </>
  );
}
