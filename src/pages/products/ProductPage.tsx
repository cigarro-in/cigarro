import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ShoppingCart, Star, ShieldCheck, Truck, Gem, Package, ExternalLink, ChevronLeft, ChevronRight, Minus, Plus, Check, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { useCart } from '../../hooks/useCart';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { VariantSelector } from '../../components/variants/VariantSelector';
import { ComboDisplayComponent } from '../../components/variants/VariantSelector';
import { ProductVariant, ProductCombo } from '../../types/variants';
import { formatINR } from '../../utils/currency';

interface ProductDetails {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  pack_size: string;
  specifications: any;
  gallery_images: string[];
  meta_title: string;
  meta_description: string;
}

function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [combos, setCombos] = useState<ProductCombo[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    description: true,
    details: false,
    shipping: false,
    reviews: false
  });
  const [isInWishlist, setIsInWishlist] = useState(false);
  const { addToCart, addVariantToCart, addComboToCart, isLoading } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      if (!slug) return;
      
      try {
        // Fetch product details
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, name, slug, brand, price, description, stock, is_active, rating, review_count, origin, pack_size, specifications, gallery_images, meta_title, meta_description')
          .eq('slug', slug)
          .single();

        if (productError) {
          toast.error('Failed to fetch product details.');
          return;
        }

        setProduct(productData);

        // Fetch variants
        const { data: variantsData, error: variantsError } = await supabase
          .from('product_variants')
          .select(`
            *,
            variant_images (*)
          `)
          .eq('product_id', productData.id)
          .eq('is_active', true)
          .order('sort_order');

        if (!variantsError && variantsData) {
          setVariants(variantsData);
        }

        // Fetch combos that include this product
        const { data: combosData, error: combosError } = await supabase
          .from('product_combos')
          .select(`
            *,
            combo_items (
              *,
              products (*),
              product_variants (*)
            )
          `)
          .eq('is_active', true)
          .contains('combo_items.product_id', [productData.id]);

        if (!combosError && combosData) {
          setCombos(combosData);
        }

        // Fetch similar products
        const { data: similarData, error: similarError } = await supabase
          .from('products')
          .select('id, name, slug, brand, price, gallery_images, rating')
          .eq('brand', productData.brand)
          .neq('id', productData.id)
          .eq('is_active', true)
          .limit(4);

        if (!similarError && similarData) {
          setSimilarProducts(similarData);
        }

      } catch (error) {
        console.error('Error fetching product data:', error);
        toast.error('Failed to load product details.');
      }
    };
    
    fetchProduct();
  }, [slug]);

  const handleAddToCart = async () => {
    if (!product) return;
    
    setIsAddingToCart(true);
    
    try {
      if (selectedVariant) {
        // Add variant to cart
        await addVariantToCart(product, selectedVariant, quantity);
        toast.success(`${product.name} ${selectedVariant.variant_name} (x${quantity}) added to cart`);
      } else {
        // Add base product to cart - using the same structure as ProductCard
        const productForCart = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          price: product.price,
          description: product.description,
          is_active: product.is_active,
          gallery_images: product.gallery_images,
          rating: product.rating,
          review_count: product.review_count,
        };
        await addToCart(productForCart, quantity);
        toast.success(`${product.name} (x${quantity}) added to cart`);
      }
      
      // Show success feedback and reset quantity
      setShowAddedFeedback(true);
      setQuantity(1);
      
      // Hide feedback after animation
      setTimeout(() => {
        setShowAddedFeedback(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleAddComboToCart = async (combo: ProductCombo) => {
    try {
      await addComboToCart(combo, quantity);
      toast.success(`${combo.name} (x${quantity}) added to cart`);
    } catch (error) {
      toast.error('Failed to add combo to cart');
    }
  };

  const handlePrevImage = () => {
    const gallery = getCurrentImages();
    setActiveImage(prev => prev === 0 ? gallery.length - 1 : prev - 1);
  };

  const handleNextImage = () => {
    const gallery = getCurrentImages();
    setActiveImage(prev => prev === gallery.length - 1 ? 0 : prev + 1);
  };

  const handleQuantityChange = (change: number) => {
    setQuantity(prev => Math.max(1, prev + change));
  };

  if (!product) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p>Loading...</p></div>;
  }

  const getCurrentPrice = () => {
    if (selectedVariant) {
      return selectedVariant.price;
    }
    return product.price;
  };

  const getCurrentImages = () => {
    if (selectedVariant) {
      const anyVariant: any = selectedVariant as any;
      const imgs = anyVariant.variant_images || anyVariant.images || [];
      if (Array.isArray(imgs) && imgs.length > 0) {
        return imgs.map((img: any) => img.image_url).filter(Boolean);
      }
    }
    return product.gallery_images || [];
  };

  const gallery = getCurrentImages();

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleWishlistToggle = () => {
    setIsInWishlist(!isInWishlist);
    toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <>
      <Helmet>
        <title>{product?.meta_title || product?.name || 'Product'}</title>
        <meta name="description" content={product?.meta_description || product?.description || 'Premium tobacco product'} />
        <link rel="canonical" href={`https://cigarro.in/product/${product?.slug}`} />
      </Helmet>
      
      <div className="min-h-screen bg-background md:bg-creme text-foreground md:text-dark pb-24 md:pb-0">
        {/* Mobile Layout */}
        <div className="md:hidden">
          {/* Mobile Gallery - Swipeable 1:1 aspect */}
          <div className="relative">
            <div className="aspect-square bg-white overflow-hidden">
              <ImageWithFallback
                src={gallery[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              
              {/* Touch-friendly navigation */}
              {gallery.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center text-white transition-all touch-manipulation"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center text-white transition-all touch-manipulation"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
              
              {/* Image counter */}
              {gallery.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                  {activeImage + 1} / {gallery.length}
                </div>
              )}
            </div>
            
            {/* Mobile thumbnail strip */}
            {gallery.length > 1 && (
              <div className="p-4 bg-background border-b border-border">
                <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
                  {gallery.map((img, index) => (
                    <button 
                      key={index} 
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        activeImage === index 
                          ? 'border-primary' 
                          : 'border-transparent'
                      }`}
                      onClick={() => setActiveImage(index)}
                    >
                      <ImageWithFallback 
                        src={img} 
                        alt={`${product.name} thumbnail ${index + 1}`} 
                        className="w-full h-full object-cover" 
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Product Info */}
          <div className="p-4 space-y-6">
            {/* Brand and Name */}
            <div>
              <p className="text-accent text-xs font-semibold uppercase tracking-wider font-sans mb-2">
                {product.brand}
              </p>
              <h1 className="text-foreground font-serif text-2xl font-normal leading-tight mb-3">
                {product.name}
              </h1>
              <div className="flex items-center justify-between">
                <span className="text-foreground font-bold text-2xl font-sans">
                  {formatINR(getCurrentPrice())}
                </span>
                <button
                  onClick={handleWishlistToggle}
                  className="p-2 rounded-full hover:bg-muted transition-colors touch-manipulation"
                >
                  <Heart className={`w-6 h-6 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                </button>
              </div>
            </div>

            {/* Rating */}
            {product.rating > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.rating} ({product.review_count} reviews)
                </span>
              </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">Select Variant</h3>
                <VariantSelector
                  variants={variants}
                  selectedVariant={selectedVariant}
                  onVariantSelect={setSelectedVariant}
                  basePrice={product.price}
                  productName={product.name}
                />
              </div>
            )}

            {/* Collapsible Sections */}
            <div className="space-y-4">
              {/* Description */}
              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleSection('description')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-foreground">Description</span>
                  {expandedSections.description ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                {expandedSections.description && (
                  <div className="px-4 pb-4">
                    <p className="text-muted-foreground leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleSection('details')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-foreground">Product Details</span>
                  {expandedSections.details ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                {expandedSections.details && (
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origin:</span>
                      <span className="text-foreground">{product.origin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pack Size:</span>
                      <span className="text-foreground">{product.pack_size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="text-foreground">{product.stock} available</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping */}
              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleSection('shipping')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-foreground">Shipping & Returns</span>
                  {expandedSections.shipping ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                {expandedSections.shipping && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-accent" />
                      <div>
                        <p className="text-foreground font-medium">Free Shipping</p>
                        <p className="text-sm text-muted-foreground">On orders over ₹999</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-accent" />
                      <div>
                        <p className="text-foreground font-medium">Easy Returns</p>
                        <p className="text-sm text-muted-foreground">30-day return policy</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Preserved */}
        <div className="hidden md:block w-full">
          <div className="px-8 py-16">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-24">
              {/* Large Image Gallery - More breathing room */}
              <div className="space-y-8">
                <div className="relative group">
                  <div className="aspect-square overflow-hidden bg-white rounded-2xl">
                    <ImageWithFallback
                      src={gallery[activeImage]}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    {/* Subtle Navigation Arrows */}
                    {gallery.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-sm"
                        >
                          <ChevronLeft className="w-4 h-4 text-dark" />
                        </button>
                        <button
                          onClick={handleNextImage}
                          className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-sm"
                        >
                          <ChevronRight className="w-4 h-4 text-dark" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Minimal Thumbnail Gallery */}
                {gallery.length > 1 && (
                  <div className="flex space-x-4 justify-center">
                    {gallery.map((img, index) => (
                      <button 
                        key={index} 
                        className={`w-16 h-16 overflow-hidden transition-all duration-300 ${
                          activeImage === index 
                            ? 'opacity-100 scale-110' 
                            : 'opacity-50 hover:opacity-75'
                        }`}
                        onClick={() => setActiveImage(index)}
                      >
                        <ImageWithFallback 
                          src={img} 
                          alt={`${product.name} thumbnail ${index + 1}`} 
                          className="w-full h-full object-cover" 
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Clean Product Details */}
              <div className="space-y-12 py-8">
                {/* Brand and Product Name */}
                <div className="space-y-6">
                  <div className="text-sm uppercase tracking-widest text-dark/60 font-medium">
                    {product.brand}
                  </div>
                  
                  <div className="space-y-2">
                    <h1 className="main-title text-dark leading-tight">
                      {product.name}
                    </h1>
                    
                    {/* Enhanced Price Display */}
                    <div className="flex items-baseline space-x-3">
                      <span className="text-3xl font-medium text-dark">
                        {formatINR(getCurrentPrice())}
                      </span>
                      {selectedVariant && selectedVariant.price !== product.price && (
                        <span className="text-xl text-dark/40 line-through">
                          {formatINR(product.price)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Variant Selection */}
                {variants.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm uppercase tracking-widest text-dark/60 font-medium">Variant</h3>
                    <VariantSelector
                      variants={variants}
                      selectedVariant={selectedVariant}
                      onVariantSelect={setSelectedVariant}
                      basePrice={product.price}
                      productName={product.name}
                    />
                  </div>
                )}

                {/* Quantity Controls - Circular buttons like reference site */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-8">
                    {/* Circular Quantity Controls - Larger with filled hover */}
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                        className="w-14 h-14 rounded-full border-2 border-coyote/40 flex items-center justify-center hover:bg-dark hover:border-dark hover:text-creme transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-dark"
                      >
                        <Minus className="w-5 h-5" strokeWidth={2} />
                      </button>
                      
                      <div className="w-16 h-14 flex items-center justify-center">
                        <span className="text-2xl font-medium text-dark">{quantity}</span>
                      </div>
                      
                      <button
                        onClick={() => handleQuantityChange(1)}
                        className="w-14 h-14 rounded-full border-2 border-coyote/40 flex items-center justify-center hover:bg-dark hover:border-dark hover:text-creme transition-all duration-300"
                      >
                        <Plus className="w-5 h-5" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Add to Cart Button - Fixed and properly styled */}
                    <button
                      onClick={handleAddToCart}
                      disabled={isAddingToCart}
                      className="px-10 h-14 text-lg font-medium rounded-full transition-all duration-300 bg-dark hover:bg-dark/90 text-creme shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {showAddedFeedback ? (
                        <div className="flex items-center">
                          <Check className="w-5 h-5 mr-2" />
                          <span>Added</span>
                        </div>
                      ) : (
                        'Add to cart'
                      )}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-4">
                  <h3 className="text-sm uppercase tracking-widest text-dark/60 font-medium">Description</h3>
                  <p className="text-dark/80 leading-relaxed text-base font-light">
                    {product.description}
                  </p>
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  <h3 className="text-sm uppercase tracking-widest text-dark/60 font-medium">Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-coyote/10">
                      <span className="text-sm text-dark/60">Origin</span>
                      <span className="text-sm text-dark">{product.origin}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-coyote/10">
                      <span className="text-sm text-dark/60">Pack Size</span>
                      <span className="text-sm text-dark">{product.pack_size}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Section */}
            <div className="mt-32 py-16 border-t border-coyote/20">
              <div className="text-center space-y-8">
                <h2 className="text-2xl font-light text-dark">About {product.brand}</h2>
                <p className="text-dark/60 max-w-2xl mx-auto leading-relaxed">
                  Discover the heritage and craftsmanship behind {product.brand}. Each product represents decades of tradition and commitment to excellence.
                </p>
                <div className="text-sm text-dark/40 uppercase tracking-widest">
                  More about this brand coming soon
                </div>
              </div>
            </div>

            {/* Similar Products */}
            {similarProducts.length > 0 && (
              <div className="mt-32 py-16 border-t border-coyote/20">
                <div className="text-center mb-16">
                  <h2 className="text-2xl font-light text-dark mb-4">You might also like</h2>
                  <p className="text-dark/60">More from {product.brand}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                  {similarProducts.map((similarProduct) => (
                    <div key={similarProduct.id} className="group cursor-pointer" onClick={() => navigate(`/product/${similarProduct.slug}`)}>
                      <div className="aspect-square overflow-hidden bg-white mb-4">
                        <ImageWithFallback
                          src={similarProduct.gallery_images?.[0]}
                          alt={similarProduct.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-light text-dark group-hover:text-canyon transition-colors">
                          {similarProduct.name}
                        </h3>
                        <p className="text-sm text-dark/60">{formatINR(similarProduct.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specifications */}
            <div className="mt-32 py-16 border-t border-coyote/20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-dark">Specifications</h2>
                  <div className="space-y-4">
                    {product.specifications && Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-2 border-b border-coyote/10">
                        <span className="text-sm text-dark/60 capitalize">{key.replace('_', ' ')}</span>
                        <span className="text-sm text-dark">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Enhanced Combo Packs Section */}
            {combos.length > 0 && (
              <div className="mt-32 py-16 border-t border-coyote/20">
                <div className="text-center mb-16">
                  <h2 className="text-2xl font-light text-dark mb-4">Combo Packs</h2>
                  <p className="text-dark/60">Curated combinations for the discerning connoisseur</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
                  {combos.map((combo) => (
                    <div key={combo.id} className="bg-white p-8 hover:shadow-lg transition-all duration-300">
                      <ComboDisplayComponent
                        combo={combo}
                        onAddToCart={() => handleAddComboToCart(combo)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sticky CTA Bar */}
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-[90] bg-background/95 backdrop-blur-sm border-t border-border p-4 safe-area-bottom">
          <div className="flex items-center gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center border border-border rounded-lg">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 hover:bg-muted transition-colors touch-manipulation"
                disabled={quantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 py-3 min-w-[3rem] text-center font-medium">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="p-3 hover:bg-muted transition-colors touch-manipulation"
                disabled={quantity >= product.stock}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={isAddingToCart || isLoading || product.stock === 0}
              className="flex-1 h-12 text-base font-medium"
            >
              {showAddedFeedback ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Added!
                </>
              ) : isAddingToCart ? (
                'Adding...'
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart • {formatINR(getCurrentPrice() * quantity)}
                </>
              )}
            </Button>

            {/* Wishlist Toggle */}
            <button
              onClick={handleWishlistToggle}
              className="p-3 border border-border rounded-lg hover:bg-muted transition-colors touch-manipulation"
            >
              <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductPage;
