import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { ArrowRight, Copy, ExternalLink, ImageIcon, RefreshCw, Replace, Search, Trash2, Upload } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { deleteR2Image, type R2Image } from '../../lib/images/upload';
import type { AssetUsage } from '../../lib/images/usage';
import { cn } from '../../components/ui/utils';
import {
  Banner,
  BulkActionBar,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  FilterBar,
  FilterChip,
  Page,
  Sheet,
  Skeleton,
  SkeletonText,
  toActionError,
  useButtonFeedback,
  type ActionError,
  type BannerTone,
} from '../ui';
import {
  ACCEPT_ATTR,
  ImagePickerDialog,
  StageOverlay,
  Thumb,
  USAGE_FILTERS,
  contextSubtitle,
  contextTitle,
  displayName,
  filesFromClipboard,
  formatBytes,
  matchesUsage,
  removeFromLibrary,
  useImageLibrary,
  useImageUploads,
  usageShort,
  type UsageFilter,
} from '../components/shared/ImagePicker';

const PAGE = 72;

interface Notice {
  tone: BannerTone;
  text: string;
}

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

/**
 * The store's image library. Job: find an image, see where it is used, replace
 * it everywhere or delete it safely, and upload new ones.
 * Grid on the left, details of the clicked image on the right (a sheet on phones).
 */
export function AssetManager() {
  const lib = useImageLibrary();
  const isDesktop = useIsDesktop();
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UsageFilter>('all');
  const [visible, setVisible] = useState(PAGE);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [bulkPlan, setBulkPlan] = useState<{ deletable: R2Image[]; skipped: number } | null>(null);
  const [planning, setPlanning] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const uploads = useImageUploads({
    aspect: 'free',
    onUploaded: (image) => setActivePath(image.path),
  });

  // Fresh "where used" on every visit: products saved a minute ago count.
  const { refresh } = lib;
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Paste a screenshot anywhere on the page to upload it.
  const addFilesRef = useRef(uploads.addFiles);
  addFilesRef.current = uploads.addFiles;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const files = filesFromClipboard(e);
      if (!files.length) return;
      e.preventDefault();
      void addFilesRef.current(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const images = useMemo(() => lib.images ?? [], [lib.images]);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      images.filter(
        (i) =>
          (!q || i.name.toLowerCase().includes(q) || displayName(i.name).toLowerCase().includes(q)) &&
          matchesUsage(lib.usage.get(i.path), filter),
      ),
    [images, q, filter, lib.usage],
  );
  const counts = useMemo(() => {
    const out: Partial<Record<UsageFilter, number>> = {};
    if (!lib.usageReady) return out;
    for (const f of USAGE_FILTERS) out[f.id] = images.filter((i) => matchesUsage(lib.usage.get(i.path), f.id)).length;
    return out;
  }, [images, lib.usage, lib.usageReady]);
  const shown = filtered.slice(0, visible);
  const active = activePath ? images.find((i) => i.path === activePath) ?? null : null;
  const pending = uploads.items.filter((u) => u.stage !== 'done');

  useEffect(() => setVisible(PAGE), [q, filter]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => (v < filtered.length ? v + PAGE : v));
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  // Selection follows the library: deleted images drop out.
  useEffect(() => {
    if (!lib.images) return;
    const paths = new Set(lib.images.map((i) => i.path));
    setChecked((prev) => {
      const next = new Set([...prev].filter((p) => paths.has(p)));
      return next.size === prev.size ? prev : next;
    });
    if (activePath && !paths.has(activePath)) setActivePath(null);
  }, [lib.images, activePath]);

  const toggleChecked = (path: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const unusedShown = filtered.filter((i) => lib.usage.get(i.path)?.total === 0);
  const checkedImages = images.filter((i) => checked.has(i.path));
  const checkedUnused = checkedImages.filter((i) => lib.usage.get(i.path)?.total === 0);

  const planBulkDelete = async () => {
    setPlanning(true);
    try {
      // Fail-closed: a fresh check right before deleting.
      const fresh = await lib.recheckUsage(checkedImages);
      const deletable = checkedImages.filter((i) => fresh.get(i.path)?.total === 0);
      if (!deletable.length) {
        setNotice({ tone: 'warning', text: 'All selected images are in use, so none can be deleted.' });
        return;
      }
      setBulkPlan({ deletable, skipped: checkedImages.length - deletable.length });
    } finally {
      setPlanning(false);
    }
  };

  const runBulkDelete = async () => {
    if (!bulkPlan) return;
    const removed: string[] = [];
    let failed = 0;
    for (const img of bulkPlan.deletable) {
      try {
        await deleteR2Image(img.path);
        removed.push(img.path);
      } catch {
        failed += 1;
      }
    }
    removeFromLibrary(removed);
    setChecked(new Set());
    const skipped = bulkPlan.skipped;
    setBulkPlan(null);
    setNotice(
      failed
        ? { tone: 'warning', text: `Deleted ${removed.length}. ${failed} could not be deleted; they may have just been used somewhere.` }
        : {
            tone: 'success',
            text: `Deleted ${removed.length} unused image${removed.length === 1 ? '' : 's'}${skipped ? `. Kept ${skipped} that ${skipped === 1 ? 'is' : 'are'} in use` : ''}.`,
          },
    );
  };

  const copyLinks = useButtonFeedback();

  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const cols = Math.max(1, Math.round((e.currentTarget.closest('ul')?.clientWidth ?? 1) / (e.currentTarget.clientWidth || 1)));
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (!delta) return;
    const next = shown[index + delta];
    if (!next) return;
    e.preventDefault();
    setActivePath(next.path);
    document.querySelector<HTMLButtonElement>(`[data-tile="${index + delta}"]`)?.focus();
  };

  const loading = lib.images === undefined;
  const waitingForUsage = filter !== 'all' && !lib.usageReady;
  const libraryEmpty = !loading && images.length === 0 && pending.length === 0;

  const details = active ? (
    <AssetDetails
      key={active.path}
      image={active}
      usage={lib.usage.get(active.path)}
      usageReady={lib.usageReady}
      onRecheck={() => void lib.recheckUsage([active])}
      onDeleted={(name) => {
        removeFromLibrary([active.path]);
        setActivePath(null);
        setNotice({ tone: 'success', text: `Deleted ${name}.` });
      }}
      recheckUsage={lib.recheckUsage}
    />
  ) : null;

  return (
    <Page
      title="Assets"
      primaryAction={{ label: 'Upload images', icon: <Upload />, onClick: () => fileRef.current?.click(), loading: uploads.busy }}
      secondaryActions={[{ label: 'Refresh', icon: <RefreshCw />, onClick: () => void lib.refresh() }]}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept={ACCEPT_ATTR}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void uploads.addFiles(files);
        }}
      />

      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}
      <ErrorBanner error={lib.error} />

      <Card padding="none">
        <FilterBar
          search={{ value: query, onChange: setQuery, placeholder: 'Search images' }}
          end={
            filter === 'unused' && unusedShown.length > 0 ? (
              <Button variant="plain" size="sm" onClick={() => setChecked(new Set(unusedShown.map((i) => i.path)))}>
                Select all {unusedShown.length}
              </Button>
            ) : (
              <span className="text-xs tabular-nums text-[var(--admin-text-muted)]">
                {loading ? '' : `${filtered.length} image${filtered.length === 1 ? '' : 's'}`}
              </span>
            )
          }
        >
          <div className="scrollbar-hide -mx-3 flex max-w-[100vw] gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="group" aria-label="Where the image is used">
            {USAGE_FILTERS.map((f) => (
              <FilterChip key={f.id} label={f.label} active={filter === f.id} count={counts[f.id]} onClick={() => setFilter(f.id)} />
            ))}
          </div>
        </FilterBar>

        <div className="flex border-t border-[var(--admin-border)]">
          <section
            aria-label="Images"
            onDragOver={(e) => {
              if (!Array.from(e.dataTransfer.types).includes('Files')) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
            }}
            onDrop={(e) => {
              if (!Array.from(e.dataTransfer.types).includes('Files')) return;
              e.preventDefault();
              setDragOver(false);
              void uploads.addFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn('relative min-h-[420px] min-w-0 flex-1 p-3 sm:p-4 transition-colors duration-150', dragOver && 'bg-[var(--admin-primary-soft)]')}
          >
            {loading || waitingForUsage ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-label="Loading images">
                {Array.from({ length: 15 }, (_, i) => (
                  <li key={i} className="flex flex-col gap-1.5">
                    <Skeleton className="aspect-square h-auto w-full rounded-[var(--admin-radius)]" />
                    <Skeleton className="h-3 w-3/4" />
                  </li>
                ))}
              </ul>
            ) : libraryEmpty ? (
              <EmptyState
                icon={<ImageIcon />}
                title="Your image library is empty"
                description="Drop photos here, paste a screenshot, or upload from your device. Images you add to products, banners and blog posts show up here too."
                action={
                  <Button variant="primary" icon={<Upload aria-hidden />} onClick={() => fileRef.current?.click()}>
                    Upload images
                  </Button>
                }
                className="py-20"
              />
            ) : filtered.length === 0 && pending.length === 0 ? (
              <EmptyState
                icon={<Search />}
                title={filter === 'unused' ? 'No unused images' : 'No images match'}
                description={filter === 'unused' ? 'Every image is in use somewhere. Nothing to tidy up.' : 'Try another word, or show every image.'}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    Show all images
                  </Button>
                }
                className="py-20"
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {pending.map((u) => (
                  <li key={u.id} className="flex flex-col gap-1.5">
                    <div className="relative aspect-square overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
                      {u.preview ? <Thumb src={u.preview} /> : <span className="block size-full bg-[var(--admin-surface-subtle)]" />}
                      <StageOverlay item={u} onDismiss={() => uploads.dismiss(u.id)} />
                    </div>
                    <p className="truncate text-[13px] font-medium text-[var(--admin-text)]">{u.name}</p>
                  </li>
                ))}
                {shown.map((img, index) => {
                  const u = lib.usage.get(img.path);
                  const status = usageShort(u);
                  const isActive = img.path === activePath;
                  const isChecked = checked.has(img.path);
                  return (
                    <li key={img.path} className="group relative flex flex-col gap-1.5">
                      <button
                        type="button"
                        data-tile={index}
                        onClick={() => setActivePath(isActive && !isDesktop ? null : img.path)}
                        onKeyDown={(e) => onTileKey(e, index)}
                        aria-pressed={isActive}
                        aria-label={`${displayName(img.name)}${status ? `, ${status.toLowerCase()}` : ''}`}
                        className={cn(
                          'relative block aspect-square w-full overflow-hidden rounded-[var(--admin-radius)] border transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-1',
                          isActive
                            ? 'border-[var(--admin-primary)] ring-2 ring-[var(--admin-primary)]'
                            : isChecked
                              ? 'border-[var(--admin-primary)]'
                              : 'border-[var(--admin-border)] hover:border-[var(--admin-border-strong)]',
                        )}
                      >
                        <Thumb src={img.url} />
                      </button>
                      <div
                        className={cn(
                          'absolute left-1.5 top-1.5 rounded-[5px] bg-[var(--admin-surface)]/95 p-1 shadow-sm transition-opacity duration-150',
                          checked.size > 0 || isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
                        )}
                      >
                        <Checkbox label={`Select ${displayName(img.name)}`} checked={isChecked} onCheckedChange={() => toggleChecked(img.path)} />
                      </div>
                      <div className="min-w-0 px-0.5">
                        <p className="truncate text-[13px] font-medium text-[var(--admin-text)]" title={img.name}>
                          {displayName(img.name)}
                        </p>
                        {status ? (
                          <p className={cn('truncate text-xs', u?.total === 0 ? 'text-[var(--admin-text-subtle)]' : 'text-[var(--admin-text-muted)]')}>{status}</p>
                        ) : (
                          <Skeleton className="mt-1 h-3 w-16" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div ref={sentinelRef} className="h-px" aria-hidden />
            {dragOver && (
              <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-[var(--admin-radius)] border-2 border-dashed border-[var(--admin-primary)] text-sm font-medium text-[var(--admin-primary)]">
                Drop to add to your library
              </div>
            )}
          </section>

          <aside aria-label="Image details" className="hidden w-[340px] shrink-0 border-l border-[var(--admin-border)] lg:block xl:w-[380px]">
            <div className="sticky top-[76px] max-h-[calc(100dvh-88px)] overflow-y-auto">
              {details ?? (
                <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[var(--admin-neutral-soft)] text-[var(--admin-text-muted)]">
                    <ImageIcon className="size-5" aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-[var(--admin-text)]">Click an image</p>
                  <p className="text-sm text-[var(--admin-text-muted)]">See it larger, where it is used, and replace or delete it.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </Card>

      {!isDesktop && (
        <Sheet open={!!active} onOpenChange={(o) => !o && setActivePath(null)} title={active ? displayName(active.name) : 'Image'} side="bottom">
          {details}
        </Sheet>
      )}

      <BulkActionBar
        count={checked.size}
        onClear={() => setChecked(new Set())}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              state={copyLinks.state}
              successLabel="Copied"
              icon={<Copy aria-hidden />}
              onClick={() => copyLinks.run(() => navigator.clipboard.writeText(checkedImages.map((i) => i.url).join('\n')))}
            >
              Copy links
            </Button>
            <Button
              size="sm"
              variant="critical"
              icon={<Trash2 aria-hidden />}
              loading={planning}
              disabled={lib.usageReady && checkedUnused.length === 0}
              title={lib.usageReady && checkedUnused.length === 0 ? 'Only unused images can be deleted' : undefined}
              onClick={() => void planBulkDelete()}
            >
              {lib.usageReady ? `Delete unused (${checkedUnused.length})` : 'Delete unused'}
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={!!bulkPlan}
        onOpenChange={(o) => !o && setBulkPlan(null)}
        title={`Delete ${bulkPlan?.deletable.length ?? 0} unused image${bulkPlan?.deletable.length === 1 ? '' : 's'}?`}
        description={`They are not used anywhere in your store. This cannot be undone.${bulkPlan?.skipped ? ` ${bulkPlan.skipped} selected image${bulkPlan.skipped === 1 ? ' is' : 's are'} in use and will be kept.` : ''}`}
        confirmLabel="Delete"
        critical
        onConfirm={runBulkDelete}
      />
      {uploads.cropDialog}
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Details panel
// ---------------------------------------------------------------------------

function AssetDetails({
  image,
  usage,
  usageReady,
  onRecheck,
  onDeleted,
  recheckUsage,
}: {
  image: R2Image;
  usage: AssetUsage | undefined;
  usageReady: boolean;
  onRecheck: () => void;
  onDeleted: (name: string) => void;
  recheckUsage: (images: R2Image[]) => Promise<Map<string, AssetUsage>>;
}) {
  const repoint = useMutation(api.adminCatalog.repointImageRefs);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceWith, setReplaceWith] = useState<string | null>(null);
  const [result, setResult] = useState<Notice | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const copy = useButtonFeedback();
  const name = displayName(image.name);

  const known = !!usage && usage.total >= 0;
  const inUse = known && usage.total > 0;
  const canReplace = known && usage.mutableTotal > 0;

  const doDelete = async () => {
    const fresh = await recheckUsage([image]);
    const total = fresh.get(image.path)?.total;
    if (total === undefined || total < 0) throw toActionError(new Error('Could not check where this image is used. Nothing was deleted; try again.'));
    if (total > 0) throw toActionError(new Error(`This image was just used in ${total === 1 ? 'one place' : `${total} places`}, so it was kept.`));
    try {
      await deleteR2Image(image.path);
    } catch (err) {
      throw toActionError(err, 'Could not delete this image.');
    }
    onDeleted(name);
  };

  const doReplace = useCallback(async () => {
    if (!replaceWith) return;
    setError(null);
    try {
      const res = await repoint({ orgSlug: ORG_SLUG, oldKey: image.path, oldUrl: image.url, newUrl: replaceWith });
      const n = Object.values(res.patched as Record<string, number>).reduce((a, b) => a + b, 0);
      await recheckUsage([image]);
      setResult({
        tone: 'success',
        text: n
          ? `Switched ${n === 1 ? 'one place' : `${n} places`} to the new image. This one is now unused, so you can delete it.`
          : 'Nothing needed switching: this image is no longer used anywhere.',
      });
    } catch (err) {
      const e = toActionError(err, 'Could not switch to the new image.');
      throw e.code === 'BAD_IMAGE_REFERENCE'
        ? { ...e, message: 'This image cannot be replaced automatically. Change it on each page listed under Used in.' }
        : e;
    }
  }, [replaceWith, repoint, image, recheckUsage]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex aspect-square max-h-[320px] w-full items-center justify-center overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]">
        <img
          src={image.url}
          alt={name}
          onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-[var(--admin-text)]" title={name}>
          {name}
        </h2>
        <p className="truncate text-xs text-[var(--admin-text-subtle)]" title={image.name}>
          {image.name}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-[var(--admin-text-muted)]">Size</dt>
          <dd className="tabular-nums text-[var(--admin-text)]">{formatBytes(image.size)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--admin-text-muted)]">Dimensions</dt>
          <dd className="tabular-nums text-[var(--admin-text)]">{dims ? `${dims.w} × ${dims.h}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--admin-text-muted)]">Added</dt>
          <dd className="text-[var(--admin-text)]">
            {image.createdAt ? new Date(image.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={<Copy aria-hidden />}
          state={copy.state}
          successLabel="Copied"
          onClick={() => copy.run(() => navigator.clipboard.writeText(image.url))}
        >
          Copy link
        </Button>
        <Button size="sm" variant="plain" icon={<ExternalLink aria-hidden />} asChild>
          <a href={image.url} target="_blank" rel="noreferrer">
            Open
          </a>
        </Button>
      </div>

      <section aria-labelledby="used-in" className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-4">
        <h3 id="used-in" className="text-sm font-semibold text-[var(--admin-text)]">
          Used in
        </h3>
        {!usage && !usageReady ? (
          <SkeletonText lines={2} />
        ) : !known ? (
          <Banner tone="warning" action={<Button size="sm" variant="secondary" onClick={onRecheck}>Check again</Button>}>
            Could not check where this image is used.
          </Banner>
        ) : usage.total === 0 ? (
          <p className="text-sm text-[var(--admin-text-muted)]">Not used anywhere in your store.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--admin-border)] rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
            {usage.contexts.map((c, i) => {
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--admin-text)]">{contextTitle(c)}</span>
                    <span className="block truncate text-xs text-[var(--admin-text-muted)]">{contextSubtitle(c)}</span>
                  </span>
                  {c.href && <ArrowRight className="size-4 shrink-0 text-[var(--admin-text-subtle)]" aria-hidden />}
                </>
              );
              return (
                <li key={`${c.kind}-${c.label}-${c.detail}-${i}`}>
                  {c.href ? (
                    <Link
                      to={c.href}
                      className="flex items-center gap-2 px-3 py-2 transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-focus)]"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2">{body}</div>
                  )}
                </li>
              );
            })}
            {usage.total > usage.contexts.length && (
              <li className="px-3 py-2 text-xs text-[var(--admin-text-muted)]">and {usage.total - usage.contexts.length} more</li>
            )}
          </ul>
        )}
      </section>

      {result && (
        <Banner tone={result.tone} onDismiss={() => setResult(null)}>
          {result.text}
        </Banner>
      )}
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-4">
        {canReplace && (
          <Button variant="secondary" icon={<Replace aria-hidden />} fullWidth onClick={() => setPickerOpen(true)}>
            Replace everywhere
          </Button>
        )}
        <Button
          variant="plain"
          icon={<Trash2 aria-hidden />}
          fullWidth
          disabled={!known || inUse}
          onClick={() => setConfirmDelete(true)}
          className="text-[var(--admin-critical)] hover:bg-[var(--admin-critical-soft)]"
        >
          Delete image
        </Button>
        {inUse && (
          <p className="text-xs text-[var(--admin-text-muted)]">
            This image is in use, so it cannot be deleted. {canReplace ? 'Replace it everywhere first, or change it on the pages above.' : 'It is kept for past orders.'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${name}?`}
        description="It is not used anywhere in your store. This cannot be undone."
        confirmLabel="Delete"
        critical
        onConfirm={doDelete}
      />
      <ImagePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose the new image"
        exclude={[image.url]}
        searchQuery={name}
        slug={name}
        onPick={(urls) => urls[0] && setReplaceWith(urls[0])}
      />
      <ConfirmDialog
        open={!!replaceWith}
        onOpenChange={(o) => !o && setReplaceWith(null)}
        title={`Use the new image in ${usage && usage.mutableTotal === 1 ? 'one place' : `${usage?.mutableTotal ?? 0} places`}?`}
        description="Every product, page and setting listed under Used in switches to the new image. The old one stays in your library until you delete it."
        confirmLabel="Replace"
        onConfirm={doReplace}
      >
        {replaceWith && (
          <div className="flex items-center gap-3">
            <span className="size-16 shrink-0 overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
              <Thumb src={image.url} />
            </span>
            <ArrowRight className="size-4 text-[var(--admin-text-subtle)]" aria-hidden />
            <span className="size-16 shrink-0 overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-primary)]">
              <Thumb src={replaceWith} />
            </span>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
