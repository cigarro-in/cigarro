// Store identity for the SPA. The edge injects window.__ORG__ into <head> for
// HTML responses (functions/_middleware.js), resolved from the request hostname.
// Build-time VITE_ORG_SLUG and window.location are fallbacks only.

const hasWindow = typeof window !== 'undefined';

export const ORG_SLUG: string =
  (hasWindow && window.__ORG__?.slug) ||
  import.meta.env?.VITE_ORG_SLUG ||
  'smokeshop';

export const ORG_PRIMARY_HOST: string =
  (hasWindow && window.__ORG__?.primaryHost) ||
  (hasWindow ? window.location.host : '');
