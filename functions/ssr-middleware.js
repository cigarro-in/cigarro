// SSR Middleware for Cloudflare Pages
// Serves pre-rendered HTML to search engine bots while maintaining SPA for users
// This solves the "duplicate canonical" and indexing issues

import { createClient } from '@supabase/supabase-js';

// List of bot user agents that should receive pre-rendered HTML
// Keep in sync with functions/_middleware.js
const BOT_USER_AGENTS = [
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'rogerbot',
  'linkedinbot',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'pinterest',
  'slackbot',
  'vkshare',
  'w3c_validator',
  'whatsapp',
  'gptbot',
  'claudebot',
  'anthropic',
  'perplexity',
  'applebot'
];

// Check if request is from a bot
function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

// Generate HTML for product pages
async function generateProductHTML(slug, supabase, faviconUrl) {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, name, slug, brand:brands(name), description, short_description, meta_title, meta_description, canonical_url, specifications, product_variants(images, is_active, price, variant_name)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      return null;
    }

    const specs = product.specifications && typeof product.specifications === 'object' ? product.specifications : {};
    const specRows = Object.entries(specs)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join('');
    const specTable = specRows ? `<h2>Specifications</h2><table>${specRows}</table>` : '';

    const canonicalUrl = product.canonical_url || `https://cigarro.in/product/${slug}`;
    const activeVariants = product.product_variants?.filter(v => v.is_active !== false) || [];
    const variantImages = activeVariants.flatMap(v => v.images || []);
    // First active variant price is the source of truth (price lives on variants, not products)
    const firstPricedVariant = activeVariants.find(v => v.price != null);
    const price = firstPricedVariant?.price ?? null;
    const imageUrl = variantImages[0] || faviconUrl;
    const title = product.meta_title || `${product.name} | Cigarro`;
    const description = product.meta_description || product.short_description || product.description?.substring(0, 160) || '';
    // Related discovery for crawlers: same-brand products (avoids thin single-node pages)
    let relatedLinks = '';
    try {
      const brandName = product.brand?.name;
      if (brandName) {
        const { data: related } = await supabase
          .from('products')
          .select('slug, name, brand:brands(name)')
          .eq('is_active', true)
          .neq('slug', slug)
          .limit(50);
        const sameBrand = (related || []).filter(p => {
          const bn = Array.isArray(p.brand) ? p.brand[0]?.name : p.brand?.name;
          return bn === brandName;
        }).slice(0, 8);
        if (sameBrand.length > 0) {
          relatedLinks = `<nav aria-label="Related products"><h2>Related products</h2><ul>` +
            sameBrand.map(p => `<li><a href="https://cigarro.in/product/${p.slug}">${escapeHtml(p.name)}</a></li>`).join('') +
            `</ul></nav>`;
        }
      }
    } catch { /* related links are best-effort */ }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Favicon (Dynamic from Admin Settings) -->
  <link rel="icon" href="${faviconUrl}">
  <link rel="shortcut icon" href="${faviconUrl}">
  <link rel="apple-touch-icon" href="${faviconUrl}">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:alt" content="${escapeHtml(product.name)}">
  <meta property="og:site_name" content="Cigarro">
  ${price != null ? `<meta property="product:price:amount" content="${price}">
  <meta property="product:price:currency" content="INR">` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(product.name)}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: description,
      image: variantImages.length > 0 ? variantImages.slice(0, 5) : imageUrl,
      brand: {
        '@type': 'Brand',
        name: product.brand?.name || 'Cigarro'
      },
      ...(price != null ? {
        offers: {
          '@type': 'Offer',
          price: price,
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          url: canonicalUrl
        }
      } : {})
    })}
  </script>
</head>
<body>
  <h1>${escapeHtml(product.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <img src="${imageUrl}" alt="${escapeHtml(product.name)}">
  ${price != null ? `<p>Price: ₹${price}</p>` : ''}
  <p>Brand: ${escapeHtml(product.brand?.name || 'Cigarro')}</p>
  ${specTable}
  <nav aria-label="Site"><ul>
    <li><a href="https://cigarro.in/">Home</a></li>
    <li><a href="https://cigarro.in/products">All products</a></li>
    <li><a href="https://cigarro.in/categories">Categories</a></li>
    <li><a href="https://cigarro.in/brands">Brands</a></li>
  </ul></nav>
  ${relatedLinks}
  
  <!-- This content is for search engines. Real users get the SPA. -->
  <noscript>
    <p>Please enable JavaScript to view the full interactive experience.</p>
  </noscript>
</body>
</html>`;
  } catch (error) {
    console.error('Error generating product HTML:', error);
    return null;
  }
}

// Generate HTML for category pages
async function generateCategoryHTML(slug, supabase, faviconUrl) {
  try {
    const { data: category, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, meta_title, meta_description')
      .eq('slug', slug)
      .single();

    if (error || !category) {
      return null;
    }

    const canonicalUrl = `https://cigarro.in/category/${slug}`;
    const title = category.meta_title || `${category.name} | Cigarro`;
    const description = category.meta_description || category.description || `Shop premium ${category.name} at Cigarro`;
    // Product links so bots can discover depth
    let productLinks = '';
    try {
      const { data: links } = await supabase
        .from('product_categories')
        .select('product:products(slug, name, is_active)')
        .eq('category_id', category.id)
        .limit(20);
      const items = (links || []).map(l => l.product).filter(p => p && p.is_active !== false && p.slug);
      if (items.length > 0) {
        productLinks = `<nav aria-label="Products in ${escapeHtml(category.name)}"><ul>` +
          items.slice(0, 12).map(p => `<li><a href="https://cigarro.in/product/${p.slug}">${escapeHtml(p.name)}</a></li>`).join('') +
          `</ul></nav>`;
      }
    } catch { /* best-effort */ }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  
  <script type="application/ld+json">
  ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: category.name,
      description: description,
      url: canonicalUrl
    })}
  </script>
</head>
<body>
  <h1>${escapeHtml(category.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <nav aria-label="Site"><ul>
    <li><a href="https://cigarro.in/">Home</a></li>
    <li><a href="https://cigarro.in/products">All products</a></li>
    <li><a href="https://cigarro.in/categories">Categories</a></li>
    <li><a href="https://cigarro.in/brands">Brands</a></li>
  </ul></nav>
  ${productLinks}
</body>
</html>`;
  } catch (error) {
    console.error('Error generating category HTML:', error);
    return null;
  }
}

// Generate HTML for brand pages — queried from DB, never guessed from slug
async function generateBrandHTML(slug, supabase, faviconUrl) {
  try {
    const { data: brand, error } = await supabase
      .from('brands')
      .select('id, name, slug, description, meta_title, meta_description, logo_url')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !brand) {
      return null;
    }

    const canonicalUrl = `https://cigarro.in/brand/${slug}`;
    const title = brand.meta_title || `${brand.name} Products | Cigarro`;
    const description = brand.meta_description || brand.description || `Shop premium ${brand.name} cigarettes and tobacco products at Cigarro`;
    let productLinks = '';
    try {
      const { data: products } = await supabase
        .from('products')
        .select('slug, name')
        .eq('brand_id', brand.id)
        .eq('is_active', true)
        .limit(12);
      if (products && products.length > 0) {
        productLinks = `<nav aria-label="Products by ${escapeHtml(brand.name)}"><ul>` +
          products.map(p => `<li><a href="https://cigarro.in/product/${p.slug}">${escapeHtml(p.name)}</a></li>`).join('') +
          `</ul></nav>`;
      }
    } catch { /* best-effort */ }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${brand.logo_url ? `<meta property="og:image" content="${brand.logo_url}">
  <meta property="og:image:alt" content="${escapeHtml(brand.name)}">` : ''}
  
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name: brand.name,
    description: description,
    url: canonicalUrl,
    ...(brand.logo_url ? { logo: brand.logo_url } : {})
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(brand.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <nav aria-label="Site"><ul>
    <li><a href="https://cigarro.in/">Home</a></li>
    <li><a href="https://cigarro.in/products">All products</a></li>
    <li><a href="https://cigarro.in/categories">Categories</a></li>
    <li><a href="https://cigarro.in/brands">Brands</a></li>
  </ul></nav>
  ${productLinks}
</body>
</html>`;
  } catch (error) {
    console.error('Error generating brand HTML:', error);
    return null;
  }
}

// Generate HTML for homepage
function generateHomepageHTML(faviconUrl) {
  const canonicalUrl = 'https://cigarro.in/';
  const title = 'Cigarro - Premium Cigarettes & Tobacco Online';
  const description = "India's premier online marketplace for premium cigarettes, cigars, and tobacco products. Authentic brands, nationwide delivery.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Favicon -->
  <link rel="icon" href="${faviconUrl}">
  <link rel="shortcut icon" href="${faviconUrl}">
  <link rel="apple-touch-icon" href="${faviconUrl}">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${faviconUrl}">
  <meta property="og:site_name" content="Cigarro">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${faviconUrl}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Cigarro',
    url: canonicalUrl,
    description: description,
    publisher: {
      '@type': 'Organization',
      name: 'Cigarro',
      url: canonicalUrl,
      logo: {
        '@type': 'ImageObject',
        url: faviconUrl
      }
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://cigarro.in/products?search={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  })}
  </script>
</head>
<body>
  <h1>Cigarro - Premium Cigarettes & Tobacco Online</h1>
  <p>${escapeHtml(description)}</p>
  
  <!-- This content is for search engines. Real users get the SPA. -->
  <noscript>
    <p>Please enable JavaScript to view the full interactive experience.</p>
  </noscript>
</body>
</html>`;
}

// Generate HTML for static pages
function generateStaticPageHTML(pathname, faviconUrl) {
  const pages = {
    '/about': {
      title: 'About Us - Premium Tobacco Marketplace',
      description: "Learn about Cigarro's commitment to excellence in premium tobacco products, our heritage, values, and the expert team behind our curated collection."
    },
    '/contact': {
      title: 'Contact Us - Get Expert Tobacco Advice',
      description: 'Get in touch with our tobacco experts for product recommendations, order support, and any questions about our premium collection. Available Mon-Sat, 9 AM - 8 PM.'
    },
    '/products': {
      title: 'All Products - Premium Cigarettes & Tobacco',
      description: 'Discover our complete collection of premium cigarettes, cigars, and tobacco products from world-renowned brands. Shop authentic products with secure delivery.'
    },
    '/categories': {
      title: 'Product Categories - Browse by Category',
      description: 'Explore our organized categories of premium cigarettes, cigars, and tobacco products. Find exactly what you\'re looking for by browsing our curated collections.'
    },
    '/brands': {
      title: 'Our Premium Brands',
      description: 'Discover our collection of premium cigarette brands from world-renowned manufacturers. Shop authentic tobacco products from the world\'s finest brands.'
    },
    '/blogs': {
      title: 'Blog - Stories of Craftsmanship & Heritage',
      description: 'Explore our collection of stories about premium tobacco craftsmanship, heritage brands, and the art of fine cigarettes.'
    },
    '/terms': {
      title: 'Terms of Service - Legal Information',
      description: 'Terms of Service for Cigarro Premium Marketplace - Important legal information about using our platform.'
    },
    '/privacy': {
      title: 'Privacy Policy - Data Protection',
      description: 'Privacy Policy for Cigarro Premium Marketplace - How we collect, use, and protect your personal information.'
    },
    '/shipping': {
      title: 'Shipping Policy - Delivery Information',
      description: 'Shipping Policy for Cigarro Premium Marketplace - Information about delivery, shipping costs, and delivery times across India.'
    },
    '/legal': {
      title: 'Legal Information - Terms & Policies',
      description: 'Terms of Service, Privacy Policy, and Legal Disclaimers for Cigarro Premium Marketplace'
    }
  };

  const pageInfo = pages[pathname] || pages['/'];
  const canonicalUrl = `https://cigarro.in${pathname}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Favicon -->
  <link rel="icon" href="${faviconUrl}">
  <link rel="shortcut icon" href="${faviconUrl}">
  <link rel="apple-touch-icon" href="${faviconUrl}">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(pageInfo.title)}</title>
  <meta name="title" content="${escapeHtml(pageInfo.title)}">
  <meta name="description" content="${escapeHtml(pageInfo.description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(pageInfo.title)}">
  <meta property="og:description" content="${escapeHtml(pageInfo.description)}">
  <meta property="og:image" content="${faviconUrl}">
  <meta property="og:site_name" content="Cigarro">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(pageInfo.title)}">
  <meta name="twitter:description" content="${escapeHtml(pageInfo.description)}">
  <meta name="twitter:image" content="${faviconUrl}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: pageInfo.title,
    description: pageInfo.description,
    url: canonicalUrl
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(pageInfo.title)}</h1>
  <p>${escapeHtml(pageInfo.description)}</p>
  
  <!-- This content is for search engines. Real users get the SPA. -->
  <noscript>
    <p>Please enable JavaScript to view the full interactive experience.</p>
  </noscript>
</body>
</html>`;
}

// Generate HTML for blog posts
async function generateBlogHTML(slug, supabase, faviconUrl) {
  try {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, featured_image, meta_title, meta_description, published_at, author:profiles(name)')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !post) {
      return null;
    }

    const canonicalUrl = `https://cigarro.in/blog/${slug}`;
    const imageUrl = post.featured_image || faviconUrl;
    const title = post.meta_title || `${post.title} | Cigarro Blog`;
    const description = post.meta_description || post.excerpt || post.content?.substring(0, 160) || '';
    const authorName = post.author?.name || 'Cigarro';
    const publishedDate = post.published_at ? new Date(post.published_at).toISOString() : new Date().toISOString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="author" content="${escapeHtml(authorName)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="Cigarro">
  <meta property="article:published_time" content="${publishedDate}">
  <meta property="article:author" content="${escapeHtml(authorName)}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: description,
      image: imageUrl,
      datePublished: publishedDate,
      dateModified: publishedDate,
      author: {
        '@type': 'Person',
        name: authorName
      },
      publisher: {
        '@type': 'Organization',
        name: 'Cigarro',
        logo: {
          '@type': 'ImageObject',
          url: faviconUrl
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl
      }
    })}
  </script>
</head>
<body>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    <p><strong>By ${escapeHtml(authorName)}</strong> | <time datetime="${publishedDate}">${new Date(publishedDate).toLocaleDateString()}</time></p>
    <img src="${imageUrl}" alt="${escapeHtml(post.title)}">
    <p>${escapeHtml(post.excerpt || description)}</p>
  </article>
  
  <!-- This content is for search engines. Real users get the SPA. -->
  <noscript>
    <p>Please enable JavaScript to view the full interactive experience.</p>
  </noscript>
</body>
</html>`;
  } catch (error) {
    console.error('Error generating blog HTML:', error);
    return null;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// Main middleware function
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // Only prerender for bots
  if (!isBot(userAgent)) {
    return next();
  }

  // Skip for admin, API, and user-specific pages
  if (url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/checkout') ||
    url.pathname.startsWith('/cart') ||
    url.pathname.startsWith('/orders') ||
    url.pathname.startsWith('/wishlist') ||
    url.pathname.startsWith('/payment')) {
    return next();
  }

  try {
    // Initialize Supabase
    const supabase = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY
    );

    // Use static favicon path (no database fetch needed)
    const faviconUrl = 'https://cigarro.in/icons/android-chrome-512x512.png';

    let html = null;

    // Generate appropriate HTML based on route
    if (url.pathname === '/' || url.pathname === '') {
      html = generateHomepageHTML(faviconUrl);
    } else if (url.pathname === '/about' || url.pathname === '/contact' ||
      url.pathname === '/products' || url.pathname === '/categories' ||
      url.pathname === '/brands' || url.pathname === '/blogs' ||
      url.pathname === '/terms' || url.pathname === '/privacy' ||
      url.pathname === '/shipping' || url.pathname === '/legal') {
      html = generateStaticPageHTML(url.pathname, faviconUrl);
    } else if (url.pathname.startsWith('/product/')) {
      const slug = url.pathname.replace('/product/', '');
      html = await generateProductHTML(slug, supabase, faviconUrl);
    } else if (url.pathname.startsWith('/category/')) {
      const slug = url.pathname.replace('/category/', '');
      html = await generateCategoryHTML(slug, supabase, faviconUrl);
    } else if (url.pathname.startsWith('/brand/')) {
      const slug = url.pathname.replace('/brand/', '');
      html = await generateBrandHTML(slug, supabase, faviconUrl);
    } else if (url.pathname.startsWith('/blog/')) {
      const slug = url.pathname.replace('/blog/', '');
      html = await generateBlogHTML(slug, supabase, faviconUrl);
    }

    // If we generated HTML, return it
    if (html) {
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          'X-Robots-Tag': 'index, follow'
        }
      });
    }
  } catch (error) {
    console.error('SSR Middleware Error:', {
      path: url.pathname,
      error: error.message,
      stack: error.stack,
      userAgent: userAgent,
      timestamp: new Date().toISOString()
    });
  }

  // Fallback to normal SPA routing
  return next();
}
