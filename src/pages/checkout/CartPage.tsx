import React, { useState } from 'react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, ShoppingCart, Package, Shield, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { AuthDialog } from '../../components/auth/AuthDialog';
import { getProductImageUrl } from '../../lib/supabase/storage';
import { Card, CardContent } from '../../components/ui/card';

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

// Helper function to safely get brand name from various formats
const getBrandName = (brand: any): string => {
  if (!brand) return '';
  if (typeof brand === 'string') return brand;
  if (typeof brand === 'object') {
    if (Array.isArray(brand)) return brand[0]?.name || '';
    return brand.name || '';
  }
  return '';
};

interface CartItemProps {
  item: any;
  updateQuantity: (productId: string, quantity: number, variantId?: string, comboId?: string) => Promise<void>;
  removeFromCart: (productId: string, variantId?: string, comboId?: string) => Promise<void>;
  isLoading: boolean;
}

const CartItem = React.forwardRef<HTMLDivElement, CartItemProps>(({ item, updateQuantity, removeFromCart, isLoading }, ref) => {
  const [imageError, setImageError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      await updateQuantity(item.id, newQuantity, item.variant_id, item.combo_id);
    } catch (error) {
      console.error('❌ Failed to update quantity:', error);
      toast.error('Failed to update quantity');
    }
  };

  const handleRemove = async () => {
    try {
      await removeFromCart(item.id, item.variant_id, item.combo_id);
      toast.success('Item removed from cart');
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('❌ Failed to remove item:', error);
      toast.error('Failed to remove item');
    }
  };

  const lineTotal = item.price * item.quantity;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="group relative bg-card border-2 border-border/40 rounded-xl p-4 shadow-sm hover:border-accent/40 transition-all duration-300"
    >
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-muted/20 rounded-lg overflow-hidden flex-shrink-0 border border-border/20">
          <img
            src={!imageError ? getProductImageUrl((item as any).image || (item as any).product_variants?.[0]?.images?.[0] || (item as any).gallery_images?.[0]) : getProductImageUrl()}
            alt={item.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>

        {/* Product Info & Controls */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2">
              <Link to={`/product/${item.slug}`} className="group/link">
                <h3 className="font-sans font-bold text-foreground text-base sm:text-lg group-hover/link:text-accent transition-colors duration-200 line-clamp-2 leading-tight">
                  {item.name}{item.variant_name && ` (${item.variant_name})`}
                </h3>
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-muted-foreground hover:text-red-500 transition-colors duration-200 p-1 -mr-1 rounded-full hover:bg-red-500/10"
                aria-label="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {getBrandName(item.brand) && (
              <p className="text-xs text-accent font-medium uppercase tracking-wide mt-1">
                {getBrandName(item.brand)}
              </p>
            )}
          </div>

          <div className="flex justify-between items-end mt-3">
            {/* Price */}
            <div>
              <p className="text-lg font-bold text-foreground">₹{formatIndianPrice(lineTotal)}</p>
            </div>

            {/* Modern Quantity Controls */}
            <div className="flex items-center bg-muted/20 rounded-lg border border-border/20 overflow-hidden h-9">
              <button
                onClick={() => handleQuantityChange(item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="w-9 h-full flex items-center justify-center text-foreground hover:bg-accent hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground active:bg-accent/80"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="w-8 h-full flex items-center justify-center font-sans font-semibold text-foreground text-sm border-x border-border/10 bg-background/50">
                {item.quantity}
              </div>
              <button
                onClick={() => handleQuantityChange(item.quantity + 1)}
                className="w-9 h-full flex items-center justify-center text-foreground hover:bg-accent hover:text-white transition-colors active:bg-accent/80"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-card/95 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 rounded-xl border-2 border-red-500/20"
          >
            <p className="text-sm font-medium text-foreground mb-4 text-center">
              Remove this item from your cart?
            </p>
            <div className="flex gap-3 w-full max-w-[200px]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-9 border-border hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRemove}
                className="flex-1 h-9 bg-red-500 hover:bg-red-600 text-white"
              >
                Remove
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

CartItem.displayName = 'CartItem';

const EmptyCart: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-20 px-4"
  >
    <div className="max-w-md mx-auto">
      <div className="w-24 h-24 bg-accent/5 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-accent/10">
        <ShoppingBag className="w-10 h-10 text-accent" />
      </div>
      <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">Your Cart is Empty</h2>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        Looks like you haven't added any premium tobacco products yet. 
        Explore our collection to find your perfect match.
      </p>
      <Link to="/products">
        <Button className="bg-foreground text-background hover:bg-accent hover:text-white transition-all duration-300 px-8 py-6 h-auto text-base font-medium rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02]">
          Start Shopping
          <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
        </Button>
      </Link>
    </div>
  </motion.div>
);

const CartSummary: React.FC<{
  totalPrice: number;
  totalItems: number;
  isLoading: boolean;
  onCheckout: () => void;
  isMobile?: boolean;
}> = ({ totalPrice, totalItems, isLoading, onCheckout, isMobile = false }) => {
  if (isMobile) {
    // Compact, single-row mobile summary (no Card wrapper)
    return (
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <p className="text-xs text-muted-foreground font-medium mb-0.5">Total</p>
          <p className="text-xl font-bold text-foreground font-serif leading-none">₹{formatIndianPrice(totalPrice)}</p>
        </div>

        <Button
          className="flex-1 bg-foreground text-background hover:bg-accent hover:text-white transition-all duration-300 h-12 text-base font-bold rounded-xl shadow-md"
          disabled={isLoading}
          onClick={onCheckout}
        >
          Checkout
          <ShoppingCart className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-2 border-border/40 bg-card">
      <CardContent className="p-6">
        <>
          <h2 className="font-serif text-xl text-foreground mb-6 flex items-center">
            <Package className="w-5 h-5 mr-2 text-accent" />
            Order Summary
          </h2>

          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
              <span className="font-medium text-foreground">₹{formatIndianPrice(totalPrice)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Shipping</span>
              <span className="text-muted-foreground italic">Calculated at checkout</span>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">Total</span>
              <span className="text-2xl font-bold text-accent font-serif">₹{formatIndianPrice(totalPrice)}</span>
            </div>
          </div>
        </>

        <Button
          className="w-full bg-foreground text-background hover:bg-accent hover:text-white transition-all duration-300 h-12 sm:h-14 text-base font-bold rounded-xl shadow-md"
          disabled={isLoading}
          onClick={onCheckout}
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          {isLoading ? 'Processing...' : 'Proceed to Checkout'}
        </Button>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">
          <Shield className="w-4 h-4 text-accent" />
          <span>Secure checkout powered by Cigarro</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default function CartPage() {
  const { items, totalPrice, isLoading, updateQuantity, removeFromCart, totalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const handleCheckout = () => {
    if (user) {
      navigate('/checkout');
    } else {
      setShowAuthDialog(true);
    }
  };

  return (
    <>
      <Helmet>
        <title>{`My Cart (${totalItems}) - Cigarro`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-[100dvh] bg-background pb-32 sm:pb-20">
        {/* Sticky Minimal Header */}
        <div className="bg-background/95 backdrop-blur-sm sticky top-0 z-40 border-b border-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4 pt-4">
            <div className="text-center">
              <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-foreground">
                My Cart
              </h1>
            </div>
          </div>
        </div>

        <div className="main-container px-4 py-8">
          {items.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="max-w-6xl mx-auto">
              <div className="lg:grid lg:grid-cols-12 lg:gap-10 items-start">
                
                {/* Cart Items List */}
                <div className="lg:col-span-8 space-y-4">
                  <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                      <CartItem
                        key={`${item.id}-${item.variant_id || 'base'}-${item.combo_id || 'none'}-${index}`}
                        item={item}
                        updateQuantity={updateQuantity}
                        removeFromCart={removeFromCart}
                        isLoading={isLoading}
                      />
                    ))}
                  </AnimatePresence>

                  <div className="pt-6 text-center sm:text-left">
                    <Link to="/products">
                      <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Continue Shopping
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Desktop Summary Sidebar */}
                <div className="hidden lg:block lg:col-span-4 sticky top-28">
                  <CartSummary
                    totalPrice={totalPrice}
                    totalItems={totalItems}
                    isLoading={isLoading}
                    onCheckout={handleCheckout}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Bottom Sticky Summary */}
        {items.length > 0 && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/60 p-4 pb-4 safe-area-pb">
             <div className="max-w-md mx-auto">
               <CartSummary
                  totalPrice={totalPrice}
                  totalItems={totalItems}
                  isLoading={isLoading}
                  onCheckout={handleCheckout}
                  isMobile={true}
                />
             </div>
          </div>
        )}
      </div>

      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthSuccess={() => {
          setShowAuthDialog(false);
          navigate('/checkout');
        }}
        context="checkout"
      />
    </>
  );
}

