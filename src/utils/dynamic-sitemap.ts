import { supabase } from './supabase/client';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: string[];
}

export async function generateCompleteSitemap(baseUrl: string = 'https://cigarro.in'): Promise<string> {
  const urls: SitemapUrl[] = [];

  // Static pages with high priority
  const staticPages: SitemapUrl[] = [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/products', changefreq: 'daily', priority: 0.9 },
    { loc: '/collections', changefreq: 'weekly', priority: 0.8 },
    { loc: '/brands', changefreq: 'weekly', priority: 0.8 },
    { loc: '/blog', changefreq: 'daily', priority: 0.7 },
    { loc: '/about', changefreq: 'monthly', priority: 0.6 },
    { loc: '/contact', changefreq: 'monthly', priority: 0.6 },
    { loc: '/privacy', changefreq: 'yearly', priority: 0.3 },
    { loc: '/terms', changefreq: 'yearly', priority: 0.3 },
    { loc: '/shipping', changefreq: 'monthly', priority: 0.4 },
  ];

  urls.push(...staticPages);

  try {
    console.log('🔍 Fetching products...');
    // Fetch all active products with images
    const { data: products } = await supabase
      .from('products')
      .select(`
        slug, 
        updated_at, 
        image_url,
        gallery_images,
        name,
        description
      `)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (products) {
      console.log(`📦 Found ${products.length} products`);
      products.forEach(product => {
        const images = [];
        if (product.image_url) images.push(product.image_url);
        if (product.gallery_images) images.push(...product.gallery_images);

        urls.push({
          loc: `/product/${product.slug}`,
          lastmod: new Date(product.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.8,
          images: images.slice(0, 5) // Limit to 5 images per product
        });
      });
    }

    console.log('🏷️ Fetching categories...');
    // Fetch all active categories
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, updated_at, name, image_url')
      .eq('is_active', true)
      .order('name');

    if (categories) {
      console.log(`📂 Found ${categories.length} categories`);
      categories.forEach(category => {
        const images = category.image_url ? [category.image_url] : [];
        
        urls.push({
          loc: `/category/${category.slug}`,
          lastmod: new Date(category.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.7,
          images
        });
      });
    }

    console.log('🏢 Fetching brands...');
    // Fetch all active brands
    const { data: brands } = await supabase
      .from('brands')
      .select('slug, updated_at, name, logo_url')
      .eq('is_active', true)
      .order('name');

    if (brands) {
      console.log(`🔖 Found ${brands.length} brands`);
      brands.forEach(brand => {
        const images = brand.logo_url ? [brand.logo_url] : [];
        
        urls.push({
          loc: `/brands/${brand.slug}`,
          lastmod: new Date(brand.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.7,
          images
        });
      });
    }

    console.log('📝 Fetching blog posts...');
    // Fetch all published blog posts
    const { data: blogPosts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at, featured_image, title')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (blogPosts) {
      console.log(`📰 Found ${blogPosts.length} blog posts`);
      blogPosts.forEach(post => {
        const images = post.featured_image ? [post.featured_image] : [];
        
        urls.push({
          loc: `/blog/${post.slug}`,
          lastmod: new Date(post.updated_at).toISOString().split('T')[0],
          changefreq: 'monthly',
          priority: 0.6,
          images
        });
      });
    }

    console.log('🎯 Fetching collections...');
    // Fetch collections (if you have a collections table)
    const { data: collections } = await supabase
      .from('collections')
      .select('slug, updated_at, name, image_url')
      .eq('is_active', true)
      .order('name');

    if (collections) {
      console.log(`📚 Found ${collections.length} collections`);
      collections.forEach(collection => {
        const images = collection.image_url ? [collection.image_url] : [];
        
        urls.push({
          loc: `/collections/${collection.slug}`,
          lastmod: new Date(collection.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.7,
          images
        });
      });
    }

    console.log('🔍 Fetching product variants...');
    // Fetch product variants (if they have separate pages)
    const { data: variants } = await supabase
      .from('product_variants')
      .select(`
        id,
        variant_name,
        updated_at,
        products!inner(slug, is_active)
      `)
      .eq('is_active', true)
      .eq('products.is_active', true);

    if (variants) {
      console.log(`🎨 Found ${variants.length} product variants`);
      variants.forEach((variant: any) => {
        urls.push({
          loc: `/product/${variant.products.slug}?variant=${variant.id}`,
          lastmod: new Date(variant.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.6
        });
      });
    }

  } catch (error) {
    console.error('❌ Error generating comprehensive sitemap:', error);
  }

  console.log(`✅ Generated sitemap with ${urls.length} URLs`);

  // Generate XML with image support
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(url => `  <url>
    <loc>${baseUrl}${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ''}
    ${url.images && url.images.length > 0 ? url.images.map(img => `<image:image>
      <image:loc>${img.startsWith('http') ? img : baseUrl + img}</image:loc>
    </image:image>`).join('\n    ') : ''}
  </url>`).join('\n')}
</urlset>`;

  return xml;
}

export async function generateSitemapIndex(baseUrl: string = 'https://cigarro.in'): Promise<string> {
  // For large sites, create a sitemap index with multiple sitemaps
  const sitemaps = [
    { loc: '/sitemap-static.xml', lastmod: new Date().toISOString().split('T')[0] },
    { loc: '/sitemap-products.xml', lastmod: new Date().toISOString().split('T')[0] },
    { loc: '/sitemap-categories.xml', lastmod: new Date().toISOString().split('T')[0] },
    { loc: '/sitemap-blog.xml', lastmod: new Date().toISOString().split('T')[0] },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(sitemap => `  <sitemap>
    <loc>${baseUrl}${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
}

// Generate category-specific sitemaps for better organization
export async function generateProductsSitemap(baseUrl: string = 'https://cigarro.in'): Promise<string> {
  const urls: SitemapUrl[] = [];

  try {
    const { data: products } = await supabase
      .from('products')
      .select(`
        slug, 
        updated_at, 
        image_url,
        gallery_images
      `)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (products) {
      products.forEach(product => {
        const images = [];
        if (product.image_url) images.push(product.image_url);
        if (product.gallery_images) images.push(...product.gallery_images);

        urls.push({
          loc: `/product/${product.slug}`,
          lastmod: new Date(product.updated_at).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.8,
          images: images.slice(0, 5)
        });
      });
    }
  } catch (error) {
    console.error('Error generating products sitemap:', error);
  }

  return generateXMLFromUrls(urls, baseUrl);
}

export async function generateBlogSitemap(baseUrl: string = 'https://cigarro.in'): Promise<string> {
  const urls: SitemapUrl[] = [];

  try {
    const { data: blogPosts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at, featured_image')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (blogPosts) {
      blogPosts.forEach(post => {
        const images = post.featured_image ? [post.featured_image] : [];
        
        urls.push({
          loc: `/blog/${post.slug}`,
          lastmod: new Date(post.updated_at).toISOString().split('T')[0],
          changefreq: 'monthly',
          priority: 0.6,
          images
        });
      });
    }
  } catch (error) {
    console.error('Error generating blog sitemap:', error);
  }

  return generateXMLFromUrls(urls, baseUrl);
}

function generateXMLFromUrls(urls: SitemapUrl[], baseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(url => `  <url>
    <loc>${baseUrl}${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ''}
    ${url.images && url.images.length > 0 ? url.images.map(img => `<image:image>
      <image:loc>${img.startsWith('http') ? img : baseUrl + img}</image:loc>
    </image:image>`).join('\n    ') : ''}
  </url>`).join('\n')}
</urlset>`;
}
