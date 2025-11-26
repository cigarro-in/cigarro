import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Button } from "../../../../../components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ProductFormData } from "../../../../../types/product";

interface SpecificationsProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function Specifications({ formData, onChange }: SpecificationsProps) {
  const specifications = formData.specifications || [];

  const addSpec = () => {
    onChange({
      specifications: [...specifications, { key: '', value: '' }]
    });
  };

  const removeSpec = (index: number) => {
    const newSpecs = [...specifications];
    newSpecs.splice(index, 1);
    onChange({ specifications: newSpecs });
  };

  const updateSpec = (index: number, field: 'key' | 'value', newValue: string) => {
    const newSpecs = [...specifications];
    newSpecs[index] = { ...newSpecs[index], [field]: newValue };
    onChange({ specifications: newSpecs });
  };

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Specifications</CardTitle>
            <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addSpec}
                className="h-8 border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
            >
                <Plus className="w-4 h-4 mr-2" />
                Add Specification
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {specifications.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-[var(--color-coyote)]/30 rounded-lg bg-[var(--color-creme)]/30">
                <p className="text-[var(--color-dark)]/50 text-sm">No specifications added yet.</p>
                <Button 
                    type="button" 
                    variant="link" 
                    onClick={addSpec}
                    className="text-[var(--color-canyon)] mt-2"
                >
                    Add your first specification
                </Button>
            </div>
        ) : (
            <div className="space-y-3">
                {specifications.map((spec, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-start">
                        <div className="space-y-1">
                            <Label className="text-xs text-[var(--color-dark)]/60">Attribute Name</Label>
                            <Input 
                                value={spec.key}
                                onChange={(e) => updateSpec(index, 'key', e.target.value)}
                                placeholder="e.g. Material, Size, Type"
                                className="bg-[var(--color-creme)] border-[var(--color-coyote)] h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-[var(--color-dark)]/60">Value</Label>
                            <Input 
                                value={spec.value}
                                onChange={(e) => updateSpec(index, 'value', e.target.value)}
                                placeholder="e.g. Cotton, Large, Regular"
                                className="bg-[var(--color-creme)] border-[var(--color-coyote)] h-9"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSpec(index)}
                            className="mt-6 h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
