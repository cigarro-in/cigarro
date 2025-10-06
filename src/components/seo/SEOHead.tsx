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
}

export function SEOHead({
  title = 'Cigarro - Premium Cigarettes & Tobacco Online',
  description = 'India\'s premier online marketplace for premium cigarettes, cigars, and tobacco products. Authentic brands, nationwide delivery, 18+ only.',
  keywords = ['premium cigarettes', 'buy cigars online', 'tobacco products India', 'cigarette delivery', 'authentic cigarettes'],
  image = 'https://cigarro.in/og-image.jpg',
  url = 'https://cigarro.in',
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
  price,
  currency = 'INR',
  availability = 'in stock',
  brand,
  category
}: SEOHeadProps) {
  const fullTitle = title.includes('Cigarro') ? title : `${title} | Cigarro`;
  const canonicalUrl = url.startsWith('http') ? url : `https://cigarro.in${url}`;

  // Generate structured data based on type
  const generateStructuredData = () => {
    const baseData = {
      '@context': 'https://schema.org',
      '@type': type === 'product' ? 'Product' : type === 'article' ? 'Article' : 'WebSite',
      name: fullTitle,
      description,
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
          url: canonicalUrl
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.5',
          reviewCount: '100'
        }
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
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Cigarro" />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

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
          },
          sameAs: [
            'https://facebook.com/cigarro',
            'https://twitter.com/cigarro',
            'https://instagram.com/cigarro'
          ]
        })}
      </script>
    </Helmet>
  );
}
