import { requiredConvexUrl } from './lib/env.js';
import { getRequestOrg } from './lib/org.js';
// Dynamic sitemap.xml endpoint for Cloudflare Pages
// Automatically serves fresh sitemap from database
// URL: https://cigarro.in/sitemap.xml
// Wave 3: catalog reads from Convex (blogs already on Convex).

async function cxQuery(baseUrl, path, args) {
  const res = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`Convex ${path} failed: ${body.errorMessage || body.status}`);
  return body.value;
}

export async function onRequest(context) {
  const { request, env } = context;
  
  // CORS headers for cross-origin requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Convex URL rides the same Pages env as the client bundle.
    const convexUrl = requiredConvexUrl(env);

    // Generate sitemap XML
    const xml = await generateSitemap(convexUrl, getRequestOrg(context));

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        ...corsHeaders,
      }
    });

  } catch (error) {
    console.error('Sitemap error:', error?.message || error);
    console.error('Stack trace:', error?.stack);

    // Never serve a short sitemap on failure: Google reads missing URLs as
    // removed pages. 503 + Retry-After tells crawlers to come back later.
    return new Response('Sitemap temporarily unavailable', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '3600',
        'Cache-Control': 'no-store',
        ...corsHeaders,
      }
    });
  }
}

// Escape special XML characters
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateSitemap(convexUrl, org) {
  const orgSlug = org.slug;
  const BASE_URL = `https://${org.primaryHost}`;
  const today = new Date().toISOString().split('T')[0];
  // Static pages change rarely — fixed date so Google trusts lastmod.
  // Bump STATIC_LASTMOD only when static page content actually changes.
  const STATIC_LASTMOD = '2026-09-07';
  
  // Static pages (NO user-specific pages like cart!)
  const staticPages = [
    { url: '/', priority: 1.0, changefreq: 'daily' },
    { url: '/products', priority: 0.9, changefreq: 'daily' },
    { url: '/categories', priority: 0.8, changefreq: 'weekly' },
    { url: '/brands', priority: 0.8, changefreq: 'weekly' },
    { url: '/blogs', priority: 0.7, changefreq: 'daily' },
    { url: '/about', priority: 0.6, changefreq: 'monthly' },
    { url: '/contact', priority: 0.6, changefreq: 'monthly' },
    { url: '/agents', priority: 0.5, changefreq: 'monthly' },
    { url: '/legal', priority: 0.4, changefreq: 'monthly' },
    { url: '/privacy', priority: 0.3, changefreq: 'yearly' },
    { url: '/terms', priority: 0.3, changefreq: 'yearly' },
    { url: '/shipping', priority: 0.4, changefreq: 'monthly' },
    { url: '/returns', priority: 0.4, changefreq: 'monthly' },
  ];

  // Known junk/test slugs — belt-and-braces; real fix is deactivating in DB
  const EXCLUDED_BRAND_SLUGS = new Set(['ktnng']);

  // Fetch data (with error handling) — Convex is the catalog source.
  const [catalogResult, blogResult] = await Promise.allSettled([
    cxQuery(convexUrl, 'catalog:sitemapCatalog', { orgSlug }),

    cxQuery(convexUrl, 'content:listBlogPosts', { orgSlug, limit: 100 }),
  ]);

  // A failed fetch must NOT produce a partial sitemap (see onRequest 503).
  if (catalogResult.status !== 'fulfilled') {
    console.error('Sitemap catalog fetch failed:', catalogResult.reason?.message || catalogResult.reason);
    throw catalogResult.reason;
  }
  if (blogResult.status !== 'fulfilled') {
    console.error('Sitemap blog fetch failed:', blogResult.reason?.message || blogResult.reason);
    throw blogResult.reason;
  }

  const catalog = catalogResult.value;
  const products = catalog?.products || [];
  const categories = catalog?.categories || [];
  const brands = catalog?.brands || [];
  const blogPosts = (blogResult.value || []).map(p => ({
    slug: p.slug,
    // content queries return ms timestamps; sitemap wants YYYY-MM-DD.
    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
  }));

  // lastmod accepts Supabase ISO strings or Convex ms timestamps.
  const day = (v) => {
    if (!v) return today;
    if (typeof v === 'number') return new Date(v).toISOString().split('T')[0];
    return String(v).split('T')[0];
  };

  // Generate XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  // Static pages (lastmod pinned — see STATIC_LASTMOD above)
  staticPages.forEach(page => {
    xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${STATIC_LASTMOD}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
  });

  // Products with images (Convex supplies active-variant images, max 5)
  products.forEach(product => {
    if (!product.slug) return;
    const lastmod = day(product.updatedAt ?? product.updated_at);
    xml += `  <url>
    <loc>${BASE_URL}/product/${escapeXml(product.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;
    
    // Add product images (up to 5 per product for performance)
    const gallery_images = product.images || [];
      
    if (gallery_images.length > 0) {
      const images = gallery_images.slice(0, 5);
      images.forEach(imageUrl => {
        if (imageUrl) {
          xml += `
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(product.name) || 'Product Image'}</image:title>
    </image:image>`;
        }
      });
    }
    
    xml += `
  </url>\n`;
  });

  // Categories
  categories.forEach(category => {
    if (!category.slug) return;
    const lastmod = day(category.updatedAt ?? category.updated_at);
    xml += `  <url>
    <loc>${BASE_URL}/category/${escapeXml(category.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  });

  // Brands — skip known junk/test slugs (deactivate in DB for permanent fix)
  brands.forEach(brand => {
    if (!brand.slug || EXCLUDED_BRAND_SLUGS.has(brand.slug)) return;
    const lastmod = day(brand.updatedAt ?? brand.updated_at);
    xml += `  <url>
    <loc>${BASE_URL}/brand/${escapeXml(brand.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
  });

  // Blog Posts — route is /blog/:slug (list lives at /blogs)
  blogPosts.forEach(post => {
    if (!post.slug) return;
    const lastmod = post.updated_at ? new Date(post.updated_at).toISOString().split('T')[0] : today;
    xml += `  <url>
    <loc>${BASE_URL}/blog/${escapeXml(post.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
  });

  xml += '</urlset>';
  return xml;
}
