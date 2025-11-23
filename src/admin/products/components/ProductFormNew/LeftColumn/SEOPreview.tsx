import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Textarea } from "../../../../../components/ui/textarea";
import { Button } from "../../../../../components/ui/button";
import { ProductFormData } from "../../../../../types/product";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SEOPreviewProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function SEOPreview({ formData, onChange }: SEOPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const title = formData.meta_title || formData.name || "Product Title";
  const description = formData.meta_description || formData.short_description || formData.description?.slice(0, 160) || "Product description...";
  const slug = formData.slug || "product-url";

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Search Engine Listing</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[var(--color-canyon)] hover:bg-[var(--color-creme)]"
        >
          {isExpanded ? "Hide Details" : "Edit SEO"}
          {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        
        {/* Google Preview */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <div className="text-sm text-[#202124] mb-1">store.cigarro.in › products › {slug}</div>
          <div className="text-xl text-[#1a0dab] hover:underline cursor-pointer truncate font-medium mb-1">
            {title}
          </div>
          <div className="text-sm text-[#4d5156] line-clamp-2">
            {description}
          </div>
        </div>

        {/* Editable Fields */}
        {isExpanded && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
            
            <div className="space-y-2">
              <Label className="text-[var(--color-dark)] font-medium">Meta Title</Label>
              <Input
                value={formData.meta_title || ''}
                onChange={(e) => onChange({ meta_title: e.target.value })}
                placeholder={formData.name}
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                maxLength={60}
              />
              <p className="text-xs text-[var(--color-dark)]/50 text-right">
                {(formData.meta_title?.length || 0)}/60
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--color-dark)] font-medium">Meta Description</Label>
              <Textarea
                value={formData.meta_description || ''}
                onChange={(e) => onChange({ meta_description: e.target.value })}
                placeholder={formData.short_description}
                className="bg-[var(--color-creme)] border-[var(--color-coyote)] min-h-[100px]"
                maxLength={160}
              />
              <p className="text-xs text-[var(--color-dark)]/50 text-right">
                {(formData.meta_description?.length || 0)}/160
              </p>
            </div>

             <div className="space-y-2">
              <Label className="text-[var(--color-dark)] font-medium">Meta Keywords</Label>
              <Input
                value={formData.meta_keywords || ''}
                onChange={(e) => onChange({ meta_keywords: e.target.value })}
                placeholder="cigars, tobacco, premium..."
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
              />
            </div>

             <div className="space-y-2">
              <Label className="text-[var(--color-dark)] font-medium">OG Image URL (Social Media)</Label>
              <Input
                value={formData.og_image || ''}
                onChange={(e) => onChange({ og_image: e.target.value })}
                placeholder="https://..."
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
              />
            </div>

          </div>
        )}

        {!isExpanded && (
           <p className="text-xs text-[var(--color-dark)]/50">
            This is how your product will appear on Google. We automatically add the "Age Restricted" schema for safety.
          </p>
        )}
       
      </CardContent>
    </Card>
  );
}
