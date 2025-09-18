import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';

interface WishlistContextType {
  wishlistItems: string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  clearWishlist: () => Promise<void>;
  wishlistCount: number;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistItems, setWishlistItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const wishlistCount = wishlistItems.length;

  // Load wishlist on mount and when user changes
  useEffect(() => {
    loadWishlist();
  }, [user?.id]);

  // Listen for wishlist update events (from data transfer)
  useEffect(() => {
    const handleWishlistUpdate = () => {
      loadWishlist();
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => {
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
    };
  }, [user?.id]);

  const loadWishlist = async () => {
    if (!user) {
      // Load from localStorage for guests
      const savedWishlist = localStorage.getItem('wishlist');
      if (savedWishlist) {
        try {
          const parsedWishlist = JSON.parse(savedWishlist);
          setWishlistItems(Array.isArray(parsedWishlist) ? parsedWishlist : []);
        } catch (error) {
          console.error('Error parsing wishlist from localStorage:', error);
          setWishlistItems([]);
        }
      } else {
        setWishlistItems([]);
      }
      return;
    }

    try {
      // Load from database for logged-in users
      const { data: wishlistData, error } = await supabase
        .from('user_wishlists')
        .select('product_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading wishlist from database:', error);
        // Fallback to localStorage
        const savedWishlist = localStorage.getItem('wishlist');
        if (savedWishlist) {
          const parsedWishlist = JSON.parse(savedWishlist);
          setWishlistItems(Array.isArray(parsedWishlist) ? parsedWishlist : []);
        }
        return;
      }

      const productIds = (wishlistData || []).map(item => item.product_id);
      setWishlistItems(productIds);

    } catch (error) {
      console.error('Error loading wishlist:', error);
      setWishlistItems([]);
    }
  };

  const isWishlisted = (productId: string): boolean => {
    return wishlistItems.includes(productId);
  };

  const toggleWishlist = async (productId: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      const isCurrentlyWishlisted = isWishlisted(productId);

      if (!user) {
        // Handle localStorage for guests
        const newWishlistItems = isCurrentlyWishlisted
          ? wishlistItems.filter(id => id !== productId)
          : [...wishlistItems, productId];

        setWishlistItems(newWishlistItems);
        localStorage.setItem('wishlist', JSON.stringify(newWishlistItems));
        
        // Dispatch event for header counter update
        window.dispatchEvent(new Event('wishlistUpdated'));
        
        toast.success(isCurrentlyWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
        return;
      }

      // Handle database for logged-in users
      if (isCurrentlyWishlisted) {
        // Remove from wishlist
        const { error } = await supabase
          .from('user_wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;

        setWishlistItems(prev => prev.filter(id => id !== productId));
        toast.success('Removed from wishlist');
      } else {
        // Add to wishlist
        const { error } = await supabase
          .from('user_wishlists')
          .insert({
            user_id: user.id,
            product_id: productId
          });

        if (error) {
          // Handle duplicate entry error gracefully
          if (error.code === '23505') {
            // Item already in wishlist, just update local state
            if (!wishlistItems.includes(productId)) {
              setWishlistItems(prev => [...prev, productId]);
            }
            toast.success('Added to wishlist');
          } else {
            throw error;
          }
        } else {
          setWishlistItems(prev => [...prev, productId]);
          toast.success('Added to wishlist');
        }
      }

      // Dispatch event for header counter update
      window.dispatchEvent(new Event('wishlistUpdated'));

    } catch (error) {
      console.error('Error toggling wishlist:', error);
      toast.error('Failed to update wishlist');
    } finally {
      setIsLoading(false);
    }
  };

  const clearWishlist = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      if (!user) {
        // Clear localStorage for guests
        localStorage.setItem('wishlist', JSON.stringify([]));
        setWishlistItems([]);
        window.dispatchEvent(new Event('wishlistUpdated'));
        toast.success('Wishlist cleared');
        return;
      }

      // Clear database for logged-in users
      const { error } = await supabase
        .from('user_wishlists')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setWishlistItems([]);
      window.dispatchEvent(new Event('wishlistUpdated'));
      toast.success('Wishlist cleared');

    } catch (error) {
      console.error('Error clearing wishlist:', error);
      toast.error('Failed to clear wishlist');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        isWishlisted,
        toggleWishlist,
        clearWishlist,
        wishlistCount,
        isLoading
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
