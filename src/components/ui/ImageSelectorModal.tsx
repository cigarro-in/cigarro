import { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Card, CardContent } from './card';
import { AssetManager } from '../../admin/modules/assets/AssetManager';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { ImageWithFallback } from './ImageWithFallback';

interface ImageSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect: (imageUrl: string) => void;
  currentImageUrl?: string;
  title?: string;
  description?: string;
  defaultMode?: 'select' | 'upload';
}

export function ImageSelectorModal({ 
  open, 
  onOpenChange, 
  onImageSelect, 
  currentImageUrl,
  title = "Select Image",
  description = "Choose how you want to add an image",
  defaultMode
}: ImageSelectorModalProps) {
  const [mode, setMode] = useState<'select' | 'upload' | null>(defaultMode || null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(currentImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, and WebP allowed.');
      return;
    }
    
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error } = await supabase.storage.from('images').upload(`uploads/${fileName}`, file);
      if (error) throw error;
      const { data } = supabase.storage.from('images').getPublicUrl(`uploads/${fileName}`);
      setUploadedImageUrl(data.publicUrl);
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = (imageUrl: string) => {
    onImageSelect(imageUrl);
    onOpenChange(false);
    setMode(null);
  };

  const handleUploadComplete = (imageUrl: string | null) => {
    if (imageUrl) {
      setUploadedImageUrl(imageUrl);
      onImageSelect(imageUrl);
      onOpenChange(false);
    } else {
      setUploadedImageUrl(null);
    }
    setMode(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setMode(null);
  };

  const handleBack = () => {
    setMode(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        {!mode ? (
          // Selection Mode
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setMode('upload')}
              >
                <CardContent className="p-6 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="font-semibold mb-2">Upload New Image</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload a new image from your device
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setMode('select')}
              >
                <CardContent className="p-6 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="font-semibold mb-2">Choose from Library</h3>
                  <p className="text-sm text-muted-foreground">
                    Select from existing website images
                  </p>
                </CardContent>
              </Card>
            </div>

            {currentImageUrl && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Current Image</h4>
                <div className="flex items-center gap-4">
                  <img 
                    src={currentImageUrl} 
                    alt="Current" 
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Current image is selected
                    </p>
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => handleImageSelect(currentImageUrl)}
                  >
                    Keep Current
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : mode === 'upload' ? (
          // Upload Mode
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                <X className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h3 className="font-semibold">Upload New Image</h3>
            </div>
            
            {uploadedImageUrl ? (
              <div className="relative">
                <ImageWithFallback
                  src={uploadedImageUrl}
                  alt="Uploaded"
                  className="w-full max-h-64 object-contain rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setUploadedImageUrl(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">{uploading ? 'Uploading...' : 'Click to upload'}</p>
                <p className="text-sm text-muted-foreground">JPEG, PNG, WebP up to 5MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </div>
            )}
            
            {uploadedImageUrl && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleBack}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => handleImageSelect(uploadedImageUrl)}>
                  Use This Image
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Select Mode
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                <X className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h3 className="font-semibold">Choose from Library</h3>
            </div>
            
            <div className="h-96 border rounded-lg overflow-hidden">
              <AssetManager
                mode="select"
                onAssetSelect={(asset) => handleImageSelect(asset.url)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
