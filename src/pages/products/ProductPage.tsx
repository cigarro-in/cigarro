import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { buildRoute } from '../../config/routes';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ShoppingCart, Star, ShieldCheck, Truck, Gem, Package, ExternalLink, ChevronLeft, ChevronRight, Minus, Plus, Check, Heart, ChevronDown, ChevronUp, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { VariantSelector } from '../../components/variants/VariantSelector';
import { ComboDisplayComponent } from '../../components/variants/VariantSelector';
import { ProductVariant, ProductCombo } from '../../types/variants';
import { formatINR } from '../../utils/currency';
import { ProductCard } from '../../components/products/ProductCard';
import { SEOHead } from '../../components/seo/SEOHead';
import { BreadcrumbSchema } from '../../components/seo/BreadcrumbSchema';

interface ProductDetails {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  short_description?: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin?: string;
  pack_size?: string;
  specifications?: any;
  gallery_images: string[];
  meta_title: string;
  meta_description: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
}

function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [combos, setCombos] = useState<ProductCombo[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [brandProducts, setBrandProducts] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    description: true,
    details: false,
    specifications: false,
    shipping: false,
    reviews: false
  });
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [shouldLoadBrandSection, setShouldLoadBrandSection] = useState(false);
  const [shouldLoadRecommended, setShouldLoadRecommended] = useState(false);
  const brandSectionRef = useRef<HTMLDivElement>(null);
  const recommendedSectionRef = useRef<HTMLDivElement>(null);
  const { addToCart, addVariantToCart, addComboToCart, isLoading } = useCart();
  const { isWishlisted, toggleWishlist, isLoading: wishlistLoading } = useWishlist();

  // Reset to first image when variant changes
  useEffect(() => {
    setActiveImage(0);
  }, [selectedVariant]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!slug) return;
      
      try {
        // Fetch product details
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, name, slug, brand, price, description, short_description, stock, is_active, rating, review_count, origin, pack_size, specifications, gallery_images, meta_title, meta_description, og_title, og_description, og_image, twitter_title, twitter_description, twitter_image')
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

      } catch (error) {
        console.error('Error fetching product data:', error);
        toast.error('Failed to load product details.');
      }
    };
    
    fetchProduct();
  }, [slug]);

  // Lazy load brand products when section is visible
  useEffect(() => {
    if (!shouldLoadBrandSection || !product) return;

    const fetchBrandProducts = async () => {
      try {
        const { data: brandData, error: brandError } = await supabase
          .from('products')
          .select('id, name, slug, brand, price, gallery_images, rating')
          .eq('brand', product.brand)
          .neq('id', product.id)
          .eq('is_active', true)
          .limit(3);

        if (!brandError && brandData) {
          setBrandProducts(brandData);
        }
      } catch (error) {
        console.error('Error fetching brand products:', error);
      }
    };

    fetchBrandProducts();
  }, [shouldLoadBrandSection, product]);

  // Lazy load recommended products when section is visible
  useEffect(() => {
    if (!shouldLoadRecommended || !product) return;

    const fetchRecommendedProducts = async () => {
      try {
        const { data: allProducts, error: allProductsError } = await supabase
          .from('products')
          .select('id, name, slug, brand, price, gallery_images, rating')
          .neq('id', product.id)
          .eq('is_active', true)
          .limit(20);

        if (!allProductsError && allProducts) {
          const shuffled = allProducts.sort(() => Math.random() - 0.5);
          setSimilarProducts(shuffled.slice(0, 8));
        }
      } catch (error) {
        console.error('Error fetching recommended products:', error);
      }
    };

    fetchRecommendedProducts();
  }, [shouldLoadRecommended, product]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!product) return; // Wait for product to load

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === brandSectionRef.current) {
              setShouldLoadBrandSection(true);
            } else if (entry.target === recommendedSectionRef.current) {
              setShouldLoadRecommended(true);
            }
          }
        });
      },
      { rootMargin: '200px' } // Start loading 200px before section is visible
    );

    if (brandSectionRef.current) {
      observer.observe(brandSectionRef.current);
    }
    if (recommendedSectionRef.current) {
      observer.observe(recommendedSectionRef.current);
    }

    return () => observer.disconnect();
  }, [product]);

  const animateDropToCart = () => {
    try {
      // Only on mobile
      if (typeof window === 'undefined' || window.innerWidth >= 768) return;
      if (!product) return;

      const cartTarget = document.getElementById('mobile-cart-target');
      if (!cartTarget) return;

      const targetRect = cartTarget.getBoundingClientRect();
      const width = 24;
      const height = 28;

      const startLeft = targetRect.left + (targetRect.width - width) / 2;
      const startTop = targetRect.top - height - 14;
      const endLeft = targetRect.left + (targetRect.width - width) / 2;
      const endTop = targetRect.top + (targetRect.height - height) / 2;

      const imgUrl = product.gallery_images?.[0] || '';
      const circle = document.createElement('div');
      circle.style.position = 'fixed';
      circle.style.left = `${startLeft}px`;
      circle.style.top = `${startTop}px`;
      circle.style.width = `${width}px`;
      circle.style.height = `${height}px`;
      circle.style.borderRadius = '9999px';
      circle.style.backgroundColor = '#433c35';
      circle.style.backgroundImage = `url(${imgUrl})`;
      circle.style.backgroundSize = 'cover';
      circle.style.backgroundPosition = 'center';
      circle.style.outline = '2px solid #433c35';
      circle.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)';
      circle.style.zIndex = '2147483647';
      circle.style.pointerEvents = 'none'; // Allow clicks to pass through
      document.body.appendChild(circle);

      const drop = circle.animate(
        [
          { transform: 'translate3d(0,0,0)', opacity: 1 },
          { transform: `translate3d(${endLeft - startLeft}px,${endTop - startTop}px,0)`, opacity: 0.3 }
        ],
        { duration: 400, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
      );

      drop.onfinish = () => {
        circle.remove();
        const cartTarget = document.getElementById('mobile-cart-target');
        if (cartTarget) {
          cartTarget.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.15)' },
              { transform: 'scale(1)' }
            ],
            { duration: 120, easing: 'ease-out' }
          );
        }
      };
    } catch (err) {
      // Ignore animation errors
    }
  };

  const handleAddToCart = async () => {
    if (!product) {
      console.log('No product found');
      return;
    }
    
    console.log('Adding to cart:', { product: product.name, quantity, selectedVariant });
    setIsAddingToCart(true);
    
    try {
      if (selectedVariant) {
        // Add variant to cart
        console.log('Adding variant to cart');
        await addVariantToCart(product, selectedVariant, quantity);
        toast.success(`Added ${quantity}x ${product.name} (${selectedVariant.variant_name}) to cart`);
      } else {
        // Add base product to cart
        console.log('Adding base product to cart');
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
        toast.success(`Added ${quantity}x ${product.name} to cart`);
      }
      
      // Trigger drop-to-cart animation
      animateDropToCart();
      
      // Show success feedback and reset quantity
      setShowAddedFeedback(true);
      setQuantity(1);
      console.log('Product added successfully');
      
      // Hide feedback after 2 seconds
      setTimeout(() => {
        setShowAddedFeedback(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart. Please try again.');
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

  const handleWishlistToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!product) return;

    try {
      await toggleWishlist(product.id);
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  return (
    <>
      <SEOHead
        title={selectedVariant 
          ? `${product.name} - ${selectedVariant.variant_name} | ${product.brand}`
          : product.meta_title || `${product.name} | ${product.brand} | Cigarro`
        }
        description={(selectedVariant as any)?.meta_description || product.meta_description || product.short_description || product.description}
        keywords={[
          product.brand,
          product.name,
          'premium cigarettes',
          'buy online India',
          'authentic tobacco',
          selectedVariant?.variant_name || '',
          product.origin || ''
        ].filter(Boolean)}
        image={gallery[0] || product.gallery_images[0]}
        url={`https://cigarro.in${location.pathname}`}
        type="product"
        price={getCurrentPrice().toString()}
        currency="INR"
        availability={product.stock > 0 ? 'in stock' : 'out of stock'}
        brand={product.brand}
        category={product.pack_size || 'Cigarettes'}
        ogTitle={product.og_title}
        ogDescription={product.og_description}
        ogImage={product.og_image}
        twitterTitle={product.twitter_title}
        twitterDescription={product.twitter_description}
        twitterImage={product.twitter_image}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://cigarro.in' },
          { name: 'Products', url: 'https://cigarro.in/products' },
          { name: product.brand, url: `https://cigarro.in/brand/${product.brand.toLowerCase().replace(/\s+/g, '-')}` },
          { name: product.name, url: `https://cigarro.in/product/${product.slug}` }
        ]}
      />
      <Helmet>
        <meta name="product:price:amount" content={getCurrentPrice().toString()} />
        <meta name="product:price:currency" content="INR" />
      </Helmet>
      
      <div className="min-h-screen bg-creme md:bg-creme text-dark pb-24 md:pb-0">
        {/* Mobile Layout */}
        <div className="md:hidden">
          {/* Product Info at Top */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="px-6 pt-6 pb-4 bg-creme"
          >
            {/* First Row: Brand/Category + Wishlist */}
            <div className="flex items-start justify-between">
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.2 }}
                style={{
                  display: 'block',
                  color: '#433c35',
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: 'max(13px, 1.5vw)',
                  lineHeight: 1.6,
                  letterSpacing: '-0.02em',
                  marginBottom: 0,
                  maxWidth: '90%'
                }}
              >
                <span>{product.brand}</span>
              </motion.p>
              
              <button
                type="button"
                onClick={handleWishlistToggle}
                disabled={wishlistLoading}
                className="p-2 -mr-2 hover:bg-dark/5 rounded-full transition-colors touch-manipulation disabled:opacity-50"
              >
                <Heart 
                  className={`w-5 h-5 ${isWishlisted(product.id) ? 'fill-canyon text-canyon' : 'text-dark'}`}
                  strokeWidth={2}
                />
              </button>
            </div>
            
            {/* Second Row: Product Name */}
            <div className="-mt-3 mb-1">
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-dark font-light text-[2.5rem] leading-[1.1] tracking-tight"
                style={{ fontFamily: 'var(--font-family-serif)' }}
              >
                {product.name}
              </motion.h1>
            </div>
            
            {/* Fourth Row: Price */}
            <div>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{
                  color: '#433c35',
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 500,
                  fontSize: 'max(16px, 1.8vw)',
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatINR(getCurrentPrice())}
              </motion.p>
            </div>
          </motion.div>

          {/* Mobile Gallery - Carousel */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative bg-creme select-none px-4 py-6"
          >
            <div 
              className="aspect-square overflow-hidden relative rounded-lg bg-creme-light shadow-md"
              onTouchStart={(e) => {
                const touch = e.touches[0];
                setTouchStart(touch.clientX);
              }}
              onTouchMove={(e) => {
                if (!touchStart) return;
                const touch = e.touches[0];
                setTouchEnd(touch.clientX);
              }}
              onTouchEnd={() => {
                if (!touchStart || !touchEnd) return;
                const distance = touchStart - touchEnd;
                const isLeftSwipe = distance > 50;
                const isRightSwipe = distance < -50;
                
                if (isLeftSwipe) {
                  // Swipe left - next image (with loop)
                  setActiveImage((prev) => (prev + 1) % gallery.length);
                }
                if (isRightSwipe) {
                  // Swipe right - previous image (with loop)
                  setActiveImage((prev) => (prev - 1 + gallery.length) % gallery.length);
                }
                
                setTouchStart(null);
                setTouchEnd(null);
              }}
            >
              {/* Carousel Container */}
              <motion.div
                className="flex h-full"
                animate={{ x: `-${activeImage * 100}%` }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 40,
                  mass: 0.8
                }}
              >
                {gallery.map((img, index) => (
                  <div key={index} className="w-full h-full flex-shrink-0">
                    <ImageWithFallback
                      src={img}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ))}
              </motion.div>
              
              {/* Subtle Navigation Arrows */}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveImage((prev) => (prev - 1 + gallery.length) % gallery.length);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-creme/80 backdrop-blur-sm border border-coyote/20 flex items-center justify-center shadow-lg hover:bg-creme transition-all active:scale-95"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 18L9 12L15 6" stroke="#433C35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveImage((prev) => (prev + 1) % gallery.length);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-creme/80 backdrop-blur-sm border border-coyote/20 flex items-center justify-center shadow-lg hover:bg-creme transition-all active:scale-95"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 18L15 12L9 6" stroke="#433C35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}
              
              {/* Image Counter */}
              {gallery.length > 1 && (
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-dark/70 backdrop-blur-sm text-creme text-xs font-medium">
                  {activeImage + 1} / {gallery.length}
                </div>
              )}
            </div>
          </motion.div>

          {/* Mobile Product Details */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="px-6 py-8 space-y-8 bg-creme"
          >

            {/* About this product */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <h3 className="text-sm uppercase tracking-[0.2em] text-canyon font-semibold">About this product</h3>
              <p className="text-dark/80 text-sm leading-relaxed">
                {product.short_description || product.description}
              </p>
            </motion.div>

            {/* Variants */}
            {variants.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="pt-6 border-t border-coyote/30 space-y-3"
              >
                <VariantSelector
                  variants={variants}
                  selectedVariant={selectedVariant}
                  onVariantSelect={setSelectedVariant}
                  basePrice={product.price}
                  productName={product.name}
                />
                
                {/* Variant Attributes - Names Only */}
                {selectedVariant && selectedVariant.attributes && Object.keys(selectedVariant.attributes).length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-2 pb-1 -mx-6 pl-6 scrollbar-hide">
                    {Object.entries(selectedVariant.attributes).map(([key]) => (
                      <div key={key} className="flex-shrink-0 bg-creme/50 rounded-lg px-0 py-2 border border-coyote/10">
                        <span className="text-sm text-dark font-medium">{key.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Product Details - Collapsible */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="pt-6 border-t border-coyote/30"
            >
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, details: !prev.details }))}
                className="flex items-center justify-between w-full text-left mb-3"
              >
                <h3 className="text-sm uppercase tracking-[0.2em] text-canyon font-semibold">Product Details</h3>
                <motion.div
                  animate={{ rotate: expandedSections.details ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="w-4 h-4 text-canyon" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSections.details && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="space-y-3 bg-creme/50 rounded-2xl p-5 border border-coyote/20">
                {product.brand && (
                  <div className="flex justify-between items-center py-2 border-b border-coyote/10 last:border-0">
                    <span className="text-sm text-dark/60 font-medium">Brand</span>
                    <span className="text-sm text-dark font-semibold">{product.brand}</span>
                  </div>
                )}
                {product.origin && (
                  <div className="flex justify-between items-center py-2 border-b border-coyote/10 last:border-0">
                    <span className="text-sm text-dark/60 font-medium">Origin</span>
                    <span className="text-sm text-dark font-semibold">{product.origin}</span>
                  </div>
                )}
                {product.pack_size && (
                  <div className="flex justify-between items-center py-2 border-b border-coyote/10 last:border-0">
                    <span className="text-sm text-dark/60 font-medium">Pack Size</span>
                    <span className="text-sm text-dark font-semibold">{product.pack_size}</span>
                  </div>
                )}
                {product.stock !== undefined && (
                  <div className="flex justify-between items-center py-2 border-b border-coyote/10 last:border-0">
                    <span className="text-sm text-dark/60 font-medium">Availability</span>
                    <span className={`text-sm font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Specifications - Collapsible */}
            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="pt-6 border-t border-coyote/30"
              >
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, specifications: !prev.specifications }))}
                  className="flex items-center justify-between w-full text-left mb-3"
                >
                  <h3 className="text-sm uppercase tracking-[0.2em] text-canyon font-semibold">Specifications</h3>
                  <motion.div
                    animate={{ rotate: expandedSections.specifications ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-4 h-4 text-canyon" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {expandedSections.specifications && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="space-y-3 bg-creme/50 rounded-2xl p-5 border border-coyote/20">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b border-coyote/10 last:border-0">
                      <span className="text-sm text-dark/60 font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm text-dark font-semibold">{String(value)}</span>
                    </div>
                  ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Full Description */}
            {product.description && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="space-y-3 pt-6 border-t border-coyote/30"
              >
                <h3 className="text-sm uppercase tracking-[0.2em] text-canyon font-semibold">Full Description</h3>
                <p className="text-dark/70 text-sm leading-relaxed">
                  {product.description}
                </p>
              </motion.div>
            )}

            {/* Shipping Info */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="space-y-3 pt-6 border-t border-coyote/30"
            >
              <h3 className="text-sm uppercase tracking-[0.2em] text-canyon font-semibold mb-4">Shipping & Delivery</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 p-4 bg-creme/50 rounded-xl border border-coyote/20">
                  <div className="p-2 bg-canyon/10 rounded-lg flex-shrink-0">
                    <Truck className="w-5 h-5 text-canyon" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-dark">Free Shipping</p>
                    <p className="text-xs text-dark/60 mt-1">On orders above ₹999</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-creme/50 rounded-xl border border-coyote/20">
                  <div className="p-2 bg-canyon/10 rounded-lg flex-shrink-0">
                    <Zap className="w-5 h-5 text-canyon" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-dark">Same Day Delivery</p>
                    <p className="text-xs text-dark/60 mt-1">Available in select cities</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-creme/50 rounded-xl border border-coyote/20">
                  <div className="p-2 bg-canyon/10 rounded-lg flex-shrink-0">
                    <Package className="w-5 h-5 text-canyon" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-dark">Pan India Delivery</p>
                    <p className="text-xs text-dark/60 mt-1">We deliver across India</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Brand Section */}
            <div ref={brandSectionRef} className="pt-8 border-t border-coyote/30">
              {shouldLoadBrandSection && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Brand Header */}
                  <div className="mb-6">
                    <Link 
                      to={`/brand/${product.brand.toLowerCase().replace(/\s+/g, '-')}`}
                      className="flex items-center gap-4 mb-3 group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-dark flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <span className="text-creme text-2xl font-bold">
                          {product.brand.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-dark uppercase tracking-wide group-hover:text-canyon transition-colors">{product.brand}</h3>
                        <p className="text-sm text-dark/60 mt-0.5">Premium Quality Products</p>
                      </div>
                    </Link>
                    <p className="text-sm text-dark/70 leading-relaxed mb-4">
                      Discover the finest selection from {product.brand}, known for exceptional quality and craftsmanship. Each product is carefully curated to meet the highest standards.
                    </p>
                  </div>

                  {/* Brand Products - 2.5 cards visible */}
                  {brandProducts.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm uppercase tracking-[0.2em] text-canyon font-semibold mb-4">More from {product.brand}</h4>
                  <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory scrollbar-hide">
                    {brandProducts.map((brandProduct, index) => (
                      <div key={brandProduct.id} className="flex-shrink-0 w-[calc(40%-6px)] snap-start">
                        <ProductCard 
                          product={brandProduct} 
                          index={index}
                          onAddToCart={(prod) => addToCart(prod, 1)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

                  {/* Visit Brand Page Button */}
                  <Link
                    to={`/brand/${product.brand.toLowerCase().replace(/\s+/g, '-')}`}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-dark text-creme rounded-xl font-semibold text-sm uppercase tracking-wide hover:bg-dark/90 transition-all group"
                  >
                    <span>Explore {product.brand}</span>
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      className="group-hover:translate-x-1 transition-transform"
                    >
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </motion.div>
              )}
            </div>

            {/* Recommended Products Section */}
            <div ref={recommendedSectionRef} className="pt-8 border-t border-coyote/30">
              {shouldLoadRecommended && similarProducts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="text-lg font-bold text-dark mb-4">You May Also Like</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {similarProducts.map((similarProduct, index) => (
                      <ProductCard 
                        key={similarProduct.id} 
                        product={similarProduct} 
                        index={index}
                        onAddToCart={(prod) => addToCart(prod, 1)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
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
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="md:hidden fixed bottom-16 left-0 right-0 z-[90] bg-creme border-t border-coyote/20 safe-area-bottom"
        >
          <div className="px-5 py-3">
            <div className="flex items-center gap-2">
              {/* Quantity Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-full border-2 border-dark/40 flex items-center justify-center disabled:opacity-30 transition-all hover:border-dark/60 active:bg-dark/5"
                >
                  <svg width="16" height="2" viewBox="0 0 19 3" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 1.5L1 1.5" stroke="#433C35" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <p 
                  className="min-w-[1.5rem] text-center"
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: '#433c35'
                  }}
                >
                  {quantity}
                </p>

                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  className="w-10 h-10 rounded-full border-2 border-dark/40 flex items-center justify-center disabled:opacity-30 transition-all hover:border-dark/60 active:bg-dark/5"
                >
                  <svg width="16" height="16" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.5 1V18" stroke="#433C35" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M18 9.5L1 9.5" stroke="#433C35" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Add to Cart Button */}
              <motion.button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Add to cart button clicked');
                  if (!isAddingToCart) {
                    handleAddToCart();
                  }
                }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 h-10 bg-dark text-creme rounded-full transition-all hover:bg-dark/90 active:shadow-inner"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                <AnimatePresence mode="wait">
                  {showAddedFeedback ? (
                    <motion.span
                      key="added"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      Added ✓
                    </motion.span>
                  ) : isAddingToCart ? (
                    <motion.span
                      key="adding"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Adding...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="add"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Add to cart
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Buy Now Button */}
              <motion.button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Buy now clicked');
                  
                  // Clear any stale retry payment data
                  sessionStorage.removeItem('isRetryPayment');
                  sessionStorage.removeItem('retryOrder');
                  
                  // Store buy now item in sessionStorage
                  const buyNowItem = {
                    ...product,
                    quantity,
                    variant_id: selectedVariant?.id,
                    variant_name: selectedVariant?.variant_name,
                    variant_price: selectedVariant?.price
                  };
                  
                  sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
                  sessionStorage.setItem('isBuyNow', 'true');
                  
                  // Navigate to checkout with buynow param
                  navigate(buildRoute.checkoutWithParams({ buynow: true }));
                }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 h-10 bg-canyon text-creme rounded-full transition-all hover:bg-canyon/90 active:shadow-inner"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Buy Now
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export default ProductPage;
