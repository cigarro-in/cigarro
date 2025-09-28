import React from 'react';
import { Package, Plus, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Product, DashboardTab } from '../types/index';

interface DashboardOverviewTabProps {
  products: Product[];
  onTabChange: (tab: DashboardTab) => void;
  onAddVariant: () => void;
}

export function DashboardOverviewTab({ 
  products, 
  onTabChange, 
  onAddVariant 
}: DashboardOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products.slice(0, 5).map(product => (
              <div key={product.id} className="flex items-center gap-3">
                {product.image_url && (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ₹{product.price} • Stock: {product.stock}
                  </p>
                </div>
                <Badge variant={product.is_active ? "default" : "secondary"}>
                  {product.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
            {products.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No products found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={() => onTabChange('products')}
          >
            <Package className="h-4 w-4 mr-2" />
            Manage Products
          </Button>
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={onAddVariant}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Variant
          </Button>
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={() => onTabChange('analytics')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
