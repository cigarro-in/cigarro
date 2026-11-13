import { useEffect, useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { ChevronRight } from 'lucide-react';
import {
  Badge,
  Banner,
  Button,
  Card,
  Label,
  Page,
  Skeleton,
  Textarea,
  useButtonFeedback,
  type BadgeTone,
} from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import { useSa } from '../SuperGate';
import { runSa, formatCount, formatDateTime, migrationLabel, relativeTime } from '../saUi';
import { listMigrationsRef, runPendingMigrationsRef } from '../refs';

// What the runner reports per migration (convex/migrations.ts runPending).
const RUN_OUTCOME: Record<string, { label: string; tone: BadgeTone }> = {
  done: { label: 'Applied', tone: 'success' },
  'skipped:done': { label: 'Already applied', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'critical' },
  'skipped:gave-up': { label: 'Gave up after 5 tries', tone: 'critical' },
};

// Two things the owner does here: apply data updates after a release, and
// (rarely) add a bank whose alert emails should count as payments.
export function PlatformConfigPage() {
  const { token, writeOpen } = useSa();
  const migrations = useQuery(listMigrationsRef, { saToken: token });
  const runPending = useAction(runPendingMigrationsRef);
  const runFb = useButtonFeedback();
  const [lastRun, setLastRun] = useState<{ at: number; entries: [string, string][] } | null>(null);

  const lastRunAt = useMemo(
    () => (migrations && migrations.length ? Math.max(...migrations.map((m) => m.updatedAt)) : undefined),
    [migrations],
  );
  const failed = (migrations ?? []).filter((m) => m.status === 'failed');

  const onRun = async () => {
    const summary = await runFb.run(() => runSa(() => runPending({ saToken: token })));
    if (summary === undefined) return;
    setLastRun({ at: Date.now(), entries: Object.entries(summary) });
  };

  const runError = lastRun?.entries.find(([k]) => k === '_error')?.[1];
  const runEntries = (lastRun?.entries ?? []).filter(([k]) => k !== '_error');
  const appliedNow = runEntries.filter(([, v]) => v === 'done').length;

  return (
    <Page title="Platform config">
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Card title="Data updates">
          <p className="max-w-prose text-[13px] text-[var(--admin-text-muted)]">
            Some releases need a one-time fix to stored data. Press the button after a release. Updates already applied are skipped.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" state={runFb.state} disabled={!writeOpen || runFb.busy} onClick={() => void onRun()}>
              Run pending migrations
            </Button>
            <span className="text-[13px] text-[var(--admin-text-muted)]">
              {migrations === undefined ? '' : lastRunAt ? `Last run ${relativeTime(lastRunAt).toLowerCase()}` : 'Never run'}
            </span>
          </div>

          {runFb.error && (
            <div className="mt-3">
              <Banner tone="critical">{runFb.error.message}</Banner>
            </div>
          )}
          {runError && (
            <div className="mt-3">
              <Banner tone="critical">The run could not start. Try again in a minute.</Banner>
            </div>
          )}

          {lastRun && !runError ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-[var(--admin-text-muted)]">
                {appliedNow === 0 ? 'Nothing new to apply' : `Applied ${formatCount(appliedNow)} update${appliedNow === 1 ? '' : 's'}`} ·{' '}
                {formatDateTime(lastRun.at)}
              </p>
              <ul className="divide-y divide-[var(--admin-border)] rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)]">
                {runEntries.map(([name, outcome]) => {
                  const o = RUN_OUTCOME[outcome] ?? { label: outcome, tone: 'neutral' as const };
                  return (
                    <li key={name} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate text-sm text-[var(--admin-text)]">{migrationLabel(name)}</span>
                      <Badge tone={o.tone} dot>
                        {o.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : migrations === undefined ? (
            <div className="mt-4 space-y-2" aria-busy="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : migrations.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--admin-border)] rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)]">
              {migrations.map((m) => (
                <li key={m._id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-[var(--admin-text)]">{migrationLabel(m.name)}</span>
                  {m.status === 'done' ? (
                    <Badge tone="success" dot>
                      Applied
                    </Badge>
                  ) : (
                    <Badge tone="critical" dot>
                      Failed
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {failed.length > 0 && !lastRun && (
            <div className="mt-3">
              <Banner tone="warning">
                {failed.length === 1 ? 'One update failed.' : `${failed.length} updates failed.`} Run again. If it keeps failing, ask your developer.
              </Banner>
            </div>
          )}
        </Card>

        <BankSendersCard token={token} writeOpen={writeOpen} />
      </div>

      {migrations && migrations.length > 0 && (
        <details className="group rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
            Technical details
          </summary>
          <div className="border-t border-[var(--admin-border)] px-4 py-3">
            <p className="mb-2 text-xs text-[var(--admin-text-muted)]">For a developer: the raw record of each update.</p>
            <ul className="space-y-2">
              {migrations.map((m) => (
                <li key={m._id} className="text-xs">
                  <p className="font-mono text-[var(--admin-text)]">
                    {m.name} · {m.status} · {m.runs} run{m.runs === 1 ? '' : 's'} · {formatDateTime(m.updatedAt)}
                  </p>
                  {m.result && <p className="mt-0.5 break-all font-mono text-[var(--admin-text-muted)]">{m.result}</p>}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </Page>
  );
}

// Extra bank email senders (on top of the built-in list) that count as payment
// alerts for every store. Rarely changed, so the editor stays folded.
function BankSendersCard({ token, writeOpen }: { token: string; writeOpen: boolean }) {
  const appConfig = useQuery(api.appConfig.get, { saToken: token });
  const setAppConfig = useMutation(api.appConfig.set);
  const saveFb = useButtonFeedback();
  const [editing, setEditing] = useState(false);
  const [csv, setCsv] = useState('');

  const customSenders = appConfig?.customBankSenders ?? [];
  const defaultSenders = appConfig?.defaultBankSenders ?? [];
  const merged = appConfig?.bankSenders ?? [];
  const customKey = customSenders.join('\n');

  useEffect(() => {
    setCsv(customKey);
  }, [customKey]);

  const onSave = async () => {
    const senders = csv
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = await saveFb.run(() => runSa(() => setAppConfig({ saToken: token, bankSenders: senders })));
    if (ok !== undefined) setEditing(false);
  };

  return (
    <Card
      title="Bank alert emails"
      actions={
        !editing ? (
          <Button size="sm" variant="secondary" disabled={!writeOpen || appConfig === undefined} onClick={() => setEditing(true)}>
            Add a bank
          </Button>
        ) : undefined
      }
    >
      <p className="max-w-prose text-[13px] text-[var(--admin-text-muted)]">
        Payments are confirmed by reading bank alert emails. Common Indian banks are built in. Add a bank only if its alerts are being missed.
      </p>

      {appConfig === undefined ? (
        <Skeleton className="mt-4 h-4 w-48" />
      ) : (
        <p className="mt-4 text-sm text-[var(--admin-text)]">
          {formatCount(defaultSenders.length)} built in
          {customSenders.length > 0 ? `, ${formatCount(customSenders.length)} added by you` : ''}
        </p>
      )}

      {customSenders.length > 0 && !editing && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {customSenders.map((s) => (
            <li key={s}>
              <Badge tone="attention">
                <span className="font-mono">{s}</span>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sa-senders">Extra sender addresses</Label>
            <Textarea
              id="sa-senders"
              className="font-mono text-[13px]"
              rows={4}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={'@icicibank.com\nalerts@sbi.co.in'}
              disabled={!writeOpen || saveFb.busy}
            />
            <p className="text-xs text-[var(--admin-text-muted)]">One per line, up to 20. A whole bank can be written as @bankdomain.com.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" state={saveFb.state} disabled={!writeOpen || saveFb.busy} onClick={() => void onSave()}>
              Save
            </Button>
            <Button
              variant="plain"
              disabled={saveFb.busy}
              onClick={() => {
                setCsv(customKey);
                setEditing(false);
                saveFb.reset();
              }}
            >
              Cancel
            </Button>
          </div>
          {saveFb.error && <Banner tone="critical">{saveFb.error.message}</Banner>}
        </div>
      )}

      {merged.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer font-medium text-[var(--admin-primary)]">See all {formatCount(merged.length)} addresses</summary>
          <p className="mt-2 break-words font-mono leading-5 text-[var(--admin-text-muted)]">{merged.join(', ')}</p>
        </details>
      )}
    </Card>
  );
}
