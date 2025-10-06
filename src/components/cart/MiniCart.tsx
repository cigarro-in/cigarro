import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '../../utils/currency';
import { AuthDialog } from '../auth/AuthDialog';
import { getProductImageUrl } from '../../utils/supabase/storage';

interface MiniCartProps {
  isVisible: boolean;
  onClose: () => void;
}

export function MiniCart({ isVisible, onClose }: MiniCartProps) {
  const { items, removeFromCart, totalPrice, getCartItemPrice } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Debug: Log cart items to identify any issues
  React.useEffect(() => {
    if (items.length > 0) {
      console.log('MiniCart items:', items.map((item, index) => ({
        index,
        id: item.id,
        name: item.name,
        variant_id: item.variant_id,
        combo_id: item.combo_id
      })));
    }
  }, [items]);

  const handleRemoveItem = (productId: string, variantId?: string, comboId?: string) => {
    removeFromCart(productId, variantId, comboId);
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key="mini-cart-container"
            initial={{ opacity: 0, transform: 'translate(10%)' }}
            animate={{ opacity: 1, transform: 'translate(0%)' }}
            exit={{ opacity: 0, transform: 'translate(10%)' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mini-cart fixed top-[60px] right-2 sm:right-4 w-[calc(100vw-1rem)] sm:w-[445px] max-w-[calc(100vw-1rem)] sm:max-w-[445px] max-h-[calc(100vh-77px)] z-50"
            onMouseEnter={() => {}} // Keep cart open when hovering over it
            onMouseLeave={onClose}
          >
          <div className="mini-cart__inner bg-creme border border-coyote rounded-[5px] overflow-y-auto w-full h-full">
            {items.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-dark font-sans text-lg mb-4">Your cart is empty</p>
                <Link
                  to="/products"
                  className="inline-block bg-dark text-creme-light px-6 py-2 rounded-full font-medium hover:bg-creme-light hover:text-dark transition-colors duration-300 text-sm uppercase tracking-wide"
                  onClick={onClose}
                >
                  Continue Shopping
                </Link>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="divide-y divide-coyote">
                  {items.map((item, index) => {
                    const itemPrice = getCartItemPrice(item);
                    // Create a robust key that handles all edge cases
                    const itemId = item.id || `unknown-${index}`;
                    const variantId = item.variant_id || 'base';
                    const comboId = item.combo_id || 'none';
                    const itemKey = `cart-item-${itemId}-${variantId}-${comboId}-${index}`;
                    
                    return (
                      <div key={itemKey} className="mini-cart__product flex p-4 sm:p-[18px_7px_18px_21px] border-b border-coyote">
                        {/* Product Image */}
                        <div className="mini-cart__product-image-container flex-shrink-0">
                          <img
                            src={getProductImageUrl(item.gallery_images?.[0] || item.image)}
                            alt={item.name}
                            className="mini-cart__product-image w-12 h-12 sm:w-[68px] sm:h-[71px] rounded-[5px] bg-white block object-cover"
                          />
                        </div>

                        {/* Product Info */}
                        <div className="mini-cart__product-infos ml-3 sm:ml-6 flex flex-col items-start py-2 sm:py-4 flex-1 justify-start min-w-0">
                          <p className="mini-cart__product-title text-dark font-sans font-bold text-sm sm:text-base uppercase tracking-tight pr-2 sm:pr-[10px] leading-tight truncate">
                            {item.name}
                          </p>

                          {/* Variant/Combo Info */}
                          {item.variant_name && (
                            <p className="text-coyote font-sans text-xs mt-1 truncate">
                              Variant: {item.variant_name}
                            </p>
                          )}

                          {item.combo_name && (
                            <p className="text-accent font-sans text-xs mt-1 font-semibold">
                              Combo Pack
                            </p>
                          )}

                          <p className="text-dark font-sans text-xs sm:text-sm mt-1">
                            {item.quantity} x {formatINR(itemPrice)}
                          </p>
                          <p className="text-dark font-sans font-medium text-xs sm:text-sm mt-1">
                            {formatINR(itemPrice * item.quantity)}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <div className="mini-cart__product-delete flex items-center justify-center ml-2 sm:ml-auto">
                          <button
                            onClick={() => handleRemoveItem(item.id, item.variant_id, item.combo_id)}
                            className="mini-cart__product-delete-btn cursor-pointer w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center hover:scale-110 transition-transform duration-200 rounded-full hover:bg-creme-light"
                          >
                            <X className="w-4 h-4 sm:w-6 sm:h-6 text-dark" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cart Total */}
                <div className="mini-cart__total flex justify-between items-center p-4 sm:p-[18px_21px] font-sans">
                  <span className="text-dark font-medium text-base sm:text-lg">Subtotal</span>
                  <span className="text-dark font-medium text-base sm:text-lg">{formatINR(totalPrice)}</span>
                </div>

                {/* Cart Controls */}
                <div className="mini-cart__controls text-center p-4 sm:px-[21px] sm:pb-[28px]">
                  <button
                    className="mini-cart__proceed inline-block w-full bg-dark text-creme-light py-3 sm:py-3 rounded-full font-medium hover:bg-creme-light hover:text-dark transition-colors duration-300 text-sm uppercase tracking-wide mb-4 sm:mb-[23px]"
                    onClick={() => {
                      onClose();
                      if (user) {
                        navigate('/checkout');
                      } else {
                        setShowAuthDialog(true);
                      }
                    }}
                  >
                    Proceed to order
                  </button>
                  <Link
                    to="/cart"
                    className="text-dark font-sans text-sm underline hover:no-underline transition-all duration-300"
                    onClick={onClose}
                  >
                    View cart
                  </Link>
                </div>
              </>
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Auth Dialog */}
      {showAuthDialog && (
        <AuthDialog 
          key="mini-cart-auth-dialog"
          open={showAuthDialog} 
          onOpenChange={setShowAuthDialog}
          onAuthSuccess={() => {
            setShowAuthDialog(false);
            navigate('/checkout');
          }}
          context="checkout"
        />
      )}
    </>
  );
} 
