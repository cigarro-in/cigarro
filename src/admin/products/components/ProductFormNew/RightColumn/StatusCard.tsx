import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../components/ui/select";
import { ProductFormData } from "../../../../../types/product";

interface StatusCardProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function StatusCard({ formData, onChange }: StatusCardProps) {
  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <CardTitle className="text-sm font-sans text-[var(--color-dark)] uppercase tracking-wider">Status</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Select 
          value={formData.is_active ? 'active' : 'draft'} 
          onValueChange={(value: string) => onChange({ is_active: value === 'active' })}
        >
          <SelectTrigger className="w-full bg-[var(--color-creme)] border-[var(--color-coyote)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Active
              </div>
            </SelectItem>
            <SelectItem value="draft">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                Draft
              </div>
            </SelectItem>
            <SelectItem value="archived">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                Archived
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
