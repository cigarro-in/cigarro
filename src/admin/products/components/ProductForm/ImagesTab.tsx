// ============================================================================
// IMAGES TAB - Product gallery management
// ============================================================================

import { Image as ImageIcon, Upload, X, Info } from 'lucide-react';
import { Label } from '../../../../components/ui/label';
import { Input } from '../../../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { ProductFormData } from '../../../../types/product';
import { MultipleImageUpload } from '../../../../components/ui/MultipleImageUpload';

interface ImagesTabProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function ImagesTab({ formData, onChange }: ImagesTabProps) {
  const handleImagesChange = (images: string[]) => {
    onChange({ gallery_images: images });
  };

  const removeImage = (index: number) => {
    const newImages = formData.gallery_images.filter((_, i) => i !== index);
    onChange({ gallery_images: newImages });
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...formData.gallery_images];
    const [removed] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, removed);
    onChange({ gallery_images: newImages });
  };

  return (
    <div className="space-y-6">
      {/* Gallery Images */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[var(--color-canyon)]" />
            <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Product Images</CardTitle>
          </div>
          <CardDescription className="text-[var(--color-dark)]/70">
            Upload and manage product images. First image will be the main product image.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MultipleImageUpload
            imageUrls={formData.gallery_images || []}
            onImageUrlsChange={handleImagesChange}
            showSelector={true}
          />

          {formData.gallery_images && formData.gallery_images.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              {formData.gallery_images.map((imageUrl, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded-lg border-2 border-[var(--color-coyote)] overflow-hidden bg-[var(--color-creme)]"
                >
                  <img
                    src={imageUrl}
                    alt={`Product ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {index === 0 && (
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-[var(--color-dark)] text-[var(--color-creme-light)] text-xs rounded">
                        Main
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {index > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => moveImage(index, index - 1)}
                        className="bg-white/90 hover:bg-white"
                      >
                        ←
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removeImage(index)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    {index < formData.gallery_images.length - 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => moveImage(index, index + 1)}
                        className="bg-white/90 hover:bg-white"
                      >
                        →
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Alt Text */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Image SEO</CardTitle>
          <CardDescription className="text-[var(--color-dark)]/70">
            Improve accessibility and search engine optimization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image_alt_text" className="text-[var(--color-dark)] font-medium">
              Alt Text
            </Label>
            <Input
              id="image_alt_text"
              value={formData.image_alt_text || ''}
              onChange={(e) => onChange({ image_alt_text: e.target.value })}
              placeholder="e.g., Marlboro Red cigarette pack on white background"
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              Describe the image for screen readers and search engines
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
        <Info className="h-4 w-4 text-[var(--color-canyon)]" />
        <AlertDescription className="text-[var(--color-dark)]/70">
          <strong>Image Tips:</strong> Use high-quality images (at least 1000x1000px). 
          The first image is your main product image. Drag to reorder images.
        </AlertDescription>
      </Alert>
    </div>
  );
}
