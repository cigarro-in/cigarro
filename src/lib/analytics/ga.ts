// Google Analytics 4 wiring for the storefront.
//
// - Loads gtag.js once, with consent-mode defaults DENIED (DPDP-safe).
// - No automatic page views: the SPA sends them explicitly on route change.
// - All money values are read as-is (rupees); this module never converts.
const MEASUREMENT_ID =
  (import.meta as any)?.env?.VITE_GA_MEASUREMENT_ID || 'G-GP06CR13RB';

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
  window.gtag!('event', name, params);
}

export function trackPageView(path: string): void {
  trackEvent('page_view', { page_path: path });
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
