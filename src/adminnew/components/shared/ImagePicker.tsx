import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Search, 
  Grid3X3, 
  List, 
  Check,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '../../../components/ui/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface StorageImage {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: string;
}

export interface ImagePickerProps {
  /** Currently selected image URL(s) */
  value?: string | string[];
  /** Callback when selection changes */
  onChange: (value: string | string[]) => void;
  /** Allow multiple image selection */
  multiple?: boolean;
  /** Maximum number of images (for multiple mode) */
  maxImages?: number;
  /** Storage bucket to use */
  bucket?: string;
  /** Folder path within bucket */
  folder?: string;
  /** Allowed file types */
  allowedTypes?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Show as modal or inline */
  mode?: 'modal' | 'inline';
  /** Modal trigger - only used when mode is 'modal' */
  trigger?: React.ReactNode;
  /** Modal open state (controlled) */
  open?: boolean;
  /** Modal open change handler */
  onOpenChange?: (open: boolean) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable the picker */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_BUCKET = 'asset_images';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function generateUniqueFilename(originalName: string): string {
  const ext = getFileExtension(originalName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}.${ext}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ImagePicker({
  value,
  onChange,
  multiple = false,
  maxImages = 10,
  bucket = DEFAULT_BUCKET,
  folder = '',
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  mode = 'modal',
  trigger,
  open: controlledOpen,
  onOpenChange,
  placeholder = 'Select image',
  disabled = false,
  className
}: ImagePickerProps) {
  // State
  const [internalOpen, setInternalOpen] = useState(false);
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Controlled/uncontrolled open state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  // Normalize value to array
  const currentValues = Array.isArray(value) ? value : value ? [value] : [];

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (isOpen) {
      loadImages();
      // Initialize selection from current value
      setSelectedUrls(currentValues);
    }
  }, [isOpen]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadImages = async () => {
    setLoading(true);
    try {
      const folderPath = folder ? `${folder}/` : '';
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder || '', {
          limit: 200,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      // Filter out folders and transform to our format
      const imageFiles = (data || [])
        .filter(item => item.id !== null) // Folders have id: null
        .filter(item => {
          const ext = getFileExtension(item.name);
          return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
        })
        .map(item => {
          const path = folder ? `${folder}/${item.name}` : item.name;
          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

          return {
            id: item.id || item.name,
            name: item.name,
            path,
            url: publicUrl,
            size: item.metadata?.size || 0,
            contentType: item.metadata?.mimetype || `image/${getFileExtension(item.name)}`,
            createdAt: item.created_at || new Date().toISOString()
          } as StorageImage;
        });

      setImages(imageFiles);
    } catch (error) {
      console.error('Error loading images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // FILE UPLOAD
  // ============================================================================

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type: ${file.name}. Allowed: JPEG, PNG, WebP, GIF`;
    }
    if (file.size > maxFileSize) {
      return `File too large: ${file.name}. Maximum size: ${formatFileSize(maxFileSize)}`;
    }
    const ext = getFileExtension(file.name);
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return `Invalid file extension: ${file.name}`;
    }
    return null;
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Validate all files first
    const errors: string[] = [];
    const validFiles: File[] = [];
    
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const filename = generateUniqueFilename(file.name);
        const path = folder ? `${folder}/${filename}` : filename;

        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);

        uploadedUrls.push(publicUrl);
        setUploadProgress(((i + 1) / validFiles.length) * 100);
      }

      if (uploadedUrls.length > 0) {
        toast.success(`Uploaded ${uploadedUrls.length} image(s)`);
        
        // Auto-select uploaded images
        if (multiple) {
          const newSelection = [...selectedUrls, ...uploadedUrls].slice(0, maxImages);
          setSelectedUrls(newSelection);
        } else {
          setSelectedUrls([uploadedUrls[0]]);
        }
        
        // Refresh the library
        await loadImages();
        setActiveTab('library');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    uploadFiles(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      uploadFiles(files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // ============================================================================
  // SELECTION
  // ============================================================================

  const toggleImageSelection = (url: string) => {
    if (multiple) {
      if (selectedUrls.includes(url)) {
        setSelectedUrls(selectedUrls.filter(u => u !== url));
      } else if (selectedUrls.length < maxImages) {
        setSelectedUrls([...selectedUrls, url]);
      } else {
        toast.error(`Maximum ${maxImages} images allowed`);
      }
    } else {
      setSelectedUrls([url]);
    }
  };

  const handleConfirmSelection = () => {
    if (multiple) {
      onChange(selectedUrls);
    } else {
      onChange(selectedUrls[0] || '');
    }
    setIsOpen(false);
  };


  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredImages = images.filter(img =>
    img.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ============================================================================
  // RENDER: LIBRARY VIEW
  // ============================================================================

  const renderLibrary = () => (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-dark)]/40" />
          <Input
            placeholder="Search images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={loadImages}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image Grid/List */}
      <div className="h-[400px] overflow-y-auto border border-[var(--color-coyote)]/30 rounded-lg p-3 bg-[var(--color-creme-light)]/50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-canyon)]" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-dark)]/60">
            <ImageIcon className="h-12 w-12 mb-3 text-[var(--color-coyote)]" />
            <p className="font-medium">No images found</p>
            <p className="text-sm">Upload some images to get started</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {filteredImages.map((image) => {
              const isSelected = selectedUrls.includes(image.url);
              return (
                <div
                  key={image.id}
                  onClick={() => toggleImageSelection(image.url)}
                  className={cn(
                    "group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                    isSelected 
                      ? "border-[var(--color-canyon)] ring-2 ring-[var(--color-canyon)]/30" 
                      : "border-transparent hover:border-[var(--color-coyote)]"
                  )}
                >
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-1 left-1 bg-[var(--color-canyon)] text-white rounded-full p-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  
                  {/* Name tooltip on hover */}
                  <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-dark)]/70 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {image.name}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredImages.map((image) => {
              const isSelected = selectedUrls.includes(image.url);
              return (
                <div
                  key={image.id}
                  onClick={() => toggleImageSelection(image.url)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all",
                    isSelected 
                      ? "border-[var(--color-canyon)] bg-[var(--color-canyon)]/5" 
                      : "border-[var(--color-coyote)]/30 hover:border-[var(--color-coyote)] hover:bg-[var(--color-creme-light)]"
                  )}
                >
                  <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[var(--color-canyon)]/20 flex items-center justify-center">
                        <Check className="h-4 w-4 text-[var(--color-canyon)]" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-[var(--color-dark)]">{image.name}</p>
                    <p className="text-xs text-[var(--color-dark)]/50">{formatFileSize(image.size)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: UPLOAD VIEW
  // ============================================================================

  const renderUpload = () => (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "h-[400px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors",
          dragOver 
            ? "border-[var(--color-canyon)] bg-[var(--color-canyon)]/5" 
            : "border-[var(--color-coyote)] hover:border-[var(--color-canyon)] hover:bg-[var(--color-creme-light)]"
        )}
      >
        {uploading ? (
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[var(--color-canyon)] mx-auto mb-4" />
            <p className="font-medium text-[var(--color-dark)]">Uploading...</p>
            <div className="w-48 h-2 bg-[var(--color-coyote)]/30 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-[var(--color-canyon)] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-[var(--color-dark)]/60 mt-2">{Math.round(uploadProgress)}%</p>
          </div>
        ) : (
          <>
            <Upload className="h-12 w-12 text-[var(--color-coyote)] mb-4" />
            <p className="font-medium text-[var(--color-dark)]">
              Drag & drop images here
            </p>
            <p className="text-sm text-[var(--color-dark)]/60 mt-1">
              or click to browse
            </p>
            <p className="text-xs text-[var(--color-dark)]/40 mt-4">
              JPEG, PNG, WebP, GIF up to {formatFileSize(maxFileSize)}
            </p>
            {multiple && (
              <Badge variant="outline" className="mt-3">
                Multiple files allowed (max {maxImages})
              </Badge>
            )}
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={allowedTypes.join(',')}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );

  // ============================================================================
  // RENDER: MODAL CONTENT
  // ============================================================================

  const renderContent = () => (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'library' | 'upload')}>
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="library" className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Library
          {images.length > 0 && (
            <Badge variant="secondary" className="ml-1">{images.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="upload" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload New
        </TabsTrigger>
      </TabsList>

      <TabsContent value="library" className="mt-0">
        {renderLibrary()}
      </TabsContent>

      <TabsContent value="upload" className="mt-0">
        {renderUpload()}
      </TabsContent>
    </Tabs>
  );

  // ============================================================================
  // RENDER: TRIGGER BUTTON (for modal mode)
  // ============================================================================

  const renderTrigger = () => {
    if (trigger) return trigger;

    const hasValue = currentValues.length > 0;

    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full justify-start text-left font-normal",
          !hasValue && "text-muted-foreground",
          className
        )}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        {hasValue ? (
          multiple 
            ? `${currentValues.length} image(s) selected`
            : 'Image selected'
        ) : (
          placeholder
        )}
      </Button>
    );
  };

  // ============================================================================
  // RENDER: MAIN
  // ============================================================================

  if (mode === 'inline') {
    return (
      <div className={className}>
        {renderContent()}
        
        {/* Selection summary */}
        {selectedUrls.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-[var(--color-dark)]/70">
              {selectedUrls.length} image(s) selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUrls([])}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmSelection}
                className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-white"
              >
                Confirm Selection
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Trigger */}
      <div onClick={() => !disabled && setIsOpen(true)}>
        {renderTrigger()}
      </div>

      {/* Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {multiple ? 'Select Images' : 'Select Image'}
            </DialogTitle>
          </DialogHeader>

          {renderContent()}

          <DialogFooter className="flex items-center justify-between border-t border-[var(--color-coyote)]/30 pt-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-dark)]/70">
                {selectedUrls.length > 0 ? (
                  <span>{selectedUrls.length} selected</span>
                ) : (
                  <span>No image selected</span>
                )}
                {multiple && maxImages && (
                  <span className="text-[var(--color-dark)]/40 ml-2">(max {maxImages})</span>
                )}
              </span>
              {selectedUrls.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setSelectedUrls([])}
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSelection}
                className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-white"
              >
                {selectedUrls.length > 0 ? (multiple ? 'Select Images' : 'Select Image') : 'Clear Selection'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/**
 * Single image picker with preview
 */
export interface SingleImagePickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  disabled?: boolean;
  className?: string;
}

export function SingleImagePicker({
  value,
  onChange,
  bucket,
  folder,
  disabled,
  className
}: SingleImagePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Compact tile - click to open picker */}
      <div
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "relative w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all flex-shrink-0 group",
          value 
            ? "border-[var(--color-coyote)]/30 hover:border-[var(--color-canyon)]" 
            : "border-dashed border-[var(--color-coyote)] hover:border-[var(--color-canyon)] hover:bg-[var(--color-creme-light)]",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Selected"
              className="w-full h-full object-cover"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImageIcon className="h-4 w-4 text-white" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-creme-light)]">
            <Upload className="h-4 w-4 text-[var(--color-coyote)]" />
            <span className="text-[10px] text-[var(--color-dark)]/60 mt-0.5">Add</span>
          </div>
        )}
      </div>

      <ImagePicker
        value={value || ''}
        onChange={(v) => onChange(typeof v === 'string' ? v : v[0] || null)}
        multiple={false}
        bucket={bucket}
        folder={folder}
        mode="modal"
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        trigger={<></>}
      />
    </>
  );
}

/**
 * Multiple image picker with preview grid and drag reorder
 */
export interface MultipleImagePickerProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  bucket?: string;
  folder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultipleImagePicker({
  value = [],
  onChange,
  maxImages = 10,
  bucket,
  folder,
  disabled,
  className
}: MultipleImagePickerProps) {
  const [open, setOpen] = useState(false);

  const handleRemove = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newValue = [...value];
    const [moved] = newValue.splice(fromIndex, 1);
    newValue.splice(toIndex, 0, moved);
    onChange(newValue);
  };

  return (
    <>
      {/* Image grid */}
      <div className={cn("flex flex-wrap gap-2", className)}>
        {value.map((url, index) => (
          <div
            key={url}
            className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-[var(--color-coyote)]/30 bg-[var(--color-creme-light)] group cursor-move"
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
              handleReorder(fromIndex, index);
            }}
          >
            <img
              src={url}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Hover overlay with remove */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {index === 0 && (
              <Badge className="absolute bottom-0.5 left-0.5 text-[10px] px-1 py-0">
                Main
              </Badge>
            )}
          </div>
        ))}

        {/* Add tile - same style as SingleImagePicker */}
        {value.length < maxImages && (
          <div
            onClick={() => !disabled && setOpen(true)}
            className={cn(
              "relative w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all flex-shrink-0",
              "border-dashed border-[var(--color-coyote)] hover:border-[var(--color-canyon)] hover:bg-[var(--color-creme-light)]",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-creme-light)]">
              <Upload className="h-4 w-4 text-[var(--color-coyote)]" />
              <span className="text-[10px] text-[var(--color-dark)]/60 mt-0.5">Add</span>
            </div>
          </div>
        )}
      </div>

      <ImagePicker
        value={value}
        onChange={(v) => onChange(Array.isArray(v) ? v : [v])}
        multiple={true}
        maxImages={maxImages}
        bucket={bucket}
        folder={folder}
        mode="modal"
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        trigger={<></>}
      />
    </>
  );
}

export default ImagePicker;
