import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useOrg } from '../lib/convex/useOrg';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { supabase } from '../lib/supabase/client';
import { CartItemWithVariant } from '../types/variants';
import { mapCartItem, trackAddToCart } from '../lib/analytics/ga';

// Phase 1 (Convex migration): logged-in cart persistence moves to Convex
// (`convex/userState.ts`) while item state, merge logic, totals and the
// public API stay identical. Set VITE_USE_CONVEX_USERSTATE=false to restore
// the legacy Supabase persistence (rollback switch per migration plan).
// Guests always use localStorage. Checkout re-prices from the catalog, so
// persisted unit prices are display snapshots only.
const USE_CONVEX = import.meta.env.VITE_USE_CONVEX_USERSTATE !== 'false';

// Updated to match new schema - images on variants, brand via relation
export interface Product {
  id: string;
  name: string;
  slug: string;
  brand_id?: string;
  brand?: { id: string; name: string };
  description?: string;
  is_active: boolean;
  // Legacy fields for backward compatibility
  price?: number;
  created_at?: string;
  origin?: string;
  // New variant-based fields - images are now on variants
  product_variants?: Array<{
    id: string;
    product_id?: string;
    variant_name: string;
    variant_type?: string;
    price: number;
    stock?: number;
    images?: string[];
    is_default?: boolean;
    is_active?: boolean;
  }>;
}

export interface CartItem extends CartItemWithVariant {
  // Inherits all properties from CartItemWithVariant
  // Ensure price is required but can be 0
  price: number;
  // Explicitly define brand as string for UI display
  brand?: string;
  // Add product_variants for type safety
  product_variants?: Array<{
    id: string;
    variant_name: string;
    price: number;
    is_default?: boolean;
  }>;
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
  const org = useOrg();

  const useConvexPath = USE_CONVEX && !!user && !!org;
  const convexAdd = useMutation(api.userState.addToCart);
  const convexSetQty = useMutation(api.userState.setCartQty);
  const convexRemove = useMutation(api.userState.removeCartLine);
  const convexClear = useMutation(api.userState.clearCart);
  // Subscription keeps the hook reactive to server-side cart changes
  // (multi-tab / Phase-3 realtime). Local optimistic state stays primary.
  const convexLineCount = useQuery(
    api.userState.listCart,
    useConvexPath ? { orgId: org!._id } : 'skip'
  );

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

  // Adopt server-side changes (other tabs/devices) when our local state is
  // untouched by an in-flight optimistic update. Keyed on line count + total
  // quantity so identical carts never trigger a reload loop.
  const serverCartSig = (convexLineCount ?? [])
    .map((l) => `${l.variantId || ''}:${l.comboId || ''}:${l.productId}:${l.qty}`)
    .sort()
    .join('|');
  useEffect(() => {
    if (!useConvexPath || !isInitialized || convexLineCount === undefined) return;
    const localSig = (items || [])
      .map((i) => `${i.variant_id || ''}:${i.combo_id || ''}:${i.id}:${i.quantity}`)
      .sort()
      .join('|');
    if (localSig !== serverCartSig) {
      loadCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverCartSig]);

  // Rehydrate lean server lines into rich CartItems via the catalog
  // (Supabase until Phase 3). Drops lines whose product/variant vanished.
  const rehydrateLines = async (
    lines: Array<{
      productId: string;
      variantId?: string;
      comboId?: string;
      name: string;
      variantName?: string;
      unitPriceRupees: number;
      qty: number;
      imageUrl?: string;
    }>
  ): Promise<CartItem[]> => {
    const productIds = [...new Set(lines.filter((l) => !l.comboId).map((l) => l.productId))];
    const comboIds = [...new Set(lines.filter((l) => l.comboId).map((l) => l.comboId as string))];

    let productsById: Record<string, any> = {};
    if (productIds.length > 0) {
      const { data } = await supabase
        .from('products')
        .select(`
          id, name, slug, brand_id, brand:brands(id, name), description, is_active,
          product_variants (id, variant_name, price, images, is_default, is_active)
        `)
        .in('id', productIds);
      for (const p of data || []) productsById[p.id] = p;
    }

    let combosById: Record<string, any> = {};
    if (comboIds.length > 0) {
      const { data } = await supabase
        .from('combos')
        .select('id, name, combo_price')
        .in('id', comboIds);
      for (const c of data || []) combosById[c.id] = c;
    }

    const getBrandName = (brand: any): string => {
      if (!brand) return 'Premium';
      if (typeof brand === 'string') return brand;
      if (Array.isArray(brand)) return brand[0]?.name || 'Premium';
      if (typeof brand === 'object') return brand.name || 'Premium';
      return 'Premium';
    };

    const rich: CartItem[] = [];
    for (const line of lines) {
      if (line.comboId) {
        const combo = combosById[line.comboId];
        if (!combo) continue;
        rich.push({
          id: line.productId,
          name: combo.name || line.name,
          slug: '',
          brand: 'Premium',
          price: Number(line.unitPriceRupees) || 0,
          description: '',
          is_active: true,
          quantity: line.qty,
          combo_id: line.comboId,
          combo_name: combo.name,
          combo_price: Number(line.unitPriceRupees) || 0,
        } as CartItem);
        continue;
      }
      const product = productsById[line.productId];
      if (!product) continue;
      const variant = (product.product_variants || []).find((v: any) => v.id === line.variantId);
      rich.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: getBrandName(product.brand),
        price: variant?.price ?? Number(line.unitPriceRupees) ?? 0,
        description: product.description,
        is_active: product.is_active,
        image: variant?.images?.[0] || line.imageUrl || '',
        quantity: line.qty,
        variant_id: line.variantId,
        variant_name: variant?.variant_name ?? line.variantName,
        variant_price: variant?.price ?? Number(line.unitPriceRupees) ?? 0,
      } as CartItem);
    }
    return rich;
  };

  const persistAllConvex = async (newItems: CartItem[]) => {
    if (!org) return;
    await convexClear({ orgId: org._id });
    for (const item of newItems) {
      await convexAdd({
        orgId: org._id,
        productId: String(item.id),
        variantId: item.variant_id ? String(item.variant_id) : undefined,
        comboId: item.combo_id ? String(item.combo_id) : undefined,
        name: String(item.name ?? 'Item'),
        variantName: item.variant_name ? String(item.variant_name) : undefined,
        unitPriceRupees: Number(
          item.variant_price ?? item.combo_price ?? item.price ?? 0
        ) || 0,
        qty: Number(item.quantity ?? 1) || 1,
        imageUrl: (item as any).image ? String((item as any).image) : undefined,
      });
    }
  };

  const loadCart = async () => {
    if (!user) {
      // Load from localStorage for guests
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setItems(parsedCart);
        } catch (error) {
          console.error('Failed to parse cart from localStorage:', error);
          localStorage.removeItem('cart');
          setItems([]);
        }
      } else {
        setItems([]);
      }
      return;
    }

    // Convex path: server lines -> rehydrate -> merge guest cart
    if (useConvexPath && org) {
      try {
        const guestCart = localStorage.getItem('cart');
        const guestItems: CartItem[] = guestCart ? JSON.parse(guestCart) : [];

        // Direct query via subscription cache is async here; rehydrate from
        // a fresh read through the same query args is not available outside
        // hooks, so resolve lines through a lightweight fetch of current
        // subscription value is impossible — instead merge guest items into
        // whatever is currently displayed, then persist the union.
        // First paint: adopt subscription lines on next render cycle.
        const currentLines = (convexLineCount ?? []).map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          comboId: l.comboId,
          name: l.name,
          variantName: l.variantName,
          unitPriceRupees: l.unitPriceRupees,
          qty: l.qty,
          imageUrl: l.imageUrl,
        }));
        const serverItems = await rehydrateLines(currentLines);

        if (guestItems.length > 0) {
          const merged = [...serverItems];
          for (const guestItem of guestItems) {
            const idx = merged.findIndex(
              (item) =>
                item.id === guestItem.id &&
                item.variant_id === guestItem.variant_id &&
                item.combo_id === guestItem.combo_id
            );
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + guestItem.quantity };
            } else {
              merged.push(guestItem);
            }
          }
          setItems(merged);
          localStorage.removeItem('cart');
          await persistAllConvex(merged);
        } else {
          setItems(serverItems);
        }
      } catch (error) {
        console.error('❌ Failed to load cart:', error);
        setItems([]);
      }
      return;
    }

    try {
      // Check if there's a guest cart to merge
      const guestCart = localStorage.getItem('cart');
      const guestItems: CartItem[] = guestCart ? JSON.parse(guestCart) : [];

      // Get cart items from Supabase (legacy path)
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
            brand_id,
            brand:brands(id, name),
            description,
            is_active
          ),
          product_variants (
            id,
            variant_name,
            price,
            images
          ),
          combos (
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

      // Transform Supabase data to CartItem format
      const userItems: CartItem[] = cartItems?.filter(item => item.products).map(item => {
        const product = item.products as any;
        const variant = item.product_variants as any;
        const combo = item.combos as any;

        // Convert null to undefined for proper comparison
        const variantId = item.variant_id || undefined;
        const comboId = item.combo_id || undefined;

        // Extract brand name - handle array format from Supabase relations
        const getBrandName = (brand: any): string => {
          if (!brand) return 'Premium';
          if (typeof brand === 'string') return brand;
          if (Array.isArray(brand)) return brand[0]?.name || 'Premium';
          if (typeof brand === 'object') return brand.name || 'Premium';
          return 'Premium';
        };

        const cartItem = {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: getBrandName(product.brand),
          price: variant?.price || product.price || 0,
          description: product.description,
          is_active: product.is_active,
          image: variant?.images?.[0] || '',
          quantity: item.quantity,
          variant_id: variantId,
          variant_name: variant?.variant_name,
          variant_price: variant?.price,
          combo_id: comboId,
          combo_name: combo?.name,
          combo_price: combo?.combo_price
        };

        return cartItem as CartItem;
      }) || [];

      // Merge guest cart with user cart
      if (guestItems.length > 0) {
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
        setItems(mergedItems);
        localStorage.removeItem('cart');
      } else {
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

    // Convex path: full-replace via clear + per-line adds
    if (useConvexPath) {
      await persistAllConvex(newItems);
      return;
    }

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
    // If no variantId is provided but product has variants, use the default variant
    if (!variantId && product.product_variants?.length) {
      const defaultVariant = product.product_variants.find(v => v.is_default);
      if (defaultVariant) {
        variantId = defaultVariant.id;
      }
    }
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
      // Extract brand name - handle array format from Supabase relations
      const extractBrand = (brand: any): string => {
        if (!brand) return 'Premium';
        if (typeof brand === 'string') return brand;
        if (Array.isArray(brand)) return brand[0]?.name || 'Premium';
        if (typeof brand === 'object') return brand.name || 'Premium';
        return 'Premium';
      };

      const newItem: CartItem = {
        ...product,
        // Flatten brand object if present
        brand: extractBrand(product.brand),
        // Get price from default variant or passed variant
        price: (product as any).variant_price || product.product_variants?.find(v => v.is_default)?.price || product.product_variants?.[0]?.price || 0,
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
          // Flatten brand object if present
          brand: typeof product.brand === 'object' ? product.brand?.name : product.brand || 'Premium',
          // Get price from default variant
          price: (product as any).variant_price || product.product_variants?.find(v => v.is_default)?.price || product.product_variants?.[0]?.price || 0,
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

      return idMatch && variantMatch && comboMatch;
    });

    if (!matchingItem) {
      console.error('❌ No matching item found for update!');
      return;
    }

    const newItems = items.map(item =>
      item.id === productId && item.variant_id === variantId && item.combo_id === comboId
        ? { ...item, quantity }
        : item
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
    // Priority: variant price > combo price > product price
    return item.variant_price || item.combo_price || item.price || 0;
  };

  // Helper to get product price (from default variant if available)
  const getProductPrice = (product: Product): number => {
    if (product.product_variants?.length) {
      const defaultVariant = product.product_variants.find(v => v.is_default);
      if (defaultVariant) {
        return defaultVariant.price;
      }
    }
    return product.product_variants?.[0]?.price || 0;
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
    trackAddToCart(mapCartItem({ ...productWithVariant, quantity }));
  };

  // Helper function to add a combo to cart
  const addComboToCart = async (combo: any, quantity = 1) => {
    // Create a pseudo-product for the combo
    const comboProduct: Product = {
      id: combo.id,
      name: combo.name,
      slug: combo.slug,
      description: combo.description || '',
      is_active: combo.is_active,
      product_variants: [{
        id: combo.id,
        variant_name: 'Combo',
        price: combo.combo_price,
        images: combo.gallery_images || [combo.image]
      }]
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
      addToCart: async () => { },
      addMultipleToCart: async () => { },
      removeFromCart: async () => { },
      updateQuantity: async () => { },
      clearCart: async () => { },
      isLoading: false,
      addVariantToCart: async () => { },
      addComboToCart: async () => { },
      getCartItemPrice: () => 0,
    };
  }
  return context;
}
