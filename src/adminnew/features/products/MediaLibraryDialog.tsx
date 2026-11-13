import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { Check, ImageIcon, Loader2, Search, Upload, X } from 'lucide-react';
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../../components/ui/dialog';
import { cn } from '../../../components/ui/utils';
import { listR2Images, uploadImageToR2 } from '../../../lib/images/upload';
import { Banner, Button, ErrorBanner, FilterSelect, Skeleton, toActionError, type ActionError } from '../../ui';

interface LibraryImage {
  key: string;
  name: string;
  url: string;
  createdAt: string;
}

interface UploadItem {
  id: string;
  name: string;
  preview: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
  url?: string;
}

const PAGE = 60;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

function folderLabel(name: string) {
  if (!name) return 'All assets';
  if (name === 'product_images') return 'Product images';
  if (name === 'brand_logos') return 'Brand logos';
  return name.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Media library for product images: the store's R2 assets in a searchable,
 * infinitely scrolling grid, multi-select with numbered selection order, and
 * uploads with progress (uploaded images are selected automatically).
 *
 * `existing` URLs are already on the product: shown as "Added", not selectable.
 * `onConfirm` receives the newly picked URLs in the order they were picked.
 */
export function MediaLibraryDialog({
  open,
  onOpenChange,
  onConfirm,
  existing = [],
  multiple = true,
  uploadSlug,
  defaultFolder = 'product_images',
  title = 'Select images',
  initialFiles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (urls: string[]) => void;
  existing?: string[];
  multiple?: boolean;
  /** SEO filename stem for uploads (e.g. the product title). */
  uploadSlug?: string;
  defaultFolder?: string;
  title?: string;
  /** Files dropped elsewhere (e.g. on the product media card): uploaded as soon as the dialog opens. */
  initialFiles?: File[];
}) {
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [images, setImages] = useState<LibraryImage[] | undefined>(undefined);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<ActionError | null>(null);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [picked, setPicked] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const previewsRef = useRef<string[]>([]);

  const existingSet = useMemo(() => new Set(existing), [existing]);

  const loadPage = useCallback(async (target: string, next?: string) => {
    const req = ++requestRef.current;
    if (next) setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await listR2Images(`asset_images/${target ? `${target}/` : ''}`, next);
      if (req !== requestRef.current) return null;
      const items = page.images.map((i) => ({ key: i.path, name: i.name, url: i.url, createdAt: i.createdAt }));
      setImages((prev) => (next ? [...(prev ?? []), ...items] : items));
      setCursor(page.cursor);
      return page;
    } catch (err) {
      if (req === requestRef.current) {
        setLoadError(toActionError(err, 'Could not load the media library.'));
        setImages((prev) => prev ?? []);
      }
      return null;
    } finally {
      if (req === requestRef.current) setLoadingMore(false);
    }
  }, []);

  // Open: discover folders at the library root, then show the default folder.
  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setQuery('');
    setUploads([]);
    setUploadNote(null);
    setVisible(PAGE);
    setImages(undefined);
    let cancelled = false;
    if (initialFiles?.length) void startUploadsRef.current(initialFiles);
    void (async () => {
      const root = await loadPage('');
      if (cancelled || !root) return;
      const names = root.folders.map((f) => f.name).filter((n) => n && n !== 'orgs');
      setFolders(names);
      if (names.includes(defaultFolder)) {
        setFolder(defaultFolder);
        setImages(undefined);
        await loadPage(defaultFolder);
      } else {
        setFolder('');
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialFiles is read once per open on purpose (not a dependency).
  }, [open, defaultFolder, loadPage]);

  const switchFolder = (next: string) => {
    if (next === folder) return;
    setFolder(next);
    setImages(undefined);
    setCursor(undefined);
    setVisible(PAGE);
    void loadPage(next);
  };

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (images ?? []).filter((i) => !q || i.name.toLowerCase().includes(q)),
    [images, q],
  );
  const shown = filtered.slice(0, visible);

  useEffect(() => setVisible(PAGE), [q]);

  // Infinite scroll: reveal more of what is loaded, then fetch the next page.
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root || !open) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (visible < filtered.length) setVisible((v) => v + PAGE);
        else if (cursor && !loadingMore && folder !== null) void loadPage(folder, cursor);
      },
      { root, rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [open, visible, filtered.length, cursor, loadingMore, folder, loadPage]);

  const toggle = (url: string) => {
    if (existingSet.has(url)) return;
    setPicked((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      return multiple ? [...prev, url] : [url];
    });
  };

  // ---- Uploads ----
  const startUploads = async (files: File[]) => {
    setUploadNote(null);
    const rejected: string[] = [];
    const valid = files.filter((f) => {
      const ok = ACCEPT.includes(f.type) && f.size <= MAX_INPUT_BYTES;
      if (!ok) rejected.push(f.name);
      return ok;
    });
    if (rejected.length) setUploadNote(`Skipped ${rejected.join(', ')}: use JPEG, PNG, WebP, GIF or AVIF up to 15 MB.`);
    if (!valid.length) return;
    const batch: UploadItem[] = valid.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      preview: URL.createObjectURL(f),
      status: 'queued',
    }));
    previewsRef.current.push(...batch.map((b) => b.preview));
    setUploads((prev) => [...batch, ...prev]);
    const target = folder ?? defaultFolder;
    const patch = (id: string, p: Partial<UploadItem>) =>
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));

    // Two at a time: conversion is CPU bound in the browser.
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const idx = next++;
        const item = batch[idx];
        patch(item.id, { status: 'uploading' });
        try {
          const res = await uploadImageToR2(valid[idx], {
            folder: target || undefined,
            slug: uploadSlug || undefined,
            keepOriginalResolution: keepOriginal,
          });
          patch(item.id, { status: 'done', url: res.url });
          setImages((prev) => [
            { key: res.key, name: res.key.split('/').pop() || item.name, url: res.url, createdAt: new Date().toISOString() },
            ...(prev ?? []),
          ]);
          setPicked((prev) => (multiple ? [...prev, res.url] : [res.url]));
        } catch (err) {
          patch(item.id, { status: 'error', error: toActionError(err, 'Upload failed').message });
        }
      }
    };
    await Promise.all([worker(), worker()]);
  };

  // Free upload previews when the dialog closes or unmounts.
  useEffect(() => {
    if (!open) return;
    const urls = previewsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.length = 0;
    };
  }, [open]);

  const pending = uploads.filter((u) => u.status === 'queued' || u.status === 'uploading');
  const finished = uploads.filter((u) => u.status === 'done' || u.status === 'error').length;
  const failed = uploads.filter((u) => u.status === 'error');
  const inFlight = pending.length > 0;
  const progress = uploads.length ? Math.round((finished / uploads.length) * 100) : 0;

  const startUploadsRef = useRef(startUploads);
  startUploadsRef.current = startUploads;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length) void startUploads(files);
  };

  const confirm = () => {
    onConfirm(picked);
    onOpenChange(false);
  };

  const folderOptions = [
    { value: '', label: folderLabel('') },
    ...folders.map((f) => ({ value: f, label: folderLabel(f) })),
  ];

  return (
    <DialogRoot open={open} onOpenChange={(o) => !inFlight && onOpenChange(o)}>
      <DialogContent
        className="flex h-[min(88vh,780px)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-[var(--admin-radius)] border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 sm:max-w-4xl md:max-w-4xl lg:max-w-4xl"
      >
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 pb-3 pt-4 pr-12">
          <DialogTitle className="text-base font-semibold text-[var(--admin-text)]">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Choose images from the store library or upload new ones.
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-0 sm:w-auto sm:flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-subtle)]" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by file name"
                aria-label="Search images"
                className="h-9 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] pl-8 pr-3 text-base text-[var(--admin-text)] placeholder:text-[var(--admin-text-subtle)] focus:border-[var(--admin-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus)]/20 md:text-sm"
              />
            </div>
            {folder !== null && (
              <FilterSelect label="Folder" value={folder} options={folderOptions} onChange={switchFolder} />
            )}
            <Button variant="primary" size="md" icon={<Upload aria-hidden />} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length) void startUploads(files);
              }}
            />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-[var(--admin-text-muted)]">
            <input type="checkbox" checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)} />
            Keep original size and shape for uploads (default: square, max 1600px)
          </label>
        </div>

        {uploads.length > 0 && (
          <div className="flex flex-col gap-1.5 border-b border-[var(--admin-border)] px-4 py-2.5" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-[var(--admin-text-muted)]">
              <span>
                {inFlight
                  ? `Uploading ${finished + 1 > uploads.length ? uploads.length : finished + 1} of ${uploads.length}`
                  : `Uploaded ${uploads.length - failed.length} of ${uploads.length}`}
              </span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-neutral-soft)]">
              <div
                className={cn('h-full w-[var(--progress)] rounded-full transition-[width] duration-300', failed.length ? 'bg-[var(--admin-warning)]' : 'bg-[var(--admin-primary)]')}
                style={{ '--progress': `${progress}%` } as CSSProperties}
              />
            </div>
            {failed.length > 0 && (
              <p className="text-xs text-[var(--admin-critical)]">
                {failed.map((f) => `${f.name}: ${f.error}`).join('; ')}
              </p>
            )}
          </div>
        )}

        <div
          ref={scrollRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn('relative min-h-0 flex-1 overflow-y-auto p-4', dragOver && 'bg-[var(--admin-primary-soft)]')}
        >
          {uploadNote && <Banner tone="warning" className="mb-3" onDismiss={() => setUploadNote(null)}>{uploadNote}</Banner>}
          <ErrorBanner error={loadError} className="mb-3" />

          {images === undefined ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {Array.from({ length: 15 }, (_, i) => (
                <Skeleton key={i} className="aspect-square h-auto w-full" />
              ))}
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" aria-label="Media library">
                {pending.map((u) => (
                  <li key={u.id} className="relative aspect-square overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
                    <img src={u.preview} alt="" className="size-full object-cover opacity-50" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-medium text-[var(--admin-text)]">
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                      {u.status === 'queued' ? 'Queued' : 'Uploading'}
                    </div>
                  </li>
                ))}
                {shown.map((img) => {
                  const added = existingSet.has(img.url);
                  const order = picked.indexOf(img.url);
                  const isSel = order >= 0;
                  return (
                    <li key={img.key}>
                      <button
                        type="button"
                        onClick={() => toggle(img.url)}
                        disabled={added}
                        aria-pressed={isSel}
                        aria-label={`${img.name}${added ? ' (already added)' : ''}`}
                        title={img.name}
                        className={cn(
                          'group relative block aspect-square w-full overflow-hidden rounded-[var(--admin-radius)] border bg-[var(--admin-surface-subtle)] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]',
                          isSel
                            ? 'border-[var(--admin-primary)] ring-2 ring-[var(--admin-primary)]'
                            : 'border-[var(--admin-border)] hover:border-[var(--admin-border-strong)]',
                          added && 'cursor-not-allowed',
                        )}
                      >
                        <img src={img.url} alt="" loading="lazy" decoding="async" className={cn('size-full object-cover', added && 'opacity-40')} />
                        {isSel && <span className="absolute inset-0 bg-[var(--admin-primary)]/10" aria-hidden />}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                            isSel
                              ? 'border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-text-on-primary)]'
                              : 'border-[var(--admin-border-strong)] bg-[var(--admin-surface)]/90 opacity-0 group-hover:opacity-100',
                          )}
                        >
                          {isSel ? (multiple ? order + 1 : <Check className="size-3.5" />) : null}
                        </span>
                        {added && (
                          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-text-muted)]">
                            Added
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {filtered.length === 0 && pending.length === 0 && !cursor && (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-[var(--admin-neutral-soft)] text-[var(--admin-text-muted)]">
                    <ImageIcon className="size-5" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-[var(--admin-text)]">{q ? 'No images match' : 'No images in this folder'}</p>
                  <p className="text-sm text-[var(--admin-text-muted)]">Drop files here or use Upload.</p>
                </div>
              )}
              <div ref={sentinelRef} className="h-px" aria-hidden />
              {(loadingMore || (cursor && visible >= filtered.length)) && (
                <div className="flex justify-center py-4">
                  <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => folder !== null && void loadPage(folder, cursor)}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
          {dragOver && (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-[var(--admin-radius)] border-2 border-dashed border-[var(--admin-primary)] text-sm font-medium text-[var(--admin-primary)]">
              Drop images to upload
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3">
          <span className="text-sm text-[var(--admin-text-muted)] tabular-nums">
            {picked.length ? `${picked.length} selected` : multiple ? 'Select one or more images' : 'Select an image'}
          </span>
          {picked.length > 0 && (
            <Button variant="plain" size="sm" icon={<X aria-hidden />} onClick={() => setPicked([])}>
              Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={inFlight}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirm} disabled={!picked.length || inFlight}>
              {picked.length > 1 ? `Add ${picked.length} images` : 'Add image'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
