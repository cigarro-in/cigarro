import { useState, useEffect } from 'react';
import {
  Upload,
  Trash2,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  RefreshCw,
  Image as ImageIcon,
  FileImage,
  Folder,
  MoreHorizontal,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { ImageUploadCore } from '../../../components/ui/ImageUploadCore';
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
  updated_at: string;
  alt_text?: string;
  tags?: string[];
  is_public: boolean;
}

interface AssetManagerProps {
  onAssetSelect?: (asset: Asset) => void;
  mode?: 'select' | 'manage';
  allowedTypes?: string[];
  maxSize?: number; // in MB
}

export function AssetManager({ 
  onAssetSelect, 
  mode = 'manage',
  allowedTypes = ['image/*'],
  maxSize = 10
}: AssetManagerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [uploadData, setUploadData] = useState({
    file: null as File | null,
    bucket: 'asset_images',
    alt_text: '',
    tags: '',
    is_public: true
  });

  const buckets = [
    { value: 'asset_images', label: 'Asset Images' },
    { value: 'products', label: 'Products' },
    { value: 'hero-slides', label: 'Hero Slides' },
    { value: 'blog', label: 'Blog Images' },
    { value: 'team', label: 'Team Photos' },
    { value: 'lifestyle', label: 'Lifestyle Images' },
    { value: 'brand-heritage', label: 'Brand Heritage' }
  ];

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    filterAssets();
  }, [assets, searchTerm, typeFilter, bucketFilter]);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      // Get all buckets and their files
      const allAssets: Asset[] = [];
      
      for (const bucket of buckets) {
        try {
          const { data: files, error } = await supabase.storage
            .from(bucket.value)
            .list('', { 
              limit: 1000, 
              sortBy: { column: 'created_at', order: 'desc' },
              offset: 0
            });

          if (error) {
            console.error(`Error loading files from ${bucket.value}:`, error);
            continue;
          }

          if (files && files.length > 0) {
            for (const file of files) {
              // Skip directories
              if (file.metadata?.mimetype === 'folder' || file.name.endsWith('/')) {
                continue;
              }

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
                created_at: file.created_at,
                updated_at: file.updated_at,
                alt_text: '',
                tags: [],
                is_public: true
              });
            }
          }
        } catch (bucketError) {
          console.error(`Error processing bucket ${bucket.value}:`, bucketError);
          continue;
        }
      }

      console.log('Loaded assets:', allAssets);
      setAssets(allAssets);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAssets = () => {
    let filtered = assets;

    if (searchTerm) {
      filtered = filtered.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.alt_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(asset => {
        if (typeFilter === 'images') return asset.mime_type.startsWith('image/');
        if (typeFilter === 'videos') return asset.mime_type.startsWith('video/');
        if (typeFilter === 'documents') return asset.mime_type.includes('pdf') || asset.mime_type.includes('doc');
        return true;
      });
    }

    if (bucketFilter !== 'all') {
      filtered = filtered.filter(asset => asset.bucket === bucketFilter);
    }

    setFilteredAssets(filtered);
  };

  const handleUpload = async () => {
    if (!uploadData.file) return;

    setIsUploading(true);
    try {
      const fileExt = uploadData.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(uploadData.bucket)
        .upload(fileName, uploadData.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      toast.success('File uploaded successfully');
      setShowUploadDialog(false);
      setUploadData({
        file: null,
        bucket: 'products',
        alt_text: '',
        tags: '',
        is_public: true
      });
      loadAssets();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    try {
      const { error } = await supabase.storage
        .from(asset.bucket)
        .remove([asset.path]);

      if (error) throw error;

      toast.success('Asset deleted successfully');
      loadAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete asset');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.length === 0) return;

    try {
      const assetsToDelete = assets.filter(a => selectedAssets.includes(a.id));
      
      for (const asset of assetsToDelete) {
        const { error } = await supabase.storage
          .from(asset.bucket)
          .remove([asset.path]);
        
        if (error) {
          console.error(`Error deleting ${asset.name}:`, error);
        }
      }

      toast.success(`${selectedAssets.length} assets deleted successfully`);
      setSelectedAssets([]);
      loadAssets();
    } catch (error) {
      console.error('Error deleting assets:', error);
      toast.error('Failed to delete assets');
    }
  };

  const handleAssetSelect = (asset: Asset) => {
    console.log('Asset selected:', asset);
    if (mode === 'select' && onAssetSelect) {
      console.log('Calling onAssetSelect with:', asset);
      onAssetSelect(asset);
    } else {
      setPreviewAsset(asset);
      setShowPreviewDialog(true);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (mimeType.startsWith('video/')) return <FileImage className="h-4 w-4" />;
    return <FileImage className="h-4 w-4" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Folder className="h-6 w-6" />
            {mode === 'select' ? 'Select Asset' : 'Asset Manager'}
          </h2>
          <p className="text-muted-foreground">
            Manage your media assets - upload, organize, and delete files
          </p>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {mode === 'manage' && (
                <Button onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              )}
              
              {mode === 'manage' && selectedAssets.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedAssets.length})
                </Button>
              )}

              <Button variant="outline" onClick={loadAssets}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="images">Images</SelectItem>
                  <SelectItem value="videos">Videos</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                </SelectContent>
              </Select>

              <Select value={bucketFilter} onValueChange={setBucketFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buckets</SelectItem>
                  {buckets.map(bucket => (
                    <SelectItem key={bucket.value} value={bucket.value}>
                      {bucket.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

        {/* Select Mode Indicator */}
        {mode === 'select' && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-primary font-medium">
              💡 Click on any image below to select it, or use the "Select" button on hover
            </p>
          </div>
        )}

        {/* Assets Grid/Table */}
        <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-12">
                <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No assets found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Upload your first asset to get started.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAssets.map(asset => (
                  <Card 
                    key={asset.id} 
                    className={`group hover:shadow-md transition-shadow ${mode === 'select' ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                    onClick={() => mode === 'select' && handleAssetSelect(asset)}
                  >
                    <CardContent className="p-0">
                      <div className="relative">
                        {asset.mime_type.startsWith('image/') ? (
                          <img
                            src={asset.url}
                            alt={asset.alt_text || asset.name}
                            className="w-full h-32 object-cover rounded-t-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <div className="w-full h-32 bg-muted flex items-center justify-center rounded-t-lg">
                            {getFileIcon(asset.mime_type)}
                          </div>
                        )}
                        
                        <div className="hidden w-full h-32 bg-muted flex items-center justify-center rounded-t-lg">
                          {getFileIcon(asset.mime_type)}
                        </div>

                        {mode === 'manage' && (
                          <div className="absolute top-2 right-2">
                            <Checkbox
                              checked={selectedAssets.includes(asset.id)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  setSelectedAssets(prev => [...prev, asset.id]);
                                } else {
                                  setSelectedAssets(prev => prev.filter(id => id !== asset.id));
                                }
                              }}
                            />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg flex items-center justify-center">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssetSelect(asset);
                              }}
                            >
                              {mode === 'select' ? (
                                <>
                                  <ImageIcon className="h-4 w-4 mr-1" />
                                  Select
                                </>
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => copyToClipboard(asset.url)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {mode === 'manage' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(asset.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-3">
                        <h3 className="font-medium text-sm truncate" title={asset.name}>
                          {asset.name}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                          <span>{formatFileSize(asset.size)}</span>
                          <Badge variant="outline" className="text-xs">
                            {asset.bucket}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New Asset</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  accept={allowedTypes.join(',')}
                  onChange={(e) => setUploadData(prev => ({ 
                    ...prev, 
                    file: e.target.files?.[0] || null 
                  }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Max size: {maxSize}MB
                </p>
              </div>

              <div>
                <Label htmlFor="bucket">Bucket</Label>
                <Select 
                  value={uploadData.bucket} 
                  onValueChange={(value: string) => setUploadData(prev => ({ ...prev, bucket: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {buckets.map(bucket => (
                      <SelectItem key={bucket.value} value={bucket.value}>
                        {bucket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="alt_text">Alt Text</Label>
                <Input
                  id="alt_text"
                  value={uploadData.alt_text}
                  onChange={(e) => setUploadData(prev => ({ ...prev, alt_text: e.target.value }))}
                  placeholder="Describe the image for accessibility"
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={uploadData.tags}
                  onChange={(e) => setUploadData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_public"
                  checked={uploadData.is_public}
                  onCheckedChange={(checked: boolean) => setUploadData(prev => ({ 
                    ...prev, 
                    is_public: checked 
                  }))}
                />
                <Label htmlFor="is_public">Public</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={!uploadData.file || isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Asset Preview</DialogTitle>
            </DialogHeader>
            
            {previewAsset && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {previewAsset.mime_type.startsWith('image/') ? (
                    <img
                      src={previewAsset.url}
                      alt={previewAsset.alt_text || previewAsset.name}
                      className="max-h-96 rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-64 bg-muted flex items-center justify-center rounded-lg">
                      {getFileIcon(previewAsset.mime_type)}
                      <span className="ml-2">{previewAsset.name}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <p className="text-sm">{previewAsset.name}</p>
                  </div>
                  <div>
                    <Label>Size</Label>
                    <p className="text-sm">{formatFileSize(previewAsset.size)}</p>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <p className="text-sm">{previewAsset.mime_type}</p>
                  </div>
                  <div>
                    <Label>Bucket</Label>
                    <p className="text-sm">{previewAsset.bucket}</p>
                  </div>
                </div>

                <div>
                  <Label>URL</Label>
                  <div className="flex gap-2">
                    <Input value={previewAsset.url} readOnly />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(previewAsset.url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.open(previewAsset.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                    Close
                  </Button>
                  {mode === 'select' && onAssetSelect && (
                    <Button onClick={() => {
                      onAssetSelect(previewAsset);
                      setPreviewAsset(null);
                    }}>
                      Select Asset
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
