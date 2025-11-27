import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Label } from "../../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../components/ui/select";
import { ProductFormData, Category, Collection } from "../../../../../types/product";
import { useEffect, useState } from "react";
import { supabase } from "../../../../../lib/supabase/client";
import { Checkbox } from "../../../../../components/ui/checkbox";

interface OrganizationCardProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function OrganizationCard({ formData, onChange }: OrganizationCardProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [cats, cols] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('collections').select('*').order('title')
      ]);
      if (cats.data) setCategories(cats.data);
      if (cols.data) setCollections(cols.data);
    };
    loadData();
  }, []);

  const toggleCollection = (collectionId: string) => {
    const current = formData.collections || [];
    const updated = current.includes(collectionId)
      ? current.filter(id => id !== collectionId)
      : [...current, collectionId];
    onChange({ collections: updated });
  };

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <CardTitle className="text-sm font-sans text-[var(--color-dark)] uppercase tracking-wider">Organization</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        
        {/* Category */}
        <div className="space-y-2">
          <Label className="text-xs text-[var(--color-dark)]/60">Product Category</Label>
          <Select
            value={formData.categories?.[0] || ''}
            onValueChange={(val) => onChange({ categories: [val] })}
          >
            <SelectTrigger className="w-full bg-[var(--color-creme)] border-[var(--color-coyote)]">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Collections */}
        <div className="space-y-2">
          <Label className="text-xs text-[var(--color-dark)]/60">Collections</Label>
          <div className="bg-[var(--color-creme)] border border-[var(--color-coyote)] rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
            {collections.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <Checkbox 
                  id={col.id} 
                  checked={(formData.collections || []).includes(col.id)}
                  onCheckedChange={() => toggleCollection(col.id)}
                  className="border-[var(--color-coyote)] data-[state=checked]:bg-[var(--color-canyon)] data-[state=checked]:border-[var(--color-canyon)]"
                />
                <label htmlFor={col.id} className="text-sm text-[var(--color-dark)] cursor-pointer select-none">
                  {col.title}
                </label>
              </div>
            ))}
            {collections.length === 0 && (
              <p className="text-xs text-[var(--color-dark)]/40 text-center py-2">No collections found</p>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
