import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { MultipleImageUpload } from "../../../../../components/ui/MultipleImageUpload";
import { ProductFormData } from "../../../../../types/product";

interface MediaGridProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function MediaGrid({ formData, onChange }: MediaGridProps) {
  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <CardTitle className="text-lg font-sans text-[var(--color-dark)]">
          Media <span className="text-red-500">*</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <MultipleImageUpload
          imageUrls={formData.gallery_images}
          onImageUrlsChange={(images) => onChange({ gallery_images: images })}
          showSelector={true}
          id="main-product-gallery"
        />
      </CardContent>
    </Card>
  );
}
