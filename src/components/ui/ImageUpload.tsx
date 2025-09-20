import { useState } from 'react';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from './button';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { ImageSelectorModal } from './ImageSelectorModal';

interface ImageUploadProps {
  imageUrl: string | null;
  onImageUrlChange: (url: string | null) => void;
  showSelector?: boolean;
  title?: string;
  description?: string;
}

export function ImageUpload({ 
  imageUrl, 
  onImageUrlChange, 
  showSelector = false, 
  title, 
  description 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showSelectorModal, setShowSelectorModal] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    
    // Security validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }
    
    // Additional security: validate file extension matches MIME type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    if (!fileExt || !validExtensions.includes(fileExt)) {
      toast.error('Invalid file extension.');
      return;
    }
    
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploading(true);

    const { data, error } = await supabase.storage
      .from('asset_images')
      .upload(filePath, file);

    if (error) {
      toast.error('Failed to upload image');
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from('asset_images')
        .getPublicUrl(filePath);
      onImageUrlChange(publicUrl);
    }

    setUploading(false);
  };

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative">
          <ImageWithFallback
            src={imageUrl}
            alt="Uploaded image"
            className="w-full max-h-96 object-contain rounded-md"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            {showSelector && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSelectorModal(true)}
                title="Change image"
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onImageUrlChange(null)}
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-h-96 border-2 border-dashed border-border/20 rounded-md flex items-center justify-center">
          {showSelector ? (
            <Button
              variant="outline"
              onClick={() => setShowSelectorModal(true)}
              className="h-full w-full flex flex-col items-center space-y-2"
            >
              <ImageIcon className="w-8 h-8" />
              <span>Select or Upload Image</span>
            </Button>
          ) : (
            <label className="cursor-pointer h-full w-full flex items-center justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
              <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                <Upload className="w-8 h-8" />
                <span>{uploading ? 'Uploading...' : 'Upload an image'}</span>
              </div>
            </label>
          )}
        </div>
      )}

      {showSelector && (
        <ImageSelectorModal
          open={showSelectorModal}
          onOpenChange={setShowSelectorModal}
          onImageSelect={onImageUrlChange}
          currentImageUrl={imageUrl}
          title={title}
          description={description}
        />
      )}
    </div>
  );
}
