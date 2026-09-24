import { useState, useEffect } from 'react';
import { 
  Upload, 
  Image, 
  File, 
  Download, 
  Trash2, 
  Search, 
  Grid3X3, 
  List, 
  Eye, 
  Copy, 
  MoreHorizontal, 
  FolderOpen, 
  FileText, 
  Film, 
  Music, 
  Archive 
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { listR2Images, deleteR2Image, uploadImageToR2, uploadRawToR2 } from '../../lib/images/upload';
import { confirmImageDelete } from '../../lib/images/guard';
import { fetchUsageBatch, usageSummary, type AssetUsage } from '../../lib/images/usage';
import { collectAllR2Images, reprocessAll, type ReprocessProgress, type ReprocessResult } from '../../lib/images/reprocess';
import { isPipelineOutput } from '../../../convex/lib/imageRefs';
import { useConvex } from 'convex/react';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { formatFileSize } from '../components/shared/ImagePicker';
import { PageHeader } from '../components/shared/PageHeader';

interface Asset {
  id: string;
  name: string;
  path: string;
  size: number;
  content_type: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any> | null;
  public_url?: string;
}

interface AssetFolder {
  name: string;
  path: string;
}

type CategoryId = 'products' | 'brands' | 'assets';

// Fixed top-level categories (R2 prefixes under asset_images/). Uploads reuse
// the same folder semantics as before — this only constrains the browsing
// entry points instead of exposing arbitrary root folders.
const CATEGORIES: { id: CategoryId; label: string; prefix: string }[] = [
  { id: 'products', label: 'Product images', prefix: 'product_images/' },
  { id: 'brands', label: 'Brand logos', prefix: 'brand_logos/' },
  { id: 'assets', label: 'Assets', prefix: '' },
];

// Subfolders owned by the category tabs — hidden from the generic Assets
// folder grid so the top level stays exactly the three categories.
const RESERVED_ROOT_FOLDERS = new Set(['product_images', 'brand_logos']);

function categoryForPrefix(prefix: string): CategoryId {
  if (prefix.startsWith('product_images/')) return 'products';
  if (prefix.startsWith('brand_logos/')) return 'brands';
  return 'assets';
}

export function AssetManager() {
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [keepOriginalResolution, setKeepOriginalResolution] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isCleaningUnused, setIsCleaningUnused] = useState(false);
  // Batch usage inventory (one query per ~100 assets, never N+1).
  const [usageByKey, setUsageByKey] = useState<Map<string, AssetUsage>>(new Map());
  const [usageLoading, setUsageLoading] = useState(false);
  // Bulk WebP reprocess state.
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<ReprocessProgress | null>(null);
  const [reprocessResults, setReprocessResults] = useState<ReprocessResult[] | null>(null);
  const [showReprocessReport, setShowReprocessReport] = useState(false);

  useEffect(() => {
    loadAssets();
    loadFolders();
  }, [currentFolder]);

  const loadAssets = async () => {
    setIsLoading(true);
    setUsageByKey(new Map());
    try {
      // R2 library under asset_images/ (admin-gated edge endpoint).
      const images = [];
      let cursor: string | undefined;
      do {
        const page = await listR2Images(`asset_images/${currentFolder || ''}`, cursor);
        images.push(...page.images);
        cursor = page.cursor;
      } while (cursor);
      setAssets(
        images.map((item) => ({
          id: item.id,
          name: item.name,
          path: item.path,
          size: item.size || 0,
          content_type: item.contentType || 'unknown',
          created_at: item.createdAt,
          updated_at: item.createdAt,
          metadata: item.metadata ?? null,
          public_url: item.url
        }) as Asset)
      );
      // Prune selections that no longer exist (folder change / delete).
      const live = new Set(images.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => live.has(id)));
      // Batch usage inventory for the visible folder (single round trip).
      setUsageLoading(true);
      try {
        const usage = await fetchUsageBatch(
          convex,
          images.map((item) => ({ key: item.path, url: item.url })),
        );
        setUsageByKey(usage);
      } finally {
        setUsageLoading(false);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
      setOpError('Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const names = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await listR2Images(`asset_images/${currentFolder || ''}`, cursor);
        page.folders.forEach((f) => names.add(f.name));
        cursor = page.cursor;
      } while (cursor);
      setFolders([...names].map((name) => ({ name, path: `${currentFolder || ''}${name}/` })));
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const folder = (currentFolder || '').replace(/\/$/, '');
      const uploadPromises = Array.from(files).map(async (file, index) => {
        // Images: WebP + metadata stripped + compressed. Other assets raw.
        if (file.type.startsWith('image/')) {
          await uploadImageToR2(file, { folder: folder || undefined, slug: file.name, keepOriginalResolution });
        } else {
          await uploadRawToR2(file, { folder: folder || undefined });
        }

        // Update progress
        setUploadProgress(((index + 1) / files.length) * 100);
      });

      await Promise.all(uploadPromises);
      
      setOpOk(`Successfully uploaded ${files.length} file(s)`);
      await loadAssets();
      await loadFolders();
    } catch (error) {
      console.error('Error uploading files:', error);
      setOpError('Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      event.target.value = '';
    }
  };

  const convex = useConvex();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    const targets = assets.filter((a) => selectedIds.includes(a.id));
    if (targets.length === 0 || isBulkDeleting) return;
    // Fail-closed: refresh the batch inventory first; unknown usage blocks,
    // referenced assets are skipped, never force-deleted in bulk.
    setIsBulkDeleting(true);
    try {
      const fresh = await fetchUsageBatch(
        convex,
        targets.map((a) => ({ key: a.path, url: a.public_url })),
      );
      setUsageByKey((prev) => new Map([...prev, ...fresh]));
      const rows = targets.map((a) => ({ asset: a, usage: fresh.get(a.path) }));
      const unknown = rows.filter((r) => !r.usage || r.usage.total === -1);
      if (unknown.length > 0) {
        setOpError(
          `Usage check failed for ${unknown.length} asset(s) — delete blocked. Try again.`,
        );
        return;
      }
      const blocked = rows.filter((r) => (r.usage?.total ?? -1) !== 0);
      const deletable = rows.filter((r) => r.usage?.total === 0).map((r) => r.asset);
      if (deletable.length === 0) {
        setOpError('All selected assets are still in use — nothing to delete');
        return;
      }
      if (blocked.length > 0) {
        const names = blocked
          .slice(0, 5)
          .map((r) => `• ${r.asset.name}`)
          .join('\n');
        const more = blocked.length > 5 ? `\n…+${blocked.length - 5} more` : '';
        const proceed = window.confirm(
          `${blocked.length} of ${targets.length} asset(s) are still in use and will be skipped:\n${names}${more}\n\nDelete the other ${deletable.length}?`
        );
        if (!proceed) return;
      } else if (
        !window.confirm(
          `Delete ${deletable.length} asset(s)? This cannot be undone.`
        )
      ) {
        return;
      }
      let failed = 0;
      for (const a of deletable) {
        try {
          await deleteR2Image(a.path);
        } catch {
          failed += 1;
        }
      }
      setSelectedIds([]);
      await loadAssets();
      if (failed > 0) setOpError(`Deleted ${deletable.length - failed} of ${deletable.length} assets`);
      else if (blocked.length > 0)
        setOpOk(`Deleted ${deletable.length} assets, skipped ${blocked.length} in use`);
      else setOpOk(`Deleted ${deletable.length} assets`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleCleanAllUnused = async () => {
    if (isCleaningUnused || isBulkDeleting) return;
    setIsCleaningUnused(true);
    try {
      const all = await collectAllR2Images();
      if (all.length === 0) {
        setOpOk('No assets found');
        return;
      }
      const usage = await fetchUsageBatch(
        convex,
        all.map((asset) => ({ key: asset.path, url: asset.url })),
      );
      const unknown = all.filter((asset) => {
        const total = usage.get(asset.path)?.total;
        return total === undefined || total < 0;
      });
      if (unknown.length > 0) {
        setOpError(`Usage could not be verified for ${unknown.length} asset(s); cleanup stopped`);
        return;
      }
      const unused = all.filter((asset) => usage.get(asset.path)?.total === 0);
      if (unused.length === 0) {
        setOpOk('No unused assets found');
        return;
      }
      if (!window.confirm(
        `Delete ${unused.length} confirmed-unused asset(s) across all folders? In-use assets will be kept. This cannot be undone.`,
      )) return;

      let deleted = 0;
      for (const asset of unused) {
        try {
          await deleteR2Image(asset.path);
          deleted += 1;
        } catch {
          // The edge endpoint repeats the usage check and blocks races.
        }
      }
      setSelectedIds([]);
      await loadAssets();
      if (deleted < unused.length)
        setOpError(`Deleted ${deleted} of ${unused.length}; the rest were blocked or failed`);
      else setOpOk(`Deleted ${deleted} unused asset(s) across all folders`);
    } catch (error) {
      setOpError(error instanceof Error ? error.message : 'Could not clean unused assets');
    } finally {
      setIsCleaningUnused(false);
    }
  };

  const handleReprocessAll = async () => {
    if (isReprocessing) return;
    // Walk the whole library first so the confirmation shows the real count.
    setIsReprocessing(true);
    setReprocessResults(null);
    try {
      setReprocessProgress({ done: 0, total: 0, current: 'Listing all R2 images…' });
      const all = await collectAllR2Images();
      const todo = all.filter((a) => !isPipelineOutput(a.path));
      const skipped = all.length - todo.length;
      if (all.length === 0) {
        setOpError('No R2 images found to reprocess');
        return;
      }
      const proceed = window.confirm(
        `Reprocess ${todo.length} image(s) through the WebP pipeline and repoint every reference? Originals are deleted after successful repointing.` +
          (skipped > 0 ? `\n${skipped} prior bulk output(s) will be skipped.` : '') +
          `\nUnused originals are left for the all-folders cleanup action.`,
      );
      if (!proceed) return;
      const usage = await fetchUsageBatch(
        convex,
        all.map((a) => ({ key: a.path, url: a.url })),
      );
      setUsageByKey((prev) => new Map([...prev, ...usage]));
      const results = await reprocessAll(convex, all, usage, setReprocessProgress);
      setReprocessResults(results);
      setShowReprocessReport(true);
      const ok = results.filter((r) => r.status === 'repointed').length;
      const skip = results.filter((r) => r.status === 'skipped').length;
      const fail = results.filter((r) => r.status === 'failed').length;
      await loadAssets();
      if (fail > 0) setOpError(`Reprocessed ${ok} of ${todo.length} (${skip} skipped, ${fail} failed — see report)`);
      else setOpOk(`Reprocessed ${ok} image(s)${skip > 0 ? `, ${skip} prior outputs skipped` : ''}`);
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Reprocess failed');
    } finally {
      setIsReprocessing(false);
      setReprocessProgress(null);
    }
  };

  const handleBulkCopyUrls = async () => {
    const urls = assets
      .filter((a) => selectedIds.includes(a.id) && a.public_url)
      .map((a) => a.public_url as string);
    if (urls.length === 0) {
      setOpError('No URLs to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      setOpOk(`Copied ${urls.length} URL(s)`);
    } catch {
      setOpError('Failed to copy URLs');
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    // Block-or-warn when a variant still references this key (orphaned
    // cards render the "No Image" placeholder).
    if (!(await confirmImageDelete(convex, { key: asset.path, url: asset.public_url, name: asset.name }))) return;

    try {
      await deleteR2Image(asset.path);

      setOpOk('Asset deleted successfully');
      await loadAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      setOpError('Failed to delete asset');
    }
  };

  const handleCopyUrl = async (asset: Asset) => {
    if (!asset.public_url) return;

    try {
      await navigator.clipboard.writeText(asset.public_url);
      setOpOk('URL copied to clipboard');
    } catch (error) {
      console.error('Error copying URL:', error);
      setOpError('Failed to copy URL');
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (!asset.public_url) return;

    try {
      const response = await fetch(asset.public_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = asset.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading asset:', error);
      setOpError('Failed to download asset');
    }
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (contentType.startsWith('video/')) return <Film className="h-5 w-5" />;
    if (contentType.startsWith('audio/')) return <Music className="h-5 w-5" />;
    if (contentType.includes('pdf') || contentType.includes('document')) return <FileText className="h-5 w-5" />;
    if (contentType.includes('zip') || contentType.includes('rar')) return <Archive className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || 
      (filterType === 'image' && asset.content_type.startsWith('image/')) ||
      (filterType === 'video' && asset.content_type.startsWith('video/')) ||
      (filterType === 'document' && asset.content_type.includes('document')) ||
      (filterType === 'other' && !asset.content_type.startsWith('image/') && 
       !asset.content_type.startsWith('video/') && 
       !asset.content_type.includes('document'));
    
    return matchesSearch && matchesType;
  });

  const navigateToFolder = (folder: AssetFolder) => {
    setCurrentFolder(folder.path);
  };

  const navigateBack = () => {
    const parentPath = currentFolder.split('/').slice(0, -2).join('/') + '/';
    setCurrentFolder(parentPath === '/' ? '' : parentPath);
  };

  const navigateToSegment = (index: number) => {
    // index -1 → library root; otherwise the prefix through segments[index].
    if (index < 0) setCurrentFolder('');
    else setCurrentFolder(`${currentFolder.split('/').filter(Boolean).slice(0, index + 1).join('/')}/`);
  };

  const activeCategory = categoryForPrefix(currentFolder);
  const segments = currentFolder.split('/').filter(Boolean);
  const visibleFolders =
    currentFolder === ''
      ? folders.filter((f) => !RESERVED_ROOT_FOLDERS.has(f.name))
      : folders;

  // "Select unused" bulk cleanup: only keys with a confirmed zero usage
  // count. Unknown (not yet checked / check failed) and in-use assets are
  // never auto-selected.
  const unusedCount = filteredAssets.filter(
    (a) => usageByKey.get(a.path)?.total === 0,
  ).length;
  const handleSelectUnused = () => {
    const ids = filteredAssets
      .filter((a) => usageByKey.get(a.path)?.total === 0)
      .map((a) => a.id);
    if (ids.length === 0) {
      setOpError(
        usageLoading
          ? 'Usage check still running — try again in a moment'
          : 'No confirmed-unused assets in this view (unknown or in-use assets are never auto-selected)',
      );
      return;
    }
    setSelectedIds(ids);
    setOpOk(`Selected ${ids.length} unused asset(s) for review`);
  };

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      {/* Header */}
      <PageHeader
        title="Asset Manager"
        description="Manage your media files and assets"
      >
        <Button variant="outline" onClick={loadAssets}>
          Refresh
        </Button>
        <Button
          variant="outline"
          onClick={handleReprocessAll}
          disabled={isReprocessing}
          title="Reprocess all R2 images through the WebP pipeline and repoint every reference (old originals kept)"
        >
          {isReprocessing ? 'Reprocessing…' : 'Reprocess all to WebP'}
        </Button>
        <label className="cursor-pointer">
          <Button className="bg-canyon hover:bg-canyon/90 text-creme">
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.zip,.rar"
          />
        </label>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <InlineStatus status={opStatus} />
        {/* Reprocess progress */}
        {(isReprocessing || reprocessProgress || reprocessResults) && (
          <AdminCard>
            <AdminCardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-canyon h-2 rounded-full transition-all duration-300"
                      style={{
                        width: reprocessProgress && reprocessProgress.total > 0
                          ? `${(reprocessProgress.done / reprocessProgress.total) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-600">
                  {reprocessProgress && reprocessProgress.total > 0
                    ? `${reprocessProgress.done}/${reprocessProgress.total} — ${reprocessProgress.current}`
                    : reprocessProgress?.current || 'Working…'}
                </span>
                {reprocessResults && (
                  <Button variant="outline" size="sm" onClick={() => setShowReprocessReport(true)}>
                    View report
                  </Button>
                )}
              </div>
            </AdminCardContent>
          </AdminCard>
        )}
        <label className="flex items-center gap-2 text-sm text-[var(--color-dark)]">
          <input type="checkbox" checked={keepOriginalResolution} onChange={(e) => setKeepOriginalResolution(e.target.checked)} />
          Keep original image dimensions (skip square crop and resize)
        </label>
        {/* Upload Progress */}
        {isUploading && (
        <AdminCard>
          <AdminCardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-canyon h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-600">{Math.round(uploadProgress)}%</span>
            </div>
          </AdminCardContent>
        </AdminCard>
      )}

      {/* Toolbar */}
      <AdminCard>
        <AdminCardContent className="p-4 space-y-4">
          {/* Fixed top-level categories */}
          <div role="tablist" aria-label="Asset categories" className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button
                key={c.id}
                role="tab"
                aria-selected={activeCategory === c.id}
                variant={activeCategory === c.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentFolder(c.prefix)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          {/* Breadcrumb + Back */}
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={navigateBack}
              disabled={!currentFolder}
              aria-label={currentFolder ? `Back to ${segments.slice(0, -1).join('/') || 'category'}` : 'Back'}
            >
              <FolderOpen className="mr-1 h-4 w-4" />
              Back
            </Button>
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => navigateToSegment(-1)}
                  aria-current={currentFolder === '' ? 'page' : undefined}
                  className={`rounded px-1 underline-offset-2 hover:underline ${currentFolder === '' ? 'font-medium text-gray-900' : 'text-canyon'}`}
                >
                  Library
                </button>
              </li>
              {segments.map((seg, i) => {
                const isLast = i === segments.length - 1;
                return (
                  <li key={`${seg}-${i}`} className="flex items-center gap-1">
                    <span className="text-gray-400" aria-hidden="true">/</span>
                    {isLast ? (
                      <span aria-current="page" className="rounded px-1 font-medium text-gray-900">
                        {seg}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigateToSegment(i)}
                        className="rounded px-1 text-canyon underline-offset-2 hover:underline"
                      >
                        {seg}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter */}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Files</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode */}
              <div className="flex items-center gap-1 border rounded-md self-start" role="group" aria-label="View mode">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  aria-label="Grid view"
                  className="h-8 w-8 p-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
          </div>
        </AdminCardContent>
      </AdminCard>

      {/* Bulk selection bar — always visible so multiselect is discoverable */}
      <AdminCard>
        <AdminCardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium" role="status">
              {selectedIds.length} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelectedIds(filteredAssets.map((a) => a.id))
              }
              disabled={filteredAssets.length === 0}
            >
              Select all ({filteredAssets.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectUnused}
              disabled={usageLoading || filteredAssets.length === 0}
              title="Select only assets with a confirmed zero usage count — unknown or in-use assets are never auto-selected"
            >
              Select unused ({usageLoading ? '…' : unusedCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanAllUnused}
              disabled={isCleaningUnused || isBulkDeleting || usageLoading}
              title="Verify and delete unused assets across every folder"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isCleaningUnused ? 'Cleaning…' : 'Delete unused (all folders)'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
            >
              Clear
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkCopyUrls}
              disabled={selectedIds.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy URLs
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0 || isBulkDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isBulkDeleting ? 'Deleting...' : `Delete (${selectedIds.length})`}
            </Button>
          </div>
        </AdminCardContent>
      </AdminCard>

      {/* Subfolders within the active category */}
      {visibleFolders.length > 0 && (
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="text-lg">Folders</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {visibleFolders.map((folder) => (
                <button
                  key={folder.name}
                  type="button"
                  onClick={() => navigateToFolder(folder)}
                  aria-label={`Open folder ${folder.name}`}
                  className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-canyon transition-colors"
                >
                  <FolderOpen className="h-8 w-8 text-canyon mb-2" aria-hidden="true" />
                  <span className="text-sm text-gray-700 text-center">{folder.name}</span>
                </button>
              ))}
            </div>
          </AdminCardContent>
        </AdminCard>
      )}

      {/* Assets */}
      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle className="flex items-center justify-between">
            <span>Assets ({filteredAssets.length})</span>
            {isLoading && (
              <span role="status" className="text-sm text-gray-500">Loading…</span>
            )}
          </AdminCardTitle>
        </AdminCardHeader>
        <AdminCardContent>
          {isLoading ? (
            <div role="status" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4" aria-label="Loading assets">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredAssets.map((asset) => (
                <div key={asset.id} className="group relative focus-within:ring-2 focus-within:ring-canyon rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAsset(asset);
                      setShowPreview(true);
                    }}
                    aria-label={`Preview ${asset.name}`}
                    className={`block w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border focus-visible:outline-2 focus-visible:outline-canyon ${selectedIds.includes(asset.id) ? 'ring-2 ring-canyon' : ''}`}
                  >
                    {asset.content_type.startsWith('image/') ? (
                      <ImageWithFallback
                        src={asset.public_url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center">
                        {getFileIcon(asset.content_type)}
                      </span>
                    )}
                  </button>
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(asset.size)}</p>
                    {(() => {
                      const u = usageByKey.get(asset.path);
                      const inUse = u !== undefined && u.total !== 0;
                      return (
                        <p
                          className={`text-xs mt-0.5 truncate ${u === undefined || u.total === -1 ? 'text-gray-400' : inUse ? 'text-amber-700 font-medium' : 'text-green-700'}`}
                          title={u ? usageSummary(u) : undefined}
                        >
                          {usageLoading && u === undefined ? 'Checking usage…' : usageSummary(u)}
                        </p>
                      );
                    })()}
                  </div>

                  {/* Select — always visible, never hover-only */}
                  <div
                    className="absolute top-2 left-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.includes(asset.id)}
                      onCheckedChange={() => toggleSelect(asset.id)}
                      className="bg-white shadow"
                      aria-label={`Select ${asset.name}`}
                    />
                  </div>

                  {/* Actions — visible on hover or keyboard focus */}
                  <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-white/90">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedAsset(asset);
                          setShowPreview(true);
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyUrl(asset)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy URL
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(asset)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteAsset(asset)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map((asset) => (
                <div key={asset.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 border rounded-lg hover:bg-gray-50 ${selectedIds.includes(asset.id) ? 'border-canyon bg-canyon/5' : ''}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedIds.includes(asset.id)}
                      onCheckedChange={() => toggleSelect(asset.id)}
                      aria-label={`Select ${asset.name}`}
                    />
                    <button
                      onClick={() => {
                        setSelectedAsset(asset);
                        setShowPreview(true);
                      }}
                      className="shrink-0"
                      aria-label={`Preview ${asset.name}`}
                    >
                      {asset.content_type.startsWith('image/') && asset.public_url ? (
                        <ImageWithFallback
                          src={asset.public_url}
                          alt={asset.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded">
                          {getFileIcon(asset.content_type)}
                        </div>
                      )}
                    </button>
                    <div>
                      <p className="font-medium text-gray-900">{asset.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(asset.size)} • {asset.content_type}
                      </p>
                      {(() => {
                        const u = usageByKey.get(asset.path);
                        const inUse = u !== undefined && u.total !== 0;
                        return (
                          <p
                            className={`text-xs mt-0.5 ${u === undefined || u.total === -1 ? 'text-gray-400' : inUse ? 'text-amber-700 font-medium' : 'text-green-700'}`}
                            title={u ? usageSummary(u) : undefined}
                          >
                            {usageLoading && u === undefined ? 'Checking usage…' : usageSummary(u)}
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" aria-label={`Preview ${asset.name}`} onClick={() => {
                      setSelectedAsset(asset);
                      setShowPreview(true);
                    }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Copy URL for ${asset.name}`} onClick={() => handleCopyUrl(asset)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Download ${asset.name}`} onClick={() => handleDownload(asset)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      aria-label={`Delete ${asset.name}`}
                      onClick={() => handleDeleteAsset(asset)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredAssets.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500" role="status">
              <File className="mx-auto h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
              <p>
                {assets.length === 0
                  ? `No assets in ${CATEGORIES.find((c) => c.id === activeCategory)?.label} yet`
                  : 'No assets match your search or filter'}
              </p>
              <p className="text-sm">
                {assets.length === 0
                  ? 'Upload files above — they will be saved to this category'
                  : 'Try clearing the search or choosing a different type'}
              </p>
            </div>
          )}
        </AdminCardContent>
      </AdminCard>

      {/* Reprocess report */}
      <Dialog open={showReprocessReport} onOpenChange={setShowReprocessReport}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reprocess report</DialogTitle>
          </DialogHeader>
          {reprocessResults && (
            <div className="space-y-2 max-h-96 overflow-auto text-sm">
              <p className="text-gray-600">
                {reprocessResults.filter((r) => r.status === 'repointed').length} repointed •{' '}
                {reprocessResults.filter((r) => r.status === 'skipped').length} skipped •{' '}
                {reprocessResults.filter((r) => r.status === 'failed').length} failed
              </p>
              {reprocessResults
                .filter((r) => r.status !== 'repointed')
                .map((r) => (
                  <div key={r.asset.id} className="flex items-center justify-between gap-2 border rounded p-2">
                    <span className="truncate">{r.asset.name}</span>
                    <span className={r.status === 'failed' ? 'text-red-600' : 'text-gray-500'}>
                      {r.status === 'failed' ? `Failed: ${r.reason}` : `Skipped: ${r.reason}`}
                    </span>
                  </div>
                ))}
              {reprocessResults.filter((r) => r.status === 'repointed').length > 0 && (
                <details>
                  <summary className="cursor-pointer text-gray-600">
                    Show repointed ({reprocessResults.filter((r) => r.status === 'repointed').length})
                  </summary>
                  {reprocessResults
                    .filter((r) => r.status === 'repointed')
                    .map((r) => (
                      <div key={r.asset.id} className="flex items-center justify-between gap-2 border rounded p-2 mt-1">
                        <span className="truncate">{r.asset.name}</span>
                        <span className="text-green-700">→ {r.patchedRefs} ref(s)</span>
                      </div>
                    ))}
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedAsset?.name}</DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              {selectedAsset.content_type.startsWith('image/') ? (
                <div className="max-h-96 overflow-auto">
                  <ImageWithFallback
                    src={selectedAsset.public_url}
                    alt={selectedAsset.name}
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  {getFileIcon(selectedAsset.content_type)}
                  <p className="mt-2 text-gray-500">Preview not available for this file type</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Size:</span> {formatFileSize(selectedAsset.size)}
                </div>
                <div>
                  <span className="font-medium">Type:</span> {selectedAsset.content_type}
                </div>
                <div>
                  <span className="font-medium">Created:</span> {new Date(selectedAsset.created_at).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">URL:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyUrl(selectedAsset)}
                    className="ml-2"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Usage:</span>{' '}
                  {(() => {
                    const u = usageByKey.get(selectedAsset.path);
                    return (
                      <span title={u ? usageSummary(u) : undefined}>
                        {usageLoading && u === undefined ? 'Checking…' : usageSummary(u)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  </div>
  );
}
