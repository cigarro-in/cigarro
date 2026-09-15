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
import { api } from '../../../convex/_generated/api';
import { listR2Images, deleteR2Image, uploadImageToR2, uploadRawToR2 } from '../../lib/images/upload';
import { confirmImageDelete } from '../../lib/images/guard';
import { useConvex } from 'convex/react';
import { toast } from 'sonner';
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

export function AssetManager() {
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    loadAssets();
    loadFolders();
  }, [currentFolder]);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      // R2 library under asset_images/ (admin-gated edge endpoint).
      const { images } = await listR2Images(`asset_images/${currentFolder || ''}`);
      setAssets(
        images.map((item) => ({
          id: item.id,
          name: item.name,
          path: item.path,
          size: item.size || 0,
          content_type: item.contentType || 'unknown',
          created_at: item.createdAt,
          updated_at: item.createdAt,
          metadata: null,
          public_url: item.url
        }) as Asset)
      );
      // Prune selections that no longer exist (folder change / delete).
      const live = new Set(images.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => live.has(id)));
    } catch (error) {
      console.error('Error loading assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const { folders: r2folders } = await listR2Images(`asset_images/${currentFolder || ''}`);
      setFolders(r2folders.map((f) => ({ name: f.name, path: `${currentFolder || ''}${f.name}/` })));
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
          await uploadImageToR2(file, { folder: folder || undefined, slug: file.name });
        } else {
          await uploadRawToR2(file, { folder: folder || undefined });
        }

        // Update progress
        setUploadProgress(((index + 1) / files.length) * 100);
      });

      await Promise.all(uploadPromises);
      
      toast.success(`Successfully uploaded ${files.length} file(s)`);
      await loadAssets();
      await loadFolders();
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
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
    // One usage check per asset, then a single confirm. Assets still
    // referenced by variants are skipped, never force-deleted in bulk.
    setIsBulkDeleting(true);
    try {
      const usage = await Promise.all(
        targets.map(async (a) => {
          try {
            const u = await convex.query(api.adminCatalog.imageUsage, {
              key: a.path,
              url: a.public_url,
            });
            return { asset: a, total: u.total as number };
          } catch {
            return { asset: a, total: -1 };
          }
        })
      );
      const blocked = usage.filter((u) => u.total !== 0);
      const deletable = usage.filter((u) => u.total === 0).map((u) => u.asset);
      if (deletable.length === 0) {
        toast.error('All selected assets are still used by product variants — nothing to delete');
        return;
      }
      if (blocked.length > 0) {
        const names = blocked
          .slice(0, 5)
          .map((u) => `• ${u.asset.name}`)
          .join('\n');
        const more = blocked.length > 5 ? `\n…+${blocked.length - 5} more` : '';
        const proceed = window.confirm(
          `${blocked.length} of ${targets.length} asset(s) are still used by product variants and will be skipped:\n${names}${more}\n\nDelete the other ${deletable.length}?`
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
      if (failed > 0) toast.error(`Deleted ${deletable.length - failed} of ${deletable.length} assets`);
      else if (blocked.length > 0)
        toast.success(`Deleted ${deletable.length} assets, skipped ${blocked.length} in use`);
      else toast.success(`Deleted ${deletable.length} assets`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkCopyUrls = async () => {
    const urls = assets
      .filter((a) => selectedIds.includes(a.id) && a.public_url)
      .map((a) => a.public_url as string);
    if (urls.length === 0) {
      toast.error('No URLs to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      toast.success(`Copied ${urls.length} URL(s)`);
    } catch {
      toast.error('Failed to copy URLs');
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    // Block-or-warn when a variant still references this key (orphaned
    // cards render the "No Image" placeholder).
    if (!(await confirmImageDelete(convex, { key: asset.path, url: asset.public_url, name: asset.name }))) return;

    try {
      await deleteR2Image(asset.path);

      toast.success('Asset deleted successfully');
      await loadAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete asset');
    }
  };

  const handleCopyUrl = async (asset: Asset) => {
    if (!asset.public_url) return;

    try {
      await navigator.clipboard.writeText(asset.public_url);
      toast.success('URL copied to clipboard');
    } catch (error) {
      console.error('Error copying URL:', error);
      toast.error('Failed to copy URL');
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
      toast.error('Failed to download asset');
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
        <AdminCardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateBack}
                disabled={!currentFolder}
                className="h-6 w-6 p-0"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <span className="text-gray-500">/</span>
              <span className="text-gray-700">
                {currentFolder || 'Root'}
              </span>
            </div>

            <div className="flex-1 flex items-center space-x-4">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
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
              <div className="flex items-center space-x-1 border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 w-8 p-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </AdminCardContent>
      </AdminCard>

      {/* Bulk selection bar */}
      {selectedIds.length > 0 && (
        <AdminCard>
          <AdminCardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">
                {selectedIds.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedIds(filteredAssets.map((a) => a.id))
                }
              >
                Select all ({filteredAssets.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={handleBulkCopyUrls}>
                <Copy className="mr-2 h-4 w-4" />
                Copy URLs
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isBulkDeleting ? 'Deleting...' : `Delete (${selectedIds.length})`}
              </Button>
            </div>
          </AdminCardContent>
        </AdminCard>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="text-lg">Folders</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {folders.map((folder) => (
                <div
                  key={folder.name}
                  onClick={() => navigateToFolder(folder)}
                  className="flex flex-col items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <FolderOpen className="h-8 w-8 text-canyon mb-2" />
                  <span className="text-sm text-gray-700 text-center">{folder.name}</span>
                </div>
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
            {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
          </AdminCardTitle>
        </AdminCardHeader>
        <AdminCardContent>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredAssets.map((asset) => (
                <div key={asset.id} className="group relative">
                  <div
                    className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border ${selectedIds.includes(asset.id) ? 'ring-2 ring-canyon' : ''}`}
                  >
                    {asset.content_type.startsWith('image/') ? (
                      <ImageWithFallback
                        src={asset.public_url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        onClick={() => {
                          setSelectedAsset(asset);
                          setShowPreview(true);
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getFileIcon(asset.content_type)}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(asset.size)}</p>
                  </div>

                  {/* Select */}
                  <div
                    className={`absolute top-2 left-2 ${selectedIds.includes(asset.id) ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.includes(asset.id)}
                      onCheckedChange={() => toggleSelect(asset.id)}
                      className="bg-white"
                      aria-label={`Select ${asset.name}`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                <div key={asset.id} className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 ${selectedIds.includes(asset.id) ? 'border-canyon bg-canyon/5' : ''}`}>
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
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedAsset(asset);
                      setShowPreview(true);
                    }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyUrl(asset)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(asset)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
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
            <div className="text-center py-8 text-gray-500">
              <File className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No assets found</p>
              <p className="text-sm">Upload some files to get started</p>
            </div>
          )}
        </AdminCardContent>
      </AdminCard>

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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  </div>
  );
}
