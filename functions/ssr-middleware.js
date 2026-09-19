import { requiredConvexUrl } from './lib/env.js';
// SSR Middleware for Cloudflare Pages
// Serves pre-rendered HTML to search engine bots while maintaining SPA for users
// This solves the "duplicate canonical" and indexing issues


// List of bot user agents that should receive pre-rendered HTML
// Keep in sync with functions/_middleware.js
const BOT_USER_AGENTS = [
  'googlebot',
  'google-extended',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'bytespider',
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
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'claude-web',
  'anthropic',
  'perplexity',
  'meta-externalagent',
  'meta-externalfetch',
  'applebot',
  'amazonbot'
];

// Check if request is from a bot
function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

// A2: default share image — real 1200x630 JPEG shipped from public/og-default.jpg.
const OG_DEFAULT_IMAGE = 'https://cigarro.in/og-default.jpg';

// Function responses bypass Cloudflare Pages `_headers`, so prerendered bot
// HTML stamps the same security set inline. Mirrors the `/*` block.
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

// A6: BreadcrumbList JSON-LD + matching visible breadcrumb nav. `items` must be the
// exact ordered model rendered by the visible nav — never include a level that has
// no visible link. All URLs are absolute canonical URLs.
function breadcrumbJsonLd(items) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url
    }))
  });
}

function breadcrumbNavHtml(items) {
  const links = items.map((item, i) => {
    const isLast = i === items.length - 1;
    return isLast
      ? `<li aria-current="page">${escapeHtml(item.name)}</li>`
      : `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a></li>`;
  }).join('');
  return `<nav aria-label="Breadcrumb"><ol>${links}</ol></nav>`;
}

// Wave 3: catalog reads come from Convex. Templates below are untouched —
// Convex rows are adapted to the exact Supabase shapes the templates expect,
// so bot HTML stays byte-identical (gate: canonical/H1/schema asserted).
async function cxQuery(baseUrl, path, args) {
  const res = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`Convex ${path} failed`);
  return body.value;
}

// Generate HTML for product pages
async function generateProductHTML(slug, faviconUrl, convexUrl) {
  try {
    const detail = await cxQuery(convexUrl, 'catalog:getProductBySlug', { slug });
    if (!detail || !detail.product || detail.product.isActive === false) {
      return null;
    }
    const p = detail.product;
    const product = {
      id: p.supabaseId,
      name: p.name,
      slug: p.slug,
      brand: detail.brand ? { name: detail.brand.name, slug: detail.brand.slug } : null,
      description: p.description,
      short_description: p.shortDescription,
      meta_title: p.metaTitle,
      meta_description: p.metaDescription,
      canonical_url: p.canonicalUrl,
      specifications: p.specifications,
      rating_value: p.ratingValue,
      review_count: p.reviewCount,
      product_variants: (detail.variants || []).map(x => ({
        images: x.images,
        is_active: x.isActive,
        is_default: x.isDefault,
        price: x.priceRupees,
        compare_at_price: x.compareAtPriceRupees,
        variant_name: x.variantName,
        variant_slug: x.variantSlug,
        variant_type: x.variantType,
        stock: x.stock,
        track_inventory: x.trackInventory,
      })),
    };

    const specs = product.specifications && typeof product.specifications === 'object' ? product.specifications : {};
    const specRows = Object.entries(specs)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join('');
    const specTable = specRows ? `<h2>Specifications</h2><table>${specRows}</table>` : '';

    const canonicalUrl = product.canonical_url || `https://cigarro.in/product/${slug}`;
    const activeVariants = product.product_variants?.filter(v => v.is_active !== false) || [];
    const variantImages = activeVariants.flatMap(v => v.images || []);
    // Single source of truth (mirrors src/lib/seo/productOffer.ts): the
    // is_default variant, else a deterministic slug/name fallback — never the
    // first priced variant. Price AND availability come from this variant.
    const defaultVariant = activeVariants.find(v => v.is_default === true)
      || [...activeVariants].sort((a, b) =>
        String(a.variant_slug || a.variant_name || '').localeCompare(
          String(b.variant_slug || b.variant_name || '')))[0]
      || null;
    const price = defaultVariant?.price ?? null;
    // Same stock rule as the ?format=json feed: track_inventory === false
    // means "don't track" → available.
    const defaultInStock = defaultVariant
      ? (defaultVariant.track_inventory === false || Number(defaultVariant.stock ?? 0) > 0)
      : false;
    const availability = defaultInStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';
    const defaultVariantKey = defaultVariant
      ? String(defaultVariant.variant_slug || defaultVariant.variant_name || '').toLowerCase().trim().replace(/\s+/g, '-')
      : '';
    const offerUrl = defaultVariantKey
      ? `${canonicalUrl}?variant=${encodeURIComponent(defaultVariantKey)}`
      : canonicalUrl;
    const defaultVariantLabel = defaultVariant?.variant_name || null;
    // Visible MRP discount — only when compare_at_price is a genuine higher MRP.
    const mrp = Number(defaultVariant?.compare_at_price ?? NaN);
    const hasDiscount = price != null && Number.isFinite(mrp) && mrp > price;
    const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
    // Carton offer (audit: expose discounted carton to bots, not just the
    // packet). Carton-type variant with a genuine higher MRP, never the
    // default variant twice. Bots then index both price points.
    const cartonVariant = activeVariants.find(v =>
      v !== defaultVariant &&
      v.variant_type === 'carton' &&
      Number.isFinite(Number(v.price)) && Number(v.price) >= 0 &&
      Number.isFinite(Number(v.compare_at_price)) &&
      Number(v.compare_at_price) > Number(v.price)) || null;
    const cartonInStock = cartonVariant
      ? (cartonVariant.track_inventory === false || Number(cartonVariant.stock ?? 0) > 0)
      : false;
    const cartonKey = cartonVariant
      ? String(cartonVariant.variant_slug || cartonVariant.variant_name || '').toLowerCase().trim().replace(/\s+/g, '-')
      : '';
    const cartonOfferUrl = cartonVariant
      ? `${canonicalUrl}?variant=${encodeURIComponent(cartonKey)}`
      : canonicalUrl;
    const cartonPct = cartonVariant
      ? Math.round(((Number(cartonVariant.compare_at_price) - Number(cartonVariant.price)) / Number(cartonVariant.compare_at_price)) * 100)
      : 0;
    // Honest cross-variant note when the default is out of stock.
    const altInStockVariant = !defaultInStock
      ? activeVariants.find(v => v !== defaultVariant &&
          (v.track_inventory === false || Number(v.stock ?? 0) > 0))
      : null;
    const imageUrl = variantImages[0] || OG_DEFAULT_IMAGE;
    const imageDims = imageUrl === OG_DEFAULT_IMAGE
      ? `\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">`
      : '';
    const title = product.meta_title || `${product.name} | Cigarro`;
    const description = product.meta_description || product.short_description || product.description?.substring(0, 160) || '';
    // Related discovery: same-brand first, fill with other active products (avoids thin
    // single-node pages for brands like Marlboro that only have one SKU).
    let relatedLinks = '';
    try {
      const brandName = product.brand?.name;
      const links = await cxQuery(convexUrl, 'catalog:relatedProductLinks', { excludeSlug: slug, limit: 50 });
      const list = (links || []).map(r => ({
        slug: r.slug,
        name: r.name,
        brand: r.brandName ? { name: r.brandName } : null,
      }));
      const sameBrand = brandName ? list.filter(p => {
        const bn = Array.isArray(p.brand) ? p.brand[0]?.name : p.brand?.name;
        return bn === brandName;
      }) : [];
      const other = list.filter(p => !sameBrand.includes(p));
      const picks = [...sameBrand, ...other].slice(0, 8);
      if (picks.length > 0) {
        relatedLinks = `<nav aria-label="Related products"><h2>Related products</h2><ul>` +
          picks.map(p => `<li><a href="https://cigarro.in/product/${p.slug}">${escapeHtml(p.name)}</a></li>`).join('') +
          `</ul></nav>`;
      }
    } catch { /* related links are best-effort */ }

    // Always link the brand page (B2: every product page → its brand page)
    const brandLink = product.brand?.name && product.brand?.slug
      ? `<nav aria-label="Brand"><h2>Browse by brand</h2><ul><li><a href="https://cigarro.in/brand/${escapeHtml(product.brand.slug)}">All ${escapeHtml(product.brand.name)} products</a></li></ul></nav>`
      : '';

    // A6: breadcrumb model mirrors the visible nav — the brand level is only
    // included when the brand page is visibly linked above.
    const crumbItems = [
      { name: 'Home', url: 'https://cigarro.in/' },
      { name: 'Products', url: 'https://cigarro.in/products' },
    ];
    if (product.brand?.name && product.brand?.slug) {
      crumbItems.push({ name: product.brand.name, url: `https://cigarro.in/brand/${product.brand.slug}` });
    }
    crumbItems.push({ name: product.name, url: canonicalUrl });

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
  <link rel="alternate" type="application/json" title="Machine-readable product data" href="${canonicalUrl}?format=json">
  <link rel="alternate" type="text/markdown" title="Product summary for AI agents" href="${canonicalUrl}?format=md">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:alt" content="${escapeHtml(product.name)}">${imageDims}
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
      // aggregateRating appears automatically once review_count > 0 (0 reviews = omitted).
      ...((product.rating_value != null && product.review_count > 0) ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: product.rating_value,
          reviewCount: product.review_count
        }
      } : {}),
      ...(price != null ? {
        offers: [
          {
          '@type': 'Offer',
          price: price,
          priceCurrency: 'INR',
          availability: availability,
          url: offerUrl,
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'INR' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
              transitTime: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 7, unitCode: 'DAY' }
            }
          },
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'IN',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 2,
            merchantReturnLink: 'https://cigarro.in/returns'
          }
        },
        ...(cartonVariant ? [{
          '@type': 'Offer',
          price: Number(cartonVariant.price),
          priceCurrency: 'INR',
          availability: cartonInStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: cartonOfferUrl,
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'INR' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
              transitTime: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 7, unitCode: 'DAY' }
            }
          },
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'IN',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 2,
            merchantReturnLink: 'https://cigarro.in/returns'
          }
        }] : [])
        ]
      } : {})
    })}
  </script>
  <script type="application/ld+json">
  ${breadcrumbJsonLd(crumbItems)}
  </script>
</head>
<body>
  ${breadcrumbNavHtml(crumbItems)}
  <h1>${escapeHtml(product.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <img src="${imageUrl}" alt="${escapeHtml(product.name)}">
  ${price != null ? `<p>Price: ₹${price}${defaultVariantLabel ? ` (${escapeHtml(defaultVariantLabel)})` : ''} — ${defaultInStock ? 'In stock' : 'Out of stock'}</p>` : ''}
  ${hasDiscount ? `<p>MRP: <s>₹${mrp}</s> — ${discountPct}% off (you save ₹${mrp - price})</p>` : ''}
  ${cartonVariant ? `<p>Carton (${cartonVariant.units_contained || 10} ${escapeHtml(cartonVariant.unit || 'packets')}): ₹${cartonVariant.price} <s>MRP ₹${cartonVariant.compare_at_price}</s> — ${cartonPct}% off (you save ₹${Number(cartonVariant.compare_at_price) - Number(cartonVariant.price)})</p>` : ''}
  ${!defaultInStock && altInStockVariant ? `<p>${escapeHtml(defaultVariantLabel || 'Default variant')} out of stock — ${escapeHtml(altInStockVariant.variant_name || 'another variant')} available.</p>` : ''}
  <p>Brand: ${escapeHtml(product.brand?.name || 'Cigarro')}</p>
  ${specTable}
  ${brandLink}
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

// ============================================================================
// Agent formats (?format=json | ?format=md)
// Same public catalog data Google already indexes. Served to ANY user-agent on
// read-only catalog routes — dumb fetchers (curl, python-requests, chatbot
// fetch tools) send no Accept header and no recognizable UA, so an explicit
// ?format= param is the only reliable contract. Purchase/checkout stays behind
// the age-gated SPA and transactional routes (never exposed here).
// ============================================================================

function stockStatusOf(v) {
  // track_inventory === false means "don't track" → assume available
  if (v.track_inventory === false) return { in_stock: true, stock_status: 'in_stock' };
  const stock = Number(v.stock ?? 0);
  if (stock <= 0) return { in_stock: false, stock_status: 'out_of_stock' };
  if (stock <= 10) return { in_stock: true, stock_status: 'low_stock' };
  return { in_stock: true, stock_status: 'in_stock' };
}

function normalizeVariant(v) {
  const status = stockStatusOf(v);
  return {
    name: v.variant_name,
    type: v.variant_type || null,
    price_inr: Number(v.price),
    mrp_inr: v.compare_at_price != null ? Number(v.compare_at_price) : null,
    per_unit: v.units_contained != null ? { qty: Number(v.units_contained), unit: v.unit || 'sticks' } : null,
    is_default: v.is_default === true,
    ...status,
  };
}

// Convex camelCase rows → the exact normalized shape above, so feed
// serializers stay byte-identical regardless of data source.
function normalizeConvexVariant(x) {
  return normalizeVariant({
    variant_name: x.variantName,
    variant_type: x.variantType,
    price: x.priceRupees,
    compare_at_price: x.compareAtPriceRupees,
    units_contained: x.unitsContained,
    unit: x.unit,
    stock: x.stock,
    track_inventory: x.trackInventory,
    is_default: x.isDefault,
  });
}

// Full product fetch for agent formats (includes stock/unit columns the
// SEO HTML intentionally omits). Convex-backed; output shape unchanged.
async function fetchProductData(slug, convexUrl) {
  const detail = await cxQuery(convexUrl, 'catalog:getProductBySlug', { slug }).catch(() => null);
  if (!detail || !detail.product || detail.product.isActive === false) return null;
  const p = detail.product;
  const brand = detail.brand || null;
  const variants = (detail.variants || [])
    .filter(x => x.isActive !== false)
    .map(normalizeConvexVariant);
  // Same default-variant rule as bot HTML: is_default, else deterministic
  // name order (never database return order).
  const def = variants.find(v => v.is_default)
    || [...variants].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))[0]
    || null;
  const images = (detail.variants || []).flatMap(x => x.images || []);
  let related = [];
  try {
    const links = await cxQuery(convexUrl, 'catalog:relatedProductLinks', { excludeSlug: slug, limit: 8 });
    related = (links || []).map(l => ({ name: l.name, url: `https://cigarro.in/product/${l.slug}` }));
  } catch { /* related links are best-effort */ }
  return {
    kind: 'product',
    name: p.name,
    slug: p.slug,
    url: p.canonicalUrl || `https://cigarro.in/product/${p.slug}`,
    brand: brand ? { name: brand.name, url: brand.slug ? `https://cigarro.in/brand/${brand.slug}` : null } : null,
    description: p.shortDescription || (p.description || '').slice(0, 300) || null,
    image: images[0] || null,
    currency: 'INR',
    price_inr: def ? def.price_inr : null,
    in_stock: def ? def.in_stock : false,
    stock_status: def ? def.stock_status : 'out_of_stock',
    rating: p.reviewCount > 0 && p.ratingValue != null
      ? { value: Number(p.ratingValue), count: Number(p.reviewCount) } : null,
    age_restricted: true,
    health_warning: 'Smoking is injurious to health.',
    specifications: p.specifications && typeof p.specifications === 'object' ? p.specifications : {},
    variants,
    related,
  };
}

function serializeProductJson(norm) {
  return JSON.stringify(norm);
}

function serializeProductMarkdown(norm) {
  const lines = [
    `# ${norm.name}`,
    '',
    '> 21+ only. Smoking is injurious to health.',
    '',
    `- Brand: ${norm.brand ? norm.brand.name : 'Cigarro'}`,
    `- Price: Rs.${norm.price_inr} (${norm.stock_status.replace(/_/g, ' ')})`,
    `- URL: ${norm.url}`,
  ];
  if (norm.description) lines.push(`- About: ${norm.description}`);
  if (norm.rating) lines.push(`- Rating: ${norm.rating.value} (${norm.rating.count} reviews)`);
  lines.push('', '## Variants', '');
  lines.push('| Variant | Price (INR) | Stock | Pack |');
  lines.push('|---|---|---|---|');
  norm.variants.forEach(v => {
    const pack = v.per_unit ? `${v.per_unit.qty} ${v.per_unit.unit}` : '-';
    lines.push(`| ${String(v.name).replace(/\|/g, '\\|')} | ${v.price_inr} | ${v.stock_status} | ${pack} |`);
  });
  if (norm.related.length) {
    lines.push('', '## Related', '');
    norm.related.forEach(r => lines.push(`- [${r.name}](${r.url})`));
  }
  return lines.join('\n');
}

// Search over the Convex fullCatalog bundle (in-memory substring match =
// the old RPC's ILIKE semantics; empty query lists the active catalog).
// Output shape matches the old RPC path exactly; search never hard-fails.
async function fetchSearchResults(query, convexUrl) {
  const q = (query || '').trim().toLowerCase().slice(0, 100);
  let full = null;
  try {
    full = await cxQuery(convexUrl, 'catalog:fullCatalog', {});
  } catch (e) {
    console.error('convex fullCatalog failed:', e.message);
    return [];
  }
  const brandBySupabaseId = new Map((full.brands || []).map(b => [b.supabaseId, b]));
  const variantsByProduct = {};
  (full.variants || []).filter(x => x.isActive !== false).forEach(x => {
    (variantsByProduct[x.productSupabaseId] = variantsByProduct[x.productSupabaseId] || []).push(x);
  });
  const match = (...texts) => !q || texts.some(t => String(t || '').toLowerCase().includes(q));
  const results = [];

  for (const p of (full.products || []).filter(p => p.isActive !== false)) {
    const brand = p.brandSupabaseId ? brandBySupabaseId.get(p.brandSupabaseId) : null;
    const cxVars = variantsByProduct[p.supabaseId] || [];
    const variants = cxVars.map(normalizeConvexVariant);
    if (!match(p.name, p.description, brand ? brand.name : null, ...cxVars.map(x => x.variantName))) continue;
    const def = variants.find(v => v.is_default)
      || [...variants].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))[0]
      || null;
    const images = cxVars.flatMap(x => x.images || []);
    results.push({
      kind: 'product',
      name: p.name,
      slug: p.slug,
      url: `https://cigarro.in/product/${p.slug}`,
      brand: brand ? brand.name : null,
      price_inr: def ? def.price_inr : null,
      image: images[0] || null,
      in_stock: def ? def.in_stock : true,
      stock_status: def ? def.stock_status : 'unknown',
      variant: def ? def.name : null,
      variants: variants.length > 1 ? variants : undefined,
    });
    if (results.length >= 20) break;
  }

  for (const c of (full.combos || []).filter(c => c.isActive !== false)) {
    if (!match(c.name, c.description)) continue;
    results.push({
      kind: 'combo',
      name: c.name,
      url: `https://cigarro.in/products?search=${encodeURIComponent(c.slug || c.name)}`,
      brand: null,
      price_inr: c.comboPriceRupees != null ? Number(c.comboPriceRupees) : null,
      image: (c.galleryImages || [])[0] || null,
      in_stock: true,
      note: 'Combo — contents and availability confirmed on page.',
    });
    if (results.length >= 30) break;
  }
  return results;
}

function serializeSearchJson(query, results) {
  return JSON.stringify({ query, count: results.length, results });
}

function serializeSearchMarkdown(query, results) {
  const lines = [`# Search: ${query || '(catalog)'}`, '', `> 21+ only. Smoking is injurious to health.`, ''];
  if (!results.length) return lines.concat('No matches. Try a brand name (e.g. Marlboro, Dunhill) + packet/carton.').join('\n');
  results.forEach(r => {
    lines.push(`- [${r.name}](${r.url}) — Rs.${r.price_inr}${r.variant ? ` (${r.variant})` : ''} — ${r.in_stock ? r.stock_status || 'in stock' : 'out of stock'}`);
  });
  return lines.join('\n');
}

function agentFormatResponse(body, format) {
  const isJson = format === 'json';
  return new Response(body, {
    headers: {
      'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=600',
      'Access-Control-Allow-Origin': '*',
      // ?format= URLs are alternates of canonical pages — never index them.
      'X-Robots-Tag': 'noindex',
    },
  });
}

// Generate HTML for category pages
async function generateCategoryHTML(slug, faviconUrl, convexUrl) {
  try {
    const detail = await cxQuery(convexUrl, 'catalog:getCategoryDetail', { slug });
    if (!detail || !detail.category) {
      return null;
    }
    const category = {
      id: detail.category.supabaseId,
      name: detail.category.name,
      slug: detail.category.slug,
      description: detail.category.description,
      meta_title: detail.category.metaTitle,
      meta_description: detail.category.metaDescription,
    };

    const canonicalUrl = `https://cigarro.in/category/${slug}`;
    const title = category.meta_title || `${category.name} | Cigarro`;
    const description = category.meta_description || category.description || `Shop premium ${category.name} at Cigarro`;
    // Product links so bots can discover depth
    let productLinks = '';
    try {
      const items = (detail.products || []).slice(0, 20);
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
  <meta property="og:image" content="${OG_DEFAULT_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${OG_DEFAULT_IMAGE}">
  <meta name="twitter:image:alt" content="${escapeHtml(title)}">
  
  <script type="application/ld+json">
  ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: category.name,
      description: description,
      url: canonicalUrl
    })}
  </script>
  <script type="application/ld+json">
  ${breadcrumbJsonLd([
      { name: 'Home', url: 'https://cigarro.in/' },
      { name: 'Categories', url: 'https://cigarro.in/categories' },
      { name: category.name, url: canonicalUrl }
    ])}
  </script>
</head>
<body>
  ${breadcrumbNavHtml([
      { name: 'Home', url: 'https://cigarro.in/' },
      { name: 'Categories', url: 'https://cigarro.in/categories' },
      { name: category.name, url: canonicalUrl }
    ])}
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
async function generateBrandHTML(slug, faviconUrl, convexUrl) {
  try {
    const detail = await cxQuery(convexUrl, 'catalog:getBrandDetail', { slug });
    if (!detail || !detail.brand) {
      return null;
    }
    const brand = {
      id: detail.brand.supabaseId,
      name: detail.brand.name,
      slug: detail.brand.slug,
      description: detail.brand.description,
      meta_title: detail.brand.metaTitle,
      meta_description: detail.brand.metaDescription,
      logo_url: detail.brand.logoUrl,
    };

    const canonicalUrl = `https://cigarro.in/brand/${slug}`;
    const title = brand.meta_title || `${brand.name} Products | Cigarro`;
    const description = brand.meta_description || brand.description || `Shop premium ${brand.name} cigarettes and tobacco products at Cigarro`;
    let productLinks = '';
    try {
      const products = (detail.products || []).slice(0, 12);
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
  <meta property="og:image:alt" content="${escapeHtml(brand.name)}">` : `<meta property="og:image" content="${OG_DEFAULT_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(brand.name)}">`}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${brand.logo_url || OG_DEFAULT_IMAGE}">
  <meta name="twitter:image:alt" content="${escapeHtml(brand.name)}">
  
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
  <script type="application/ld+json">
  ${breadcrumbJsonLd([
      { name: 'Home', url: 'https://cigarro.in/' },
      { name: 'Brands', url: 'https://cigarro.in/brands' },
      { name: brand.name, url: canonicalUrl }
    ])}
  </script>
</head>
<body>
  ${breadcrumbNavHtml([
      { name: 'Home', url: 'https://cigarro.in/' },
      { name: 'Brands', url: 'https://cigarro.in/brands' },
      { name: brand.name, url: canonicalUrl }
    ])}
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
  const title = 'Cigarro | Cigarettes and Tobacco Products Online';
  const description = 'Browse cigarette brands, variants, pack options and related tobacco products online at Cigarro. For adults of legal smoking age only.';

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
  <meta property="og:image" content="${OG_DEFAULT_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:site_name" content="Cigarro">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${OG_DEFAULT_IMAGE}">
  <meta name="twitter:image:alt" content="${escapeHtml(title)}">
  
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
  <h1>Cigarro | Cigarettes and Tobacco Products Online</h1>
  <p>${escapeHtml(description)}</p>
  
  <!-- This content is for search engines. Real users get the SPA. -->
  <noscript>
    <p>Please enable JavaScript to view the full interactive experience.</p>
  </noscript>
</body>
</html>`;
}

// Generate HTML for static pages. For /blogs the bot body also lists the
// latest posts (crawlable internal links); failures degrade to title + desc.
async function generateStaticPageHTML(pathname, faviconUrl, convexUrl) {
  const pages = {
    '/about': {
      title: 'About Cigarro | Online Cigarette Store in India',
      description: 'Learn how Cigarro helps adult customers in India browse cigarette brands, compare pack options and find clear product information online.',
      body: '<h2>Clear information makes choosing simpler.</h2><p>Cigarro organises products by brand and category, with listings designed to show the variant, format, quantity and current price before an order is placed.</p><nav aria-label="Explore Cigarro"><a href="/products">Browse products</a> · <a href="/brands">Explore brands</a> · <a href="/contact">Contact support</a></nav>'
    },
    '/contact': {
      title: 'Contact Cigarro | Order and Product Support',
      description: 'Contact Cigarro for help with an order, a product listing, shipping or using the online store. Email support@cigarro.in.',
      body: '<h2>Email Cigarro support</h2><p>For an order question, include the order number and phone number used at checkout. For a product question, include the product name or page link.</p><p><a href="mailto:support@cigarro.in">support@cigarro.in</a></p><nav aria-label="Customer policies"><a href="/shipping">Shipping policy</a> · <a href="/returns">Returns policy</a></nav>'
    },
    '/products': {
      title: 'All Cigarettes and Tobacco Products | Cigarro',
      description: 'Browse the current Cigarro catalogue by product, brand, variant, pack option, price and availability.'
    },
    '/categories': {
      title: 'Cigarette and Tobacco Product Categories | Cigarro',
      description: 'Browse cigarettes, rolling papers, filter tips and other available products by category at Cigarro.'
    },
    '/brands': {
      title: 'Cigarette and Tobacco Brands | Cigarro',
      description: 'Browse the cigarette, cigar and rolling accessory brands currently listed in the Cigarro catalogue.'
    },
    '/blogs': {
      title: 'Cigarette Brand and Product Guides | Cigarro',
      description: 'Read Cigarro guides to cigarette brands, variants, pack formats and related tobacco products.'
    },
    '/terms': {
      title: 'Terms of Service | Cigarro',
      description: 'Read the terms that apply when you browse, create an account or place an order with Cigarro.'
    },
    '/privacy': {
      title: 'Privacy Policy | Cigarro',
      description: 'Learn what personal information Cigarro collects, why it is used, when it may be shared and how to make a privacy request.'
    },
    '/shipping': {
      title: 'Shipping and Delivery Policy | Cigarro',
      description: 'See how Cigarro delivery availability, shipping options, dispatch, tracking and age verification work for orders within India.'
    },
    '/returns': {
      title: 'Returns & Replacement Policy - Damaged Items',
      description: 'Returns policy for Cigarro: damaged or incorrect tobacco items are replaced free if reported within 48 hours of delivery. Consumables are otherwise non-returnable.'
    },
    '/legal': {
      title: 'Cigarro Policies | Terms, Privacy, Shipping and Returns',
      description: 'Find Cigarro\'s terms of service, privacy policy, shipping information and returns and refunds policy.'
    }
  };

  const pageInfo = pages[pathname] || pages['/'];
  const canonicalUrl = `https://cigarro.in${pathname}`;

  let postsNav = '';
  let postsSchema = '';
  if (pathname === '/blogs' && convexUrl) {
    try {
      const rows = await cxQuery(convexUrl, 'content:listBlogPosts', { limit: 50 });
      const items = (rows || []).map((p) => ({
        title: p.title,
        url: `https://cigarro.in/blog/${p.slug}`,
      }));
      if (items.length > 0) {
        postsNav = `<nav aria-label="Blog posts"><ul>\n${items.map((p) => `    <li><a href="${p.url}">${escapeHtml(p.title)}</a></li>`).join('\n')}\n  </ul></nav>`;
        postsSchema = `
  <!-- Structured Data: blog listing -->
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageInfo.title,
    itemListElement: items.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: p.url,
      name: p.title,
    })),
  })}
  </script>`;
      }
    } catch {
      // Degrade to title + description (still indexable, still self-canonical).
    }
  }

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
  <meta property="og:image" content="${OG_DEFAULT_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(pageInfo.title)}">
  <meta property="og:site_name" content="Cigarro">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(pageInfo.title)}">
  <meta name="twitter:description" content="${escapeHtml(pageInfo.description)}">
  <meta name="twitter:image" content="${OG_DEFAULT_IMAGE}">
  <meta name="twitter:image:alt" content="${escapeHtml(pageInfo.title)}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: pageInfo.title,
    description: pageInfo.description,
    url: canonicalUrl
  })}
  </script>${postsSchema}
</head>
<body>
  <h1>${escapeHtml(pageInfo.title)}</h1>
  <p>${escapeHtml(pageInfo.description)}</p>
  ${pageInfo.body || ''}
  ${postsNav}
  
  <!-- This content is for search engines. Real users get the SPA. -->
  <noscript>
    <p>Please enable JavaScript to view the full interactive experience.</p>
  </noscript>
</body>
</html>`;
}

// Generate HTML for blog posts
async function generateBlogHTML(slug, faviconUrl, convexUrl) {
  try {
    const row = await cxQuery(convexUrl, 'content:getBlogPostBySlug', { slug });
    if (!row) {
      return null;
    }
    const post = {
      id: row._id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      content: row.content,
      featured_image: row.featuredImage,
      meta_title: row.metaTitle,
      meta_description: row.metaDescription,
      published_at: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
      updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      author: { name: row.authorName },
    };

    const canonicalUrl = `https://cigarro.in/blog/${slug}`;
    // A2: no featured image → omit og:image entirely (never substitute a logo).
    const imageUrl = post.featured_image || null;
    const title = post.meta_title || `${post.title} | Cigarro Blog`;
    const description = post.meta_description || post.excerpt || post.content?.substring(0, 160) || '';
    const authorName = post.author?.name || 'Cigarro';
    const publishedDate = post.published_at ? new Date(post.published_at).toISOString() : new Date().toISOString();
    // dateModified honors content refreshes (Convex updatedAt); a refresh
    // that predates publishing data falls back to the publish date.
    const modifiedDate = post.updated_at || publishedDate;

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
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">
  <meta property="og:image:alt" content="${escapeHtml(post.title)}">` : ''}
  <meta property="og:site_name" content="Cigarro">
  <meta property="article:published_time" content="${publishedDate}">
  <meta property="article:author" content="${escapeHtml(authorName)}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(post.title)}">` : ''}
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: description,
      ...(imageUrl ? { image: imageUrl } : {}),
      datePublished: publishedDate,
      dateModified: modifiedDate,
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
  <script type="application/ld+json">
  ${breadcrumbJsonLd([
      { name: 'Home', url: 'https://cigarro.in/' },
      { name: 'Blog', url: 'https://cigarro.in/blogs' },
      { name: post.title, url: canonicalUrl }
    ])}
  </script>
</head>
<body>
  ${breadcrumbNavHtml([
      { name: 'Home', url: 'https://cigarro.in/' },
      { name: 'Blog', url: 'https://cigarro.in/blogs' },
      { name: post.title, url: canonicalUrl }
    ])}
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    <p><strong>By ${escapeHtml(authorName)}</strong> | <time datetime="${publishedDate}">${new Date(publishedDate).toLocaleDateString()}</time></p>
    ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(post.title)}">` : ''}
    <p>${escapeHtml(post.excerpt || description)}</p>
    ${sanitizeBlogHtml(post.content)}
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

// Sanitized blog body for bot HTML: full article text with real crawlable
// links. Allowlist-based — strips scripts, styles, event handlers,
// javascript:/data: URLs and non-content tags. Relative hrefs/srcs become
// absolute canonical URLs. Anything unparseable degrades to plain text.
function sanitizeBlogHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let out = String(html);
  out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style\s*>/gi, '');
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/<(\/?)(?!(p|h2|h3|h4|ul|ol|li|a|strong|em|b|i|br|blockquote)\b)[a-zA-Z][^>]*>/g, '');
  out = out.replace(/<a(\s[^>]*)?>/gi, (tag) => {
    const href = /href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(tag);
    if (!href) return '<a>';
    let url = href[1].replace(/^['"]|['"]$/g, '');
    if (/^\s*(javascript|data|vbscript):/i.test(url)) return '<a>';
    if (url.startsWith('/')) url = `https://cigarro.in${url}`;
    if (!/^https:\/\/cigarro\.in\//i.test(url)) return '<a>';
    return `<a href="${url}">`;
  });
  return out;
}

// Generate HTML for the /agents entry point (AI shopping agents).
// Static content — mirrors src/pages/agents/AgentsPage.tsx. Keep in sync.
function generateAgentsHTML(faviconUrl) {
  const canonicalUrl = 'https://cigarro.in/agents';
  const title = 'Shopping Agents — Start Here | Cigarro';
  const description = 'Machine-readable guide for AI shopping agents: catalog entry points, search template, variant semantics, and compliance rules for cigarro.in. 21+ only.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" type="application/json" title="Agent manifest (JSON)" href="${canonicalUrl}?format=json">
  <link rel="alternate" type="text/markdown" title="Agent manual (Markdown)" href="${canonicalUrl}?format=md">
  <link rel="icon" href="${faviconUrl}">
  <script type="application/ld+json">
  ${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: description,
    url: canonicalUrl,
    about: {
      '@type': 'ItemList',
      name: 'Agent entry points',
      itemListElement: [
        { '@type': 'ListItem', position: 1, url: 'https://cigarro.in/products', name: 'Product catalog' },
        { '@type': 'ListItem', position: 2, url: 'https://cigarro.in/brands', name: 'Brands' },
        { '@type': 'ListItem', position: 3, url: 'https://cigarro.in/categories', name: 'Categories' },
        { '@type': 'ListItem', position: 4, url: 'https://cigarro.in/llms.txt', name: 'Store manual for LLMs' },
        { '@type': 'ListItem', position: 5, url: 'https://cigarro.in/sitemap.xml', name: 'Sitemap' }
      ]
    }
  })}
  </script>
</head>
<body>
  <h1>Agents start here</h1>
  <p>${escapeHtml(description)}</p>
  <h2>Compliance (non-negotiable)</h2>
  <ul>
    <li>Buyers must be 18+ (21+ in Karnataka). Never facilitate underage purchase.</li>
    <li>Smoking is injurious to health. Cigarro does not promote tobacco use.</li>
  </ul>
  <h2>Entry points</h2>
  <ul>
    <li><a href="https://cigarro.in/products">/products</a> — full catalog</li>
    <li><a href="https://cigarro.in/brands">/brands</a> — all brands</li>
    <li><a href="https://cigarro.in/categories">/categories</a> — all categories</li>
    <li>/product/:slug — one product, variants + price + stock</li>
    <li>/brand/:slug — brand collection</li>
    <li>/category/:slug — category listing</li>
  </ul>
  <h2>Search</h2>
  <p>Search template: https://cigarro.in/products?search={query} — e.g. ?search=Dunhill+Red+carton. Search understands packet / carton / half-carton / combo synonyms.</p>
  <h2>Variant semantics</h2>
  <ul>
    <li>packet — single pack; carton — box of 10 packets; half-carton — 5 packets; combo — bundle offer.</li>
    <li>Price and stock live on the variant, not the product. Always quote the variant price in INR with stock status.</li>
  </ul>
  <h2>Rules for agents</h2>
  <ul>
    <li>Read-only: browse, compare, link. Do not auto-purchase — checkout needs human UPI payment.</li>
    <li>Machine files: <a href="https://cigarro.in/llms.txt">/llms.txt</a>, <a href="https://cigarro.in/sitemap.xml">/sitemap.xml</a></li>
  </ul>
</body>
</html>`;
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

// Paths that never get edge rendering (admin, APIs, user-specific flows)
function isExcludedPath(pathname) {
  return pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/wishlist') ||
    pathname.startsWith('/payment');
}

// Returns the entity slug when pathname is a single-segment catalog detail URL
// (/product/:slug, /brand/:slug, /category/:slug, /blog/:slug), else null.
// Multi-segment paths (e.g. /category/:category/:brand, a valid SPA route) are
// NOT catalog detail URLs and fall through to normal SPA routing untouched.
function catalogSlug(pathname) {
  const m = pathname.match(/^\/(product|brand|category|blog)\/([^/]+?)\/?$/);
  return m ? decodeURIComponent(m[2]) : null;
}

// Branded 404 for dead catalog URLs (audit A5). Served with HTTP 404 +
// noindex so crawlers drop the URL instead of burning budget on the 200
// age-gate SPA shell (soft 404). No canonical: 404s must not be canonicalized.
// No offer/price markup here by design — there is no entity to describe.
function generateNotFoundHTML(requestedPath, faviconUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page not found | Cigarro</title>
  <meta name="description" content="The page you requested does not exist. Browse Cigarro's catalog, brands and categories instead.">
  <meta name="robots" content="noindex, follow">
  <link rel="icon" href="${faviconUrl}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Page not found | Cigarro">
  <meta property="og:description" content="This page does not exist. Browse the Cigarro catalog instead.">
  <meta property="og:site_name" content="Cigarro">
</head>
<body>
  <h1>Page not found</h1>
  <p>No page exists at ${escapeHtml(requestedPath)}. It may have been removed or the link may be incorrect.</p>
  <form action="https://cigarro.in/products" method="get" role="search">
    <label for="q">Search the catalog</label>
    <input id="q" type="search" name="search" placeholder="Brand or product, e.g. Dunhill">
    <button type="submit">Search</button>
  </form>
  <nav aria-label="Site"><ul>
    <li><a href="https://cigarro.in/">Home</a></li>
    <li><a href="https://cigarro.in/products">All products</a></li>
    <li><a href="https://cigarro.in/categories">Categories</a></li>
    <li><a href="https://cigarro.in/brands">Brands</a></li>
    <li><a href="https://cigarro.in/blogs">Blog</a></li>
  </ul></nav>
</body>
</html>`;
}

// Read-only catalog routes eligible for explicit ?format= (any UA)
function isAgentFormatRoute(pathname) {
  return pathname === '/agents' ||
    pathname === '/products' ||
    pathname.startsWith('/product/');
}

// Static manifest for /agents?format= (mirrors the /agents page)
const AGENTS_MANIFEST = {
  entry: 'https://cigarro.in/agents',
  search_template: 'https://cigarro.in/products?search={query}',
  product_url_pattern: 'https://cigarro.in/product/:slug',
  alternates: { json: '?format=json', markdown: '?format=md' },
  catalog_feed: 'https://cigarro.in/api/products',
  sitemap: 'https://cigarro.in/sitemap.xml',
  llms: 'https://cigarro.in/llms.txt',
  compliance: {
    age: '18+ (21+ in Karnataka). Never facilitate underage purchase.',
    health_warning: 'Smoking is injurious to health. Cigarro does not promote tobacco use.',
  },
  variant_semantics: {
    packet: 'single pack (see units_contained for stick count)',
    carton: 'box of 10 packets',
    half_carton: '5 packets',
    combo: 'bundle / special offer',
  },
  rules: [
    'Read-only: browse, compare, link. Do not auto-purchase — checkout needs human UPI payment.',
    'Always quote the selected variant (packet vs carton) with price in INR and stock status.',
    'Price and stock live on the variant, not the product.',
  ],
};

const AGENTS_MARKDOWN = [
  '# Agents start here — cigarro.in',
  '',
  '> 21+ only (18+ outside Karnataka). Smoking is injurious to health.',
  '',
  '- Search: https://cigarro.in/products?search={query} (append ?format=json for JSON)',
  '- Product: https://cigarro.in/product/:slug (append ?format=json for JSON)',
  '- Catalog feed: https://cigarro.in/api/products',
  '- Sitemap: https://cigarro.in/sitemap.xml — Manual: https://cigarro.in/llms.txt',
  '',
  '## Variant semantics',
  '',
  '- packet = single pack; carton = 10 packets; half-carton = 5 packets; combo = bundle.',
  '- Price and stock live on the variant. Read-only: do not auto-purchase.',
].join('\n');

// Main middleware function
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // Only prerender for bots — except explicit ?format= on catalog routes (any UA).
  // Dumb fetchers send no Accept header and no recognizable UA, so the explicit
  // param is the contract. The data is the same public catalog Google indexes.
  const formatParam = (url.searchParams.get('format') || '').toLowerCase();
  const wantsAgentFormat = (formatParam === 'json' || formatParam === 'md') &&
    isAgentFormatRoute(url.pathname);
  if (!isBot(userAgent) && !wantsAgentFormat) {
    return next();
  }

  // Skip for admin, API, and user-specific pages
  if (isExcludedPath(url.pathname)) {
    return next();
  }

  try {
    // Wave 8: all catalog reads (bot HTML + search + ?format= feeds) come
    // from Convex. Supabase is fully decoupled from this middleware.
    const convexUrl = requiredConvexUrl(env);

    // Use static favicon path (no database fetch needed)
    const faviconUrl = 'https://cigarro.in/icons/android-chrome-512x512.png';

    // Explicit agent formats first (any UA, catalog routes only)
    if (wantsAgentFormat) {
      try {
        if (url.pathname === '/agents') {
          return agentFormatResponse(
            formatParam === 'json' ? JSON.stringify(AGENTS_MANIFEST) : AGENTS_MARKDOWN,
            formatParam
          );
        }
        if (url.pathname === '/products') {
          const q = url.searchParams.get('search') || '';
          const results = await fetchSearchResults(q, convexUrl);
          return agentFormatResponse(
            formatParam === 'json' ? serializeSearchJson(q, results) : serializeSearchMarkdown(q, results),
            formatParam
          );
        }
        if (url.pathname.startsWith('/product/')) {
          const slug = url.pathname.replace('/product/', '').split('?')[0];
          const norm = await fetchProductData(slug, convexUrl);
          if (!norm) {
            return new Response(
              formatParam === 'json' ? JSON.stringify({ error: 'Product not found', slug }) : '# Not found\n\nNo active product for this URL.',
              { status: 404, headers: { 'Content-Type': formatParam === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8', 'X-Robots-Tag': 'noindex' } }
            );
          }
          return agentFormatResponse(
            formatParam === 'json' ? serializeProductJson(norm) : serializeProductMarkdown(norm),
            formatParam
          );
        }
      } catch (error) {
        console.error('Agent format error:', { path: url.pathname, error: error.message });
        return new Response(
          formatParam === 'json' ? JSON.stringify({ error: 'temporarily unavailable' }) : '# Unavailable\n\nTry again shortly.',
          { status: 500, headers: { 'Content-Type': formatParam === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8', 'X-Robots-Tag': 'noindex' } }
        );
      }
      return next();
    }

    // HTML prerender stays bot-only (unchanged SEO behavior)
    if (!isBot(userAgent)) {
      return next();
    }

    let html = null;
    // True when the path looked like a catalog detail URL but the DB lookup
    // returned no ACTIVE entity (audit A5). Inactive products stay
    // non-indexable: they hit this branch exactly like unknown slugs.
    let catalogMiss = false;

    // Generate appropriate HTML based on route
    if (url.pathname === '/' || url.pathname === '') {
      html = generateHomepageHTML(faviconUrl);
    } else if (url.pathname === '/agents') {
      html = generateAgentsHTML(faviconUrl);
    } else if (url.pathname === '/about' || url.pathname === '/contact' ||
      url.pathname === '/products' || url.pathname === '/categories' ||
      url.pathname === '/brands' || url.pathname === '/blogs' ||
      url.pathname === '/terms' || url.pathname === '/privacy' ||
      url.pathname === '/shipping' || url.pathname === '/returns' ||
      url.pathname === '/legal') {
      html = await generateStaticPageHTML(url.pathname, faviconUrl, convexUrl);
    } else if (url.pathname.startsWith('/product/')) {
      const slug = catalogSlug(url.pathname);
      if (slug !== null) {
        html = await generateProductHTML(slug, faviconUrl, convexUrl);
        if (!html) catalogMiss = true;
      }
    } else if (url.pathname.startsWith('/category/')) {
      const slug = catalogSlug(url.pathname);
      if (slug !== null) {
        html = await generateCategoryHTML(slug, faviconUrl, convexUrl);
        if (!html) catalogMiss = true;
      }
    } else if (url.pathname.startsWith('/brand/')) {
      const slug = catalogSlug(url.pathname);
      if (slug !== null) {
        html = await generateBrandHTML(slug, faviconUrl, convexUrl);
        if (!html) catalogMiss = true;
      }
    } else if (url.pathname.startsWith('/blog/')) {
      const slug = catalogSlug(url.pathname);
      if (slug !== null) {
        html = await generateBlogHTML(slug, faviconUrl, convexUrl);
        if (!html) catalogMiss = true;
      }
    }

    // Dead catalog URL: branded 404, never the SPA shell (soft 404).
    if (!html && catalogMiss) {
      return new Response(generateNotFoundHTML(url.pathname, faviconUrl), {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, follow',
          // Function responses bypass _headers — stamp the set here.
          ...SECURITY_HEADERS,
        }
      });
    }

    // If we generated HTML, return it
    if (html) {
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          'X-Robots-Tag': 'index, follow',
          ...SECURITY_HEADERS,
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
