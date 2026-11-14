import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useAuth, useAuthDialog } from '../../hooks/useAuth';

/**
 * Cart state and line actions for vivid's cart UI (desktop dropdown and mobile
 * drawer). Reads and writes go through the shared useCart hook. This adds only
 * the checkout sign-in gate and the inline error copy, so the two surfaces
 * cannot drift apart.
 */
export function useVividCartActions(onDone: () => void) {
  const cart = useCart();
  const { user } = useAuth();
  const { requestAuth } = useAuthDialog();
  const navigate = useNavigate();
  const [opError, setOpError] = useState<string | null>(null);

  const proceed = () => {
    onDone();
    if (user) {
      navigate('/checkout');
    } else {
      requestAuth({ onSuccess: () => navigate('/checkout') });
    }
  };

  const changeQty = (productId: string, next: number, variantId?: string, comboId?: string) => {
    setOpError(null);
    cart.updateQuantity(productId, next, variantId, comboId).catch(() => setOpError('Could not update quantity. Try again.'));
  };

  const remove = (productId: string, variantId?: string, comboId?: string) => {
    setOpError(null);
    cart.removeFromCart(productId, variantId, comboId).catch(() => setOpError('Could not remove this item. Try again.'));
  };

  return {
    items: cart.items,
    totalItems: cart.totalItems,
    totalPrice: cart.totalPrice,
    getCartItemPrice: cart.getCartItemPrice,
    user,
    opError,
    proceed,
    changeQty,
    remove,
  };
}
