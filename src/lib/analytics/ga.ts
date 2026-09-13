// Google Analytics 4 wiring for the storefront.
//
// - Loads gtag.js once, with consent-mode defaults DENIED (DPDP-safe).
// - No automatic page views: the SPA sends them explicitly on route change.
// - All money values are read as-is (rupees); this module never converts.
// No hardcoded fallback: the ID must come from VITE_GA_MEASUREMENT_ID
// (Cloudflare Pages env). If it is missing, init is skipped with a warning
// rather than sending hits to the wrong property.
const MEASUREMENT_ID: string | undefined =
  (import.meta as any)?.env?.VITE_GA_MEASUREMENT_ID || undefined;

const CONSENT_KEY = 'cigarro-analytics-consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type ConsentChoice = 'granted' | 'denied';

let initialized = false;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode) — analytics simply stays opt-out
  }
}

export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!MEASUREMENT_ID) {
    console.warn('[analytics] VITE_GA_MEASUREMENT_ID is not set — skipping GA init.');
    return;
  }
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  const stored = safeGet(CONSENT_KEY);
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: stored === 'granted' ? 'granted' : 'denied',
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
  window.gtag('js', new Date());
  // Manual page_view events (SPA); the automatic one would double-count.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

export function getConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const stored = safeGet(CONSENT_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : null;
}

export function setConsent(choice: ConsentChoice): void {
  safeSet(CONSENT_KEY, choice);
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: choice === 'granted' ? 'granted' : 'denied',
    });
  }
}

function ready(): boolean {
  return initialized && typeof window !== 'undefined' && !!window.gtag;
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!ready()) return;
  // ?ga_debug=1 routes hits to GA4 DebugView (for owner self-tests).
  let debug: Record<string, unknown> = {};
  try {
    if (new URLSearchParams(window.location.search).has('ga_debug')) {
      debug = { debug_mode: true };
    }
  } catch {
    // URL parsing unavailable — send the event without debug flag
  }
  window.gtag!('event', name, { ...debug, ...params });
}

export function trackPageView(path: string): void {
  let extras: Record<string, unknown> = {};
  try {
    extras = {
      page_location: window.location.href,
      page_title: document.title,
    };
  } catch {
    // DOM unavailable — page_path alone is still a valid hit
  }
  trackEvent('page_view', { page_path: path, ...extras });
}

export interface GAItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// Normalizes cart/checkout item shapes (variant_price / combo_price / price)
// into GA4 items. Prices are read as rupees — never converted here.
export function mapCartItem(item: any): GAItem {
  const price = Number(item?.variant_price ?? item?.combo_price ?? item?.price ?? 0);
  const nameParts = [item?.name, item?.variant_name].filter(Boolean);
  return {
    id: String(item?.variant_id ?? item?.variant_slug ?? item?.id ?? 'item'),
    name: nameParts.length > 0 ? nameParts.join(' — ') : 'Item',
    price: Number.isFinite(price) ? price : 0,
    quantity: Number(item?.quantity ?? 1) || 1,
  };
}

function gaItems(items: any[]): GAItem[] {
  return (items || []).map(mapCartItem);
}

export function trackViewItem(item: GAItem): void {
  trackEvent('view_item', {
    currency: 'INR',
    value: item.price,
    items: [item],
  });
}

export function trackAddToCart(item: GAItem): void {
  trackEvent('add_to_cart', {
    currency: 'INR',
    value: item.price * item.quantity,
    items: [item],
  });
}

// Resolves a catalog product row (default-variant price in rupees) into a
// GA4 item. List pages (PLP / category / brand / search, both themes) share
// this so item ids and prices stay consistent everywhere.
export function mapProductToItem(product: any): GAItem {
  const variants = product?.product_variants || [];
  const def = variants.find((v: any) => v.is_default) || variants[0];
  const price = Number(def?.price ?? product?.price ?? 0);
  const nameParts = [product?.name, def?.variant_name].filter(Boolean);
  return {
    id: String(product?.slug ?? def?.id ?? product?.id ?? 'item'),
    name: nameParts.length > 0 ? nameParts.join(' — ') : 'Item',
    price: Number.isFinite(price) ? price : 0,
    quantity: 1,
  };
}

export function trackViewItemList(products: any[], listName: string): void {
  if (!products?.length) return;
  trackEvent('view_item_list', {
    item_list_name: listName,
    items: products.slice(0, 40).map(mapProductToItem),
  });
}

export function trackSelectItem(product: any, listName: string): void {
  trackEvent('select_item', {
    item_list_name: listName,
    items: [mapProductToItem(product)],
  });
}

export function trackViewCart(items: any[], value: number): void {
  if (!items?.length) return;
  trackEvent('view_cart', {
    currency: 'INR',
    value: Number(value ?? 0) || 0,
    items: gaItems(items),
  });
}

export function trackRemoveFromCart(item: any): void {
  const g = mapCartItem({ ...item, quantity: Number(item?.quantity ?? 1) || 1 });
  trackEvent('remove_from_cart', {
    currency: 'INR',
    value: g.price * g.quantity,
    items: [g],
  });
}

export function trackBeginCheckout(items: any[], value: number): void {
  trackEvent('begin_checkout', {
    currency: 'INR',
    value: Number(value ?? 0) || 0,
    items: gaItems(items),
  });
}

export function trackPurchase(orderId: string, value: number, items: any[]): void {
  trackEvent('purchase', {
    transaction_id: String(orderId),
    currency: 'INR',
    value: Number(value ?? 0) || 0,
    items: gaItems(items),
  });
}
