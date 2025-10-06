import { supabase } from './supabase/client';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export async function generateSitemap(baseUrl: string = 'https://cigarro.in'): Promise<string> {
  const urls: SitemapUrl[] = [];

  // Static pages with high priority
  const staticPages = [
    { loc: '/', changefreq: 'daily' as const, priority: 1.0 },
    { loc: '/products', changefreq: 'daily' as const, priority: 0.9 },
    { loc: '/collections', changefreq: 'weekly' as const, priority: 0.8 },
    { loc: '/brands', changefreq: 'weekly' as const, priority: 0.8 },
    { loc: '/blog', changefreq: 'daily' as const, priority: 0.7 },
    { loc: '/about', changefreq: 'monthly' as const, priority: 0.6 },
    { loc: '/contact', changefreq: 'monthly' as const, priority: 0.6 },
    { loc: '/privacy', changefreq: 'yearly' as const, priority: 0.3 },
    { loc: '/terms', changefreq: 'yearly' as const, priority: 0.3 },
    { loc: '/shipping', changefreq: 'monthly' as const, priority: 0.4 },
  ];

  urls.push(...staticPages);

  try {
    // Fetch all active products
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (products) {
      products.forEach(product => {
        urls.push({
          loc: `/product/${product.slug}`,
          lastmod: new Date(product.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.8
        });
      });
    }

    // Fetch all active categories
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('name');

    if (categories) {
      categories.forEach(category => {
        urls.push({
          loc: `/category/${category.slug}`,
          lastmod: new Date(category.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.7
        });
      });
    }

    // Fetch all active brands
    const { data: brands } = await supabase
      .from('brands')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('name');

    if (brands) {
      brands.forEach(brand => {
        urls.push({
          loc: `/brands/${brand.slug}`,
          lastmod: new Date(brand.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.7
        });
      });
    }

    // Fetch all published blog posts
    const { data: blogPosts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (blogPosts) {
      blogPosts.forEach(post => {
        urls.push({
          loc: `/blog/${post.slug}`,
          lastmod: new Date(post.updated_at).toISOString().split('T')[0],
          changefreq: 'monthly',
          priority: 0.6
        });
      });
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.map(url => `  <url>
    <loc>${baseUrl}${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`;

  return xml;
}

export async function generateRobotsTxt(baseUrl: string = 'https://cigarro.in'): Promise<string> {
  return `# Cigarro - Premium Cigarette Marketplace
# Robots.txt for SEO optimization

User-agent: *
Allow: /

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Disallow admin and private areas
Disallow: /admin
Disallow: /admin/*
Disallow: /api/*
Disallow: /checkout
Disallow: /payment
Disallow: /orders
Disallow: /wishlist
Disallow: /cart

# Allow important pages for crawling
Allow: /
Allow: /products
Allow: /products/*
Allow: /product/*
Allow: /category/*
Allow: /categories
Allow: /brands
Allow: /brands/*
Allow: /collections
Allow: /blog
Allow: /blog/*
Allow: /about
Allow: /contact
Allow: /privacy
Allow: /terms
Allow: /shipping

# Crawl delay to be respectful
Crawl-delay: 1

# Specific bot instructions
User-agent: Googlebot
Allow: /
Crawl-delay: 0.5

User-agent: Bingbot
Allow: /
Crawl-delay: 1

User-agent: Slurp
Allow: /
Crawl-delay: 1
`;
}
