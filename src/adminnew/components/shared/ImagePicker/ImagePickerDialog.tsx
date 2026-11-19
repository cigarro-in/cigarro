import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Globe, ImageIcon, Images, Search, Upload, X } from 'lucide-react';
import { Dialog as DialogRoot, DialogContent, DialogDescription, DialogTitle } from '../../../../components/ui/dialog';
import { cn } from '../../../../components/ui/utils';
import { Banner, Button, EmptyState, ErrorBanner, FilterChip, Skeleton } from '../../../ui';
import { aspectConfig, type ImageAspect } from './aspect';
import { useImageLibrary } from './useImageLibrary';
import { ACCEPT_ATTR, filesFromClipboard, urlFromClipboard, useImageUploads } from './useImageUploads';
import { matchesUsage, USAGE_FILTERS, type UsageFilter } from './usageGroups';
import { displayName, SelectMark, SmallBadge, StageOverlay, Thumb, UploadTile } from './tiles';

export type PickerTab = 'library' | 'upload' | 'web';

export interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen image URLs (always on the store CDN, in pick order). */
  onPick: (urls: string[]) => void;
  multiple?: boolean;
  /** Shape of the slot. Decides cropping and the stored size. Default: free. */
  aspect?: ImageAspect;
  /** Prefill for the web search (e.g. the product name). */
  searchQuery?: string;
  /** SEO filename stem and alt text for uploads (e.g. the product title). */
  slug?: string;
  title?: string;
  /** URLs the caller already has: shown as "Added" and not pickable again. */
  existing?: string[];
  /** The image in the slot now (single pick): marked "Current". */
  current?: string;
  /** URLs to leave out of the library (e.g. the image being replaced). */
  exclude?: string[];
  initialTab?: PickerTab;
  /** Files dropped on the field before the dialog opened: uploaded right away. */
  initialFiles?: File[];
}

const PAGE = 60;
const API_BASE = import.meta.env.DEV ? 'https://cigarro.in' : '';

interface WebResult {
  url: string;
  thumbnail: string;
  title?: string;
}

const TABS: { id: PickerTab; label: string; icon: typeof Images }[] = [
  { id: 'library', label: 'Library', icon: Images },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'web', label: 'Web', icon: Globe },
];

/**
 * The one image picker: Library, Upload and Web search in one dialog.
 * Every path stores the image in this store's library (WebP, SEO filename)
 * and hands its CDN URL back through `onPick`.
 */
export function ImagePickerDialog({
  open,
  onOpenChange,
  onPick,
  multiple = false,
  aspect = 'free',
  searchQuery = '',
  slug,
  title,
  existing = [],
  current,
  exclude = [],
  initialTab = 'library',
  initialFiles,
}: ImagePickerDialogProps) {
  const cfg = aspectConfig(aspect);
  const [tab, setTab] = useState<PickerTab>(initialTab);
  // Panels stay mounted once visited, so web results survive a tab switch.
  const [visited, setVisited] = useState<Set<PickerTab>>(() => new Set([initialTab]));
  useEffect(() => setVisited((v) => (v.has(tab) ? v : new Set([...v, tab]))), [tab]);
  const [picked, setPicked] = useState<string[]>([]);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const pickedRef = useRef<string[]>([]);
  pickedRef.current = picked;

  const finish = useCallback(
    (urls: string[]) => {
      if (!urls.length) return;
      onPick(urls);
      onOpenChange(false);
    },
    [onPick, onOpenChange],
  );

  // An upload or web import is the intent itself: single pick returns at once;
  // multi pick adds it to the selection.
  const uploads = useImageUploads({
    aspect,
    slug: slug || searchQuery || undefined,
    onUploaded: (image) => {
      if (multiple) setPicked((prev) => (prev.includes(image.url) ? prev : [...prev, image.url]));
      else finish([image.url]);
    },
  });

  // Reset each time the dialog opens.
  const addFilesRef = useRef(uploads.addFiles);
  addFilesRef.current = uploads.addFiles;
  useEffect(() => {
    if (!open) return;
    const first = initialFiles?.length ? 'upload' : initialTab;
    setTab(first);
    setVisited(new Set([first]));
    setPicked([]);
    setCloseBlocked(false);
    if (initialFiles?.length) void addFilesRef.current(initialFiles);
    // initialFiles and initialTab are read once per open on purpose.
  }, [open]);

  // Paste anywhere in the dialog: images upload, an image link imports.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = filesFromClipboard(e);
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (files.length) {
        e.preventDefault();
        setTab('upload');
        void addFilesRef.current(multiple ? files : files.slice(0, 1));
        return;
      }
      const link = urlFromClipboard(e);
      if (link && !typing) {
        e.preventDefault();
        setTab('upload');
        void importRef.current(link);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [open, multiple]);
  const importRef = useRef(uploads.importUrl);
  importRef.current = uploads.importUrl;

  const requestClose = (next: boolean) => {
    if (!next && uploads.busy) {
      setCloseBlocked(true);
      return;
    }
    onOpenChange(next);
  };

  const toggle = (url: string) => {
    if (existing.includes(url)) return;
    setPicked((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      return multiple ? [...prev, url] : [url];
    });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`picker-tab-${next.id}`)?.focus();
  };

  const count = picked.length;
  const primaryLabel = multiple ? (count > 1 ? `Add ${count} images` : 'Add image') : 'Use image';

  return (
    <>
      <DialogRoot open={open} onOpenChange={requestClose}>
        <DialogContent
          className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden rounded-none border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 sm:h-[min(88vh,780px)] sm:max-w-[calc(100%-2rem)] sm:rounded-[var(--admin-radius)] md:max-w-4xl lg:max-w-5xl"
        >
          <div className="border-b border-[var(--admin-border)] px-4 pt-4 pr-12">
            <DialogTitle className="text-base font-semibold text-[var(--admin-text)]">
              {title ?? (multiple ? 'Add images' : 'Choose an image')}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
              {cfg.hint}. Pick from your library, upload from this device, or find one on the web.
            </DialogDescription>
            <div role="tablist" aria-label="Where the image comes from" className="-mb-px mt-3 flex gap-1">
              {TABS.map((t) => {
                const active = t.id === tab;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    id={`picker-tab-${t.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`picker-panel-${t.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setTab(t.id)}
                    onKeyDown={onTabKey}
                    className={cn(
                      'relative flex h-10 items-center gap-1.5 rounded-t-[var(--admin-radius-sm)] px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]',
                      active
                        ? 'font-semibold text-[var(--admin-text)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--admin-primary)]'
                        : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {t.label}
                    {t.id === 'upload' && uploads.busy && <span className="size-1.5 rounded-full bg-[var(--admin-primary)]" aria-label="uploading" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {tab === 'library' && (
              <LibraryPanel
                multiple={multiple}
                picked={picked}
                existing={existing}
                current={current}
                exclude={exclude}
                pending={uploads.items.filter((u) => u.stage !== 'done' && u.stage !== 'error')}
                onToggle={toggle}
                onChoose={(url) => finish([url])}
                onUpload={() => setTab('upload')}
                onWeb={() => setTab('web')}
              />
            )}
            {(tab === 'upload' || visited.has('upload')) && <UploadPanel hidden={tab !== 'upload'} multiple={multiple} hint={cfg.hint} crops={cfg.crop} uploads={uploads} picked={picked} />}
            {visited.has('web') && (
              <WebPanel hidden={tab !== 'web'} initialQuery={searchQuery} multiple={multiple} picked={picked} uploads={uploads} onToggle={toggle} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {closeBlocked && uploads.busy ? (
              <span role="status" className="text-sm text-[var(--admin-warning)]">
                Images are still saving. This closes when they finish.
              </span>
            ) : (
              <span className="text-sm tabular-nums text-[var(--admin-text-muted)]" aria-live="polite">
                {count ? `${count} selected` : multiple ? 'Select one or more images' : 'Select an image'}
              </span>
            )}
            {count > 0 && (
              <Button variant="plain" size="sm" icon={<X aria-hidden />} onClick={() => setPicked([])}>
                Clear
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => finish(pickedRef.current)} disabled={!count || uploads.busy}>
                {primaryLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>
      {uploads.cropDialog}
    </>
  );
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

function LibraryPanel({
  multiple,
  picked,
  existing,
  current,
  exclude,
  pending,
  onToggle,
  onChoose,
  onUpload,
  onWeb,
}: {
  multiple: boolean;
  picked: string[];
  existing: string[];
  current?: string;
  exclude: string[];
  pending: ReturnType<typeof useImageUploads>['items'];
  onToggle: (url: string) => void;
  onChoose: (url: string) => void;
  onUpload: () => void;
  onWeb: () => void;
}) {
  const lib = useImageLibrary();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UsageFilter>('all');
  const [visible, setVisible] = useState(PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const excluded = useMemo(() => new Set(exclude), [exclude]);
  const all = useMemo(() => (lib.images ?? []).filter((i) => !excluded.has(i.url)), [lib.images, excluded]);
  const filtered = useMemo(
    () =>
      all.filter(
        (i) =>
          (!q || i.name.toLowerCase().includes(q) || displayName(i.name).toLowerCase().includes(q)) &&
          matchesUsage(lib.usage.get(i.path), filter),
      ),
    [all, q, filter, lib.usage],
  );
  const counts = useMemo(() => {
    const out: Partial<Record<UsageFilter, number>> = {};
    if (!lib.usageReady) return out;
    for (const f of USAGE_FILTERS) out[f.id] = all.filter((i) => matchesUsage(lib.usage.get(i.path), f.id)).length;
    return out;
  }, [all, lib.usage, lib.usageReady]);
  const shown = filtered.slice(0, visible);

  useEffect(() => setVisible(PAGE), [q, filter]);
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => (v < filtered.length ? v + PAGE : v));
    }, { root, rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const loading = lib.images === undefined;
  const usageFilterWaiting = filter !== 'all' && !lib.usageReady;

  return (
    <div id="picker-panel-library" role="tabpanel" aria-labelledby="picker-tab-library" className="flex h-full flex-col">
      <div className="flex flex-col gap-2 px-4 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-subtle)]" aria-hidden />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your images"
            aria-label="Search your images"
            className="h-9 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] pl-8 pr-3 text-base text-[var(--admin-text)] placeholder:text-[var(--admin-text-subtle)] focus:border-[var(--admin-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus)]/20 md:text-sm"
          />
        </div>
        <div className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Where the image is used">
          {USAGE_FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} active={filter === f.id} count={counts[f.id]} onClick={() => setFilter(f.id)} />
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ErrorBanner error={lib.error} className="mb-3" />
        {loading || usageFilterWaiting ? (
          <TileGridSkeleton />
        ) : filtered.length === 0 && pending.length === 0 ? (
          all.length === 0 ? (
            <EmptyState
              icon={<ImageIcon />}
              title="No images yet"
              description="Upload from this device or find one on the web. Everything you add is kept here for next time."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon={<Upload aria-hidden />} onClick={onUpload}>
                    Upload images
                  </Button>
                  <Button variant="secondary" icon={<Globe aria-hidden />} onClick={onWeb}>
                    Search the web
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="No images match"
              description="Try another word, or show every image."
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
            />
          )
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6" aria-label="Your images">
            {pending.map((u) => (
              <li key={u.id}>
                <UploadTile item={u} />
              </li>
            ))}
            {shown.map((img) => {
              const added = existing.includes(img.url);
              const order = picked.indexOf(img.url);
              const isCurrent = !!current && current === img.url;
              return (
                <li key={img.path}>
                  <button
                    type="button"
                    onClick={() => onToggle(img.url)}
                    onDoubleClick={() => !multiple && !added && onChoose(img.url)}
                    disabled={added}
                    aria-pressed={order >= 0}
                    aria-label={`${displayName(img.name)}${added ? ', already added' : ''}${isCurrent ? ', current image' : ''}`}
                    title={displayName(img.name)}
                    className={cn(
                      'group relative block aspect-square w-full overflow-hidden rounded-[var(--admin-radius)] border transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-1',
                      order >= 0
                        ? 'border-[var(--admin-primary)] ring-2 ring-[var(--admin-primary)]'
                        : 'border-[var(--admin-border)] hover:border-[var(--admin-border-strong)]',
                      added && 'cursor-not-allowed',
                    )}
                  >
                    <Thumb src={img.url} className={cn(added && 'opacity-40')} />
                    {order >= 0 && <span className="absolute inset-0 bg-[var(--admin-primary)]/10" aria-hidden />}
                    {!added && <SelectMark order={order} multiple={multiple} visible={false} />}
                    {added && <SmallBadge>Added</SmallBadge>}
                    {isCurrent && !added && <SmallBadge>Current</SmallBadge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={sentinelRef} className="h-px" aria-hidden />
      </div>
    </div>
  );
}

function TileGridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading images" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-square h-auto w-full rounded-[var(--admin-radius)]" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

function UploadPanel({
  hidden,
  multiple,
  hint,
  crops,
  uploads,
  picked,
}: {
  hidden: boolean;
  multiple: boolean;
  hint: string;
  crops: boolean;
  uploads: ReturnType<typeof useImageUploads>;
  picked: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (files: File[]) => void uploads.addFiles(multiple ? files : files.slice(0, 1));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(Array.from(e.dataTransfer.files));
  };

  return (
    <div id="picker-panel-upload" role="tabpanel" aria-labelledby="picker-tab-upload" hidden={hidden} className="h-full overflow-y-auto p-4">
      <button
        type="button"
        autoFocus
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-[var(--admin-radius)] border-2 border-dashed px-4 py-10 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] sm:py-14',
          over
            ? 'border-[var(--admin-primary)] bg-[var(--admin-primary-soft)]'
            : 'border-[var(--admin-border-strong)] hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-hover)]',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[var(--admin-neutral-soft)] text-[var(--admin-text-muted)]">
          <Upload className="size-5" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-[var(--admin-text)]">
          {over ? 'Drop to upload' : multiple ? 'Drag images here, or click to choose' : 'Drag an image here, or click to choose'}
        </span>
        <span className="text-xs text-[var(--admin-text-muted)]">
          You can also paste a screenshot or an image link. {hint}.{crops ? ' You frame each image before it is saved.' : ''}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          take(files);
        }}
      />

      {uploads.items.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--admin-text)]">This session</p>
            {!uploads.busy && (
              <Button variant="plain" size="sm" onClick={uploads.clearFinished}>
                Clear list
              </Button>
            )}
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6" aria-live="polite">
            {uploads.items.map((u) => (
              <li key={u.id} className="flex flex-col gap-1">
                <UploadTile
                  item={u}
                  onDismiss={() => uploads.dismiss(u.id)}
                  className={cn(u.image && picked.includes(u.image.url) && 'border-[var(--admin-primary)] ring-2 ring-[var(--admin-primary)]')}
                />
                <span className="truncate text-xs text-[var(--admin-text-muted)]" title={u.name}>
                  {u.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Web
// ---------------------------------------------------------------------------

function WebPanel({
  hidden,
  initialQuery,
  multiple,
  picked,
  uploads,
  onToggle,
}: {
  hidden: boolean;
  initialQuery: string;
  multiple: boolean;
  picked: string[];
  uploads: ReturnType<typeof useImageUploads>;
  onToggle: (url: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<WebResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const run = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term) return;
    const req = ++reqRef.current;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/images/search?q=${encodeURIComponent(term)}`);
      const body = await res.json().catch(() => ({}));
      if (req !== reqRef.current) return;
      if (!res.ok) throw new Error(body.error || 'Search is not available right now.');
      const images: WebResult[] = (body.images || []).filter((r: WebResult) => r && r.url);
      setResults(images);
      if (!images.length) setError(body.error ? 'Web search is not available right now.' : null);
    } catch (err) {
      if (req !== reqRef.current) return;
      setResults([]);
      setError(err instanceof Error ? err.message : 'Search failed. Try again.');
    } finally {
      if (req === reqRef.current) setSearching(false);
    }
  }, []);

  // First visit with a prefilled name searches straight away.
  useEffect(() => {
    if (initialQuery.trim()) void run(initialQuery);
  }, [initialQuery, run]);

  const itemFor = (url: string) => uploads.items.find((u) => u.sourceUrl === url);

  return (
    <div id="picker-panel-web" role="tabpanel" aria-labelledby="picker-tab-web" hidden={hidden} className="flex h-full flex-col">
      <form
        className="flex gap-2 px-4 pb-2 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-subtle)]" aria-hidden />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Marlboro Gold pack"
            aria-label="Search the web for images"
            className="h-9 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] pl-8 pr-3 text-base text-[var(--admin-text)] placeholder:text-[var(--admin-text-subtle)] focus:border-[var(--admin-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus)]/20 md:text-sm"
          />
        </div>
        <Button type="submit" variant="secondary" loading={searching} disabled={!query.trim()}>
          Search
        </Button>
      </form>
      <p className="px-4 pb-2 text-xs text-[var(--admin-text-muted)]">
        Click a picture to save a copy to your library. Use images you have the right to use.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <Banner tone="warning" className="mb-3">
            {error}
          </Banner>
        )}
        {searching && !results?.length ? (
          <TileGridSkeleton count={12} />
        ) : results === null ? (
          <EmptyState icon={<Globe />} title="Find an image on the web" description="Type what you are looking for, like a brand and pack name." />
        ) : results.length === 0 ? (
          !error && <EmptyState icon={<Search />} title="Nothing found" description="Try fewer or different words." />
        ) : (
          <ul className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6', searching && 'opacity-60')}>
            {results.map((r, i) => {
              const item = itemFor(r.url);
              const libraryUrl = item?.image?.url;
              const order = libraryUrl ? picked.indexOf(libraryUrl) : -1;
              const working = !!item && item.stage !== 'done' && item.stage !== 'error';
              return (
                <li key={`${r.url}-${i}`}>
                  <button
                    type="button"
                    disabled={working}
                    aria-pressed={order >= 0}
                    aria-label={`${r.title || `Result ${i + 1}`}${libraryUrl ? ', in your library' : ''}`}
                    title={r.title}
                    onClick={() => {
                      if (libraryUrl) onToggle(libraryUrl);
                      else void uploads.importUrl(r.url, { thumbnail: r.thumbnail, title: r.title });
                    }}
                    className={cn(
                      'group relative block aspect-square w-full overflow-hidden rounded-[var(--admin-radius)] border bg-[var(--admin-surface-subtle)] transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-1',
                      order >= 0 ? 'border-[var(--admin-primary)] ring-2 ring-[var(--admin-primary)]' : 'border-[var(--admin-border)] hover:border-[var(--admin-border-strong)]',
                    )}
                  >
                    <Thumb src={r.thumbnail || r.url} fallback={r.url} referrerPolicy="no-referrer" />
                    {item && item.stage !== 'done' && <StageOverlay item={item} />}
                    {libraryUrl && <SelectMark order={order} multiple={multiple} visible />}
                    {libraryUrl && order < 0 && <SmallBadge>In library</SmallBadge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

