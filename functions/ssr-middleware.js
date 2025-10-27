// SSR Middleware for Cloudflare Pages
// Serves pre-rendered HTML to search engine bots while maintaining SPA for users
// This solves the "duplicate canonical" and indexing issues

import { createClient } from '@supabase/supabase-js';

// List of bot user agents that should receive pre-rendered HTML
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
  'whatsapp'
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
      .select('id, name, slug, brand, price, description, short_description, gallery_images, meta_title, meta_description, og_image, rating, review_count')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      return null;
    }

    const canonicalUrl = `https://cigarro.in/product/${slug}`;
    const imageUrl = product.gallery_images?.[0] || product.og_image || faviconUrl;
    const title = product.meta_title || `${product.name} | Cigarro`;
    const description = product.meta_description || product.short_description || product.description?.substring(0, 160) || '';

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
  <meta property="og:type" content="product">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="Cigarro">
  
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
    '@type': 'Product',
    name: product.name,
    description: description,
    image: imageUrl,
    brand: {
      '@type': 'Brand',
      name: product.brand
    },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl
    },
    aggregateRating: product.rating ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.review_count || 1
    } : undefined
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(product.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <img src="${imageUrl}" alt="${escapeHtml(product.name)}">
  <p>Price: ₹${product.price}</p>
  <p>Brand: ${escapeHtml(product.brand)}</p>
  
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
      .select('id, name, slug, description')
      .eq('slug', slug)
      .single();

    if (error || !category) {
      return null;
    }

    const canonicalUrl = `https://cigarro.in/category/${slug}`;
    const title = `${category.name} | Cigarro`;
    const description = category.description || `Shop premium ${category.name} at Cigarro`;

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
</body>
</html>`;
  } catch (error) {
    console.error('Error generating category HTML:', error);
    return null;
  }
}

// Generate HTML for brand pages
async function generateBrandHTML(slug, supabase, faviconUrl) {
  const brandName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const canonicalUrl = `https://cigarro.in/brand/${slug}`;
  const title = `${brandName} Products | Cigarro`;
  const description = `Shop premium ${brandName} cigarettes and tobacco products at Cigarro`;

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
  
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name: brandName,
    url: canonicalUrl
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(brandName)}</h1>
  <p>${escapeHtml(description)}</p>
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

    // Fetch dynamic site settings (favicon, logo, etc.)
    const { data: siteSettings } = await supabase
      .from('site_settings')
      .select('favicon_url, site_name')
      .single();
    
    const faviconUrl = siteSettings?.favicon_url || 'https://cigarro.in/logo.png';
    const siteName = siteSettings?.site_name || 'Cigarro';

    let html = null;

    // Generate appropriate HTML based on route
    if (url.pathname.startsWith('/product/')) {
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
