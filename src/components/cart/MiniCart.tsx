import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, ShoppingBag } from 'lucide-react';
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
          <>
            {/* Desktop MiniCart - Keep original design */}
            <motion.div
              key="mini-cart-container-desktop"
              initial={{ opacity: 0, transform: 'translate(10%)' }}
              animate={{ opacity: 1, transform: 'translate(0%)' }}
              exit={{ opacity: 0, transform: 'translate(10%)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="mini-cart hidden md:block fixed top-[60px] right-2 sm:right-4 w-[445px] max-w-[445px] max-h-[calc(100vh-77px)] z-50"
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
                        const itemId = item.id || `unknown-${index}`;
                        const variantId = item.variant_id || 'base';
                        const comboId = item.combo_id || 'none';
                        const itemKey = `cart-item-${itemId}-${variantId}-${comboId}-${index}`;
                        
                        return (
                          <div key={itemKey} className="mini-cart__product flex p-[18px_7px_18px_21px] border-b border-coyote">
                            {/* Product Image */}
                            <div className="mini-cart__product-image-container flex-shrink-0">
                              <img
                                src={getProductImageUrl(item.gallery_images?.[0] || item.image)}
                                alt={item.name}
                                className="mini-cart__product-image w-[68px] h-[71px] rounded-[5px] bg-white block object-cover"
                              />
                            </div>

                            {/* Product Info */}
                            <div className="mini-cart__product-infos ml-6 flex flex-col items-start py-4 flex-1 justify-start min-w-0">
                              <p className="mini-cart__product-title text-dark font-sans font-bold text-base uppercase tracking-tight pr-[10px] leading-tight truncate">
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

                              <p className="text-dark font-sans text-sm mt-1">
                                {item.quantity} x {formatINR(itemPrice)}
                              </p>
                              <p className="text-dark font-sans font-medium text-sm mt-1">
                                {formatINR(itemPrice * item.quantity)}
                              </p>
                            </div>

                            {/* Remove Button */}
                            <div className="mini-cart__product-delete flex items-center justify-center ml-auto">
                              <button
                                onClick={() => handleRemoveItem(item.id, item.variant_id, item.combo_id)}
                                className="mini-cart__product-delete-btn cursor-pointer w-12 h-12 flex items-center justify-center hover:scale-110 transition-transform duration-200 rounded-full hover:bg-creme-light"
                              >
                                <X className="w-6 h-6 text-dark" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cart Total */}
                    <div className="mini-cart__total flex justify-between items-center p-[18px_21px] font-sans">
                      <span className="text-dark font-medium text-lg">Subtotal</span>
                      <span className="text-dark font-medium text-lg">{formatINR(totalPrice)}</span>
                    </div>

                    {/* Cart Controls */}
                    <div className="mini-cart__controls text-center px-[21px] pb-[28px]">
                      <button
                        className="mini-cart__proceed inline-block w-full bg-dark text-creme-light py-3 rounded-full font-medium hover:bg-creme-light hover:text-dark transition-colors duration-300 text-sm uppercase tracking-wide mb-[23px]"
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

            {/* Mobile Cart Sidebar - Standardized Mobile Sidebar */}
            <div
              className="md:hidden fixed inset-0 z-[9999] transition-opacity duration-300 opacity-100 pointer-events-auto"
              onClick={onClose}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/50" />

              {/* Right-side drawer - Standardized Mobile Sidebar */}
              <motion.div
                initial={{ transform: 'translateX(100%)' }}
                animate={{ transform: 'translateX(0%)' }}
                exit={{ transform: 'translateX(100%)' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-l border-border shadow-xl flex flex-col"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                  {/* FROZEN HEADER */}
                  <div className="flex-shrink-0 p-4 border-b border-border bg-background/95 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={onClose}
                        className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 hover:bg-muted/50"
                        aria-label="Close cart"
                      >
                        <X className="w-6 h-6 text-foreground" />
                      </button>
                      <h2 className="text-foreground font-sans font-semibold text-lg flex-1">Shopping Cart</h2>
                    </div>
                    {items.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {items.reduce((total, item) => total + item.quantity, 0)} {items.reduce((total, item) => total + item.quantity, 0) === 1 ? 'item' : 'items'} in cart
                      </div>
                    )}
                  </div>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto overscroll-y-bounce">
                  {items.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-foreground font-sans font-semibold text-lg mb-2">Your cart is empty</h3>
                      <p className="text-muted-foreground font-sans mb-4">
                        Add some products to get started
                      </p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="space-y-4">
                        {items.map((item, index) => {
                          const itemPrice = getCartItemPrice(item);
                          const itemId = item.id || `unknown-${index}`;
                          const variantId = item.variant_id || 'base';
                          const comboId = item.combo_id || 'none';
                          const itemKey = `mobile-cart-item-${itemId}-${variantId}-${comboId}-${index}`;
                          
                          return (
                            <div key={itemKey} className="flex items-center gap-3 p-3 rounded-lg border border-border/20 hover:border-border/40 transition-colors">
                              {/* Product Image */}
                              <div className="flex-shrink-0">
                                <img
                                  src={getProductImageUrl(item.gallery_images?.[0] || item.image)}
                                  alt={item.name}
                                  className="w-16 h-16 rounded-lg object-cover bg-white"
                                />
                              </div>

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-foreground font-sans font-semibold text-sm leading-tight line-clamp-2 mb-1">
                                  {item.name}
                                </h4>

                                {/* Variant/Combo Info */}
                                {item.variant_name && (
                                  <p className="text-muted-foreground text-xs mb-1">
                                    Variant: {item.variant_name}
                                  </p>
                                )}

                                {item.combo_name && (
                                  <p className="text-accent text-xs font-semibold mb-1">
                                    Combo Pack
                                  </p>
                                )}

                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground text-sm">
                                    Qty: {item.quantity}
                                  </span>
                                  <span className="text-foreground font-bold text-sm">
                                    {formatINR(itemPrice * item.quantity)}
                                  </span>
                                </div>
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => handleRemoveItem(item.id, item.variant_id, item.combo_id)}
                                className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-200 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                aria-label="Remove item"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* FROZEN FOOTER */}
                {items.length > 0 && (
                  <div className="flex-shrink-0 p-4 border-t border-border bg-background/95 backdrop-blur-sm">
                    {/* Total */}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-foreground font-sans font-semibold text-lg">Total</span>
                      <span className="text-foreground font-sans font-bold text-xl">{formatINR(totalPrice)}</span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <button
                        className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors duration-300 text-sm uppercase tracking-wide"
                        onClick={() => {
                          onClose();
                          if (user) {
                            navigate('/checkout');
                          } else {
                            setShowAuthDialog(true);
                          }
                        }}
                      >
                        Proceed to Checkout
                      </button>
                      <Link
                        to="/cart"
                        className="block w-full text-center text-foreground font-sans text-sm py-2 hover:text-accent transition-colors"
                        onClick={onClose}
                      >
                        View Full Cart
                      </Link>
                    </div>
                  </div>
                )}
                
                {items.length === 0 && (
                  <div className="flex-shrink-0 p-4 border-t border-border bg-background/95 backdrop-blur-sm">
                    <Link
                      to="/products"
                      className="block w-full text-center bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors duration-300 text-sm uppercase tracking-wide"
                      onClick={onClose}
                    >
                      Continue Shopping
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>
          </>
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
