import { useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';
import { Button } from './button';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ImageSelectorModal } from './ImageSelectorModal';

interface SingleImageUploadProps {
  imageUrl: string | null;
  onImageUrlChange: (url: string | null) => void;
  showSelector?: boolean;
  title?: string;
  description?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'auto';
  size?: 'sm' | 'md' | 'lg';
}

interface MultipleImageUploadProps {
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  showSelector?: boolean;
  title?: string;
  description?: string;
  maxImages?: number;
  size?: 'sm' | 'md' | 'lg';
}

// Single Image Upload Component
export function SingleImageUpload({ 
  imageUrl, 
  onImageUrlChange, 
  showSelector = false, 
  title, 
  description,
  aspectRatio = 'auto',
  size = 'md'
}: SingleImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showSelectorModal, setShowSelectorModal] = useState(false);

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-48 h-48'
  };

  const aspectClasses = {
    square: 'aspect-square',
    landscape: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: ''
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    setUploading(true);

    try {
      // Security validation
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Only JPEG, PNG, and WebP images are allowed.`);
      }
      
      if (file.size > maxSize) {
        throw new Error(`File is too large. Maximum size is 5MB.`);
      }
      
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      
      if (!fileExt || !validExtensions.includes(fileExt)) {
        throw new Error(`Invalid file extension.`);
      }
      
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
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    }

    setUploading(false);
  };

  const handleRemoveImage = () => {
    onImageUrlChange(null);
  };

  const handleImageSelect = (selectedImageUrl: string) => {
    onImageUrlChange(selectedImageUrl);
    setShowSelectorModal(false);
  };

  return (
    <div className="space-y-2">
      <div className={`relative group ${sizeClasses[size]} ${aspectClasses[aspectRatio]} border-2 border-dashed border-border/20 rounded-lg overflow-hidden bg-muted/20`}>
        {imageUrl ? (
          <>
            <ImageWithFallback
              src={imageUrl}
              alt="Uploaded image"
              className="w-full h-full object-cover"
              width={size === 'sm' ? 80 : size === 'md' ? 128 : 192}
              height={size === 'sm' ? 80 : size === 'md' ? 128 : 192}
            />
            <div className="absolute top-1 right-1">
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemoveImage}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {showSelector ? (
              <Button
                variant="ghost"
                onClick={() => setShowSelectorModal(true)}
                className="w-full h-full flex flex-col items-center justify-center p-2"
                disabled={uploading}
              >
                <ImageIcon className="w-6 h-6 mb-1" />
                <span className="text-xs">Select</span>
              </Button>
            ) : (
              <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-1 text-muted-foreground">
                  <Upload className="w-6 h-6" />
                  <span className="text-xs text-center">
                    {uploading ? 'Uploading...' : 'Upload'}
                  </span>
                </div>
              </label>
            )}
          </div>
        )}
      </div>

      {showSelector && (
        <ImageSelectorModal
          open={showSelectorModal}
          onOpenChange={setShowSelectorModal}
          onImageSelect={handleImageSelect}
          title={title || "Select Image"}
          description={description || "Choose an image from your library or upload a new one"}
        />
      )}
    </div>
  );
}

// Multiple Images Upload Component (Enhanced version of existing)
export function MultipleImageUpload({ 
  imageUrls, 
  onImageUrlsChange, 
  showSelector = false, 
  title, 
  description,
  maxImages = 10,
  size = 'md'
}: MultipleImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showSelectorModal, setShowSelectorModal] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24'
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const files = Array.from(event.target.files);
    const remainingSlots = maxImages - imageUrls.length;
    
    if (files.length > remainingSlots) {
      toast.error(`You can only upload ${remainingSlots} more images. Maximum ${maxImages} images allowed.`);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        // Security validation for each file
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Invalid file type for ${file.name}. Only JPEG, PNG, and WebP images are allowed.`);
        }
        
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} is too large. Maximum size is 5MB.`);
        }
        
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        
        if (!fileExt || !validExtensions.includes(fileExt)) {
          throw new Error(`Invalid file extension for ${file.name}.`);
        }
        
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
        
        return publicUrl;
      });

      const newUrls = await Promise.all(uploadPromises);
      onImageUrlsChange([...imageUrls, ...newUrls]);
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload some images');
    }

    setUploading(false);
  };

  const handleRemoveImage = (index: number) => {
    const newImageUrls = [...imageUrls];
    newImageUrls.splice(index, 1);
    onImageUrlsChange(newImageUrls);
  };

  const handleImageSelect = (imageUrl: string) => {
    if (imageUrls.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    onImageUrlsChange([...imageUrls, imageUrl]);
    setShowSelectorModal(false);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const newImageUrls = Array.from(imageUrls);
    const [reorderedItem] = newImageUrls.splice(result.source.index, 1);
    newImageUrls.splice(result.destination.index, 0, reorderedItem);

    onImageUrlsChange(newImageUrls);
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="image-gallery" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-wrap gap-2"
            >
              {imageUrls.map((url, index) => (
                <Draggable key={url} draggableId={url} index={index}>
                  {(provided, snapshot) => {
                    const element = (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`relative group ${sizeClasses[size]} flex-shrink-0 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                      >
                        <ImageWithFallback
                          src={url}
                          alt={`Uploaded image ${index + 1}`}
                          className="w-full h-full object-cover rounded-md border border-border"
                          width={size === 'sm' ? 64 : size === 'md' ? 80 : 96}
                          height={size === 'sm' ? 64 : size === 'md' ? 80 : 96}
                        />
                        <div className="absolute top-0.5 right-0.5">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <X className="w-2 h-2" />
                          </Button>
                        </div>
                        {index === 0 && (
                          <div className="absolute bottom-0.5 left-0.5">
                            <div className="bg-primary text-primary-foreground text-xs px-1 rounded">
                              Main
                            </div>
                          </div>
                        )}
                      </div>
                    );

                    if (snapshot.isDragging) {
                      return ReactDOM.createPortal(element, document.body);
                    }
                    return element;
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
              {imageUrls.length < maxImages && (
                <div className={`${sizeClasses[size]} border-2 border-dashed border-border/20 rounded-md flex items-center justify-center flex-shrink-0`}>
                  {showSelector ? (
                    <Button
                      variant="ghost"
                      onClick={() => setShowSelectorModal(true)}
                      className="w-full h-full flex flex-col items-center justify-center p-0"
                      disabled={uploading}
                    >
                      <Plus className="w-4 h-4 mb-1" />
                      <span className="text-xs">Add</span>
                    </Button>
                  ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={uploading}
                        className="hidden"
                        multiple
                      />
                      <div className="flex flex-col items-center space-y-1 text-muted-foreground">
                        <Plus className="w-4 h-4" />
                        <span className="text-xs">{uploading ? 'Uploading...' : 'Add'}</span>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {showSelector && (
        <ImageSelectorModal
          open={showSelectorModal}
          onOpenChange={setShowSelectorModal}
          onImageSelect={handleImageSelect}
          title={title || "Select Images"}
          description={description || "Choose images from your library or upload new ones"}
        />
      )}
    </div>
  );
}
