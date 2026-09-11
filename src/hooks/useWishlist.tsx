import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useOrg } from '../lib/convex/useOrg';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';

// Phase 1 complete: wishlist lives in Convex for signed-in users,
// localStorage for guests. No Supabase paths remain.
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

  const useConvexPath = !!user && !!org;
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

  // Guests load localStorage; server state arrives via subscription.
  useEffect(() => {
    if (!useConvexPath) {
      setLocalItems(readLocalWishlist());
    }
  }, [user?.id, useConvexPath]);

  const isWishlisted = (productId: string): boolean => {
    return wishlistItems.includes(productId);
  };

  const toggleWishlist = async (productId: string): Promise<void> => {
    setIsLoading(true);

    try {
      if (useConvexPath) {
        const result = await convexToggle({ orgId: org!._id, productId });
        toast.success(result.wishlisted ? 'Added to wishlist' : 'Removed from wishlist');
        window.dispatchEvent(new Event('wishlistUpdated'));
        return;
      }

      // Guests (or org still resolving): localStorage
      const current = readLocalWishlist();
      const isCurrentlyWishlisted = current.includes(productId);
      const next = isCurrentlyWishlisted
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      setLocalItems(next);
      localStorage.setItem('wishlist', JSON.stringify(next));
      window.dispatchEvent(new Event('wishlistUpdated'));
      toast.success(isCurrentlyWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
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
      localStorage.setItem('wishlist', JSON.stringify([]));
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
