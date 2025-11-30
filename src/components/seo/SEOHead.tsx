import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  price?: string;
  currency?: string;
  availability?: 'in stock' | 'out of stock' | 'preorder';
  brand?: string;
  category?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

export function SEOHead({
  title = 'Cigarro - Premium Cigarettes & Tobacco Online',
  description = 'India\'s premier online marketplace for premium cigarettes, cigars, and tobacco products. Authentic brands, nationwide delivery, 18+ only.',
  keywords = ['premium cigarettes', 'buy cigars online', 'tobacco products India', 'cigarette delivery', 'authentic cigarettes'],
  image = 'https://cigarro.in/logo.png',
  url = 'https://cigarro.in',
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
  price,
  currency = 'INR',
  availability = 'in stock',
  brand,
  category,
  ogTitle,
  ogDescription,
  ogImage,
  twitterTitle,
  twitterDescription,
  twitterImage
}: SEOHeadProps) {
  const fullTitle = title.includes('Cigarro') ? title : `${title} | Cigarro`;
  
  // Build canonical URL - strip query params and normalize trailing slashes for SEO
  const buildCanonicalUrl = () => {
    let cleanUrl = url;
    
    // Handle absolute URLs
    if (url.startsWith('http')) {
      cleanUrl = url.split('?')[0]; // Remove query params
    } else {
      // Handle relative URLs
      const cleanPath = url.split('?')[0]; // Remove query params
      cleanUrl = `https://cigarro.in${cleanPath}`;
    }
    
    // Normalize trailing slashes
    // Homepage should have trailing slash, other pages should not
    if (cleanUrl === 'https://cigarro.in' || cleanUrl === 'https://cigarro.in/') {
      return 'https://cigarro.in/';
    }
    
    // Remove trailing slashes from all other pages
    return cleanUrl.replace(/\/+$/, '');
  };
  
  const canonicalUrl = buildCanonicalUrl();
  
  // Optimize description length (150-160 chars for best SEO)
  const optimizedDescription = description.length > 160 
    ? description.substring(0, 157) + '...'
    : description;

  // Generate structured data based on type
  const generateStructuredData = () => {
    const baseData = {
      '@context': 'https://schema.org',
      '@type': type === 'product' ? 'Product' : type === 'article' ? 'Article' : 'WebSite',
      name: fullTitle,
      description: optimizedDescription,
      url: canonicalUrl,
      image
    };

    if (type === 'product' && price) {
      return {
        ...baseData,
        '@type': 'Product',
        brand: brand ? { '@type': 'Brand', name: brand } : undefined,
        category,
        offers: {
          '@type': 'Offer',
          price,
          priceCurrency: currency,
          availability: `https://schema.org/${availability === 'in stock' ? 'InStock' : 'OutOfStock'}`,
          url: canonicalUrl,
          seller: {
            '@type': 'Organization',
            name: 'Cigarro'
          }
        }
        // Note: Only add aggregateRating when you have real reviews
      };
    }

    if (type === 'article') {
      return {
        ...baseData,
        '@type': 'Article',
        headline: title,
        author: author ? { '@type': 'Person', name: author } : undefined,
        publisher: {
          '@type': 'Organization',
          name: 'Cigarro',
          logo: {
            '@type': 'ImageObject',
            url: 'https://cigarro.in/logo.png'
          }
        },
        datePublished: publishedTime,
        dateModified: modifiedTime || publishedTime
      };
    }

    return {
      ...baseData,
      '@type': 'WebSite',
      publisher: {
        '@type': 'Organization',
        name: 'Cigarro',
        url: 'https://cigarro.in',
        logo: {
          '@type': 'ImageObject',
          url: 'https://cigarro.in/logo.png'
        }
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://cigarro.in/products?search={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    };
  };

  return (
    <Helmet>
      {/* Preload LCP image if provided */}
      {image && image !== 'https://cigarro.in/logo.png' && (
        <link rel="preload" as="image" href={image} fetchPriority="high" />
      )}

      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={optimizedDescription} />
      <meta name="keywords" content={keywords.join(', ')} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={ogTitle || fullTitle} />
      <meta property="og:description" content={ogDescription || optimizedDescription} />
      <meta property="og:image" content={ogImage || image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Cigarro" />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={twitterTitle || ogTitle || fullTitle} />
      <meta name="twitter:description" content={twitterDescription || ogDescription || optimizedDescription} />
      <meta name="twitter:image" content={twitterImage || ogImage || image} />

      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <meta name="googlebot" content="index, follow" />
      <meta name="bingbot" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      <meta name="author" content={author || 'Cigarro'} />

      {/* Geo Tags */}
      <meta name="geo.region" content="IN" />
      <meta name="geo.placename" content="India" />

      {/* Mobile Meta Tags */}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(generateStructuredData())}
      </script>

      {/* Additional Organization Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Cigarro',
          url: 'https://cigarro.in',
          logo: 'https://cigarro.in/logo.png',
          description: 'India\'s premier online marketplace for premium cigarettes and tobacco products',
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'IN'
          },
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'Customer Service',
            availableLanguage: ['English', 'Hindi']
          }
          // Add sameAs array when you have real social media profiles:
          // sameAs: ['https://instagram.com/your-handle']
        })}
      </script>
    </Helmet>
  );
}
