import { useState } from 'react';
import { Upload, Image as ImageIcon, X, Plus } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Card, CardContent } from './card';
import { ImageUpload } from './ImageUpload';
import { AssetManager } from '../admin/AssetManager';

interface ImageSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect: (imageUrl: string) => void;
  currentImageUrl?: string;
  title?: string;
  description?: string;
}

export function ImageSelectorModal({ 
  open, 
  onOpenChange, 
  onImageSelect, 
  currentImageUrl,
  title = "Select Image",
  description = "Choose how you want to add an image"
}: ImageSelectorModalProps) {
  const [mode, setMode] = useState<'select' | 'upload' | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(currentImageUrl || null);

  const handleImageSelect = (imageUrl: string) => {
    console.log('ImageSelectorModal: Image selected:', imageUrl);
    onImageSelect(imageUrl);
    onOpenChange(false);
    setMode(null);
  };

  const handleUploadComplete = (imageUrl: string) => {
    setUploadedImageUrl(imageUrl);
    onImageSelect(imageUrl);
    onOpenChange(false);
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
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <X className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h3 className="font-semibold">Upload New Image</h3>
            </div>
            
            <ImageUpload
              imageUrl={uploadedImageUrl}
              onImageUrlChange={handleUploadComplete}
            />
            
            {uploadedImageUrl && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleBack}>
                  Cancel
                </Button>
                <Button onClick={() => handleImageSelect(uploadedImageUrl)}>
                  Use This Image
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Select Mode
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={handleBack}>
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
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
