import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff,
  Package,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

interface ProductVariantLite {
  id: string;
  price: number;
  is_default?: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price?: number; // legacy
  is_active: boolean;
  product_variants?: ProductVariantLite[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface FeaturedProductsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function FeaturedProductsManager({ open, onOpenChange, onUpdate }: FeaturedProductsManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsResult, categoriesResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, slug, is_active, product_variants(id, price, is_default, images)')
          .order('name'),
        supabase
          .from('categories')
          .select('id, name, slug')
          .order('name')
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && product.is_active) ||
      (statusFilter === 'inactive' && !product.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const handleToggleFeatured = async (productId: string, isFeatured: boolean) => {
    toast.info("Featured status is now managed via Collections. This feature is being migrated.");
    // Legacy logic removed as column is dropped
  };


  const featuredProducts = []; // specific featured column is removed

  const getProductPrice = (product: Product): number => {
    if (product.product_variants && product.product_variants.length > 0) {
      const def = product.product_variants.find(v => v.is_default) || product.product_variants[0];
      return def.price;
    }
    return product.price || 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Featured Products</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                    <p className="text-2xl font-bold">{products.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Featured Products</p>
                    <p className="text-2xl font-bold">{featuredProducts.length}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Featured</p>
                    <p className="text-2xl font-bold">{featuredProducts.length}</p>
                  </div>
                  <Filter className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full md:w-64"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                      {(product as any).product_variants?.[0]?.images?.[0] ? (
                        <img
                          src={(product as any).product_variants[0].images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">₹{getProductPrice(product).toLocaleString()}</p>
                      <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Use Collections to manage featured products")}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Products Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms.' : 'No products available.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>How it works:</strong> Featured products will appear in the "Curated Selection of Premium Tobacco" section on your homepage. 
              You can select multiple products and add/remove them from the featured collection in bulk.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}
