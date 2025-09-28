import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../../utils/supabase/client';
import { Product } from '../../hooks/useCart';
import { toast } from 'sonner';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/ui/button';
import { Heart, ShoppingCart, Star, ArrowRight } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { formatINR } from '../../utils/currency';

interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  meta_title: string;
  meta_description: string;
}

interface CategoryProduct {
  order: number;
  products: Product;
}

interface CategoryWithProducts extends Category {
  products: CategoryProduct[];
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const { addToCart, isLoading: cartLoading } = useCart();

  const isProductsPage = location.pathname === '/products';
  const productsPerPage = 12;
  
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
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
        .eq('is_active', true);

      // If there's a search query, filter products
      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
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
              brand,
              price,
              description,
              is_active,
              slug,
              gallery_images,
              rating,
              review_count,
              image,
              limited,
              created_at
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

      // Extract category info
      const categoryInfo: Category = {
        id: data.id,
        name: data.name,
        description: data.description,
        image: data.image,
        meta_title: data.meta_title,
        meta_description: data.meta_description
      };

      setCategory(categoryInfo);
      
      // Extract products from the nested structure
      const categoryProducts = data.products?.map((pc: any) => pc.products).filter(Boolean) || [];
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

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'newest':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default: // name
        return a.name.localeCompare(b.name);
    }
  });

  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  const totalPages = Math.ceil(sortedProducts.length / productsPerPage);

  const pageTitle = isProductsPage 
    ? (searchQuery ? `Search Results for "${searchQuery}"` : 'Premium Tobacco Products')
    : category?.meta_title || category?.name || 'Products';

  const pageDescription = isProductsPage
    ? (searchQuery 
        ? `Search results for "${searchQuery}" - Find the perfect tobacco products that match your preferences.`
        : 'Discover our complete collection of premium cigarettes, cigars, and tobacco products from world-renowned brands.')
    : category?.meta_description || category?.description || 'Premium tobacco products';

  if (isLoading) {
    return (
      <div className="main-container section">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text mt-4">Loading premium products...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle} - Cigarro</title>
        <meta name="description" content={pageDescription} />
      </Helmet>

      <div className="main-container section">
        {/* Header - Inspiration Style */}
        <div className="text-center mb-16">
          <h1 className="main-title mb-6">{pageTitle}</h1>
          {(category?.description || isProductsPage) && (
            <div className="text-wrapper text-center max-w-4xl mx-auto">
              <p className="text">
                {category?.description || (searchQuery 
                  ? `Found ${sortedProducts.length} products matching "${searchQuery}"`
                  : 'Explore our curated selection of premium tobacco products, carefully sourced from the finest growers worldwide.')}
              </p>
            </div>
          )}
        </div>

        {/* Enhanced Filters and Sorting */}
        <div className="bg-white rounded-xl shadow-sm border border-coyote/20 p-6 mb-12">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-6">
              <span className="text-dark font-sans font-medium text-lg">
                {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'} found
              </span>
              {!isLoading && sortedProducts.length === 0 && (
                <span className="text-canyon font-sans text-sm">
                  Try adjusting your search or browse all products
                </span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="text-dark font-sans font-medium text-base">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-creme-light border-2 border-coyote rounded-lg px-4 py-3 text-dark font-sans text-base focus:outline-none focus:ring-2 focus:ring-canyon focus:border-canyon transition-colors min-w-[200px]"
              >
                <option value="name">Name A-Z</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid - Inspiration Layout */}
        {paginatedProducts.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-coyote" />
            <h3 className="text-2xl font-serif text-dark mb-4">No products found</h3>
            <p className="text-dark/80 mb-8">We couldn't find any products in this category.</p>
            <Link
              to="/products"
              className="inline-block bg-dark text-creme-light px-6 py-3 rounded-full font-medium hover:bg-creme-light hover:text-dark transition-colors duration-300 uppercase tracking-wide text-sm"
            >
              Browse All Products
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {paginatedProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="list"
                onAddToCart={handleAddToCart}
                isLoading={cartLoading}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-coyote rounded-md text font-sans disabled:opacity-50 disabled:cursor-not-allowed hover:bg-creme-light transition-colors duration-300"
            >
              Previous
            </button>
            
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-md font-sans font-medium transition-colors duration-300 ${
                        currentPage === pageNum
                          ? 'bg-dark text-creme-light'
                          : 'border border-coyote hover:bg-creme-light'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  pageNum === currentPage - 2 ||
                  pageNum === currentPage + 2
                ) {
                  return (
                    <span key={pageNum} className="w-10 h-10 flex items-center justify-center text-coyote">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-coyote rounded-md text font-sans disabled:opacity-50 disabled:cursor-not-allowed hover:bg-creme-light transition-colors duration-300"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
