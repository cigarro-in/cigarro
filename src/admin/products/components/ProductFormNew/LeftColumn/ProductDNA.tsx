import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../components/ui/select";
import { ProductFormData, Brand } from "../../../../../types/product";
import { useEffect, useState } from "react";
import { supabase } from "../../../../../lib/supabase/client";

interface ProductDNAProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function ProductDNA({ formData, onChange }: ProductDNAProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  
  useEffect(() => {
    const loadBrands = async () => {
      const { data } = await supabase.from('brands').select('*').order('name');
      if (data) setBrands(data);
    };
    loadBrands();
  }, []);

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Product DNA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        
        <div className="grid grid-cols-2 gap-6">
          {/* Brand */}
          <div className="space-y-2">
            <Label className="text-[var(--color-dark)] font-medium">
              Brand <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.brand} 
              onValueChange={(value: string) => {
                const selectedBrand = brands.find(b => b.name === value);
                onChange({ 
                  brand: value,
                  brand_id: selectedBrand?.id 
                });
              }}
            >
              <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                <SelectValue placeholder="Select Brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.name}>
                    {brand.name}
                    {brand.country_of_origin && (
                      <span className="ml-2 text-[var(--color-dark)]/50 text-xs">
                        ({brand.country_of_origin})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origin */}
          <div className="space-y-2">
            <Label className="text-[var(--color-dark)] font-medium">Origin</Label>
            <Select 
              value={formData.origin || ''} 
              onValueChange={(value) => onChange({ origin: value })}
            >
              <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                <SelectValue placeholder="Select Origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="India">🇮🇳 India</SelectItem>
                <SelectItem value="USA">🇺🇸 USA</SelectItem>
                <SelectItem value="Switzerland">🇨🇭 Switzerland</SelectItem>
                <SelectItem value="Indonesia">🇮🇩 Indonesia</SelectItem>
                <SelectItem value="UK">🇬🇧 UK</SelectItem>
                <SelectItem value="UAE">🇦🇪 UAE</SelectItem>
                <SelectItem value="South Korea">🇰🇷 South Korea</SelectItem>
                <SelectItem value="Spain">🇪🇸 Spain</SelectItem>
                <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                <SelectItem value="Japan">🇯🇵 Japan</SelectItem>
                <SelectItem value="Turkey">🇹🇷 Turkey</SelectItem>
                <SelectItem value="China">🇨🇳 China</SelectItem>
                <SelectItem value="Brazil">🇧🇷 Brazil</SelectItem>
                <SelectItem value="Netherlands">🇳🇱 Netherlands</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pack Size */}
        <div className="grid grid-cols-2 gap-6">
           <div className="space-y-2">
            <Label className="text-[var(--color-dark)] font-medium">Pack Size</Label>
            <Input
              value={formData.pack_size || ''}
              onChange={(e) => onChange({ pack_size: e.target.value })}
              placeholder="e.g. 20 Sticks"
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
