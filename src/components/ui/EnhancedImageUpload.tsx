import { useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Link,
  Eye,
  Trash2,
  Camera,
  Folder,
  Crop,
  Download
} from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Badge } from './badge';
import { ImageWithFallback } from './ImageWithFallback';
import { cn } from './utils';

interface EnhancedImageUploadProps {
  imageUrl: string | null;
  onImageUrlChange: (url: string | null) => void;
  title?: string;
  description?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'auto';
  maxSize?: number;
  allowedTypes?: string[];
  showPreview?: boolean;
  className?: string;
}

export function EnhancedImageUpload({ 
  imageUrl, 
  onImageUrlChange, 
  title = "Upload Image",
  description = "Drag and drop or click to select",
  aspectRatio = 'auto',
  maxSize = 5,
  allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  showPreview = true,
  className
}: EnhancedImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClasses = {
    square: 'aspect-square',
    landscape: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: 'min-h-[200px]'
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid file type. Allowed: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`);
      return;
    }
    
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${maxSize}MB.`);
      return;
    }

    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      onImageUrlChange(data.publicUrl);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onImageUrlChange(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
      toast.success('Image URL added successfully!');
    }
  };

  const removeImage = () => {
    onImageUrlChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-dark font-medium text-base">{title}</Label>
          <p className="text-sm text-dark/60 mt-1">{description}</p>
        </div>
        {imageUrl && (
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreviewModal(true)}
              className="text-canyon hover:bg-canyon/10"
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeImage}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {imageUrl ? (
        <Card className="bg-creme-light border-coyote">
          <CardContent className="p-4">
            <div className={cn("relative rounded-lg overflow-hidden bg-coyote/10", aspectRatioClasses[aspectRatio])}>
              <ImageWithFallback
                src={imageUrl}
                alt="Uploaded image"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowPreviewModal(true)}
                    className="bg-creme/90 text-dark hover:bg-creme"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={removeImage}
                    className="bg-red-500/90 text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-coyote/20">
            <TabsTrigger value="upload" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">
              <Link className="h-4 w-4 mr-2" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Card 
              className={cn(
                "border-2 border-dashed transition-all duration-200 cursor-pointer",
                dragActive 
                  ? "border-canyon bg-canyon/5" 
                  : "border-coyote hover:border-canyon/50 hover:bg-canyon/5"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className={cn("p-8 text-center", aspectRatioClasses[aspectRatio])}>
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="mx-auto w-16 h-16 bg-canyon/10 rounded-full flex items-center justify-center">
                    {uploading ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-canyon"></div>
                    ) : (
                      <Upload className="h-8 w-8 text-canyon" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-medium text-dark">
                      {uploading ? 'Uploading...' : 'Drop images here'}
                    </p>
                    <p className="text-sm text-dark/60">
                      {uploading ? 'Please wait' : 'or click to browse'}
                    </p>
                  </div>
                  <div className="flex justify-center space-x-2">
                    {allowedTypes.map(type => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type.split('/')[1].toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-dark/50">
                    Maximum file size: {maxSize}MB
                  </p>
                </div>
              </CardContent>
            </Card>
            <input
              ref={fileInputRef}
              type="file"
              accept={allowedTypes.join(',')}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
          </TabsContent>

          <TabsContent value="url" className="mt-4">
            <Card className="bg-creme-light border-coyote">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label htmlFor="image-url" className="text-dark font-medium">Image URL</Label>
                  <div className="flex space-x-2 mt-2">
                    <Input
                      id="image-url"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="bg-creme border-coyote text-dark"
                    />
                    <Button
                      type="button"
                      onClick={handleUrlSubmit}
                      disabled={!urlInput.trim()}
                      className="bg-canyon hover:bg-canyon/90 text-creme"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl bg-creme border-coyote">
          <DialogHeader>
            <DialogTitle className="text-dark">Image Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {imageUrl && (
              <div className="relative rounded-lg overflow-hidden bg-coyote/10">
                <ImageWithFallback
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
