import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useOrg } from '../lib/convex/useOrg';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { supabase } from '../lib/supabase/client';
import { toast } from 'sonner';

// Phase 1 (Convex migration): wishlist reads/writes go to Convex when the
// flag is on and org context is ready. Set VITE_USE_CONVEX_USERSTATE=false
// to fall back to the legacy Supabase path (rollback switch per plan).
const USE_CONVEX = import.meta.env.VITE_USE_CONVEX_USERSTATE !== 'false';

interface WishlistContextType {
  wishlistItems: string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  clearWishlist: () => Promise<void>;
  wishlistCount: number;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

function readLocalWishlist(): string[] {
  try {
    const saved = localStorage.getItem('wishlist');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing wishlist from localStorage:', error);
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [localItems, setLocalItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const org = useOrg();

  const useConvexPath = USE_CONVEX && !!user && !!org;
  const convexRows = useQuery(
    api.userState.listWishlist,
    useConvexPath ? { orgId: org!._id } : 'skip'
  );
  const convexToggle = useMutation(api.userState.toggleWishlist);
  const convexClear = useMutation(api.userState.clearWishlist);

  const wishlistItems = useConvexPath
    ? (convexRows ?? []).map((r) => r.productId)
    : localItems;
  const wishlistCount = wishlistItems.length;

  // Legacy Supabase path (guests always; logged-in when flag off / org missing)
  const loadLegacyWishlist = async () => {
    if (!user) {
      setLocalItems(readLocalWishlist());
      return;
    }
    try {
      const { data: wishlistData, error } = await supabase
        .from('user_wishlists')
        .select('product_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading wishlist from database:', error);
        setLocalItems(readLocalWishlist());
        return;
      }
      setLocalItems((wishlistData || []).map((item) => item.product_id));
    } catch (error) {
      console.error('Error loading wishlist:', error);
      setLocalItems([]);
    }
  };

  useEffect(() => {
    if (!useConvexPath) {
      loadLegacyWishlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, useConvexPath]);

  // Listen for wishlist update events (from data transfer)
  useEffect(() => {
    const handleWishlistUpdate = () => {
      if (!useConvexPath) {
        loadLegacyWishlist();
      }
      // Convex path refreshes automatically via subscription.
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => {
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, useConvexPath]);

  const isWishlisted = (productId: string): boolean => {
    return wishlistItems.includes(productId);
  };

  const toggleWishlist = async (productId: string): Promise<void> => {
    setIsLoading(true);

    try {
      const isCurrentlyWishlisted = isWishlisted(productId);

      if (useConvexPath) {
        const result = await convexToggle({ orgId: org!._id, productId });
        toast.success(result.wishlisted ? 'Added to wishlist' : 'Removed from wishlist');
        window.dispatchEvent(new Event('wishlistUpdated'));
        return;
      }

      if (!user) {
        // Handle localStorage for guests
        const newWishlistItems = isCurrentlyWishlisted
          ? localItems.filter((id) => id !== productId)
          : [...localItems, productId];

        setLocalItems(newWishlistItems);
        localStorage.setItem('wishlist', JSON.stringify(newWishlistItems));

        // Dispatch event for header counter update
        window.dispatchEvent(new Event('wishlistUpdated'));

        toast.success(isCurrentlyWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
        return;
      }

      // Handle database for logged-in users (legacy Supabase path)
      if (isCurrentlyWishlisted) {
        // Remove from wishlist
        const { error } = await supabase
          .from('user_wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;

        setLocalItems((prev) => prev.filter((id) => id !== productId));
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
            if (!localItems.includes(productId)) {
              setLocalItems((prev) => [...prev, productId]);
            }
            toast.success('Added to wishlist');
          } else {
            throw error;
          }
        } else {
          setLocalItems((prev) => [...prev, productId]);
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
      if (useConvexPath) {
        await convexClear({ orgId: org!._id });
        window.dispatchEvent(new Event('wishlistUpdated'));
        toast.success('Wishlist cleared');
        return;
      }

      if (!user) {
        // Clear localStorage for guests
        localStorage.setItem('wishlist', JSON.stringify([]));
        setLocalItems([]);
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

      setLocalItems([]);
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
