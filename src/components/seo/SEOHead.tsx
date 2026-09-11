import { Helmet } from 'react-helmet-async';

// A2 share-image defaults. og-default.jpg is a real 1200x630 JPEG in public/.
// The 512px icon is a valid image for Organization/publisher logos (never a share image).
const DEFAULT_SHARE_IMAGE = 'https://cigarro.in/og-default.jpg';
const SITE_LOGO_URL = 'https://cigarro.in/icons/android-chrome-512x512.png';

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
  // Exact-variant offer URL (canonical page URL + ?variant=<slug>). When set,
  // JSON-LD offers.url names the variant while <link rel="canonical"> stays
  // clean. Sole emitter of product:price:* meta on product pages.
  offerUrl?: string;
  brand?: string;
  category?: string;
  // Ratings pipeline (populated from product.rating_value / product.review_count once live).
  // aggregateRating + review are only emitted when reviewCount > 0 — emitting placeholder
  // ratings with zero reviews violates Google's spam policies and can get rich results suppressed.
  ratingValue?: number;
  reviewCount?: number;
  reviews?: Array<{ author: string; rating: number; body: string; datePublished?: string }>;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  // Crawl directive override — default keeps every existing caller indexable;
  // NotFoundPage passes 'noindex, follow'.
  robots?: string;
}

export function SEOHead({
  title = 'Cigarro - Premium Cigarettes & Tobacco Online',
  description = 'India\'s premier online marketplace for premium cigarettes, cigars, and tobacco products. Authentic brands, nationwide delivery.',
  keywords = ['premium cigarettes', 'buy cigars online', 'tobacco products India', 'cigarette delivery', 'authentic cigarettes'],
  image,
  url = 'https://cigarro.in',
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
  price,
  currency = 'INR',
  availability = 'in stock',
  offerUrl,
  brand,
  category,
  ratingValue,
  reviewCount,
  reviews,
  ogTitle,
  ogDescription,
  ogImage,
  twitterTitle,
  twitterDescription,
  twitterImage,
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
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

  // og:type only supports website/article/profile — never "product".
  // For products we emit website + product: namespace tags below.
  const ogType = type === 'article' ? 'article' : 'website';
  // A2: articles with no featured/og image omit og:image entirely rather than
  // substituting a logo. All other templates fall back to the default share image.
  const omitImage = type === 'article' && !image && !ogImage && !twitterImage;
  const resolvedImage = image ?? DEFAULT_SHARE_IMAGE;
  const shareImage = omitImage ? undefined : (ogImage || resolvedImage);
  const twitterShareImage = omitImage ? undefined : (twitterImage || ogImage || resolvedImage);
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
      image: shareImage
    };

    if (type === 'product' && price) {
      const hasRealReviews = reviewCount != null && reviewCount > 0 && ratingValue != null;
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
          url: offerUrl || canonicalUrl,
          seller: {
            '@type': 'Organization',
            name: 'Cigarro'
          },
          // Standard shipping: 5-7 business days, free, India-wide
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: 0,
              currency
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'IN'
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 2,
                unitCode: 'DAY'
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 5,
                maxValue: 7,
                unitCode: 'DAY'
              }
            }
          },
          // Consumables are non-returnable; damaged/incorrect items get a free
          // replacement if reported within 48h — full policy at /returns
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'IN',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 2,
            merchantReturnLink: 'https://cigarro.in/returns'
          }
        },
        // Only emitted with real reviews — never placeholders (Google spam policy)
        ...(hasRealReviews
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue,
                reviewCount
              },
              ...(reviews && reviews.length > 0
                ? {
                    review: reviews.map(r => ({
                      '@type': 'Review',
                      author: { '@type': 'Person', name: r.author },
                      reviewRating: {
                        '@type': 'Rating',
                        ratingValue: r.rating,
                        bestRating: 5
                      },
                      reviewBody: r.body,
                      ...(r.datePublished ? { datePublished: r.datePublished } : {})
                    }))
                  }
                : {})
            }
          : {})
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
            url: SITE_LOGO_URL
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
          url: SITE_LOGO_URL
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
      {shareImage && shareImage !== DEFAULT_SHARE_IMAGE && (
        <link rel="preload" as="image" href={shareImage} fetchPriority="high" />
      )}

      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={optimizedDescription} />
      <meta name="keywords" content={keywords.join(', ')} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook — og:type must be website/article, never "product" */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={ogTitle || fullTitle} />
      <meta property="og:description" content={ogDescription || optimizedDescription} />
      {shareImage && (
        <>
          <meta property="og:image" content={shareImage} />
          <meta property="og:image:alt" content={ogTitle || fullTitle} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
        </>
      )}
      <meta property="og:site_name" content="Cigarro" />
      <meta property="og:locale" content="en_IN" />
      {type === 'product' && (
        <>
          {price && <meta property="product:price:amount" content={price} />}
          <meta property="product:price:currency" content={currency} />
          {brand && <meta property="product:brand" content={brand} />}
          {availability && <meta property="product:availability" content={availability} />}
        </>
      )}

      {/* Twitter — must use name=, not property= */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={twitterTitle || ogTitle || fullTitle} />
      <meta name="twitter:description" content={twitterDescription || ogDescription || optimizedDescription} />
      {twitterShareImage && (
        <>
          <meta name="twitter:image" content={twitterShareImage} />
          <meta name="twitter:image:alt" content={twitterTitle || ogTitle || fullTitle} />
        </>
      )}

      {/* Additional Meta Tags */}
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <meta name="bingbot" content={robots} />
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
          logo: SITE_LOGO_URL,
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
