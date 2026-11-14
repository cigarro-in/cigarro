import { useCart } from '../useCart';

/**
 * One product line in the cart, identified by product and variant (the same
 * key addToCart and updateQuantity match on). Themes use it to show the
 * quantity on an add button and to step it. Quantity 0 means "not in cart".
 * Setting 0 removes the line (updateQuantity handles that).
 */
export function useCartLine(productId: string, variantId?: string) {
  const { items, updateQuantity } = useCart();
  const line = items.find((i) => i.id === productId && i.variant_id === variantId && !i.combo_id);

  return {
    quantity: line?.quantity ?? 0,
    setQuantity: (next: number) => updateQuantity(productId, next, variantId),
  };
}
