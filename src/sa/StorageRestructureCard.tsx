import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { Banner, Button, Card, Checkbox, Skeleton } from '../adminnew/ui';
import { InlineStatus, useInlineStatus } from '../components/common/InlineStatus';
import { formatCount } from './saUi';
import { listStoresRef, storageSummaryRef, type StoreRow, type StorageSummaryRow } from './refs';

// Copy batch size. Each batch lists this many raw R2 keys and copies the images
// among them, so one request stays well inside the Pages Functions limits.
const BATCH_LIMIT = 25;

interface CopyBatch {
  slug: string;
  scanned: number;
  copied: number;
  exists: number;
  conflicts: number;
  failed: number;
  cursor: string | null;
  done: boolean;
}

interface CopyTotals {
  copied: number;
  exists: number;
  conflicts: number;
  failed: number;
}

const ZERO: CopyTotals = { copied: 0, exists: 0, conflicts: 0, failed: 0 };

// One store's copy, looped batch by batch until the endpoint reports done.
// Idempotent: a re-run skips moves already recorded.
async function copyStoreImages(
  token: string,
  store: StoreRow,
  onBatch: (batch: CopyBatch, totals: CopyTotals) => void,
  totals: CopyTotals,
): Promise<CopyTotals> {
  let cursor: string | null = null;
  let running = { ...totals };
  for (;;) {
    let res: Response;
    try {
      res = await fetch('/api/sa/storage-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saToken: token, orgId: store._id, cursor, limit: BATCH_LIMIT }),
      });
    } catch {
      throw Object.assign(new Error('Could not reach the copy service. Check your connection and run it again.'), { code: 'NETWORK' });
    }
    const body = (await res.json().catch(() => null)) as (CopyBatch & { error?: string; code?: string }) | null;
    if (!res.ok || !body) {
      const code = body?.code ?? `HTTP_${res.status}`;
      const message =
        code === 'NOT_SIGNED_IN'
          ? 'Your KeyBastion session ended. Open this app from KeyBastion again.'
          : code === 'WRITE_REQUIRED' || code === 'WRITE_EXPIRED'
            ? 'Write access expired. Open it again from KeyBastion to edit.'
            : body?.error || 'Copying images failed.';
      throw Object.assign(new Error(message), { code });
    }
    running = {
      copied: running.copied + body.copied,
      exists: running.exists + body.exists,
      conflicts: running.conflicts + body.conflicts,
      failed: running.failed + body.failed,
    };
    onBatch(body, running);
    if (body.done) return running;
    if (!body.cursor) throw new Error(`Copying ${store.slug} stopped early. Run it again.`);
    cursor = body.cursor;
  }
}

function errorText(err: unknown): string {
  const e = err as { message?: string; code?: string };
  const message = e.message || 'Something went wrong. Try again.';
  return e.code ? `${message} (${e.code})` : message;
}

// Storage restructure: copy each store's old images into the new layout, then the
// data updates card (PlatformConfigPage) rewrites stored links. Copy only.
export function StorageRestructureCard({ token, writeOpen }: { token: string; writeOpen: boolean }) {
  const stores = useQuery(listStoresRef, { saToken: token });
  const summary = useQuery(storageSummaryRef, { saToken: token });
  const { status, setError, setOk, clear } = useInlineStatus();
  const [picked, setPicked] = useState<Record<string, boolean> | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ slug: string; batches: number; totals: CopyTotals } | null>(null);

  // Default: every store selected, once the list is known.
  useEffect(() => {
    if (stores && picked === null) {
      setPicked(Object.fromEntries(stores.map((s) => [s._id, true])));
    }
  }, [stores, picked]);

  const selected = (stores ?? []).filter((s) => picked?.[s._id]);
  const byStore = new Map<string, StorageSummaryRow>((summary ?? []).map((r) => [r.orgSlug, r]));
  const recorded = (summary ?? []).reduce((n, r) => n + r.copied, 0);
  const problems = (summary ?? []).reduce((n, r) => n + r.conflict + r.failed, 0);

  const onCopy = async () => {
    clear();
    setRunning(true);
    let totals = { ...ZERO };
    let finished = 0;
    try {
      for (const store of selected) {
        let batches = 0;
        totals = await copyStoreImages(
          token,
          store,
          (_batch, running) => {
            batches += 1;
            setProgress({ slug: store.slug, batches, totals: running });
          },
          totals,
        );
        finished += 1;
      }
      const problemText =
        totals.conflicts + totals.failed > 0
          ? ` ${formatCount(totals.conflicts)} conflict${totals.conflicts === 1 ? '' : 's'} and ${formatCount(totals.failed)} failed: those images keep their old links. Run Copy images again to retry.`
          : '';
      setOk(
        `Copied ${formatCount(totals.copied)} image${totals.copied === 1 ? '' : 's'}, ${formatCount(totals.exists)} already in place, across ${finished} store${finished === 1 ? '' : 's'}.${problemText} Next: Run pending migrations above.`,
      );
    } catch (err) {
      setError(`${errorText(err)}${finished ? ` ${finished} store${finished === 1 ? '' : 's'} finished before this.` : ''}`);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <Card title="Storage restructure">
      <p className="max-w-prose text-[13px] text-[var(--admin-text-muted)]">
        Copies each store&apos;s images into the new folder layout. Copies only: old images and old links keep working, and nothing is deleted.
        Then press Run pending migrations to point stored links at the new copies.
      </p>

      {stores === undefined ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-40" />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {stores.map((s) => {
            const row = byStore.get(s.slug);
            return (
              <li key={s._id} className="flex flex-wrap items-center justify-between gap-2">
                <Checkbox
                  checked={!!picked?.[s._id]}
                  onCheckedChange={(v) => setPicked((prev) => ({ ...(prev ?? {}), [s._id]: v }))}
                  label={s.name || s.slug}
                  disabled={running}
                />
                <span className="font-mono text-xs text-[var(--admin-text-muted)]">
                  {row ? `${formatCount(row.copied)} copied · ${formatCount(row.conflict)} conflicts · ${formatCount(row.failed)} failed` : 'Not copied yet'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={!writeOpen || running || selected.length === 0}
          onClick={() => void onCopy()}
        >
          {running ? 'Copying…' : 'Copy images'}
        </Button>
        <span className="text-[13px] text-[var(--admin-text-muted)]">
          {summary === undefined ? '' : `${formatCount(recorded)} move${recorded === 1 ? '' : 's'} recorded${problems ? `, ${formatCount(problems)} to retry` : ''}`}
        </span>
      </div>

      {progress && (
        <p className="mt-3 text-xs text-[var(--admin-text-muted)]" aria-live="polite">
          {progress.slug}: batch {progress.batches} · {formatCount(progress.totals.copied)} copied · {formatCount(progress.totals.exists)} already in place ·{' '}
          {formatCount(progress.totals.conflicts)} conflicts · {formatCount(progress.totals.failed)} failed
        </p>
      )}

      {!writeOpen && (
        <div className="mt-3">
          <Banner tone="warning">Write access is closed. Open it again from KeyBastion to copy images.</Banner>
        </div>
      )}

      <div className="mt-3">
        <InlineStatus status={status} onDismiss={clear} />
      </div>
    </Card>
  );
}
