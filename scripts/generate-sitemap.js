require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Base URL for the sitemap
const BASE_URL = 'https://cigarro.in';
const MAX_URLS_PER_SITEMAP = 50000; // Google's limit

// Static pages configuration with SEO optimization
const staticPages = [
  // High Priority - Core Pages
  { url: '/', priority: 1.0, changefreq: 'daily', name: 'Homepage' },
  { url: '/products', priority: 0.9, changefreq: 'daily', name: 'All Products' },
  
  // Shopping Pages
  { url: '/collections', priority: 0.8, changefreq: 'weekly', name: 'Collections' },
  { url: '/brands', priority: 0.8, changefreq: 'weekly', name: 'Brands' },
  { url: '/cart', priority: 0.5, changefreq: 'always', name: 'Shopping Cart' },
  
  // Content Pages
  { url: '/blog', priority: 0.7, changefreq: 'daily', name: 'Blog' },
  { url: '/about', priority: 0.6, changefreq: 'monthly', name: 'About Us' },
  { url: '/contact', priority: 0.6, changefreq: 'monthly', name: 'Contact Us' },
  
  // Legal Pages
  { url: '/privacy', priority: 0.3, changefreq: 'yearly', name: 'Privacy Policy' },
  { url: '/terms', priority: 0.3, changefreq: 'yearly', name: 'Terms & Conditions' },
  { url: '/shipping', priority: 0.4, changefreq: 'monthly', name: 'Shipping Policy' },
  { url: '/returns', priority: 0.4, changefreq: 'monthly', name: 'Returns & Refunds' },
];

// Function to fetch all active products with enhanced data
async function fetchProducts() {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('slug, name, updated_at, created_at, gallery_images, price, brand')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    
    console.log(`✓ Fetched ${products?.length || 0} products`);
    return products || [];
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    return [];
  }
}

// Function to fetch all categories with enhanced data
async function fetchCategories() {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('slug, name, updated_at, image, description')
      .order('name', { ascending: true });

    if (error) throw error;
    
    console.log(`✓ Fetched ${categories?.length || 0} categories`);
    return categories || [];
  } catch (error) {
    console.error('❌ Error fetching categories:', error.message);
    return [];
  }
}

// Function to fetch all brands with product count
async function fetchBrands() {
  try {
    const { data: brands, error } = await supabase
      .from('products')
      .select('brand, updated_at')
      .eq('is_active', true)
      .not('brand', 'is', null);

    if (error) throw error;

    // Group by brand and get latest update date
    const brandMap = new Map();
    brands.forEach(({ brand, updated_at }) => {
      if (!brandMap.has(brand)) {
        brandMap.set(brand, { 
          name: brand,
          updated_at: updated_at,
          count: 1 
        });
      } else {
        const existing = brandMap.get(brand);
        existing.count++;
        // Keep the most recent update date
        if (new Date(updated_at) > new Date(existing.updated_at)) {
          existing.updated_at = updated_at;
        }
      }
    });

    const uniqueBrands = Array.from(brandMap.values()).map(brand => ({
      name: brand.name,
      slug: brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      updated_at: brand.updated_at || new Date().toISOString(),
      productCount: brand.count
    }));

    console.log(`✓ Fetched ${uniqueBrands.length} brands`);
    return uniqueBrands;
  } catch (error) {
    console.error('❌ Error fetching brands:', error.message);
    return [];
  }
}

// Function to escape XML special characters
function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Function to format date to ISO 8601 (W3C format)
function formatDate(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  return new Date(date).toISOString().split('T')[0];
}

// Function to generate sitemap XML with enhanced SEO
function generateSitemap(urls, filename = 'sitemap.xml') {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n';
  xml += `  <!-- Generated on ${new Date().toISOString()} -->\n`;
  xml += `  <!-- Total URLs: ${urls.length} -->\n\n`;

  urls.forEach((urlData, index) => {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(urlData.loc)}</loc>\n`;
    
    if (urlData.lastmod) {
      xml += `    <lastmod>${formatDate(urlData.lastmod)}</lastmod>\n`;
    }
    
    if (urlData.changefreq) {
      xml += `    <changefreq>${urlData.changefreq}</changefreq>\n`;
    }
    
    if (urlData.priority !== undefined) {
      xml += `    <priority>${urlData.priority.toFixed(1)}</priority>\n`;
    }
    
    // Add images (limit to 1000 per URL as per Google guidelines)
    if (urlData.images && urlData.images.length > 0) {
      const images = urlData.images.slice(0, 1000);
      images.forEach(img => {
        if (img) {
          const imageUrl = img.startsWith('http') ? img : `${BASE_URL}/storage/${img}`;
          xml += '    <image:image>\n';
          xml += `      <image:loc>${escapeXml(imageUrl)}</image:loc>\n`;
          if (urlData.imageAlt) {
            xml += `      <image:title>${escapeXml(urlData.imageAlt)}</image:title>\n`;
          }
          xml += '    </image:image>\n';
        }
      });
    }
    
    xml += '  </url>\n';
    
    // Add newline every 10 URLs for readability
    if ((index + 1) % 10 === 0) {
      xml += '\n';
    }
  });

  xml += '</urlset>';
  return xml;
}

// Function to generate sitemap index for large sites
function generateSitemapIndex(sitemaps) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <!-- Generated on ${new Date().toISOString()} -->\n\n`;
  
  sitemaps.forEach(sitemap => {
    xml += '  <sitemap>\n';
    xml += `    <loc>${BASE_URL}/${sitemap.filename}</loc>\n`;
    xml += `    <lastmod>${formatDate(new Date())}</lastmod>\n`;
    xml += '  </sitemap>\n';
  });
  
  xml += '</sitemapindex>';
  return xml;
}

// Main function to generate comprehensive sitemap
async function generate() {
  try {
    console.log('\n🚀 Starting sitemap generation...\n');
    const startTime = Date.now();
    
    // Fetch all the data in parallel
    console.log('📊 Fetching data from database...');
    const [products, categories, brands] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchBrands()
    ]);

    console.log(`\n📈 Data Summary:`);
    console.log(`   • ${products.length} products`);
    console.log(`   • ${categories.length} categories`);
    console.log(`   • ${brands.length} brands`);
    console.log(`   • ${staticPages.length} static pages\n`);

    // Prepare URL arrays for different sitemaps
    const staticUrls = [];
    const productUrls = [];
    const categoryUrls = [];
    const brandUrls = [];

    // Add static pages (highest priority)
    console.log('📝 Processing static pages...');
    staticPages.forEach(page => {
      staticUrls.push({
        loc: `${BASE_URL}${page.url}`,
        lastmod: new Date(),
        changefreq: page.changefreq,
        priority: page.priority
      });
    });

    // Add products with enhanced SEO
    console.log('📦 Processing products...');
    products.forEach(product => {
      productUrls.push({
        loc: `${BASE_URL}/product/${product.slug}`,
        lastmod: product.updated_at || product.created_at,
        changefreq: 'weekly',
        priority: 0.8,
        images: product.gallery_images || [],
        imageAlt: product.name
      });
    });

    // Add categories
    console.log('📂 Processing categories...');
    categories.forEach(category => {
      categoryUrls.push({
        loc: `${BASE_URL}/category/${category.slug}`,
        lastmod: category.updated_at,
        changefreq: 'weekly',
        priority: 0.7,
        images: category.image ? [category.image] : [],
        imageAlt: category.name
      });
    });

    // Add brands
    console.log('🏷️  Processing brands...');
    brands.forEach(brand => {
      brandUrls.push({
        loc: `${BASE_URL}/brands/${brand.slug}`,
        lastmod: brand.updated_at,
        changefreq: 'monthly',
        priority: 0.6
      });
    });

    // Combine all URLs
    const allUrls = [...staticUrls, ...productUrls, ...categoryUrls, ...brandUrls];
    const totalUrls = allUrls.length;

    console.log(`\n✅ Total URLs to process: ${totalUrls}\n`);

    // Ensure output directory exists
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Check if we need multiple sitemaps (Google limit is 50,000 URLs)
    if (totalUrls > MAX_URLS_PER_SITEMAP) {
      console.log(`⚠️  URLs exceed ${MAX_URLS_PER_SITEMAP}, creating sitemap index...\n`);
      
      const sitemaps = [];
      const chunks = [];
      
      // Split URLs into chunks
      for (let i = 0; i < allUrls.length; i += MAX_URLS_PER_SITEMAP) {
        chunks.push(allUrls.slice(i, i + MAX_URLS_PER_SITEMAP));
      }
      
      // Generate individual sitemaps
      chunks.forEach((chunk, index) => {
        const filename = `sitemap-${index + 1}.xml`;
        const sitemap = generateSitemap(chunk, filename);
        const outputPath = path.join(publicDir, filename);
        fs.writeFileSync(outputPath, sitemap);
        sitemaps.push({ filename, count: chunk.length });
        console.log(`✓ Generated ${filename} (${chunk.length} URLs)`);
      });
      
      // Generate sitemap index
      const sitemapIndex = generateSitemapIndex(sitemaps);
      const indexPath = path.join(publicDir, 'sitemap.xml');
      fs.writeFileSync(indexPath, sitemapIndex);
      console.log(`\n✓ Generated sitemap index at sitemap.xml`);
      
    } else {
      // Generate single sitemap
      console.log('📄 Generating single sitemap file...\n');
      const sitemap = generateSitemap(allUrls);
      const outputPath = path.join(publicDir, 'sitemap.xml');
      fs.writeFileSync(outputPath, sitemap);
      console.log(`✓ Generated sitemap.xml`);
    }

    // Copy to root directory as well (for easy access)
    const rootSitemapPath = path.join(process.cwd(), 'sitemap.xml');
    const publicSitemapPath = path.join(publicDir, 'sitemap.xml');
    if (fs.existsSync(publicSitemapPath)) {
      fs.copyFileSync(publicSitemapPath, rootSitemapPath);
      console.log(`✓ Copied to root directory`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Sitemap generation completed successfully!`);
    console.log(`   • Total URLs: ${totalUrls}`);
    console.log(`   • Duration: ${duration}s`);
    console.log(`   • Location: ${publicDir}`);
    console.log(`\n📍 Submit your sitemap to Google Search Console:`);
    console.log(`   ${BASE_URL}/sitemap.xml\n`);
    
  } catch (error) {
    console.error('\n❌ Error generating sitemap:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the generator with error handling
if (require.main === module) {
  generate().then(() => {
    console.log('✓ Process completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generate };
