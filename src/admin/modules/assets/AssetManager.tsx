import { useState, useEffect } from 'react';
import { Upload, Trash2, Search, RefreshCw, Image as ImageIcon, Folder, Copy, ExternalLink, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

interface Asset {
  id: string;
  name: string;
  url: string;
  bucket: string;
  path: string;
  size: number;
  mime_type: string;
  created_at: string;
}

interface AssetManagerProps {
  onAssetSelect?: (asset: Asset) => void;
  mode?: 'select' | 'manage';
}

const BUCKETS = [
  { value: 'asset_images', label: 'Assets' },
  { value: 'products', label: 'Products' },
  { value: 'hero-slides', label: 'Hero Slides' },
  { value: 'blog', label: 'Blog' },
  { value: 'brand-heritage', label: 'Brand Heritage' }
];

export function AssetManager({ onAssetSelect, mode = 'manage' }: AssetManagerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadBucket, setUploadBucket] = useState('asset_images');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const allAssets: Asset[] = [];
      
      for (const bucket of BUCKETS) {
        try {
          const { data: files, error } = await supabase.storage
            .from(bucket.value)
            .list('', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });

          if (error) continue;

          for (const file of files || []) {
            if (file.name.endsWith('/')) continue;
            
            const { data: publicUrl } = supabase.storage
              .from(bucket.value)
              .getPublicUrl(file.name);

            allAssets.push({
              id: `${bucket.value}-${file.name}`,
              name: file.name,
              url: publicUrl.publicUrl,
              bucket: bucket.value,
              path: file.name,
              size: file.metadata?.size || 0,
              mime_type: file.metadata?.mimetype || 'unknown',
              created_at: file.created_at
            });
          }
        } catch (e) {
          console.error(`Error loading ${bucket.value}:`, e);
        }
      }

      setAssets(allAssets);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

      const { error } = await supabase.storage
        .from(uploadBucket)
        .upload(fileName, uploadFile, { cacheControl: '3600' });

      if (error) throw error;

      toast.success('File uploaded');
      setShowUpload(false);
      setUploadFile(null);
      loadAssets();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;

    try {
      const { error } = await supabase.storage
        .from(asset.bucket)
        .remove([asset.path]);

      if (error) throw error;
      toast.success('Asset deleted');
      loadAssets();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error?.message || 'Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.length === 0) return;
    if (!confirm(`Delete ${selectedAssets.length} assets?`)) return;

    try {
      for (const id of selectedAssets) {
        const asset = assets.find(a => a.id === id);
        if (asset) {
          await supabase.storage.from(asset.bucket).remove([asset.path]);
        }
      }
      toast.success(`${selectedAssets.length} assets deleted`);
      setSelectedAssets([]);
      loadAssets();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Some assets failed to delete');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBucket = bucketFilter === 'all' || a.bucket === bucketFilter;
    return matchesSearch && matchesBucket;
  });

  // Asset detail view
  if (selectedAsset && mode === 'manage') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(null)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copyUrl(selectedAsset.url)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(selectedAsset.url, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
            <Button variant="destructive" size="sm" onClick={() => {
              handleDelete(selectedAsset);
              setSelectedAsset(null);
            }}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
            {selectedAsset.mime_type.startsWith('image/') ? (
              <img src={selectedAsset.url} alt={selectedAsset.name} className="max-w-full max-h-[400px] rounded" />
            ) : (
              <div className="text-center text-gray-500">
                <Folder className="h-16 w-16 mx-auto mb-2" />
                <p>Preview not available</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="font-semibold text-lg">Asset Details</h2>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500">Name:</span> {selectedAsset.name}</div>
              <div><span className="text-gray-500">Bucket:</span> {selectedAsset.bucket}</div>
              <div><span className="text-gray-500">Size:</span> {formatSize(selectedAsset.size)}</div>
              <div><span className="text-gray-500">Type:</span> {selectedAsset.mime_type}</div>
              <div><span className="text-gray-500">Created:</span> {new Date(selectedAsset.created_at).toLocaleString()}</div>
            </div>
            <div>
              <Label>URL</Label>
              <Input value={selectedAsset.url} readOnly className="font-mono text-xs" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mode === 'select' ? 'Select Asset' : 'Assets'}</h1>
          <p className="text-gray-500">{assets.length} files</p>
        </div>
        {mode === 'manage' && (
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        )}
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Upload File</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>File</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label>Bucket</Label>
              <Select value={uploadBucket} onValueChange={setUploadBucket}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUCKETS.map(b => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buckets</SelectItem>
            {BUCKETS.map(b => (
              <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadAssets}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        {mode === 'manage' && selectedAssets.length > 0 && (
          <Button variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({selectedAssets.length})
          </Button>
        )}
      </div>

      {mode === 'select' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          Click on an image to select it
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Folder className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          {searchTerm ? 'No assets match your search' : 'No assets yet'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              onClick={() => {
                if (mode === 'select' && onAssetSelect) {
                  onAssetSelect(asset);
                } else {
                  setSelectedAsset(asset);
                }
              }}
              className={`
                group relative bg-white rounded-lg border overflow-hidden cursor-pointer
                hover:ring-2 hover:ring-blue-500 transition-all
                ${selectedAssets.includes(asset.id) ? 'ring-2 ring-blue-500' : ''}
              `}
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {asset.mime_type.startsWith('image/') ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Folder className="h-8 w-8 text-gray-400" />
                )}
              </div>
              
              <div className="p-2">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{formatSize(asset.size)}</span>
                  <Badge variant="outline" className="text-[10px] px-1">
                    {asset.bucket.split('-')[0]}
                  </Badge>
                </div>
              </div>

              {mode === 'manage' && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(asset.id)}
                    onChange={e => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedAssets(prev => [...prev, asset.id]);
                      } else {
                        setSelectedAssets(prev => prev.filter(id => id !== asset.id));
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
