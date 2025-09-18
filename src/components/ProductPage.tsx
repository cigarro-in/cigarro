import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ShoppingCart, Star, ShieldCheck, Truck, Gem, Package, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useCart } from '../hooks/useCart';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { VariantSelector } from './variants/VariantSelector';
import { ComboDisplayComponent } from './variants/VariantSelector';
import { ProductVariant, ProductCombo } from '../types/variants';
import { formatINR } from '../utils/currency';

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
  strength: string;
  pack_size: string;
  specifications: any;
  ingredients: string[];
  gallery_images: string[];
  meta_title: string;
  meta_description: string;
}

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [combos, setCombos] = useState<ProductCombo[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const { addToCart, addVariantToCart, addComboToCart, isLoading } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      if (!slug) return;
      
      try {
        // Fetch product details
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, name, slug, brand, price, description, stock, is_active, rating, review_count, origin, strength, pack_size, specifications, ingredients, gallery_images, meta_title, meta_description')
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

  const handleAddToCart = async () => {
    if (!product) return;
    
    try {
      if (selectedVariant) {
        // Add variant to cart
        await addVariantToCart(product, selectedVariant, quantity);
        toast.success(`${product.name} ${selectedVariant.variant_name} (x${quantity}) added to cart`);
      } else {
        // Add base product to cart
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
    } catch (error) {
      toast.error('Failed to add to cart');
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
    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) {
      return selectedVariant.images.map(img => img.image_url);
    }
    return product.gallery_images || [];
  };

  const gallery = getCurrentImages();

  return (
    <>
      <Helmet>
        <title>{product?.meta_title || product?.name || 'Product'}</title>
        <meta name="description" content={product?.meta_description || product?.description || 'Premium tobacco product'} />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div>
            <div className="aspect-square rounded-lg overflow-hidden border border-border/20 mb-4">
              <ImageWithFallback
                src={gallery[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex space-x-2">
              {gallery.map((img, index) => (
                <button 
                  key={index} 
                  className={`w-16 h-16 rounded-md overflow-hidden border-2 ${activeImage === index ? 'border-accent' : 'border-transparent'}`}
                  onClick={() => setActiveImage(index)}
                >
                  <ImageWithFallback src={img} alt={`${product.name} thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Details */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground font-sans-premium">{product.brand}</p>
            <h1 className="font-serif-premium text-4xl sm:text-5xl text-foreground my-2">{product.name}</h1>
            
            <div className="flex items-center space-x-2 text-muted-foreground mb-4">
              <Star className="w-4 h-4 text-accent fill-accent" />
              <span>{product.rating}</span>
              <span>({product.review_count} reviews)</span>
            </div>

            {/* Price Display */}
            <div className="my-6">
              <p className="font-serif-premium text-5xl text-foreground">
                {formatINR(getCurrentPrice())}
                {selectedVariant && (
                  <span className="text-lg text-muted-foreground ml-2">
                    ({selectedVariant.variant_name})
                  </span>
                )}
              </p>
              {selectedVariant && selectedVariant.price !== product.price && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatINR(product.price)}
                </p>
              )}
            </div>

            {/* Variant Selection */}
            {variants.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Select Variant</h3>
                <VariantSelector
                  variants={variants}
                  selectedVariant={selectedVariant}
                  onVariantSelect={setSelectedVariant}
                  basePrice={product.price}
                  productName={product.name}
                />
              </div>
            )}

            <p className="text-muted-foreground leading-relaxed mb-8">{product.description}</p>

            <div className="grid grid-cols-2 gap-4 text-sm mb-8">
              <div><strong className="block text-foreground">Origin</strong> {product.origin}</div>
              <div><strong className="block text-foreground">Strength</strong> {product.strength}</div>
              <div><strong className="block text-foreground">Category</strong> Classic</div>
              <div><strong className="block text-foreground">Pack Size</strong> {product.pack_size}</div>
            </div>

            <div className="flex items-center space-x-4 mb-8">
              <div className="flex items-center border border-border/20 rounded-md">
                <Button variant="ghost" size="lg" onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</Button>
                <span className="w-16 text-center font-bold text-lg">{quantity}</span>
                <Button variant="ghost" size="lg" onClick={() => setQuantity(q => q + 1)}>+</Button>
              </div>
              <Button onClick={handleAddToCart} disabled={isLoading || !product.is_active} className="flex-1 gold-gradient text-primary" size="lg">
                <ShoppingCart className="w-5 h-5 mr-2" />
                {isLoading ? 'Adding...' : 'Add to Cart'}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-muted-foreground text-sm">
              <div className="flex flex-col items-center"><Truck className="w-6 h-6 mb-2 text-accent" /> Free Shipping</div>
              <div className="flex flex-col items-center"><ShieldCheck className="w-6 h-6 mb-2 text-accent" /> Secure Payment</div>
              <div className="flex flex-col items-center"><Gem className="w-6 h-6 mb-2 text-accent" /> Premium Quality</div>
            </div>
          </div>
        </div>

        <Separator className="my-12 bg-border/20" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-serif-premium text-3xl text-foreground mb-4">Specifications</h2>
            <div className="space-y-2 text-muted-foreground">
              {product.specifications && Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span>{key}</span>
                  <span className="text-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-serif-premium text-3xl text-foreground mb-4">Ingredients</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              {product.ingredients?.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        </div>

        {/* Combo Packs Section */}
        {combos.length > 0 && (
          <>
            <Separator className="my-12 bg-border/20" />
            <div className="mb-12">
              <h2 className="font-serif-premium text-3xl text-foreground mb-8 text-center">
                Available Combo Packs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {combos.map((combo) => (
                  <ComboDisplayComponent
                    key={combo.id}
                    combo={combo}
                    onAddToCart={() => handleAddComboToCart(combo)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
}
