import React, { useState } from 'react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, ShoppingCart, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
// import { formatINR } from '../../utils/currency';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { AuthDialog } from '../../components/auth/AuthDialog';
import { getProductImageUrl } from '../../utils/supabase/storage';

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

interface CartItemProps {
  item: any;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  isLoading: boolean;
}

const CartItem: React.FC<CartItemProps> = ({ item, updateQuantity, removeFromCart, isLoading }) => {
  const [imageError, setImageError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    setIsUpdating(true);
    try {
      await updateQuantity(item.id, newQuantity);
    } catch (error) {
      toast.error('Failed to update quantity');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeFromCart(item.id);
      toast.success('Item removed from cart');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const lineTotal = item.price * item.quantity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="bg-background border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        {/* Product Image */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={!imageError ? getProductImageUrl(item.gallery_images?.[0]) : getProductImageUrl()}
            alt={item.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <Link to={`/product/${item.slug}`} className="group">
            <h3 className="font-medium text-foreground group-hover:text-accent transition-colors duration-200 line-clamp-2 leading-tight">
              {item.name}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground mt-1">{item.brand}</p>
          <p className="text-lg font-semibold text-foreground mt-2">₹{formatIndianPrice(item.price)}</p>
          <p className="text-sm text-muted-foreground mt-1">Quantity: {item.quantity}</p>
        </div>

        {/* Quantity Controls & Remove */}
        <div className="flex flex-col items-end gap-3">
          {/* Quantity Controls */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => handleQuantityChange(item.quantity - 1)}
              disabled={isUpdating || isLoading || item.quantity <= 1}
              className="w-8 h-8 rounded-md bg-background text-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center font-medium text-foreground text-sm">{item.quantity}</span>
            <button
              onClick={() => handleQuantityChange(item.quantity + 1)}
              disabled={isUpdating || isLoading}
              className="w-8 h-8 rounded-md bg-background text-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Remove Button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoading}
            className="text-red-500 hover:text-red-600 transition-colors duration-200 p-2 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            title="Remove from cart"
            aria-label="Remove item"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Subtotal for this item */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Subtotal:</span>
          <span className="text-base font-medium text-foreground">₹{formatIndianPrice(lineTotal)}</span>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-border bg-muted/50 rounded-lg p-4"
          >
            <p className="text-sm text-muted-foreground mb-3">
              Remove "{item.name}" from your cart?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                className="flex-1"
              >
                Remove
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const EmptyCart: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16 px-4"
  >
    <div className="max-w-sm mx-auto">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <ShoppingBag className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-3">Your Cart is Empty</h2>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        Discover our premium collection and start adding products to your cart.
      </p>
      <Link to="/products">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-300 px-6 py-3 w-full sm:w-auto">
          Start Shopping
          <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
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
}> = ({ totalPrice, totalItems, isLoading, onCheckout }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-background border border-border rounded-lg p-4 shadow-sm"
  >
    <h2 className="font-medium text-foreground text-lg mb-4 flex items-center">
      <Package className="w-5 h-5 mr-2 text-accent" />
      Order Summary
    </h2>

    <div className="space-y-3 mb-4">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
        <span className="font-medium text-foreground">₹{formatIndianPrice(totalPrice)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Shipping</span>
        <span className="text-accent font-medium">Free</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Tax</span>
        <span className="text-muted-foreground">Calculated at checkout</span>
      </div>
    </div>

    <div className="border-t border-border pt-3 mb-4">
      <div className="flex justify-between items-center">
        <span className="text-lg font-medium text-foreground">Total</span>
        <span className="text-xl font-bold text-foreground">₹{formatIndianPrice(totalPrice)}</span>
      </div>
    </div>

    <Button
      className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors duration-300 py-3 text-base font-medium touch-manipulation"
      disabled={isLoading}
      onClick={onCheckout}
    >
      <ShoppingCart className="w-5 h-5 mr-2" />
      {isLoading ? 'Processing...' : 'Proceed to Checkout'}
    </Button>

    {/* Security Badge */}
    <div className="mt-3 text-center">
      <p className="text-xs text-muted-foreground flex items-center justify-center">
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        Secure checkout
      </p>
    </div>
  </motion.div>
);

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
        <meta name="description" content="Review your items before checkout" />
      </Helmet>

      <div className="min-h-screen bg-background pt-20 pb-24">
        <div className="main-container px-4">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Shopping Cart
              {totalItems > 0 && (
                <span className="text-accent ml-2">({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">
              Review and modify your items before checkout
            </p>
          </div>

          {/* Content */}
          {items.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
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

                {/* Continue Shopping */}
                <div className="text-center lg:text-left">
                  <Link to="/products">
                    <Button variant="outline" className="border-border text-foreground hover:bg-muted transition-colors duration-300 px-6 py-3">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Desktop Sidebar Summary */}
              <div className="hidden lg:block">
                <CartSummary
                  totalPrice={totalPrice}
                  totalItems={totalItems}
                  isLoading={isLoading}
                  onCheckout={handleCheckout}
                />
              </div>

              {/* Mobile Sticky Summary above bottom nav */}
              <div className="lg:hidden sticky bottom-16 z-50 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-t border-border">
                <CartSummary
                  totalPrice={totalPrice}
                  totalItems={totalItems}
                  isLoading={isLoading}
                  onCheckout={handleCheckout}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auth Dialog */}
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
