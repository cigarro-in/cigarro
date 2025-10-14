// Dynamic sitemap.xml endpoint for Cloudflare Pages
// Automatically serves fresh sitemap from database
// URL: https://cigarro.in/sitemap.xml

import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  const { env } = context;
  
  try {
    // Initialize Supabase
    const supabase = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY
    );

    // Generate sitemap XML
    const xml = await generateSitemap(supabase);
    
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    });
    
  } catch (error) {
    console.error('Sitemap error:', error);
    
    // Return fallback static sitemap on error
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cigarro.in/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://cigarro.in/products</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    
    return new Response(fallback, {
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}

async function generateSitemap(supabase) {
  const BASE_URL = 'https://cigarro.in';
  const today = new Date().toISOString().split('T')[0];
  
  // Static pages
  const staticPages = [
    { url: '/', priority: 1.0, changefreq: 'daily' },
    { url: '/products', priority: 0.9, changefreq: 'daily' },
    { url: '/collections', priority: 0.8, changefreq: 'weekly' },
    { url: '/brands', priority: 0.8, changefreq: 'weekly' },
    { url: '/cart', priority: 0.5, changefreq: 'always' },
    { url: '/about', priority: 0.6, changefreq: 'monthly' },
    { url: '/contact', priority: 0.6, changefreq: 'monthly' },
    { url: '/privacy', priority: 0.3, changefreq: 'yearly' },
    { url: '/terms', priority: 0.3, changefreq: 'yearly' },
    { url: '/shipping', priority: 0.4, changefreq: 'monthly' },
  ];

  // Fetch data (with error handling)
  const [productsResult, categoriesResult] = await Promise.allSettled([
    supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)
      .limit(1000), // Limit for performance
    
    supabase
      .from('categories')
      .select('slug, updated_at')
      .limit(100)
  ]);

  const products = productsResult.status === 'fulfilled' ? productsResult.value.data || [] : [];
  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value.data || [] : [];

  // Generate XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Static pages
  staticPages.forEach(page => {
    xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
  });

  // Products
  products.forEach(product => {
    const lastmod = product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : today;
    xml += `  <url>
    <loc>${BASE_URL}/product/${product.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  });

  // Categories
  categories.forEach(category => {
    const lastmod = category.updated_at ? new Date(category.updated_at).toISOString().split('T')[0] : today;
    xml += `  <url>
    <loc>${BASE_URL}/category/${category.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  });

  xml += '</urlset>';
  return xml;
}
