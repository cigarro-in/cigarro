/**
 * Centralized Route Configuration
 * Single source of truth for all application routes
 */

export const ROUTES = {
  // Public routes
  HOME: '/',
  
  // Shopping
  CART: '/cart',
  CHECKOUT: '/checkout',
  DESKTOP_CHECKOUT: '/desktop-checkout',
  MOBILE_CHECKOUT: '/mobile-checkout',
  
  // Payment & Orders
  PAYMENT: '/payment',
  TRANSACTION: '/transaction',
  ORDERS: '/orders',
  
  // User
  PROFILE: '/profile',
  WALLET: '/wallet',
  WISHLIST: '/wishlist',
  REFERRALS: '/referrals',
  REFERRAL_LANDING: '/referral/:code',
  
  // Products
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/product/:slug',
  CATEGORIES: '/categories',
  CATEGORY: '/category/:slug',
  CATEGORY_BRAND: '/category/:category/:brand',
  BRANDS: '/brands',
  BRAND_DETAIL: '/brand/:slug',
  
  // Content
  BLOGS: '/blogs',
  BLOG_POST: '/blog/:slug',
  ABOUT: '/about',
  CONTACT: '/contact',
  
  // Legal
  LEGAL: '/legal',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  SHIPPING: '/shipping',
  
  // Admin
  ADMIN: '/admin/*',
} as const;

/**
 * Helper functions to build dynamic routes
 */
export const buildRoute = {
  productDetail: (slug: string) => `/product/${slug}`,
  category: (slug: string) => `/category/${slug}`,
  categoryBrand: (category: string, brand: string) => `/category/${category}/${brand}`,
  brandDetail: (slug: string) => `/brand/${slug}`,
  blogPost: (slug: string) => `/blog/${slug}`,
  referralLanding: (code: string) => `/referral/${code}`,
  
  // Checkout with query params
  checkoutWithParams: (params?: { buynow?: boolean; retry?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.buynow) searchParams.set('buynow', 'true');
    if (params?.retry) searchParams.set('retry', 'true');
    const query = searchParams.toString();
    return `/checkout${query ? `?${query}` : ''}`;
  },
  
  mobileCheckoutWithParams: (params?: { buynow?: boolean; retry?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.buynow) searchParams.set('buynow', 'true');
    if (params?.retry) searchParams.set('retry', 'true');
    const query = searchParams.toString();
    return `/mobile-checkout${query ? `?${query}` : ''}`;
  },
  
  desktopCheckoutWithParams: (params?: { buynow?: boolean; retry?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.buynow) searchParams.set('buynow', 'true');
    if (params?.retry) searchParams.set('retry', 'true');
    const query = searchParams.toString();
    return `/desktop-checkout${query ? `?${query}` : ''}`;
  },
} as const;

/**
 * Route groups for easier management
 */
export const ROUTE_GROUPS = {
  PUBLIC: [
    ROUTES.HOME,
    ROUTES.PRODUCTS,
    ROUTES.CATEGORIES,
    ROUTES.BRANDS,
    ROUTES.BLOGS,
    ROUTES.ABOUT,
    ROUTES.CONTACT,
  ],
  
  PROTECTED: [
    ROUTES.PROFILE,
    ROUTES.ORDERS,
    ROUTES.WALLET,
    ROUTES.WISHLIST,
    ROUTES.REFERRALS,
  ],
  
  CHECKOUT_FLOW: [
    ROUTES.CART,
    ROUTES.CHECKOUT,
    ROUTES.DESKTOP_CHECKOUT,
    ROUTES.MOBILE_CHECKOUT,
    ROUTES.PAYMENT,
    ROUTES.TRANSACTION,
  ],
  
  LEGAL: [
    ROUTES.LEGAL,
    ROUTES.PRIVACY,
    ROUTES.TERMS,
    ROUTES.SHIPPING,
  ],
} as const;

/**
 * Type-safe route type
 */
export type Route = typeof ROUTES[keyof typeof ROUTES];
