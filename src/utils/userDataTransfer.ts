import { supabase } from '../lib/supabase/client';
import { CartItem } from '../hooks/useCart';
import { toast } from 'sonner';

/**
 * Transfers guest cart and wishlist data to a new user account
 * This should only be called for new signups, not existing user logins
 */
export const transferGuestDataToUser = async (userId: string): Promise<void> => {
  try {
    console.log('Starting data transfer for new user:', userId);
    
    // Transfer cart data
    await transferGuestCartToUser(userId);
    
    // Transfer wishlist data
    await transferGuestWishlistToUser(userId);
    
    // Clear localStorage after successful transfer
    localStorage.removeItem('cart');
    localStorage.removeItem('wishlist');
    
    // Dispatch events to update UI counters
    window.dispatchEvent(new Event('cartUpdated'));
    window.dispatchEvent(new Event('wishlistUpdated'));
    
    console.log('Data transfer completed successfully');
    
  } catch (error) {
    console.error('Error transferring guest data to user:', error);
    // Don't show error to user as this is a background operation
    // The cart/wishlist will still work from localStorage if transfer fails
  }
};

/**
 * Transfers guest cart from localStorage to user's database cart
 */
const transferGuestCartToUser = async (userId: string): Promise<void> => {
  const guestCartData = localStorage.getItem('cart');
  if (!guestCartData) {
    console.log('No guest cart data to transfer');
    return;
  }

  try {
    const guestCart: CartItem[] = JSON.parse(guestCartData);
    if (!guestCart.length) {
      console.log('Guest cart is empty');
      return;
    }

    console.log(`Transferring ${guestCart.length} cart items to user account`);

    // Check if user already has cart items (shouldn't happen for new users, but safety check)
    const { data: existingCartItems } = await supabase
      .from('cart_items')
      .select('product_id, variant_id, combo_id')
      .eq('user_id', userId);

    const existingItemKeys = new Set(
      (existingCartItems || []).map(item => 
        `${item.product_id}-${item.variant_id || 'null'}-${item.combo_id || 'null'}`
      )
    );

    // Prepare cart items for insertion, avoiding duplicates
    const cartItemsToInsert = guestCart
      .filter(item => {
        const itemKey = `${item.id}-${item.variant_id || 'null'}-${item.combo_id || 'null'}`;
        return !existingItemKeys.has(itemKey);
      })
      .map(item => ({
        user_id: userId,
        product_id: item.id,
        quantity: item.quantity,
        variant_id: item.variant_id || null,
        combo_id: item.combo_id || null,
        variant_price: item.variant_price || null,
        combo_price: item.combo_price || null,
        created_at: new Date().toISOString()
      }));

    if (cartItemsToInsert.length > 0) {
      const { error } = await supabase
        .from('cart_items')
        .insert(cartItemsToInsert);

      if (error) {
        throw error;
      }

      console.log(`Successfully transferred ${cartItemsToInsert.length} cart items`);
    } else {
      console.log('No new cart items to transfer (all already exist)');
    }

  } catch (error) {
    console.error('Error parsing or transferring guest cart:', error);
    throw error;
  }
};

/**
 * Transfers guest wishlist from localStorage to user's database wishlist
 */
const transferGuestWishlistToUser = async (userId: string): Promise<void> => {
  const guestWishlistData = localStorage.getItem('wishlist');
  if (!guestWishlistData) {
    console.log('No guest wishlist data to transfer');
    return;
  }

  try {
    const guestWishlist: string[] = JSON.parse(guestWishlistData);
    if (!guestWishlist.length) {
      console.log('Guest wishlist is empty');
      return;
    }

    console.log(`Transferring ${guestWishlist.length} wishlist items to user account`);

    // Check if user already has wishlist items (shouldn't happen for new users, but safety check)
    const { data: existingWishlistItems } = await supabase
      .from('user_wishlists')
      .select('product_id')
      .eq('user_id', userId);

    const existingProductIds = new Set(
      (existingWishlistItems || []).map(item => item.product_id)
    );

    // Filter out products that are already in the user's wishlist
    const wishlistItemsToInsert = guestWishlist
      .filter(productId => !existingProductIds.has(productId))
      .map(productId => ({
        user_id: userId,
        product_id: productId,
        created_at: new Date().toISOString()
      }));

    if (wishlistItemsToInsert.length > 0) {
      const { error } = await supabase
        .from('user_wishlists')
        .insert(wishlistItemsToInsert);

      if (error) {
        throw error;
      }

      console.log(`Successfully transferred ${wishlistItemsToInsert.length} wishlist items`);
    } else {
      console.log('No new wishlist items to transfer (all already exist)');
    }

  } catch (error) {
    console.error('Error parsing or transferring guest wishlist:', error);
    throw error;
  }
};

/**
 * Checks if this is a new user signup vs existing user login
 * Returns true if this is a new user who should have their guest data transferred
 */
export const shouldTransferGuestData = async (userId: string): Promise<boolean> => {
  try {
    // Check if user has any existing cart or wishlist data
    const [cartResult, wishlistResult] = await Promise.all([
      supabase
        .from('cart_items')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('user_wishlists')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
    ]);

    // If user has no existing cart or wishlist data, they're likely a new user
    const hasExistingData = (cartResult.data?.length || 0) > 0 || (wishlistResult.data?.length || 0) > 0;
    
    // Also check if there's guest data to transfer
    const hasGuestCart = !!(localStorage.getItem('cart') && JSON.parse(localStorage.getItem('cart') || '[]').length > 0);
    const hasGuestWishlist = !!(localStorage.getItem('wishlist') && JSON.parse(localStorage.getItem('wishlist') || '[]').length > 0);
    
    const shouldTransfer = !hasExistingData && (hasGuestCart || hasGuestWishlist);
    
    console.log('Should transfer guest data:', {
      hasExistingData,
      hasGuestCart,
      hasGuestWishlist,
      shouldTransfer
    });
    
    return shouldTransfer;
  } catch (error) {
    console.error('Error checking if should transfer guest data:', error);
    return false; // Default to not transferring on error
  }
};
