import { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Search, 
  Grid, 
  List, 
  Trash2, 
  Download,
  Eye,
  Plus,
  Folder,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Input } from './input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Badge } from './badge';
import { Alert, AlertDescription } from './alert';
import { Checkbox } from './checkbox';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';

interface MediaFile {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_url: string;
  file_type: string;
  file_size: number;
  width?: number;
  height?: number;
  alt_text?: string;
  caption?: string;
  folder?: string;
  tags?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ImageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string, imageData?: MediaFile) => void;
  allowMultiple?: boolean;
  allowedTypes?: string[];
  title?: string;
  folder?: string;
}

export function ImageManager({
  isOpen,
  onClose,
  onSelect,
  allowMultiple = false,
  allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  title = 'Select Image',
  folder = 'general'
}: ImageManagerProps) {
  const [images, setImages] = useState<MediaFile[]>([]);
  const [filteredImages, setFilteredImages] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(folder);
  const [folders, setFolders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadImages();
      loadFolders();
    }
  }, [isOpen, selectedFolder]);

  useEffect(() => {
    filterImages();
  }, [images, searchTerm]);

  const loadImages = async () => {
    setIsLoading(true);
    try {
      // Load from media table if it exists, otherwise load from storage
      const { data: mediaFiles, error: mediaError } = await supabase
        .from('media_files')
        .select('*')
        .eq('folder', selectedFolder)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (mediaError && mediaError.code !== 'PGRST116') {
        throw mediaError;
      }

      if (mediaFiles && mediaFiles.length > 0) {
        setImages(mediaFiles);
      } else {
        // Fallback to storage bucket
        await loadFromStorage();
      }
    } catch (error) {
      console.error('Error loading images:', error);
      toast.error('Failed to load images');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromStorage = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from('media')
        .list(selectedFolder, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const imageFiles = files?.filter(file => 
        allowedTypes.some(type => type.includes(file.name.split('.').pop()?.toLowerCase() || ''))
      ) || [];

      const mediaFiles: MediaFile[] = imageFiles.map(file => ({
        id: file.id || file.name,
        filename: file.name,
        original_filename: file.name,
        file_path: `${selectedFolder}/${file.name}`,
        file_url: `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/media/${selectedFolder}/${file.name}`,
        file_type: `image/${file.name.split('.').pop()?.toLowerCase()}`,
        file_size: file.metadata?.size || 0,
        folder: selectedFolder,
        is_active: true,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: file.updated_at || new Date().toISOString()
      }));

      setImages(mediaFiles);
    } catch (error) {
      console.error('Error loading from storage:', error);
      toast.error('Failed to load images from storage');
    }
  };

  const loadFolders = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from('media')
        .list('', { limit: 100 });

      if (error) throw error;

      const folderNames = files
        ?.filter(file => file.name && !file.name.includes('.'))
        .map(file => file.name) || [];

      setFolders(['general', 'products', 'categories', 'brands', 'blog', ...folderNames]);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const filterImages = () => {
    if (!searchTerm) {
      setFilteredImages(images);
      return;
    }

    const filtered = images.filter(image =>
      image.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.alt_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    setFilteredImages(filtered);
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setUploading(true);
    const uploadedFiles: MediaFile[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!allowedTypes.includes(file.type)) {
          toast.error(`Invalid file type: ${file.name}`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`File too large: ${file.name} (max 5MB)`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${selectedFolder}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          toast.error(`Upload failed: ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        // Create media file object
        const mediaFile: MediaFile = {
          id: fileName,
          filename: fileName,
          original_filename: file.name,
          file_path: filePath,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          folder: selectedFolder,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Save to database if table exists
        try {
          await supabase.from('media_files').insert(mediaFile);
        } catch (error) {
          // Table might not exist, that's okay
        }

        uploadedFiles.push(mediaFile);
      }

      if (uploadedFiles.length > 0) {
        setImages(prev => [...uploadedFiles, ...prev]);
        toast.success(`Uploaded ${uploadedFiles.length} file(s)`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = (image: MediaFile) => {
    if (allowMultiple) {
      const imageId = image.id;
      setSelectedImages(prev => 
        prev.includes(imageId) 
          ? prev.filter(id => id !== imageId)
          : [...prev, imageId]
      );
    } else {
      onSelect(image.file_url, image);
      onClose();
    }
  };

  const handleMultiSelect = () => {
    if (selectedImages.length > 0) {
      const selectedImageData = images.filter(img => selectedImages.includes(img.id));
      // For now, just select the first image's URL
      onSelect(selectedImageData[0]?.file_url || '', selectedImageData[0]);
      onClose();
    }
  };

  const handleDeleteImage = async (image: MediaFile) => {
    if (!confirm(`Delete ${image.filename}?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('media')
        .remove([image.file_path]);

      if (storageError) throw storageError;

      // Delete from database if exists
      try {
        await supabase.from('media_files').delete().eq('id', image.id);
      } catch (error) {
        // Table might not exist
      }

      setImages(prev => prev.filter(img => img.id !== image.id));
      toast.success('Image deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete image');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[80vh]">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 p-4 border-b">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>

              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                {folders.map(folder => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={loadImages}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-4" />
                <p>No images found</p>
                <p className="text-sm">Upload some images to get started</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredImages.map(image => (
                  <Card 
                    key={image.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedImages.includes(image.id) ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleImageSelect(image)}
                  >
                    <CardContent className="p-2">
                      <div className="aspect-square relative mb-2">
                        <img
                          src={image.file_url}
                          alt={image.alt_text || image.filename}
                          className="w-full h-full object-cover rounded"
                          loading="lazy"
                        />
                        {allowMultiple && (
                          <Checkbox
                            checked={selectedImages.includes(image.id)}
                            className="absolute top-2 left-2"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(image.file_url, '_blank');
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(image);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p className="truncate">{image.original_filename}</p>
                        <p>{formatFileSize(image.file_size)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredImages.map(image => (
                  <Card 
                    key={image.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedImages.includes(image.id) ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleImageSelect(image)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {allowMultiple && (
                          <Checkbox
                            checked={selectedImages.includes(image.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <img
                          src={image.file_url}
                          alt={image.alt_text || image.filename}
                          className="w-16 h-16 object-cover rounded"
                          loading="lazy"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{image.original_filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(image.file_size)} • {image.file_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(image.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(image.file_url, '_blank');
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(image);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {allowMultiple && selectedImages.length > 0 && (
            <div className="p-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedImages.length} image(s) selected
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedImages([])}>
                    Clear Selection
                  </Button>
                  <Button onClick={handleMultiSelect}>
                    Select Images
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}

