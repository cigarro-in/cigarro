// Super-admin "Fresh start": clears one store's data so it can be handed over.
// Framed as what to KEEP. Every group starts ticked (kept). Unticking a group
// clears it. The server (convex/storeReset.ts) refuses the platform org and
// needs an open write window; this card only drives it and shows progress.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Banner, Button, Card, Checkbox, Input, Label, Skeleton } from '../adminnew/ui';
import { InlineStatus, useInlineStatus } from '../components/common/InlineStatus';
import type { Id } from '../../convex/_generated/dataModel';
import { formatCount, runSa } from './saUi';
import { clearBatchRef, logResetRef, previewResetRef, type ResetPreview } from './freshStartRefs';

const GROUP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const FILE_GROUP_IDS = [11, 12];

// Plain-language copy per group. Counts and table names come from the server.
const GROUP_COPY: Record<number, { label: string; copy: string }> = {
  1: { label: 'Orders & payments', copy: 'Orders, invoices, late payments, bank emails and payment messages.' },
  2: {
    label: 'Customers',
    copy: 'Customer accounts, carts, wishlists, saved addresses, wallet, reviews and push subscriptions. Staff and admins stay.',
  },
  3: { label: 'Marketing', copy: 'Marketing contacts, campaigns, templates and sends.' },
  4: { label: 'Stock', copy: 'Stock levels and stock movements.' },
  5: { label: 'Catalog', copy: 'Brands, categories, products, variants, collections, combos and discounts.' },
  6: { label: 'Content', copy: 'Blog, store pages, banners, homepage sections and old-link redirects.' },
  7: { label: 'Store settings', copy: 'Site settings and invoice settings.' },
  8: {
    label: 'Payment setup',
    copy: 'UPI IDs, Gmail connection, bank inboxes, bank email templates, SMS relays and pipeline settings.',
  },
  9: { label: 'Platform fees', copy: 'Platform fee ledger and dues balance for this store.' },
  10: { label: 'Activity log', copy: 'This store\'s admin activity log. The reset itself is still recorded for the platform.' },
  11: { label: 'Files used by the store', copy: 'Images the remaining data points to. Clearing them breaks any image on a kept page.' },
  12: { label: 'Unused files', copy: 'Images that nothing in the store\'s data points to.' },
};

interface FileCounts {
  listed: number;
  used: number;
  unused: number;
  deleted: number;
}

type RunState = 'waiting' | 'running' | 'done' | 'failed';
interface ProgressRow {
  state: RunState;
  removed?: number;
}

type FileMode = 'both' | 'used' | 'unused';

// Calls the Pages Function that lists and deletes R2 files for this store.
async function callStoreFiles(token: string, orgId: string, mode: FileMode, dryRun: boolean): Promise<FileCounts> {
  let res: Response;
  try {
    res = await fetch('/api/sa/store-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saToken: token, orgId, mode, dryRun }),
    });
  } catch {
    throw Object.assign(new Error('Could not reach the file service. Check your connection and try again.'), { code: 'NETWORK' });
  }
  const body = (await res.json().catch(() => null)) as (FileCounts & { error?: string; code?: string }) | null;
  if (!res.ok || !body) {
    const code = body?.code ?? `HTTP_${res.status}`;
    const message =
      code === 'NOT_SIGNED_IN'
        ? 'Your KeyBastion session ended. Open this app from KeyBastion again.'
        : code === 'WRITE_REQUIRED' || code === 'WRITE_EXPIRED'
          ? 'Write access expired. Open it again from KeyBastion to edit.'
          : body?.error || 'File cleanup failed.';
    throw Object.assign(new Error(message), { code });
  }
  return { listed: body.listed, used: body.used, unused: body.unused, deleted: body.deleted };
}

function errorText(err: unknown): string {
  const e = err as { message?: string; code?: string; data?: { code?: string } };
  const code = e.code ?? e.data?.code;
  const message = e.message || 'Something went wrong. Try again.';
  return code ? `${message} (${code})` : message;
}

export function FreshStartCard({
  orgId,
  slug,
  token,
  writeOpen,
}: {
  orgId: Id<'organizations'>;
  slug: string;
  token: string;
  writeOpen: boolean;
}) {
  const preview = useQuery(previewResetRef, { saToken: token, orgId }) as ResetPreview | undefined;
  const clearBatch = useMutation(clearBatchRef);
  const logReset = useMutation(logResetRef);
  const { status, setError, setOk, clear } = useInlineStatus();

  const [keep, setKeep] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(GROUP_IDS.map((id) => [id, true])),
  );
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<number, ProgressRow> | null>(null);
  const [files, setFiles] = useState<FileCounts | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const runningRef = useRef(false);

  // Dry run for the file groups: counts only, nothing deleted.
  const loadFiles = useCallback(async () => {
    try {
      setFiles(await callStoreFiles(token, orgId, 'both', true));
      setFilesError(null);
    } catch (err) {
      setFilesError(errorText(err));
    }
  }, [token, orgId]);

  useEffect(() => {
    if (writeOpen) void loadFiles();
  }, [writeOpen, loadFiles]);

  const clearedIds = GROUP_IDS.filter((id) => !keep[id]);
  const fileMode: FileMode | null = !keep[11] && !keep[12] ? 'both' : !keep[11] ? 'used' : !keep[12] ? 'unused' : null;
  const warnFiles = !keep[11] && (!!keep[5] || !!keep[6]);
  const canRun = writeOpen && !running && clearedIds.length > 0 && typed === slug;

  const groupCount = (id: number): number | string | undefined => {
    if (id === 11) return files?.used;
    if (id === 12) return files?.unused;
    return preview?.groups.find((g) => g.id === id)?.total;
  };

  const setKeepGroup = (id: number, value: boolean) => setKeep((prev) => ({ ...prev, [id]: value }));

  async function run() {
    if (runningRef.current || !canRun || !preview) return;
    runningRef.current = true;
    setRunning(true);
    clear();
    const initial: Record<number, ProgressRow> = {};
    for (const id of clearedIds) initial[id] = { state: 'waiting' };
    setProgress(initial);
    const mark = (id: number, patch: ProgressRow) => setProgress((p) => ({ ...p, [id]: { ...p?.[id], ...patch } }));

    let current: number | null = null;
    let totalRemoved = 0;
    try {
      // Groups 1 to 10: clear table by table in batches, then log the group.
      for (const group of preview.groups) {
        if (group.id > 10 || keep[group.id]) continue;
        current = group.id;
        mark(group.id, { state: 'running' });
        const counts: Record<string, number> = {};
        let removed = 0;
        for (const t of group.tables) {
          let n = 0;
          for (;;) {
            const r = await runSa(() => clearBatch({ saToken: token, orgId, table: t.table }));
            n += r.deleted;
            if (r.done) break;
          }
          counts[t.table] = n;
          removed += n;
        }
        await runSa(() => logReset({ saToken: token, orgId, group: group.id, deleted: counts }));
        mark(group.id, { state: 'done', removed });
        totalRemoved += removed;
      }

      // Files last, so "unused" reflects the data that was just cleared.
      if (fileMode) {
        for (const id of FILE_GROUP_IDS) if (!keep[id]) mark(id, { state: 'running' });
        current = 11;
        const res = await callStoreFiles(token, orgId, fileMode, false);
        const usedRemoved = fileMode !== 'unused' ? res.used : 0;
        const unusedRemoved = fileMode !== 'used' ? res.unused : 0;
        if (!keep[11]) {
          await runSa(() => logReset({ saToken: token, orgId, group: 11, deleted: { r2_files: usedRemoved } }));
          mark(11, { state: 'done', removed: usedRemoved });
          totalRemoved += usedRemoved;
        }
        if (!keep[12]) {
          await runSa(() => logReset({ saToken: token, orgId, group: 12, deleted: { r2_files: unusedRemoved } }));
          mark(12, { state: 'done', removed: unusedRemoved });
          totalRemoved += unusedRemoved;
        }
      }
      setOk(`Fresh start done for ${slug}. ${formatCount(totalRemoved)} item${totalRemoved === 1 ? '' : 's'} removed.`);
    } catch (err) {
      if (current !== null) mark(current, { state: 'failed' });
      setError(`Stopped. Nothing after this point was cleared. ${errorText(err)}`);
    } finally {
      runningRef.current = false;
      setRunning(false);
      setTyped('');
      if (writeOpen) void loadFiles();
    }
  }

  return (
    <Card title="Fresh start" className="border-[var(--admin-critical-border)]">
      <p className="text-[13px] text-[var(--admin-text-muted)]">
        Hand this store over with a clean slate. Tick what to keep. Every box starts ticked. Unticking a group clears it for{' '}
        <span className="font-medium text-[var(--admin-text)]">{preview?.name ?? slug}</span>. Ticking nothing gives a brand-new empty
        store. The store itself, its domains, and its staff and admin accounts are always kept. This cannot be undone.
      </p>

      {!writeOpen && (
        <div className="mt-3">
          <Banner tone="warning">Write access is closed. Open this app from KeyBastion with write access to use Fresh start.</Banner>
        </div>
      )}

      <div className="mt-4 divide-y divide-[var(--admin-border)] border-y border-[var(--admin-border)]">
        {GROUP_IDS.map((id) => {
          const meta = GROUP_COPY[id];
          const group = preview?.groups.find((g) => g.id === id);
          const nonZero = group?.tables.filter((t) => t.count !== 0) ?? [];
          const total = groupCount(id);
          const p = progress?.[id];
          return (
            <div key={id} className="flex items-start gap-3 py-3">
              <div className="pt-0.5">
                <Checkbox
                  checked={!!keep[id]}
                  onCheckedChange={(v) => setKeepGroup(id, v)}
                  label={`Keep ${meta.label}`}
                  disabled={running}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--admin-text)]">{meta.label}</p>
                <p className="text-[13px] text-[var(--admin-text-muted)]">{meta.copy}</p>
                {!keep[id] && (
                  <p className="mt-1 text-[13px] font-medium text-[var(--admin-critical)]">
                    {id >= 11
                      ? `Will clear ${total === undefined ? '...' : formatCount(Number(total) || 0)} file${Number(total) === 1 ? '' : 's'}`
                      : `Will clear ${total === undefined ? '...' : typeof total === 'string' ? total : formatCount(total)} row${total === 1 ? '' : 's'}`}
                  </p>
                )}
                {id <= 10 && nonZero.length > 0 && (
                  <p className="mt-0.5 break-words font-mono text-[11px] text-[var(--admin-text-muted)]">
                    {nonZero.map((t) => `${t.table} ${typeof t.count === 'number' ? formatCount(t.count) : t.count}`).join(' · ')}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-[13px] text-[var(--admin-text-muted)]">
                {id >= 11 ? (
                  filesError ? null : files === null ? <Skeleton className="h-4 w-12" /> : <span>{formatCount(total as number)}</span>
                ) : group ? (
                  <span>{typeof group.total === 'number' ? formatCount(group.total) : group.total}</span>
                ) : (
                  <Skeleton className="h-4 w-12" />
                )}
                {p && (
                  <p className="mt-0.5 text-[12px] font-medium">
                    {p.state === 'waiting' && <span className="text-[var(--admin-text-muted)]">Waiting</span>}
                    {p.state === 'running' && <span className="text-[var(--admin-primary)]">Clearing...</span>}
                    {p.state === 'done' && <span className="text-[var(--admin-success)]">Removed {formatCount(p.removed ?? 0)}</span>}
                    {p.state === 'failed' && <span className="text-[var(--admin-critical)]">Failed</span>}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filesError && <p className="mt-2 text-[13px] text-[var(--admin-critical)]">Could not count files: {filesError}</p>}

      {warnFiles && (
        <div className="mt-3">
          <Banner tone="warning" title="Images will break">
            Catalog or Content is kept, but its images are in the files set to clear. Keep "Files used by the store" ticked unless you are
            also clearing Catalog and Content.
          </Banner>
        </div>
      )}

      <div className="mt-4">
        <InlineStatus status={status} onDismiss={clear} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {clearedIds.length === 0 ? (
          <p className="text-[13px] text-[var(--admin-text-muted)]">Everything is kept. Nothing will be cleared.</p>
        ) : (
          <>
            <div className="max-w-sm">
              <Label htmlFor="fresh-start-confirm">
                Type <span className="font-mono">{slug}</span> to confirm
              </Label>
              <Input
                id="fresh-start-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={running || !writeOpen}
                autoComplete="off"
                spellCheck={false}
                placeholder={slug}
              />
            </div>
            <div>
              <Button variant="critical" disabled={!canRun} onClick={() => void run()}>
                {running ? 'Clearing...' : 'Clear selected'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
