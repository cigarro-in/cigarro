import React, { useState } from 'react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, ShoppingCart, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR } from '../../utils/currency';
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
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-coyote/20"
    >
      <div className="p-6">
        <div className="flex items-center space-x-4">
          {/* Product Image */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-creme-light rounded-lg overflow-hidden flex-shrink-0">
            <img
              src={!imageError ? getProductImageUrl(item.gallery_images?.[0]) : getProductImageUrl()}
              alt={item.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <Link to={`/product/${item.slug}`}>
              <h3 className="text-lg font-semibold text-dark hover:text-canyon transition-colors duration-200 line-clamp-2">
                {item.name}
              </h3>
            </Link>
            <p className="text-sm text-dark/70 mt-1">{item.brand}</p>
            <p className="text-xl font-bold text-dark mt-2">₹{formatIndianPrice(item.price)}</p>
          </div>

          {/* Quantity Controls & Remove */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Quantity Controls */}
            <div className="flex items-center space-x-2 bg-creme-light rounded-lg p-1">
              <button
                onClick={() => handleQuantityChange(item.quantity - 1)}
                disabled={isUpdating || isLoading || item.quantity <= 1}
                className="w-8 h-8 rounded-md bg-white text-dark hover:bg-canyon hover:text-white transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-medium text-dark">{item.quantity}</span>
              <button
                onClick={() => handleQuantityChange(item.quantity + 1)}
                disabled={isUpdating || isLoading}
                className="w-8 h-8 rounded-md bg-white text-dark hover:bg-canyon hover:text-white transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Remove Button */}
            <button
              onClick={handleRemove}
              disabled={isLoading}
              className="text-red-500 hover:text-red-600 transition-colors duration-200 p-2 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove from cart"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subtotal for this item */}
        <div className="mt-4 pt-4 border-t border-coyote/20">
          <div className="flex justify-between items-center">
            <span className="text-sm text-dark/70">Subtotal:</span>
            <span className="text-lg font-medium text-dark">₹{formatIndianPrice(item.price * item.quantity)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const EmptyCart: React.FC = () => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-creme-light rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShoppingBag className="w-12 h-12 text-coyote" />
                </div>
                <h2 className="medium-title text-dark mb-4">Your Cart is Empty</h2>
                <p className="text text-dark/70 mb-8 leading-relaxed">
                  Discover our premium collection and start adding products to your cart.
                </p>
                <Link to="/products">
                  <Button className="bg-dark text-creme-light hover:bg-canyon transition-colors duration-300 px-8 py-3">
                    Start Shopping
                    <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                  </Button>
                </Link>
              </div>
            </motion.div>
);

export default function CartPage() {
  const { items, totalPrice, isLoading, updateQuantity, removeFromCart, totalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  return (
    <>
      <Helmet>
        <title>{`My Cart (${totalItems}) - Cigarro`}</title>
        <meta name="description" content="Review your items before checkout" />
      </Helmet>

      <div className="min-h-screen bg-creme pt-24 pb-12">
        <div className="main-container">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="main-title text-dark mb-6 max-w-4xl mx-auto">
              Shopping Cart
              {totalItems > 0 && (
                <span className="text-canyon"> ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
              )}
            </h1>
          </div>

        {/* Content */}
          {items.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
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
                </motion.div>

                {/* Continue Shopping */}
                <div className="mt-8">
                  <Link to="/products">
                    <Button variant="outline" className="border-coyote text-dark hover:bg-dark hover:text-creme-light transition-colors duration-300">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-xl shadow-lg p-6 sticky top-8 border border-coyote/20"
                >
                  <h2 className="font-medium text-dark text-lg mb-6 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-canyon" />
                    Order Summary
                  </h2>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-dark/70">Subtotal ({totalItems} items)</span>
                      <span className="font-medium text-dark">₹{formatIndianPrice(totalPrice)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-dark/70">Shipping</span>
                      <span className="text-canyon font-medium">Free</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-dark/70">Tax</span>
                      <span className="text-dark/70">Calculated at checkout</span>
                    </div>
                  </div>

                  <div className="border-t border-coyote/20 pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-dark">Total</span>
                      <span className="text-xl font-bold text-dark">₹{formatIndianPrice(totalPrice)}</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-canyon text-creme-light hover:bg-dark transition-colors duration-300 py-3 text-lg font-medium"
                    disabled={isLoading}
                    onClick={() => {
                      if (user) {
                        navigate('/checkout');
                      } else {
                        setShowAuthDialog(true);
                      }
                    }}
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {isLoading ? 'Processing...' : 'Proceed to Checkout'}
                  </Button>

                  {/* Security Badge */}
                  <div className="mt-4 text-center">
                    <p className="text-xs text-dark/60 flex items-center justify-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Secure checkout
                    </p>
                  </div>
                </motion.div>
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
