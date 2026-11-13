import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import { Archive, ChevronRight, Copy, Download, File as FileIcon, FileText, Film, Folder, Image as ImageIcon, Music, RefreshCw, Trash2, Upload } from 'lucide-react';
import {
  Banner,
  BulkActionBar,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  FilterBar,
  FilterChip,
  FilterSelect,
  Input,
  Page,
  Pagination,
  Skeleton,
  Tabs,
  paginate,
  toActionError,
  useButtonFeedback,
  useRowSelection,
  type BannerTone,
} from '../ui';
import { listR2Images, deleteR2Image, uploadImageToR2, uploadRawToR2, type R2Image } from '../../lib/images/upload';
import { confirmImageDelete } from '../../lib/images/guard';
import { fetchUsageBatch, usageSummary, type AssetUsage } from '../../lib/images/usage';
import { collectAllR2Images, reprocessAll, type ReprocessProgress } from '../../lib/images/reprocess';
import { formatFileSize } from '../components/shared/ImagePicker';

/* Upload and reprocess progress widths are data-driven. */
/* eslint-disable shadcn/no-inline-styles */

const PAGE_SIZE = 48;
const UPLOAD_CONCURRENCY = 3;
const ROOT = 'asset_images/';

type CategoryId = 'all' | 'products' | 'brands';
const CATEGORY_TABS: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'products', label: 'Product images' },
  { id: 'brands', label: 'Brand logos' },
];
const CATEGORY_PREFIX: Record<CategoryId, string> = {
  all: '',
  products: 'product_images/',
  brands: 'brand_logos/',
};
// Folders owned by the category tabs. Hidden from the root folder list.
const RESERVED_ROOT_FOLDERS = new Set(['product_images', 'brand_logos']);

type TypeFilter = 'all' | 'image' | 'video' | 'document' | 'other';
const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents' },
  { value: 'other', label: 'Other files' },
];

interface LibraryFolder {
  name: string;
  path: string;
}

interface UploadItem {
  id: string;
  name: string;
  state: 'queued' | 'uploading' | 'done' | 'failed';
  error?: string;
}

interface Notice {
  tone: BannerTone;
  text: string;
}

interface DeletePlan {
  deletable: R2Image[];
  blocked: R2Image[];
  /** Cleanup across all folders has no selection context. */
  scope: 'selected' | 'all';
}

function categoryOf(folder: string): CategoryId {
  if (folder.startsWith('product_images/')) return 'products';
  if (folder.startsWith('brand_logos/')) return 'brands';
  return 'all';
}

function matchesType(contentType: string, filter: TypeFilter) {
  switch (filter) {
    case 'image':
      return contentType.startsWith('image/');
    case 'video':
      return contentType.startsWith('video/');
    case 'document':
      return contentType.includes('pdf') || contentType.includes('document');
    case 'other':
      return !contentType.startsWith('image/') && !contentType.startsWith('video/') && !contentType.includes('document');
    default:
      return true;
  }
}

function iconFor(contentType: string) {
  if (contentType.startsWith('image/')) return ImageIcon;
  if (contentType.startsWith('video/')) return Film;
  if (contentType.startsWith('audio/')) return Music;
  if (contentType.includes('pdf') || contentType.includes('document')) return FileText;
  if (contentType.includes('zip') || contentType.includes('rar')) return Archive;
  return FileIcon;
}

export function AssetManager() {
  const convex = useConvex();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [currentFolder, setCurrentFolder] = useState('');
  const [assets, setAssets] = useState<R2Image[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<Map<string, AssetUsage>>(new Map());
  const [usageLoading, setUsageLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);
  const [dragOver, setDragOver] = useState(false);

  const sel = useRowSelection();
  const { setSelected } = sel;

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(false);

  const [preview, setPreview] = useState<R2Image | null>(null);
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number } | null>(null);
  const copyUrl = useButtonFeedback();
  const copyBulk = useButtonFeedback();

  const [planning, setPlanning] = useState(false);
  const [deletePlan, setDeletePlan] = useState<DeletePlan | null>(null);
  const [cleanPlanning, setCleanPlanning] = useState(false);
  const [reprocessPlan, setReprocessPlan] = useState<{ all: R2Image[]; todo: number; skipped: number } | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<ReprocessProgress | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const images: R2Image[] = [];
      const folderNames = new Set<string>();
      let cursor: string | undefined;
      do {
        const pageResult = await listR2Images(`${ROOT}${currentFolder}`, cursor);
        images.push(...pageResult.images);
        pageResult.folders.forEach((f) => folderNames.add(f.name));
        cursor = pageResult.cursor;
      } while (cursor);
      setAssets(images);
      setFolders([...folderNames].map((name) => ({ name, path: `${currentFolder}${name}/` })));
      setSelected((prev) => new Set([...prev].filter((id) => images.some((i) => i.id === id))));
      // One batch usage round trip for the visible folder. Unknown usage blocks deletes.
      setUsageLoading(true);
      try {
        setUsage(await fetchUsageBatch(convex, images.map((i) => ({ key: i.path, url: i.url }))));
      } finally {
        setUsageLoading(false);
      }
    } catch (err) {
      console.error('Error loading assets:', err);
      setNotice({ tone: 'critical', text: 'Could not load the library. Refresh to try again.' });
    } finally {
      setLoading(false);
    }
  }, [currentFolder, convex, setSelected]);

  useEffect(() => {
    void load();
  }, [load]);

  // A new folder, search or type filter starts again on page 1 with nothing selected.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [currentFolder, query, typeFilter, setSelected]);

  const visibleFolders = currentFolder === '' ? folders.filter((f) => !RESERVED_ROOT_FOLDERS.has(f.name)) : folders;
  const segments = currentFolder.split('/').filter(Boolean);
  const category = categoryOf(currentFolder);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => (!q || a.name.toLowerCase().includes(q)) && matchesType(a.contentType || '', typeFilter));
  }, [assets, query, typeFilter]);

  const { pageItems, pageCount } = paginate(filtered, page, PAGE_SIZE);
  const selectedAssets = assets.filter((a) => sel.isSelected(a.id));

  const setItem = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return;
    const folder = currentFolder.replace(/\/$/, '') || undefined;
    const items: UploadItem[] = files.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, state: 'queued' }));
    setUploads(items);
    setUploading(true);
    setNotice(null);
    let next = 0;
    let failed = 0;
    const worker = async () => {
      while (next < files.length) {
        const idx = next++;
        const file = files[idx];
        const id = items[idx].id;
        setItem(id, { state: 'uploading' });
        try {
          if (file.type.startsWith('image/')) {
            await uploadImageToR2(file, { folder, slug: file.name, keepOriginalResolution: keepOriginal });
          } else {
            await uploadRawToR2(file, { folder });
          }
          setItem(id, { state: 'done' });
        } catch (err) {
          failed += 1;
          setItem(id, { state: 'failed', error: err instanceof Error ? err.message : 'Upload failed' });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));
    setUploading(false);
    await load();
    setNotice(
      failed > 0
        ? { tone: 'warning', text: `${files.length - failed} of ${files.length} uploaded. ${failed} failed; see the list below.` }
        : { tone: 'success', text: `Uploaded ${files.length} file${files.length === 1 ? '' : 's'}.` },
    );
  };

  const openPreview = (asset: R2Image) => {
    setPreviewDims(null);
    setPreview(asset);
  };

  // Bulk delete: fail-closed usage check, then a confirmation that names what is skipped.
  const planBulkDelete = async () => {
    if (selectedAssets.length === 0) return;
    setPlanning(true);
    try {
      const fresh = await fetchUsageBatch(convex, selectedAssets.map((a) => ({ key: a.path, url: a.url })));
      setUsage((prev) => new Map([...prev, ...fresh]));
      const unknown = selectedAssets.filter((a) => {
        const total = fresh.get(a.path)?.total;
        return total === undefined || total < 0;
      });
      if (unknown.length > 0) {
        setNotice({ tone: 'critical', text: `Usage could not be checked for ${unknown.length} asset(s). Delete blocked; try again.` });
        return;
      }
      const deletable = selectedAssets.filter((a) => fresh.get(a.path)?.total === 0);
      const blocked = selectedAssets.filter((a) => fresh.get(a.path)?.total !== 0);
      if (deletable.length === 0) {
        setNotice({ tone: 'warning', text: 'All selected assets are still in use, so nothing was deleted.' });
        return;
      }
      setDeletePlan({ deletable, blocked, scope: 'selected' });
    } finally {
      setPlanning(false);
    }
  };

  const runDelete = async (items: R2Image[]) => {
    let failed = 0;
    for (const a of items) {
      try {
        await deleteR2Image(a.path);
      } catch {
        failed += 1;
      }
    }
    sel.clear();
    await load();
    return { removed: items.length - failed, failed };
  };

  const confirmBulkDelete = async () => {
    if (!deletePlan) return;
    const { removed, failed } = await runDelete(deletePlan.deletable);
    setDeletePlan(null);
    if (failed > 0) setNotice({ tone: 'warning', text: `Deleted ${removed} of ${deletePlan.deletable.length}. ${failed} failed.` });
    else
      setNotice({
        tone: 'success',
        text: `Deleted ${removed} asset${removed === 1 ? '' : 's'}${deletePlan.blocked.length ? `, skipped ${deletePlan.blocked.length} in use` : ''}.`,
      });
  };

  const planCleanUnused = async () => {
    setCleanPlanning(true);
    try {
      const all = await collectAllR2Images();
      if (all.length === 0) {
        setNotice({ tone: 'info', text: 'The library is empty.' });
        return;
      }
      const fresh = await fetchUsageBatch(convex, all.map((a) => ({ key: a.path, url: a.url })));
      const unknown = all.filter((a) => {
        const total = fresh.get(a.path)?.total;
        return total === undefined || total < 0;
      });
      if (unknown.length > 0) {
        setNotice({ tone: 'critical', text: `Usage could not be verified for ${unknown.length} asset(s). Cleanup stopped.` });
        return;
      }
      const unused = all.filter((a) => fresh.get(a.path)?.total === 0);
      if (unused.length === 0) {
        setNotice({ tone: 'success', text: 'No unused assets across all folders.' });
        return;
      }
      setDeletePlan({ deletable: unused, blocked: [], scope: 'all' });
    } catch (err) {
      setNotice({ tone: 'critical', text: err instanceof Error ? err.message : 'Could not check the library.' });
    } finally {
      setCleanPlanning(false);
    }
  };

  const confirmCleanUnused = async () => {
    if (!deletePlan) return;
    const { removed, failed } = await runDelete(deletePlan.deletable);
    setDeletePlan(null);
    setNotice(
      failed > 0
        ? { tone: 'warning', text: `Deleted ${removed} of ${deletePlan.deletable.length} unused asset(s). The rest were blocked or failed.` }
        : { tone: 'success', text: `Deleted ${removed} unused asset${removed === 1 ? '' : 's'} across all folders.` },
    );
  };

  const planReprocess = async () => {
    setCleanPlanning(true);
    try {
      const all = await collectAllR2Images();
      const todo = all.filter((a) => !a.metadata?.pipelineSource).length;
      if (all.length === 0) {
        setNotice({ tone: 'info', text: 'No images to reprocess.' });
        return;
      }
      setReprocessPlan({ all, todo, skipped: all.length - todo });
    } catch (err) {
      setNotice({ tone: 'critical', text: err instanceof Error ? err.message : 'Could not list the library.' });
    } finally {
      setCleanPlanning(false);
    }
  };

  const confirmReprocess = async () => {
    if (!reprocessPlan) return;
    const { all } = reprocessPlan;
    setReprocessing(true);
    setReprocessProgress({ done: 0, total: 0, current: 'Checking usage…' });
    try {
      const usageAll = await fetchUsageBatch(convex, all.map((a) => ({ key: a.path, url: a.url })));
      setUsage((prev) => new Map([...prev, ...usageAll]));
      const results = await reprocessAll(convex, all, usageAll, setReprocessProgress);
      const ok = results.filter((r) => r.status === 'repointed').length;
      const fail = results.filter((r) => r.status === 'failed').length;
      setReprocessPlan(null);
      setNotice(
        fail > 0
          ? { tone: 'warning', text: `Reprocessed ${ok} image(s); ${fail} failed. Originals were kept for the failed ones.` }
          : { tone: 'success', text: `Reprocessed ${ok} image${ok === 1 ? '' : 's'} to WebP and repointed references.` },
      );
      await load();
    } catch (err) {
      setNotice({ tone: 'critical', text: err instanceof Error ? err.message : 'Reprocess failed.' });
    } finally {
      setReprocessing(false);
      setReprocessProgress(null);
    }
  };

  const copyUrls = (urls: string[]) =>
    copyBulk.run(async () => {
      if (urls.length === 0) throw toActionError(new Error('Nothing to copy'), 'Select assets with a public URL first.');
      await navigator.clipboard.writeText(urls.join('\n'));
    });

  const deletePreviewed = async () => {
    if (!preview) return;
    const ok = await confirmImageDelete(convex, { key: preview.path, url: preview.url, name: preview.name });
    if (!ok) return;
    try {
      await deleteR2Image(preview.path);
      setPreview(null);
      setNotice({ tone: 'success', text: `Deleted ${preview.name}.` });
      await load();
    } catch (err) {
      setNotice({ tone: 'critical', text: toActionError(err, 'Could not delete the asset.').message });
    }
  };

  const usageText = (asset: R2Image) => {
    const u = usage.get(asset.path);
    if (!u || u.total < 0) return usageLoading ? 'Checking…' : '';
    return u.total === 0 ? 'Unused' : 'In use';
  };

  const usageCount = (asset: R2Image) => usage.get(asset.path)?.total ?? -1;
  const unusedVisible = filtered.filter((a) => usageCount(a) === 0);

  const uploadDone = uploads.filter((u) => u.state === 'done' || u.state === 'failed').length;

  return (
    <Page
      title="Assets"
      primaryAction={{ label: 'Upload', icon: <Upload />, onClick: () => inputRef.current?.click(), loading: uploading }}
      secondaryActions={[
        { label: 'Refresh', icon: <RefreshCw />, onClick: () => void load(), disabled: loading },
        { label: 'Select unused', onClick: () => setSelected(new Set(unusedVisible.map((a) => a.id))), disabled: unusedVisible.length === 0 },
        { label: 'Clean unused (all folders)', onClick: () => void planCleanUnused(), loading: cleanPlanning, disabled: reprocessing },
        { label: 'Reprocess to WebP', onClick: () => void planReprocess(), disabled: reprocessing },
      ]}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,.pdf,.doc,.docx,.zip,.rar"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void uploadFiles(files);
        }}
      />

      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      {uploads.length > 0 && (
        <Card
          title={uploading ? `Uploading ${uploadDone} of ${uploads.length}` : `Uploads finished (${uploads.length})`}
          actions={!uploading ? <Button variant="plain" size="sm" onClick={() => setUploads([])}>Clear</Button> : undefined}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${(uploadDone / uploads.length) * 100}%` }} />
          </div>
          <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-sm">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-foreground">{u.name}</span>
                <span
                  className={
                    u.state === 'failed'
                      ? 'shrink-0 text-destructive'
                      : u.state === 'done'
                        ? 'shrink-0 text-muted-foreground'
                        : 'shrink-0 text-muted-foreground'
                  }
                  title={u.error}
                >
                  {u.state === 'queued' && 'Queued'}
                  {u.state === 'uploading' && 'Uploading…'}
                  {u.state === 'done' && 'Done'}
                  {u.state === 'failed' && (u.error || 'Failed')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reprocessing && reprocessProgress && (
        <Card title="Reprocessing to WebP">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${reprocessProgress.total ? (reprocessProgress.done / reprocessProgress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 truncate text-sm text-muted-foreground">
            {reprocessProgress.done} of {reprocessProgress.total} · {reprocessProgress.current}
          </p>
        </Card>
      )}

      <Card padding="none">
        <nav aria-label="Library location" className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2.5 text-sm">
          <button type="button" onClick={() => setCurrentFolder('')} className="font-medium text-foreground hover:underline">
            Library
          </button>
          {segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
              <button
                type="button"
                onClick={() => setCurrentFolder(`${segments.slice(0, i + 1).join('/')}/`)}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                {seg}
              </button>
            </span>
          ))}
        </nav>
        <Tabs
          value={category}
          onChange={(id) => setCurrentFolder(CATEGORY_PREFIX[id])}
          tabs={CATEGORY_TABS.map((t) => ({ id: t.id, label: t.label }))}
        />
        <FilterBar
          search={{ value: query, onChange: setQuery, placeholder: 'Search by file name' }}
          end={
            <FilterSelect label="Type" value={typeFilter} options={TYPE_OPTIONS} onChange={(v) => setTypeFilter(v as TypeFilter)} />
          }
        />
        {visibleFolders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            {visibleFolders.map((f) => (
              <FilterChip key={f.path} label={<span className="inline-flex items-center gap-1.5"><Folder className="size-3.5" aria-hidden />{f.name}</span>} active={false} onClick={() => setCurrentFolder(f.path)} />
            ))}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(Array.from(e.dataTransfer.files));
          }}
          className={`border-t border-border p-4 transition-colors ${dragOver ? 'bg-muted outline-2 outline-dashed outline-primary -outline-offset-8' : ''}`}
        >
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Upload />}
              title={assets.length === 0 && !query && typeFilter === 'all' ? 'This folder is empty' : 'No files match these filters'}
              description={
                assets.length === 0 && !query && typeFilter === 'all'
                  ? 'Drop files here or use Upload. Images are converted to WebP on the way in.'
                  : 'Clear the search or type filter to see everything in this folder.'
              }
              action={
                assets.length === 0 && !query && typeFilter === 'all' ? (
                  <Button variant="primary" onClick={() => inputRef.current?.click()}>
                    Upload files
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {pageItems.map((asset) => {
                const checked = sel.isSelected(asset.id);
                const isImage = (asset.contentType || '').startsWith('image/');
                const Icon = iconFor(asset.contentType || '');
                const status = usageText(asset);
                return (
                  <li
                    key={asset.id}
                    className={`group relative overflow-hidden rounded-xl border bg-card transition-colors ${
                      checked ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-input'
                    }`}
                  >
                    <button type="button" onClick={() => openPreview(asset)} className="block w-full text-left" aria-label={`Preview ${asset.name}`}>
                      <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                        {isImage && asset.url ? (
                          <img src={asset.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <Icon className="size-8 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="truncate text-sm font-medium text-foreground" title={asset.name}>
                          {asset.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatFileSize(asset.size || 0)}
                          {status ? ` · ${status}` : ''}
                        </p>
                      </div>
                    </button>
                    <div className="absolute left-2 top-2 rounded-md bg-card/90 p-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox label={`Select ${asset.name}`} checked={checked} onCheckedChange={() => sel.toggle(asset.id)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          />
        )}
      </Card>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        actions={
          <>
            <Button size="sm" variant="secondary" state={copyBulk.state} onClick={() => copyUrls(selectedAssets.map((a) => a.url).filter(Boolean))}>
              <Copy aria-hidden /> Copy URLs
            </Button>
            <Button size="sm" variant="critical" loading={planning} onClick={() => void planBulkDelete()}>
              <Trash2 aria-hidden /> Delete
            </Button>
          </>
        }
      />

      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.name ?? 'Asset'}
        size="lg"
        footer={
          <>
            <Button variant="critical" onClick={() => void deletePreviewed()}>
              <Trash2 aria-hidden /> Delete
            </Button>
            <Button variant="secondary" onClick={() => preview && void downloadAsset(preview)}>
              <Download aria-hidden /> Download
            </Button>
          </>
        }
      >
        {preview && (
          <div className="space-y-4">
            <div className="flex max-h-96 min-h-40 items-center justify-center overflow-hidden rounded-xl bg-muted">
              {(preview.contentType || '').startsWith('image/') ? (
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-h-96 w-auto object-contain"
                  onLoad={(e) => setPreviewDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                />
              ) : (
                <FileIcon className="size-12 text-muted-foreground" aria-hidden />
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="tabular-nums text-foreground">{formatFileSize(preview.size || 0)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd className="tabular-nums text-foreground">
                  {previewDims ? `${previewDims.w} × ${previewDims.h}` : (preview.contentType || '').startsWith('image/') ? 'Loading…' : 'Not an image'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-foreground">{preview.contentType || 'unknown'}</dd>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-muted-foreground">Usage</dt>
                <dd className="text-foreground">{usageSummary(usage.get(preview.path))}</dd>
              </div>
            </dl>
            <div className="space-y-1.5">
              <label htmlFor="asset-url" className="text-sm font-medium text-foreground">
                Public URL
              </label>
              <div className="flex gap-2">
                <Input id="asset-url" readOnly value={preview.url} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="secondary" state={copyUrl.state} onClick={() => copyUrl.run(() => navigator.clipboard.writeText(preview.url))}>
                  <Copy aria-hidden /> Copy
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deletePlan}
        onOpenChange={(open) => !open && setDeletePlan(null)}
        title={deletePlan?.scope === 'all' ? `Delete ${deletePlan.deletable.length} unused asset(s)?` : `Delete ${deletePlan?.deletable.length ?? 0} asset(s)?`}
        description={
          deletePlan?.scope === 'all'
            ? 'Only assets with zero references are deleted. In-use assets are kept. This cannot be undone.'
            : deletePlan && deletePlan.blocked.length > 0
              ? `${deletePlan.blocked.length} selected asset(s) are still in use and will be skipped. This cannot be undone.`
              : 'This cannot be undone.'
        }
        confirmLabel="Delete"
        critical
        onConfirm={deletePlan?.scope === 'all' ? confirmCleanUnused : confirmBulkDelete}
      />

      <ConfirmDialog
        open={!!reprocessPlan}
        onOpenChange={(open) => !open && !reprocessing && setReprocessPlan(null)}
        title="Reprocess the library to WebP?"
        description={
          reprocessPlan
            ? `${reprocessPlan.todo} image(s) go through the WebP pipeline and every reference is repointed. Originals are deleted only after a successful repoint.${reprocessPlan.skipped ? ` ${reprocessPlan.skipped} earlier output(s) are skipped.` : ''}`
            : ''
        }
        confirmLabel="Reprocess"
        onConfirm={confirmReprocess}
      />
    </Page>
  );
}

async function downloadAsset(asset: R2Image) {
  try {
    const res = await fetch(asset.url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = asset.name;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(href);
    a.remove();
  } catch {
    window.open(asset.url, '_blank', 'noopener');
  }
}
