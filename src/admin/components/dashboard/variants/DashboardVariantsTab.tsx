import React from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { ProductVariant } from '../types/index';
import { VariantManagementTable } from './VariantManagementTable';

interface DashboardVariantsTabProps {
  variants: ProductVariant[];
  onAddVariant: () => void;
  onEditVariant: (variant: ProductVariant) => void;
  onDeleteVariant: (variantId: string) => void;
}

export function DashboardVariantsTab({
  variants,
  onAddVariant,
  onEditVariant,
  onDeleteVariant
}: DashboardVariantsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Product Variants</h2>
        <Button onClick={onAddVariant}>
          <Plus className="h-4 w-4 mr-2" />
          Add Variant
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <VariantManagementTable
            variants={variants}
            onEditVariant={onEditVariant}
            onDeleteVariant={onDeleteVariant}
          />
        </CardContent>
      </Card>
    </div>
  );
}
