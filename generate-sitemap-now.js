// Simple Node.js script to generate comprehensive sitemap
const fs = require('fs');
const path = require('path');

// Mock database data for demonstration
const mockData = {
  products: [
    { slug: 'marlboro-red', updated_at: '2025-01-01', image_url: '/images/marlboro-red.jpg' },
    { slug: 'camel-blue', updated_at: '2025-01-02', image_url: '/images/camel-blue.jpg' },
    { slug: 'lucky-strike', updated_at: '2025-01-03', image_url: '/images/lucky-strike.jpg' },
    { slug: 'parliament', updated_at: '2025-01-04', image_url: '/images/parliament.jpg' },
    { slug: 'dunhill', updated_at: '2025-01-05', image_url: '/images/dunhill.jpg' }
  ],
  categories: [
    { slug: 'cigarettes', updated_at: '2025-01-01', image_url: '/images/cigarettes.jpg' },
    { slug: 'cigars', updated_at: '2025-01-01', image_url: '/images/cigars.jpg' },
    { slug: 'vapes', updated_at: '2025-01-01', image_url: '/images/vapes.jpg' },
    { slug: 'accessories', updated_at: '2025-01-01', image_url: '/images/accessories.jpg' }
  ],
  brands: [
    { slug: 'marlboro', updated_at: '2025-01-01', logo_url: '/images/marlboro-logo.jpg' },
    { slug: 'camel', updated_at: '2025-01-01', logo_url: '/images/camel-logo.jpg' },
    { slug: 'lucky-strike', updated_at: '2025-01-01', logo_url: '/images/lucky-logo.jpg' },
    { slug: 'parliament', updated_at: '2025-01-01', logo_url: '/images/parliament-logo.jpg' }
  ],
  blogPosts: [
    { slug: 'premium-cigarette-guide', updated_at: '2025-01-01', featured_image: '/images/guide.jpg' },
    { slug: 'cigar-smoking-tips', updated_at: '2025-01-02', featured_image: '/images/tips.jpg' },
    { slug: 'tobacco-history', updated_at: '2025-01-03', featured_image: '/images/history.jpg' }
  ],
  collections: [
    { slug: 'premium-collection', updated_at: '2025-01-01', image_url: '/images/premium.jpg' },
    { slug: 'luxury-cigars', updated_at: '2025-01-01', image_url: '/images/luxury.jpg' },
    { slug: 'starter-pack', updated_at: '2025-01-01', image_url: '/images/starter.jpg' }
  ]
};

function generateComprehensiveSitemap(baseUrl = 'https://cigarro.in') {
  const urls = [];
  const today = new Date().toISOString().split('T')[0];

  // Static pages
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/products', changefreq: 'daily', priority: 0.9 },
    { loc: '/collections', changefreq: 'weekly', priority: 0.8 },
    { loc: '/brands', changefreq: 'weekly', priority: 0.8 },
    { loc: '/blog', changefreq: 'daily', priority: 0.7 },
    { loc: '/about', changefreq: 'monthly', priority: 0.6 },
    { loc: '/contact', changefreq: 'monthly', priority: 0.6 },
    { loc: '/privacy', changefreq: 'yearly', priority: 0.3 },
    { loc: '/terms', changefreq: 'yearly', priority: 0.3 },
    { loc: '/shipping', changefreq: 'monthly', priority: 0.4 }
  ];

  urls.push(...staticPages);

  // Products
  mockData.products.forEach(product => {
    urls.push({
      loc: `/product/${product.slug}`,
      lastmod: product.updated_at,
      changefreq: 'weekly',
      priority: 0.8,
      images: [product.image_url]
    });
  });

  // Categories
  mockData.categories.forEach(category => {
    urls.push({
      loc: `/category/${category.slug}`,
      lastmod: category.updated_at,
      changefreq: 'weekly',
      priority: 0.7,
      images: [category.image_url]
    });
  });

  // Brands
  mockData.brands.forEach(brand => {
    urls.push({
      loc: `/brands/${brand.slug}`,
      lastmod: brand.updated_at,
      changefreq: 'weekly',
      priority: 0.7,
      images: [brand.logo_url]
    });
  });

  // Blog posts
  mockData.blogPosts.forEach(post => {
    urls.push({
      loc: `/blog/${post.slug}`,
      lastmod: post.updated_at,
      changefreq: 'monthly',
      priority: 0.6,
      images: [post.featured_image]
    });
  });

  // Collections
  mockData.collections.forEach(collection => {
    urls.push({
      loc: `/collections/${collection.slug}`,
      lastmod: collection.updated_at,
      changefreq: 'weekly',
      priority: 0.7,
      images: [collection.image_url]
    });
  });

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(url => `  <url>
    <loc>${baseUrl}${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ''}
    ${url.images && url.images.length > 0 ? url.images.map(img => `<image:image>
      <image:loc>${baseUrl}${img}</image:loc>
    </image:image>`).join('\n    ') : ''}
  </url>`).join('\n')}
</urlset>`;

  return xml;
}

// Generate and save sitemap
const sitemap = generateComprehensiveSitemap();
const outputPath = path.join(__dirname, 'public', 'sitemap-complete.xml');

// Ensure public directory exists
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

fs.writeFileSync(outputPath, sitemap, 'utf-8');

console.log('✅ Comprehensive sitemap generated!');
console.log(`📄 File: ${outputPath}`);
console.log(`📊 URLs included: ${(sitemap.match(/<url>/g) || []).length}`);
console.log('\n📋 Content included:');
console.log(`  • ${mockData.products.length} Products`);
console.log(`  • ${mockData.categories.length} Categories`);
console.log(`  • ${mockData.brands.length} Brands`);
console.log(`  • ${mockData.blogPosts.length} Blog Posts`);
console.log(`  • ${mockData.collections.length} Collections`);
console.log('  • 10 Static Pages');
console.log('\n🚀 Ready for Google Search Console!');
