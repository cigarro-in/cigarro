/**
 * Transfers guest cart and wishlist data to a new user account.
 *
 * Phase 1 (Convex migration): the useCart/useWishlist hooks now merge guest
 * localStorage data into Convex-backed server state themselves on user
 * change. This util therefore only nudges the hooks to reload — it must NOT
 * write to the legacy Supabase tables or clear localStorage early, or guest
 * items would bypass the Convex merge and be lost.
 */
export const transferGuestDataToUser = async (userId: string): Promise<void> => {
  try {
    // Dispatch events to update UI counters; hooks merge guest data.
    window.dispatchEvent(new Event('cartUpdated'));
    window.dispatchEvent(new Event('wishlistUpdated'));
  } catch (error) {
    console.error('Error transferring guest data to user:', error);
    // Don't show error to user as this is a background operation
    // The cart/wishlist will still work from localStorage if transfer fails
  }
};

/**
 * Checks if this is a new user signup vs existing user login.
 * Phase 1: local-only check — hooks dedupe against server state on merge,
 * so the only question is whether guest data exists at all.
 */
export const shouldTransferGuestData = async (userId: string): Promise<boolean> => {
  try {
    // Hooks merge guest localStorage into server state with dedupe, so only
    // guest-side presence matters here.
    const hasGuestCart = !!(localStorage.getItem('cart') && JSON.parse(localStorage.getItem('cart') || '[]').length > 0);
    const hasGuestWishlist = !!(localStorage.getItem('wishlist') && JSON.parse(localStorage.getItem('wishlist') || '[]').length > 0);

    return hasGuestCart || hasGuestWishlist;
  } catch (error) {
    console.error('Error checking if should transfer guest data:', error);
    return false; // Default to not transferring on error
  }
};
