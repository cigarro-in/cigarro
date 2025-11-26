import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { Textarea } from "../../../../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { ProductFormData, generateSlug } from "../../../../../types/product";
import { useEffect, useState } from "react";

interface BasicInfoProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function BasicInfo({ formData, onChange }: BasicInfoProps) {
  // Track if slug was manually edited to prevent auto-generation overwriting user intent
  // Initialize as true if slug exists (Edit Mode), false if empty (Create Mode)
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(!!formData.slug);
  
  // Auto-generate slug from name
  useEffect(() => {
    // Only auto-generate if slug hasn't been manually touched
    if (!isSlugManuallyEdited && formData.name) {
      onChange({ slug: generateSlug(formData.name) });
    }
  }, [formData.name, isSlugManuallyEdited]); // Added dependencies

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    onChange({ slug: generateSlug(e.target.value) });
  };

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Product Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        
        {/* Title */}
        <div className="space-y-2">
          <Label className="text-[var(--color-dark)] font-medium">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input
            value={formData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Marlboro Red (Imported)"
            className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] text-lg py-6"
          />
        </div>

        {/* Short Description */}
        <div className="space-y-2">
          <Label className="text-[var(--color-dark)] font-medium">Short Description</Label>
          <Input
            value={formData.short_description || ''}
            onChange={(e) => onChange({ short_description: e.target.value })}
            placeholder="Brief summary for collection pages..."
            className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
          />
        </div>

        {/* Slug (URL) */}
        <div className="grid grid-cols-[auto_1fr] gap-2 items-center text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)]/50 p-3 rounded-md border border-[var(--color-coyote)]/30">
          <span className="font-medium">store.cigarro.in/products/</span>
          <input
            value={formData.slug}
            onChange={handleSlugChange}
            className="bg-transparent border-none focus:outline-none text-[var(--color-dark)] font-medium w-full"
            placeholder="product-slug"
          />
        </div>

        {/* Rich Description (Placeholder for Rich Text Editor) */}
        <div className="space-y-2">
          <Label className="text-[var(--color-dark)] font-medium">Description</Label>
          <div className="border-2 border-[var(--color-coyote)] rounded-md bg-[var(--color-creme)]">
            {/* Toolbar Mockup */}
            <div className="flex items-center gap-2 p-2 border-b border-[var(--color-coyote)]/50 bg-[var(--color-creme-light)] text-[var(--color-dark)]/70">
              <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded"><strong>B</strong></button>
              <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded"><em>I</em></button>
              <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded"><u>U</u></button>
              <div className="w-px h-4 bg-[var(--color-coyote)]/50 mx-1" />
              <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded">List</button>
            </div>
            <Textarea
              value={formData.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe the product..."
              className="border-none shadow-none focus-visible:ring-0 min-h-[200px] bg-transparent"
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
