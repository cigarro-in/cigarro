import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../utils/supabase/client';
import { CartItemWithVariant } from '../types/variants';

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string; // Made required again since we added it back to database
  price: number;
  description: string;
  is_active: boolean;
  gallery_images: string[];
  rating: number;
  review_count: number;
  image?: string;
  created_at?: string;
}

export interface CartItem extends CartItemWithVariant {
  // Inherits all properties from CartItemWithVariant
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (product: Product, quantity?: number, variantId?: string, comboId?: string) => Promise<void>;
  addMultipleToCart: (products: Product[], quantities: number[]) => Promise<void>;
  removeFromCart: (productId: string, variantId?: string, comboId?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, variantId?: string, comboId?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  isLoading: boolean;
  // Helper functions for variants and combos
  addVariantToCart: (product: Product, variant: any, quantity?: number) => Promise<void>;
  addComboToCart: (combo: any, quantity?: number) => Promise<void>;
  getCartItemPrice: (item: CartItem) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();

  const totalItems = (items || []).reduce((sum, item) => sum + (item?.quantity || 0), 0);
  const totalPrice = (items || []).reduce((sum, item) => {
    const price = item.variant_price || item.combo_price || item.price || 0;
    return sum + (price * (item?.quantity || 0));
  }, 0);

  // Load cart on mount and when user changes
  useEffect(() => {
    if (!isInitialized) {
      loadCart();
      setIsInitialized(true);
    }
  }, [isInitialized]);
  
  // Reload cart when user changes (login/logout)
  useEffect(() => {
    if (isInitialized && user !== undefined) {
      loadCart();
    }
  }, [user?.id]);

  // Remove duplicate initial mount effect
  // useEffect(() => {
  //   loadCart();
  // }, []);

  // Listen for cart update events (from data transfer)
  useEffect(() => {
    const handleCartUpdate = () => {
      loadCart();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [user?.id]);

  const loadCart = async () => {
    if (!user) {
      // Load from localStorage for guests
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          console.log('🛒 Loading guest cart from localStorage:', parsedCart.length, 'items');
          setItems(parsedCart);
        } catch (error) {
          console.error('Failed to parse cart from localStorage:', error);
          localStorage.removeItem('cart');
          setItems([]);
        }
      } else {
        console.log('🛒 No guest cart found in localStorage');
        setItems([]);
      }
      return;
    }

    try {
      // Check if there's a guest cart to merge
      const guestCart = localStorage.getItem('cart');
      const guestItems: CartItem[] = guestCart ? JSON.parse(guestCart) : [];
      
      // Get cart items from Supabase
      console.log('🛒 Loading cart for user:', user.id);
      const { data: cartItems, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product_id,
          variant_id,
          combo_id,
          products (
            id,
            name,
            slug,
            brand,
            price,
            description,
            is_active,
            gallery_images,
            rating,
            review_count
          ),
          product_variants (
            id,
            variant_name,
            price
          ),
          product_combos (
            id,
            name,
            combo_price
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Failed to load cart from database:', error);
        throw error;
      }
      
      console.log('✅ Cart loaded from database:', cartItems?.length || 0, 'items');

      // Transform Supabase data to CartItem format
      const userItems: CartItem[] = cartItems?.filter(item => item.products).map(item => {
        const product = item.products as any;
        const variant = item.product_variants as any;
        const combo = item.product_combos as any;
        
        // Convert null to undefined for proper comparison
        const variantId = item.variant_id || undefined;
        const comboId = item.combo_id || undefined;
        
        const cartItem = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand || 'Premium', // Default brand if null
          price: product.price,
          description: product.description,
          is_active: product.is_active,
          gallery_images: product.gallery_images || [],
          rating: product.rating,
          review_count: product.review_count,
          image: product.gallery_images?.[0] || '',
          quantity: item.quantity,
          variant_id: variantId,
          variant_name: variant?.variant_name,
          variant_price: variant?.price,
          combo_id: comboId,
          combo_name: combo?.name,
          combo_price: combo?.combo_price
        };
        
        console.log('📦 Loaded cart item:', {
          id: cartItem.id,
          name: cartItem.name,
          quantity: cartItem.quantity,
          variant_id: cartItem.variant_id,
          combo_id: cartItem.combo_id
        });
        
        return cartItem;
      }) || [];
      
      // Merge guest cart with user cart
      if (guestItems.length > 0) {
        console.log('🔄 Merging', guestItems.length, 'guest items with', userItems.length, 'user items');
        const mergedItems = [...userItems];
        
        for (const guestItem of guestItems) {
          const existingItemIndex = mergedItems.findIndex(item => 
            item.id === guestItem.id && 
            item.variant_id === guestItem.variant_id && 
            item.combo_id === guestItem.combo_id
          );
          if (existingItemIndex >= 0) {
            // Add quantities if item exists
            mergedItems[existingItemIndex].quantity += guestItem.quantity;
            // Update in database
            const updateQuery = supabase
              .from('cart_items')
              .update({ quantity: mergedItems[existingItemIndex].quantity })
              .eq('user_id', user.id)
              .eq('product_id', guestItem.id);
            
            if (guestItem.variant_id) {
              updateQuery.eq('variant_id', guestItem.variant_id);
            }
            if (guestItem.combo_id) {
              updateQuery.eq('combo_id', guestItem.combo_id);
            }
            
            await updateQuery;
          } else {
            // Add new item
            mergedItems.push(guestItem);
            // Insert into database
            await supabase
              .from('cart_items')
              .insert({
                user_id: user.id,
                product_id: guestItem.id,
                quantity: guestItem.quantity,
                variant_id: guestItem.variant_id,
                combo_id: guestItem.combo_id
              });
          }
        }
        
        // Save merged cart and clear localStorage
        console.log('✅ Merged cart:', mergedItems.length, 'items');
        setItems(mergedItems);
        localStorage.removeItem('cart');
      } else {
        console.log('✅ Using user cart:', userItems.length, 'items');
        setItems(userItems);
      }
    } catch (error) {
      console.error('❌ Failed to load cart:', error);
      // Fallback to empty cart on error
      setItems([]);
    }
  };

  const saveCartToServer = async (newItems: CartItem[]) => {
    if (!user) return;
    
    try {
      // First, clear all existing cart items for this user
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);
      
      // Insert new cart items
      if (newItems.length > 0) {
        const cartItemsToInsert = newItems.map(item => ({
          user_id: user.id,
          product_id: item.id,
          quantity: item.quantity,
          variant_id: item.variant_id,
          combo_id: item.combo_id
        }));
        
        await supabase
          .from('cart_items')
          .insert(cartItemsToInsert);
      }
    } catch (error) {
      console.error('Failed to save cart to server:', error);
    }
  };

  const saveCart = async (newItems: CartItem[]) => {
    setItems(newItems);

    if (!user) {
      // Save to localStorage for guests
      localStorage.setItem('cart', JSON.stringify(newItems));
      return;
    }

    await saveCartToServer(newItems);
  };

  const addToCart = async (product: Product, quantity = 1, variantId?: string, comboId?: string) => {
    // Optimistic update - update UI immediately
    const existingItem = items.find(item => 
      item.id === product.id && 
      item.variant_id === variantId && 
      item.combo_id === comboId
    );
    let newItems: CartItem[];
    
    if (existingItem) {
      newItems = items.map(item =>
        item.id === product.id && item.variant_id === variantId && item.combo_id === comboId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      // Create new cart item with variant/combo info
      const newItem: CartItem = {
        ...product,
        quantity,
        variant_id: variantId,
        variant_name: (product as any).variant_name || undefined,
        variant_price: (product as any).variant_price || undefined,
        combo_id: comboId,
        combo_name: (product as any).combo_name || undefined,
        combo_price: (product as any).combo_price || undefined
      };
      newItems = [...items, newItem];
    }
    
    // Update UI immediately
    setItems(newItems);
    
    // Dispatch event to auto-show mini cart
    window.dispatchEvent(new CustomEvent('cartItemAdded'));
    
    // Save in background
    try {
      if (!user) {
        localStorage.setItem('cart', JSON.stringify(newItems));
      } else {
        await saveCartToServer(newItems);
      }
    } catch (error) {
      // Revert on error
      setItems(items);
      console.error('Failed to save cart:', error);
      throw error;
    }
  };

  const addMultipleToCart = async (products: Product[], quantities: number[]) => {
    if (products.length !== quantities.length) {
      throw new Error('Products and quantities arrays must have the same length');
    }

    // Start with current items
    let newItems = [...items];
    
    // Add each product with its quantity
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = quantities[i];
      
      // Check for existing item considering variant_id and combo_id
      const existingItemIndex = newItems.findIndex(item => 
        item.id === product.id && 
        item.variant_id === (product as any).variant_id && 
        item.combo_id === (product as any).combo_id
      );
      
      if (existingItemIndex >= 0) {
        // Add to existing quantity
        newItems[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        newItems.push({ 
          ...product, 
          quantity,
          variant_id: (product as any).variant_id,
          combo_id: (product as any).combo_id
        });
      }
    }
    
    // Update UI immediately
    setItems(newItems);
    
    // Save in background
    try {
      if (!user) {
        localStorage.setItem('cart', JSON.stringify(newItems));
      } else {
        await saveCartToServer(newItems);
      }
    } catch (error) {
      // Revert on error
      setItems(items);
      console.error('Failed to save cart:', error);
      throw error;
    }
  };

  const removeFromCart = async (productId: string, variantId?: string, comboId?: string) => {
    const originalItems = items;
    const newItems = items.filter(item => 
      !(item.id === productId && item.variant_id === variantId && item.combo_id === comboId)
    );
    
    // Update UI immediately
    setItems(newItems);
    
    // Save in background
    try {
      if (!user) {
        localStorage.setItem('cart', JSON.stringify(newItems));
      } else {
        await saveCartToServer(newItems);
      }
    } catch (error) {
      // Revert on error
      setItems(originalItems);
      console.error('Failed to save cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (productId: string, quantity: number, variantId?: string, comboId?: string) => {
    console.log('🔄 updateQuantity called:', { productId, quantity, variantId, comboId });
    console.log('📋 Current cart items:', items.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      variant_id: i.variant_id,
      combo_id: i.combo_id
    })));
    
    if (quantity <= 0) {
      await removeFromCart(productId, variantId, comboId);
      return;
    }

    const originalItems = items;
    
    // Find matching item
    const matchingItem = items.find(item => {
      const idMatch = item.id === productId;
      const variantMatch = item.variant_id === variantId;
      const comboMatch = item.combo_id === comboId;
      
      console.log('🔍 Checking item:', {
        itemId: item.id,
        itemVariantId: item.variant_id,
        itemComboId: item.combo_id,
        idMatch,
        variantMatch,
        comboMatch,
        allMatch: idMatch && variantMatch && comboMatch
      });
      
      return idMatch && variantMatch && comboMatch;
    });
    
    if (!matchingItem) {
      console.error('❌ No matching item found for update!');
      return;
    }
    
    console.log('✅ Found matching item:', matchingItem.name);
    
    const newItems = items.map(item =>
      item.id === productId && item.variant_id === variantId && item.combo_id === comboId
        ? { ...item, quantity }
        : item
    );
    
    console.log('📝 Updated items:', newItems.map(i => ({ id: i.id, name: i.name, quantity: i.quantity })));
    
    // Update UI immediately
    setItems(newItems);
    
    // Save in background
    try {
      if (!user) {
        localStorage.setItem('cart', JSON.stringify(newItems));
      } else {
        await saveCartToServer(newItems);
      }
    } catch (error) {
      // Revert on error
      setItems(originalItems);
      console.error('Failed to save cart:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    setIsLoading(true);
    try {
      await saveCart([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get the effective price of a cart item
  const getCartItemPrice = (item: CartItem): number => {
    return item.variant_price || item.combo_price || item.price || 0;
  };

  // Helper function to add a variant to cart
  const addVariantToCart = async (product: Product, variant: any, quantity = 1) => {
    // Create a cart item with variant information
    const productWithVariant = {
      ...product,
      variant_id: variant.id,
      variant_name: variant.variant_name,
      variant_price: variant.price
    };
    await addToCart(productWithVariant, quantity, variant.id);
  };

  // Helper function to add a combo to cart
  const addComboToCart = async (combo: any, quantity = 1) => {
    // Create a pseudo-product for the combo
    const comboProduct: Product = {
      id: combo.id,
      name: combo.name,
      slug: combo.slug,
      brand: 'Combo', // Default brand for combos
      price: combo.combo_price,
      description: combo.description || '',
      is_active: combo.is_active,
      gallery_images: combo.gallery_images || [],
      rating: 0,
      review_count: 0
    };
    
    await addToCart(comboProduct, quantity, undefined, combo.id);
  };

  return (
    <CartContext.Provider value={{
      items,
      totalItems,
      totalPrice,
      addToCart,
      addMultipleToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      isLoading,
      addVariantToCart,
      addComboToCart,
      getCartItemPrice,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    console.error('useCart must be used within a CartProvider');
    // Return a default context to prevent crashes
    return {
      items: [],
      totalItems: 0,
      totalPrice: 0,
      addToCart: async () => {},
      addMultipleToCart: async () => {},
      removeFromCart: async () => {},
      updateQuantity: async () => {},
      clearCart: async () => {},
      isLoading: false,
      addVariantToCart: async () => {},
      addComboToCart: async () => {},
      getCartItemPrice: () => 0,
    };
  }
  return context;
}
