/**
 * Site Configuration
 * 
 * Central configuration for site-wide settings.
 * Update these values to customize the site for different deployments.
 */

export const siteConfig = {
  // Brand Identity
  name: 'Cigarro',
  tagline: 'The Tobacco Marketplace',
  description: "India's premier online marketplace for premium cigarettes and tobacco products",
  
  // URLs
  url: 'https://cigarro.in',
  domain: 'cigarro.in',
  
  // Contact
  email: {
    support: 'support@cigarro.in',
    orders: 'orders@cigarro.in',
  },
  phone: '+91 98765 43210',
  
  // Social Media
  social: {
    instagram: '',
    facebook: '',
    twitter: '',
  },
  
  // Business
  currency: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  
  // Legal
  ageRestriction: 18,
  
  // SEO Defaults
  seo: {
    titleTemplate: '%s | Cigarro',
    defaultTitle: 'Cigarro - Premium Tobacco Marketplace',
    defaultDescription: "India's premier online marketplace for premium cigarettes and tobacco products. Authentic brands, nationwide delivery.",
    defaultKeywords: [
      'premium cigarettes',
      'tobacco products',
      'buy cigarettes online',
      'authentic tobacco',
      'cigarette delivery India',
    ],
  },
  
  // Theme
  theme: {
    primaryColor: '#8B4513', // canyon
    backgroundColor: '#e8e0d2', // creme
  },
} as const;

export type SiteConfig = typeof siteConfig;
