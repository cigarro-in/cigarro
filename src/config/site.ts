/**
 * Site Configuration
 * 
 * Central configuration for site-wide settings.
 * Update these values to customize the site for different deployments.
 */

export const siteConfig = {
  // Brand Identity
  name: 'Cigarro',
  tagline: 'A clearer way to browse',
  description: 'An online store that helps adult customers in India browse cigarette brands, variants and pack options.',
  
  // URLs
  url: 'https://cigarro.in',
  domain: 'cigarro.in',
  
  // Contact
  email: {
    support: 'support@cigarro.in',
    orders: 'orders@cigarro.in',
  },
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
    defaultTitle: 'Cigarro | Cigarettes and Tobacco Products Online',
    defaultDescription: 'Browse cigarette brands, variants, pack options and related tobacco products online at Cigarro.',
    defaultKeywords: [
      'premium cigarettes',
      'tobacco products',
      'buy cigarettes online',
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
