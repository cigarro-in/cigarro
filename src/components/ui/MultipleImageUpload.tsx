import { useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from './button';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ImageSelectorModal } from './ImageSelectorModal';

interface ImageUploadProps {
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  showSelector?: boolean;
  title?: string;
  description?: string;
}

export function MultipleImageUpload({ 
  imageUrls, 
  onImageUrlsChange, 
  showSelector = false, 
  title, 
  description 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = async (files: File[]) => {
    const remainingSlots = 10 - imageUrls.length;

    if (files.length > remainingSlots) {
      toast.error(`You can only upload ${remainingSlots} more images. Maximum 10 images allowed.`);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
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
    } catch (error) {
      toast.error('Failed to upload some images');
    }

    setUploading(false);
  };
  const [showSelectorModal, setShowSelectorModal] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const files = Array.from(event.target.files);
    await uploadFiles(files);
  };

  const handleRemoveImage = (index: number) => {
    const newImageUrls = [...imageUrls];
    newImageUrls.splice(index, 1);
    onImageUrlsChange(newImageUrls);
  };

  const handleImageSelect = (imageUrl: string) => {
    if (imageUrls.length >= 10) {
      toast.error('Maximum 10 images allowed');
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

  // Suppress react-beautiful-dnd defaultProps warning
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('defaultProps')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="image-gallery" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`flex flex-wrap gap-2 ${dragOver ? 'ring-2 ring-primary/40 ring-offset-2' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOver(false);
                const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
                if (files.length) {
                  await uploadFiles(files as File[]);
                }
              }}
            >
              {imageUrls.map((url, index) => (
                <Draggable key={url} draggableId={url} index={index}>
                  {(provided, snapshot) => {
                    const element = (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`relative group w-20 h-20 flex-shrink-0 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                      >
                        <ImageWithFallback
                          src={url}
                          alt={`Uploaded image ${index + 1}`}
                          className="w-full h-full object-cover rounded-md"
                          width={80}
                          height={80}
                        />
                        <div className="absolute top-0.5 right-0.5">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <X className="w-2 h-2" />
                          </Button>
                        </div>
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
              {imageUrls.length < 10 && (
                <div className="w-20 h-20 border-2 border-dashed border-border/20 rounded-md flex items-center justify-center flex-shrink-0">
                  {showSelector ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowSelectorModal(true)}
                      className="w-full h-full flex flex-col items-center justify-center p-0"
                    >
                      <ImageIcon className="w-6 h-6" />
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
                        multiple
                      />
                      <div className="flex flex-col items-center space-y-1 text-muted-foreground">
                        <Upload className="w-6 h-6" />
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
          title={title || "Select Product Image"}
          description={description || "Choose an image from your library or upload a new one"}
          defaultMode="select"
        />
      )}
    </div>
  );
}
