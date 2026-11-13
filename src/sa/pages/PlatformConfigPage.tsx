import { useEffect, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardSection,
  DataTable,
  EmptyState,
  Label,
  Page,
  Textarea,
  useButtonFeedback,
  type Column,
} from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import { useSa } from '../SuperGate';
import { runSa, formatCount, formatDateTime } from '../saUi';
import { listMigrationsRef, runPendingMigrationsRef, type MigrationRow } from '../refs';

// Platform-wide bank-alert senders shared by every store, plus the one-time
// migration runner. Migrations run only when the button is pressed.
export function PlatformConfigPage() {
  const { token, writeOpen } = useSa();
  const appConfig = useQuery(api.appConfig.get, { saToken: token });
  const setAppConfig = useMutation(api.appConfig.set);
  const migrations = useQuery(listMigrationsRef, { saToken: token });
  const runPendingMigrations = useAction(runPendingMigrationsRef);

  const migrationFb = useButtonFeedback();
  const [lastRun, setLastRun] = useState<{ at: number; entries: [string, string][] } | null>(null);

  const saveFb = useButtonFeedback();
  const [csv, setCsv] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const customSenders = appConfig?.customBankSenders ?? [];
  const defaultSenders = appConfig?.defaultBankSenders ?? [];
  const mergedSenders = appConfig?.bankSenders ?? [];
  const customKey = customSenders.join('\n');

  // Re-seed the textarea only when the saved list changes.
  useEffect(() => {
    setCsv(customKey);
  }, [customKey]);

  const onSave = async () => {
    const senders = csv
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = await saveFb.run(() => runSa(() => setAppConfig({ saToken: token, bankSenders: senders })));
    if (ok !== undefined) setSavedAt(Date.now());
  };

  const onRunMigrations = async () => {
    const summary = await migrationFb.run(() => runSa(() => runPendingMigrations({ saToken: token })));
    if (summary === undefined) return;
    setLastRun({ at: Date.now(), entries: Object.entries(summary) });
  };

  const migrationColumns: Column<MigrationRow>[] = [
    {
      id: 'name',
      header: 'Migration',
      cell: (m) => <span className="break-all font-mono text-[13px]">{m.name}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (m) =>
        m.status === 'done' ? <Badge tone="success" dot>Done</Badge> : <Badge tone="critical" dot>Failed</Badge>,
    },
    {
      id: 'runs',
      header: 'Runs',
      align: 'right',
      hideBelow: 'sm',
      cell: (m) => <span className="tabular-nums">{m.runs}</span>,
    },
    {
      id: 'updated',
      header: 'Updated',
      hideBelow: 'md',
      cell: (m) => <span className="whitespace-nowrap text-[13px] text-[var(--admin-text-muted)]">{formatDateTime(m.updatedAt)}</span>,
    },
    {
      id: 'result',
      header: 'Result',
      cell: (m) => <span className="break-all font-mono text-xs text-[var(--admin-text-muted)]">{m.result ?? '-'}</span>,
    },
  ];

  const pendingCount = (migrations ?? []).filter((m) => m.status === 'failed').length;

  return (
    <Page title="Platform config">
      {/* Migrations first: the one action that changes production data. */}
      <Card title="One-time migrations">
        <CardSection>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-[var(--admin-text-muted)]">
                Runs only when you press the button. Completed migrations never run again. Failed ones retry, up to 5 runs.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="shrink-0"
                state={migrationFb.state}
                disabled={!writeOpen || migrationFb.busy}
                onClick={() => void onRunMigrations()}
              >
                Run pending migrations
              </Button>
            </div>

            {migrationFb.error && <Banner tone="critical">{migrationFb.error.message}</Banner>}

            {lastRun && (
              <div className="rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-3 py-2">
                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                    {lastRun.entries.length === 0 ? 'Nothing to run' : `Ran ${formatCount(lastRun.entries.length)} migration${lastRun.entries.length === 1 ? '' : 's'}`}
                  </p>
                  <span className="text-xs text-[var(--admin-text-muted)]">{formatDateTime(lastRun.at)}</span>
                </div>
                {lastRun.entries.length === 0 ? (
                  <p className="px-3 py-3 text-[13px] text-[var(--admin-text-muted)]">No migrations pending.</p>
                ) : (
                  <ul className="divide-y divide-[var(--admin-border)]">
                    {lastRun.entries.map(([name, result]) => (
                      <li key={name} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                        <span className="font-mono text-[13px] text-[var(--admin-text)]">{name}</span>
                        <span className="break-all font-mono text-xs text-[var(--admin-text-muted)]">{result}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </CardSection>
        <div className="border-t border-[var(--admin-border)]">
          <DataTable
            columns={migrationColumns}
            rows={migrations}
            getRowId={(m) => m._id}
            loading={migrations === undefined}
            empty={<EmptyState title="No migrations have run yet" description="Pending migrations appear here after the first run." />}
          />
        </div>
        {pendingCount > 0 && (
          <div className="px-4 py-3">
            <Banner tone="warning">
              {pendingCount} migration{pendingCount === 1 ? ' has' : 's have'} failed. Run again after checking the result.
            </Banner>
          </div>
        )}
      </Card>

      <Card title="Bank-alert senders">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--admin-text-muted)]">
            Added to the built-in defaults for every store, never replacing them. One per line or comma-separated, up to 20.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="sa-senders">Additional senders</Label>
            <Textarea
              id="sa-senders"
              className="font-mono text-[13px]"
              rows={4}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={'@icicibank.com\nalerts@sbi.co.in'}
              disabled={!writeOpen || saveFb.busy}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--admin-text-muted)]">Searched now ({formatCount(mergedSenders.length)})</p>
            {mergedSenders.length === 0 ? (
              <p className="text-[13px] text-[var(--admin-text-muted)]">No senders configured.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {mergedSenders.map((s) => {
                  const isDefault = defaultSenders.includes(s);
                  const isCustom = customSenders.includes(s) && !isDefault;
                  return (
                    <li key={s}>
                      <Badge tone={isCustom ? 'attention' : 'neutral'}>
                        <span className="font-mono">{s}</span>
                        <span className="text-[var(--admin-text-subtle)]">{isDefault ? 'default' : isCustom ? 'custom' : ''}</span>
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" state={saveFb.state} disabled={!writeOpen || saveFb.busy || appConfig === undefined} onClick={() => void onSave()}>
              Save senders
            </Button>
            {savedAt !== null && !saveFb.error && (
              <span className="text-[13px] text-[var(--admin-text-muted)]">Saved {formatDateTime(savedAt)}</span>
            )}
          </div>
          {saveFb.error && <Banner tone="critical">{saveFb.error.message}</Banner>}
        </div>
      </Card>
    </Page>
  );
}
