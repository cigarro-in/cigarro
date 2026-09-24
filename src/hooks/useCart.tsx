import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useOrg } from '../lib/convex/useOrg';
import { ORG_SLUG } from '../lib/convex/org';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { CartItemWithVariant } from '../types/variants';
import { mapCartItem, trackAddToCart, trackRemoveFromCart } from '../lib/analytics/ga';

// Phase 1 complete: logged-in cart persistence is Convex
// (`convex/userState.ts`) — full-replace via clear + per-line adds — while
// item state, merge logic, totals and the public API are unchanged.
// Guests use localStorage. Checkout re-prices from the catalog, so persisted
// unit prices are display snapshots only. Catalog rehydration reads from
// Convex (Wave 3); shapes match the legacy Supabase rows.

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
const MAX_CART_QUANTITY = 99;

const normalizeCartQuantity = (value: unknown, fallback = 1): number => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return fallback;
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)));
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();
  const org = useOrg();
  const convex = useConvex();
  // Mirror of items for mutation closures. Rapid +/- taps used to build
  // each persist from a stale `items` snapshot, so the second full-replace
  // overwrote the first (lost updates). Mutators read/write the ref.
  //
  // Latest-intent model (Phase 6): every optimistic mutation bumps
  // localVersion. Server snapshots older than the newest intent are ignored
  // (they predate an in-flight persist); ackedVersion advances only when a
  // server snapshot matches local state — that confirmation path never
  // rehydrates, so no second visual count/animation. Persists coalesce:
  // rapid taps schedule one drain writing the latest ref state instead of
  // one full-replace mutation per tap. On failure the drain reconciles to
  // authoritative state only when no newer user intent arrived meanwhile,
  // and acks the abandoned intent only after that reconcile succeeds —
  // otherwise local state is preserved untouched and the caller rethrows
  // for its row-level inline error.
  const itemsRef = useRef<CartItem[]>([]);
  const localVersion = useRef(0);
  const ackedVersion = useRef(0);
  const persistState = useRef({
    inFlight: false,
    queued: false,
    waiters: [] as Array<{ resolve: () => void; reject: (e: unknown) => void }>,
  });

  const setItemsSync = (next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const persistSnapshot = async (snapshot: CartItem[]) => {
    if (!user) {
      localStorage.setItem('cart', JSON.stringify(snapshot));
      return;
    }
    if (!org) {
      // Org transiently unresolved: keep a device-local backup; the Convex
      // path merges it on the next load once org resolves.
      localStorage.setItem('cart', JSON.stringify(snapshot));
      return;
    }
    await persistAllConvex(snapshot);
  };

  const enqueuePersist = (): Promise<void> => {
    const st = persistState.current;
    if (st.inFlight) {
      // Coalesced tap: the drain will persist our newer snapshot; join it
      // so this caller still observes success/failure for its row error.
      st.queued = true;
      return new Promise<void>((resolve, reject) => {
        st.waiters.push({ resolve, reject });
      });
    }
    st.inFlight = true;
    const run = (async () => {
      // Trailing-edge coalescing: always persist the LATEST snapshot, so
      // ten rapid taps produce ~1 server write, not ten.
      do {
        st.queued = false;
        await persistSnapshot(itemsRef.current);
      } while (st.queued);
    })();
    return run.then(
      () => {
        st.inFlight = false;
        const ws = st.waiters;
        st.waiters = [];
        ws.forEach((w) => w.resolve());
      },
      async (error) => {
        st.inFlight = false;
        // Race-safe recovery: abandon only the intent that actually failed.
        // failedVersion pins the newest intent at failure time. If the user
        // tapped again while the persist (or the reload below) was in
        // flight, localVersion has moved past it and the server snapshot is
        // stale relative to that newer intent — applying it would clobber
        // fresh optimistic changes, so skip the reconcile and keep local
        // state. The ack below runs only after a successful reconcile, so a
        // failed reload preserves local state and never marks intent acked
        // (without it, external server updates would be ignored forever by
        // the serverCartSig intent guard). Rethrow in all cases so the
        // caller's inline row error renders.
        const failedVersion = localVersion.current;
        if (useConvexPath && org) {
          try {
            const lines = await convex.query(api.userState.listCart, {
              orgId: org._id,
            });
            const serverItems = await rehydrateLines(
              (lines ?? []).map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                comboId: l.comboId,
                name: l.name,
                variantName: l.variantName,
                unitPriceRupees: l.unitPriceRupees,
                qty: l.qty,
                imageUrl: l.imageUrl,
              }))
            );
            // Second gate: intent may have arrived *during* the reload
            // fetch, after the check above — apply only if still quiet.
            if (localVersion.current === failedVersion) {
              setItemsSync(serverItems);
              ackedVersion.current = failedVersion;
            }
          } catch {
            /* keep optimistic state, never ack */
          }
        }
        const ws = st.waiters;
        st.waiters = [];
        ws.forEach((w) => w.reject(error));
        throw error;
      }
    );
  };
  const useConvexPath = !!user && !!org;
  const convexAdd = useMutation(api.userState.addToCart);
  const convexSetQty = useMutation(api.userState.setCartQty);
  const convexRemove = useMutation(api.userState.removeCartLine);
  const convexClear = useMutation(api.userState.clearCart);
  const convexReplace = useMutation(api.userState.replaceCart);
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

  // Adopt server-side changes (other tabs/devices) only when we hold no
  // unconfirmed local intent. Keyed on line count + total quantity so
  // identical carts never trigger a reload loop. Never adopts an
  // EMPTY server snapshot while we hold local items: the empty middle of a
  // non-atomic replace must not wipe the UI (that was the self-wipe bug —
  // replaceCart is atomic now, this guard covers legacy races + clearCart).
  //
  // Intent guard (Phase 6): a server snapshot that differs from local while
  // localVersion != ackedVersion is definitionally stale (our persist hasn't
  // echoed yet) — reconciling now would flash old quantities and replay
  // animations. A matching snapshot just confirms intent, no rehydrate.
  const serverCartSig = (convexLineCount ?? [])
    .map((l) => `${l.variantId || ''}:${l.comboId || ''}:${l.productId}:${l.qty}`)
    .sort()
    .join('|');
  useEffect(() => {
    if (!useConvexPath || !isInitialized || convexLineCount === undefined) return;
    if (convexLineCount.length === 0 && (items || []).length > 0) return;
    const localSig = (items || [])
      .map((i) => `${i.variant_id || ''}:${i.combo_id || ''}:${i.id}:${i.quantity}`)
      .sort()
      .join('|');
    if (localSig === serverCartSig) {
      ackedVersion.current = localVersion.current;
      return;
    }
    if (localVersion.current !== ackedVersion.current) return;
    loadCart();
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
      const rows = await convex.query(api.catalog.productsBySupabaseIds, {
        ids: productIds,
        orgSlug: ORG_SLUG,
      });
      for (const p of rows || []) productsById[p.id] = p;
    }

    let combosById: Record<string, any> = {};
    if (comboIds.length > 0) {
      const rows = await convex.query(api.catalog.combosBySupabaseIds, {
        ids: comboIds,
        orgSlug: ORG_SLUG,
      });
      for (const c of rows || []) combosById[c.id] = c;
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
    // Single atomic mutation — readers never see the empty middle state
    // that clear→N×add exposed (the self-wipe in the cart-clear storm).
    await convexReplace({
      orgId: org._id,
      lines: newItems.map((item) => ({
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
      })),
    });
  };

  const loadCart = async () => {
    // No user, or org not resolved yet (transient at startup): device-local
    // cart. Once org arrives the Convex path merges it server-side.
    if (!user || !org) {
      // Load from localStorage for guests
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          if (!Array.isArray(parsedCart)) throw new Error('Cart must be an array');
          setItemsSync(parsedCart.map((item) => ({
            ...item,
            quantity: normalizeCartQuantity(item?.quantity),
          })));
        } catch (error) {
          console.error('Failed to parse cart from localStorage:', error);
          localStorage.removeItem('cart');
          setItemsSync([]);
        }
      } else {
        setItemsSync([]);
      }
      return;
    }

    // Convex path: server lines -> rehydrate -> merge guest cart
    // Convex: server lines -> rehydrate rich items -> merge guest cart.
    if (useConvexPath && org) {
      // Subscription not loaded yet: an empty snapshot here is "unknown",
      // not "empty server cart". Show the device-local cart without
      // persisting so we never overwrite server lines with guest-only
      // state. The serverCartSig effect re-runs loadCart once lines arrive.
      if (convexLineCount === undefined) {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            if (Array.isArray(parsedCart)) {
              setItemsSync(parsedCart.map((item) => ({
                ...item,
                quantity: normalizeCartQuantity(item?.quantity),
              })));
              return;
            }
          } catch {
            /* fall through to empty */
          }
        }
        setItemsSync([]);
        return;
      }
      try {
        const guestCart = localStorage.getItem('cart');
        const parsedGuestCart = guestCart ? JSON.parse(guestCart) : [];
        const guestItems: CartItem[] = Array.isArray(parsedGuestCart)
          ? parsedGuestCart.map((item) => ({
            ...item,
            quantity: normalizeCartQuantity(item?.quantity),
          }))
          : [];

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
              merged[idx] = {
                ...merged[idx],
                quantity: normalizeCartQuantity(merged[idx].quantity + guestItem.quantity),
              };
            } else {
              merged.push(guestItem);
            }
          }
          setItemsSync(merged);
          localStorage.removeItem('cart');
          await persistAllConvex(merged);
        } else {
          setItemsSync(serverItems);
        }
      } catch (error) {
        console.error('Failed to load cart:', error);
        // Keep optimistic/local state on failure: wiping to [] would
        // discard unconfirmed intent, and a failed load must never count
        // as acknowledgement of it.
      }
    }
  };

  const addToCart = async (product: Product, quantity = 1, variantId?: string, comboId?: string) => {
    quantity = normalizeCartQuantity(quantity);
    // If no variantId is provided but product has variants, use the default variant
    if (!variantId && product.product_variants?.length) {
      const defaultVariant = product.product_variants.find(v => v.is_default);
      if (defaultVariant) {
        variantId = defaultVariant.id;
      }
    }
    // Optimistic update from the ref mirror, then a serialized persist so
    // rapid taps build on the latest snapshot instead of a stale closure.
    const previous = itemsRef.current;
    const existingItem = previous.find(item =>
      item.id === product.id &&
      item.variant_id === variantId &&
      item.combo_id === comboId
    );
    let newItems: CartItem[];

    if (existingItem) {
      newItems = previous.map(item =>
        item.id === product.id && item.variant_id === variantId && item.combo_id === comboId
          ? { ...item, quantity: normalizeCartQuantity(item.quantity + quantity) }
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
      newItems = [...previous, newItem];
    }

    // Update UI immediately (one render per tap)
    setItemsSync(newItems);
    localVersion.current += 1;

    // Dispatch event to auto-show mini cart
    window.dispatchEvent(new CustomEvent('cartItemAdded'));

    // Persist coalesced — concurrent taps join the drain instead of racing.
    // Analytics stays outside the revert scope: a tracking failure must
    // never roll back a persisted cart.
    try {
      await enqueuePersist();
    } catch (error) {
      // Drain already reconciled to authoritative state; rethrow for the
      // caller's inline row error.
      console.error('Failed to save cart:', error);
      throw error;
    }
    // GA4: every add path funnels through here (PLP quick-add, PDP,
    // vivid cards, combos). Resolve the sold variant's rupee price —
    // default variant when none was picked — so hits are honest.
    const soldVariant = (product.product_variants || []).find((v: any) => v.id === (variantId ?? comboId))
      ?? (product.product_variants || []).find((v: any) => v.is_default)
      ?? (product.product_variants || [])[0];
    trackAddToCart(mapCartItem({
      ...product,
      variant_name: (product as any).variant_name ?? soldVariant?.variant_name,
      variant_price: (product as any).variant_price ?? (product as any).combo_price ?? soldVariant?.price ?? (product as any).price ?? 0,
      quantity,
    }));
  };

  const addMultipleToCart = async (products: Product[], quantities: number[]) => {
    if (products.length !== quantities.length) {
      throw new Error('Products and quantities arrays must have the same length');
    }

    // Start with the latest snapshot, not a stale render closure.
    const previous = itemsRef.current;
    let newItems = [...previous];

    // Add each product with its quantity
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = quantities[i];
      const normalizedQuantity = normalizeCartQuantity(quantity);

      // Check for existing item considering variant_id and combo_id
      const existingItemIndex = newItems.findIndex(item =>
        item.id === product.id &&
        item.variant_id === (product as any).variant_id &&
        item.combo_id === (product as any).combo_id
      );

      if (existingItemIndex >= 0) {
        // Add to existing quantity
        newItems[existingItemIndex].quantity = normalizeCartQuantity(
          newItems[existingItemIndex].quantity + normalizedQuantity
        );
      } else {
        // Add new item
        newItems.push({
          ...product,
          // Flatten brand object if present
          brand: typeof product.brand === 'object' ? product.brand?.name : product.brand || 'Premium',
          // Get price from default variant
          price: (product as any).variant_price || product.product_variants?.find(v => v.is_default)?.price || product.product_variants?.[0]?.price || 0,
          quantity: normalizedQuantity,
          variant_id: (product as any).variant_id,
          combo_id: (product as any).combo_id
        });
      }
    }

    // Update UI immediately, persist coalesced.
    setItemsSync(newItems);
    localVersion.current += 1;

    try {
      await enqueuePersist();
    } catch (error) {
      console.error('Failed to save cart:', error);
      throw error;
    }
    // GA4 reorder (OrdersPage): one add_to_cart per restored line.
    // Outside the revert scope — tracking never rolls back the cart.
    for (let i = 0; i < products.length; i++) {
      trackAddToCart(mapCartItem({ ...products[i], quantity: quantities[i] }));
    }
  };

  const removeFromCart = async (productId: string, variantId?: string, comboId?: string) => {
    const previous = itemsRef.current;
    const removed = previous.find(item =>
      item.id === productId && item.variant_id === variantId && item.combo_id === comboId
    );
    const newItems = previous.filter(item =>
      !(item.id === productId && item.variant_id === variantId && item.combo_id === comboId)
    );

    // Update UI immediately, persist coalesced.
    setItemsSync(newItems);
    localVersion.current += 1;

    try {
      await enqueuePersist();
    } catch (error) {
      console.error('Failed to save cart:', error);
      throw error;
    }
    if (removed) trackRemoveFromCart(removed);
  };

  const updateQuantity = async (productId: string, quantity: number, variantId?: string, comboId?: string) => {
    if (quantity <= 0) {
      await removeFromCart(productId, variantId, comboId);
      return;
    }

    quantity = normalizeCartQuantity(quantity);
    const previous = itemsRef.current;

    // Find matching item
    const matchingItem = previous.find(item => {
      const idMatch = item.id === productId;
      const variantMatch = item.variant_id === variantId;
      const comboMatch = item.combo_id === comboId;

      return idMatch && variantMatch && comboMatch;
    });

    if (!matchingItem) {
      console.error('❌ No matching item found for update!');
      return;
    }

    const newItems = previous.map(item =>
      item.id === productId && item.variant_id === variantId && item.combo_id === comboId
        ? { ...item, quantity }
        : item
    );

    // Update UI immediately, persist coalesced.
    setItemsSync(newItems);
    localVersion.current += 1;

    try {
      await enqueuePersist();
    } catch (error) {
      console.error('Failed to save cart:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    // Skip the server round-trip when the cart is already empty: the
    // Transaction page calls this on every mount, and each no-op delete
    // was a full mutation + listCart re-fire in the prod log stream.
    if ((itemsRef.current || []).length === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const snapshot: CartItem[] = [];
      setItemsSync(snapshot);
      localVersion.current += 1;
      await enqueuePersist();
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
