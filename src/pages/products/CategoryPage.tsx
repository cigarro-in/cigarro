import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { Product } from '../../hooks/useCart';
import { toast } from 'sonner';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/ui/button';
import { Grid3X3, Grid2X2, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { SEOHead } from '../../components/seo/SEOHead';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  meta_title: string;
  meta_description: string;
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'two-col'>('grid');
  const [showMobileSort, setShowMobileSort] = useState(false);
  const { addToCart, isLoading: cartLoading } = useCart();

  const isProductsPage = location.pathname === '/products';

  // Get search query from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    if (isProductsPage) {
      fetchAllProducts();
    } else if (slug) {
      fetchCategory();
    }
  }, [slug, isProductsPage, searchQuery]);

  const fetchAllProducts = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, name, slug, brand_id, description, is_active, created_at, brand:brands(id, name), product_variants(id, variant_name, price, is_default, is_active, images)')
        .eq('is_active', true);

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      const transformedProducts = (data || []).map((p: any) => ({
        ...p,
        brand: Array.isArray(p.brand) ? p.brand[0] : p.brand
      }));
      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategory = async () => {
    if (!slug) return;
    setIsLoading(true);

    try {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const categoriesData = await response.json();
          const categoryData = categoriesData.find((c: any) => c.slug === slug);
          
          if (categoryData) {
            setCategory({
              id: categoryData.id,
              name: categoryData.name,
              description: categoryData.description,
              image: categoryData.image,
              meta_title: categoryData.meta_title || '',
              meta_description: categoryData.meta_description || ''
            });
            setProducts(categoryData.products || []);
            return;
          }
        }
      } catch (apiError) {
        console.log('API not available, using Supabase fallback');
      }

      const { data, error } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          description,
          image,
          meta_title,
          meta_description,
          products:product_categories!inner(
            order,
            products!inner(
              id,
              name,
              brand_id,
              brand:brands(id, name),
              description,
              is_active,
              slug,
              created_at,
              product_variants(id, variant_name, price, is_default, is_active, images)
            )
          )
        `)
        .eq('slug', slug)
        .eq('products.products.is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          navigate('/404');
          return;
        }
        throw error;
      }

      setCategory({
        id: data.id,
        name: data.name,
        description: data.description,
        image: data.image,
        meta_title: data.meta_title,
        meta_description: data.meta_description
      });

      const categoryProducts = (data.products?.map((pc: any) => pc.products).filter(Boolean) || [])
        .map((p: any) => ({
          ...p,
          brand: Array.isArray(p.brand) ? p.brand[0] : p.brand
        }));
      setProducts(categoryProducts);
    } catch (error) {
      console.error('Error fetching category:', error);
      toast.error('Failed to load category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product, 1);
      toast.success(`${product.name} added to cart!`);
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  // Sort products
  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => {
          const priceA = a.product_variants?.find((v: any) => v.is_default)?.price || 0;
          const priceB = b.product_variants?.find((v: any) => v.is_default)?.price || 0;
          return priceA - priceB;
        });
      case 'price-high':
        return sorted.sort((a, b) => {
          const priceA = a.product_variants?.find((v: any) => v.is_default)?.price || 0;
          const priceB = b.product_variants?.find((v: any) => v.is_default)?.price || 0;
          return priceB - priceA;
        });
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      default: // name
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [products, sortBy]);

  const pageTitle = category?.meta_title || category?.name || 'Products';
  const pageDescription = category?.meta_description || category?.description || 'Premium tobacco products';

  const sortOptions = [
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Newest First', value: 'newest' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text-dark mt-4 font-sans">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={[category?.name || 'tobacco products']}
      />

      <div className="min-h-screen bg-creme pb-16">
        {/* Header Section */}
        <div className="bg-creme-light border-b border-coyote/10">
          <div className="main-container py-12 md:py-20">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="font-serif text-3xl md:text-5xl text-dark mb-4">
                {category?.name || (searchQuery ? `Search: "${searchQuery}"` : 'All Products')}
              </h1>
              {category?.description && (
                <p className="text-dark/70 font-sans text-base md:text-lg leading-relaxed">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="main-container px-4 md:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Product Count */}
            <p className="text-dark/60 font-sans text-sm">
              {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'}
            </p>

            {/* Sort & View Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Mobile Sort Button */}
              <div className="sm:hidden flex-1">
                <Button
                  variant="outline"
                  onClick={() => setShowMobileSort(!showMobileSort)}
                  className="w-full h-11 justify-between border-coyote/30 bg-white"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" />
                    {sortOptions.find(o => o.value === sortBy)?.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMobileSort ? 'rotate-180' : ''}`} />
                </Button>
              </div>

              {/* Desktop Sort */}
              <div className="hidden sm:block">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] h-10 bg-white border-coyote/30">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {sortOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-white border border-coyote/30 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-dark text-creme-light' : 'text-dark hover:bg-creme-light'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('two-col')}
                  className={`p-2 rounded transition-colors ${viewMode === 'two-col' ? 'bg-dark text-creme-light' : 'text-dark hover:bg-creme-light'}`}
                >
                  <Grid2X2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Sort Dropdown */}
          {showMobileSort && (
            <div className="sm:hidden mt-3 bg-white border border-coyote/20 rounded-xl overflow-hidden shadow-lg">
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setShowMobileSort(false); }}
                  className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${sortBy === opt.value ? 'bg-canyon/10 text-canyon' : 'text-dark hover:bg-creme-light'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="main-container px-4 md:px-8">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-coyote/10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-creme-light flex items-center justify-center">
                <X className="w-8 h-8 text-coyote" />
              </div>
              <h3 className="text-xl font-serif text-dark mb-2">No products found</h3>
              <p className="text-dark/60 font-sans mb-6">Try browsing all products or check back later.</p>
              <Link to="/products">
                <Button>Browse All Products</Button>
              </Link>
            </div>
          ) : (
            <div className={`grid gap-4 md:gap-6 ${
              viewMode === 'grid' 
                ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' 
                : 'grid-cols-1 md:grid-cols-2'
            }`}>
              {sortedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  variant="default"
                  onAddToCart={handleAddToCart}
                  isLoading={cartLoading}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
