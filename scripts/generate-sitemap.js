require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Base URL for the sitemap
const BASE_URL = 'https://cigarro.in';

// Static pages that should be included in the sitemap
const staticPages = [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/products', priority: 0.9, changefreq: 'daily' },
  { url: '/collections', priority: 0.8, changefreq: 'weekly' },
  { url: '/brands', priority: 0.8, changefreq: 'weekly' },
  { url: '/blog', priority: 0.7, changefreq: 'daily' },
  { url: '/about', priority: 0.6, changefreq: 'monthly' },
  { url: '/contact', priority: 0.6, changefreq: 'monthly' },
  { url: '/privacy', priority: 0.3, changefreq: 'yearly' },
  { url: '/terms', priority: 0.3, changefreq: 'yearly' },
  { url: '/shipping', priority: 0.4, changefreq: 'monthly' },
];

// Function to fetch all active products from the database
async function fetchProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('slug, updated_at, gallery_images')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return products || [];
}

// Function to fetch all categories
async function fetchCategories() {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('slug, updated_at, image');

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return categories || [];
}

// Function to fetch all brands
async function fetchBrands() {
  // Get unique brands from products
  const { data: brands, error } = await supabase
    .from('products')
    .select('brand')
    .eq('is_active', true)
    .not('brand', 'is', null);

  if (error) {
    console.error('Error fetching brands:', error);
    return [];
  }

  // Get unique brands and create slugs
  const uniqueBrands = [...new Set(brands.map(item => item.brand))];
  return uniqueBrands.map(brand => ({
    slug: brand.toLowerCase().replace(/\s+/g, '-'),
    updated_at: new Date().toISOString().split('T')[0]
  }));
}

// Function to generate the sitemap XML
function generateSitemap(urls) {
  const today = new Date().toISOString().split('T')[0];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n\n';

  // Add each URL to the sitemap
  urls.forEach(urlData => {
    xml += '  <url>\n';
    xml += `    <loc>${urlData.loc}</loc>\n`;
    
    if (urlData.lastmod) {
      xml += `    <lastmod>${urlData.lastmod}</lastmod>\n`;
    }
    
    if (urlData.changefreq) {
      xml += `    <changefreq>${urlData.changefreq}</changefreq>\n`;
    }
    
    if (urlData.priority) {
      xml += `    <priority>${urlData.priority}</priority>\n`;
    }
    
    // Add image if available
    if (urlData.images && urlData.images.length > 0) {
      urlData.images.forEach(img => {
        if (img) {
          xml += '    <image:image>\n';
          xml += `      <image:loc>${img.startsWith('http') ? img : `${BASE_URL}${img}`}</image:loc>\n`;
          if (urlData.imageAlt) {
            xml += `      <image:title><![CDATA[${urlData.imageAlt}]]></image:title>\n`;
          }
          xml += '    </image:image>\n';
        }
      });
    }
    
    xml += '  </url>\n';
  });

  xml += '</urlset>';
  return xml;
}

// Main function to generate the sitemap
async function generate() {
  try {
    console.log('Generating sitemap...');
    
    // Fetch all the data
    const [products, categories, brands] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchBrands()
    ]);

    console.log(`Fetched ${products.length} products, ${categories.length} categories, and ${brands.length} brands`);

    // Prepare URLs array
    const urls = [];

    // Add static pages
    staticPages.forEach(page => {
      urls.push({
        loc: `${BASE_URL}${page.url}`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: page.changefreq,
        priority: page.priority
      });
    });

    // Add products
    products.forEach(product => {
      urls.push({
        loc: `${BASE_URL}/product/${product.slug}`,
        lastmod: product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : undefined,
        changefreq: 'weekly',
        priority: 0.8,
        images: product.gallery_images || [],
        imageAlt: product.name
      });
    });

    // Add categories
    categories.forEach(category => {
      urls.push({
        loc: `${BASE_URL}/category/${category.slug}`,
        lastmod: category.updated_at ? new Date(category.updated_at).toISOString().split('T')[0] : undefined,
        changefreq: 'weekly',
        priority: 0.7,
        images: category.image ? [category.image] : []
      });
    });

    // Add brands
    brands.forEach(brand => {
      urls.push({
        loc: `${BASE_URL}/brands/${brand.slug}`,
        lastmod: brand.updated_at || new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.6
      });
    });

    // Generate the sitemap XML
    const sitemap = generateSitemap(urls);
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    fs.writeFileSync(outputPath, sitemap);
    
    console.log(`Sitemap generated successfully at ${outputPath}`);
    console.log(`Total URLs in sitemap: ${urls.length}`);
    
  } catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
  }
}

// Run the generator
generate();
