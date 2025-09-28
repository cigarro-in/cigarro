import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { ProductVariant } from '../types/index';

interface VariantManagementTableProps {
  variants: ProductVariant[];
  onEditVariant: (variant: ProductVariant) => void;
  onDeleteVariant: (variantId: string) => void;
}

export function VariantManagementTable({ 
  variants, 
  onEditVariant, 
  onDeleteVariant 
}: VariantManagementTableProps) {
  const handleDeleteClick = (variant: ProductVariant) => {
    if (window.confirm(`Are you sure you want to delete "${variant.variant_name}"?`)) {
      onDeleteVariant(variant.id);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Variant</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {variants.map(variant => (
          <TableRow key={variant.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                {variant.variant_images?.[0] && (
                  <img 
                    src={variant.variant_images[0].image_url} 
                    alt={variant.variant_name}
                    className="w-10 h-10 rounded object-cover"
                  />
                )}
                <div>
                  <p className="font-medium">{variant.variant_name}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>{variant.products?.name}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {variant.variant_type}
              </Badge>
            </TableCell>
            <TableCell>₹{variant.price}</TableCell>
            <TableCell>{variant.stock}</TableCell>
            <TableCell>
              <Badge variant={variant.is_active ? "default" : "secondary"}>
                {variant.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditVariant(variant)}
                  title="Edit variant"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClick(variant)}
                  title="Delete variant"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {variants.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              No variants found. Create your first variant to get started.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
