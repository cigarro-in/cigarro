import { useState } from 'react';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import { Button } from './button';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ImageUploadCoreProps {
  imageUrl: string | null;
  onImageUrlChange: (url: string) => void;
  showSelector?: boolean;
  title?: string;
  description?: string;
}

export function ImageUploadCore({ 
  imageUrl, 
  onImageUrlChange, 
  showSelector = false, 
  title, 
  description 
}: ImageUploadCoreProps) {
  const [uploading, setUploading] = useState(false);

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
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }
    
    // Additional security: validate file extension matches MIME type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    if (!fileExt || !validExtensions.includes(fileExt)) {
      toast.error('Invalid file extension.');
      return;
    }

    setUploading(true);

    try {
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error } = await supabase.storage
        .from('asset_images')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('asset_images')
        .getPublicUrl(filePath);
      
      onImageUrlChange(publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload image');
    }

    setUploading(false);
  };

  const handleRemoveImage = () => {
    onImageUrlChange('');
  };

  return (
    <div className="space-y-4">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      
      <div className="border-2 border-dashed border-border/20 rounded-lg p-6">
        {imageUrl ? (
          <div className="relative">
            <ImageWithFallback
              src={imageUrl}
              alt="Uploaded image"
              className="w-full h-48 object-cover rounded-md"
              width={400}
              height={200}
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemoveImage}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex flex-col items-center space-y-4 text-muted-foreground">
              <Upload className="w-12 h-12" />
              <div className="text-center">
                <p className="text-lg font-medium">
                  {uploading ? 'Uploading...' : 'Click to upload image'}
                </p>
                <p className="text-sm">
                  Supports JPEG, PNG, WebP up to 5MB
                </p>
              </div>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
