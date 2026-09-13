// Cloudflare Worker for Homepage Data with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard (see setup guide below)
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
// URL: https://cigarro.in/api/homepage-data
// Wave 3: catalog reads from Convex (fullCatalog bundle); heroes, section
// configs, and blogs from the Convex content queries. Output shape is the
// exact legacy Supabase JSON so the storefront is untouched. Known,
// consumer-free deltas: hero created_at/updated_at/id (null/Convex id),
// blog author email (name only).

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

// Supabase timestamptz serializes "+00:00"; Date.toISOString gives "Z".
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString().replace('Z', '+00:00'));

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Homepage data request received');

    const convexUrl = env.VITE_CONVEX_URL || 'https://proper-coyote-383.convex.cloud';
    const [bundle, heroSlides, featuredCfg, showcaseCfg, blogSecCfg, blogRows, blogCats] = await Promise.all([
      cxQuery(convexUrl, 'catalog:fullCatalog', {}),
      cxQuery(convexUrl, 'content:listHeroSlides', {}),
      cxQuery(convexUrl, 'content:getSectionConfig', { name: 'featured_products' }),
      cxQuery(convexUrl, 'content:getSectionConfig', { name: 'product_showcase' }),
      cxQuery(convexUrl, 'content:getSectionConfig', { name: 'blog_section' }),
      cxQuery(convexUrl, 'content:listBlogPosts', { limit: 6 }),
      cxQuery(convexUrl, 'content:listBlogCategories', {}),
    ]);

    const brandById = new Map((bundle.brands || []).map((b) => [b.supabaseId, b]));
    const variantsByProduct = new Map();
    for (const x of bundle.variants || []) {
      if (!variantsByProduct.has(x.productSupabaseId)) variantsByProduct.set(x.productSupabaseId, []);
      variantsByProduct.get(x.productSupabaseId).push({
        id: x.supabaseId,
        price: x.priceRupees,
        images: x.images ?? [],
        is_active: x.isActive,
        is_default: x.isDefault,
        variant_name: x.variantName,
      });
    }
    const shapeProduct = (p) => {
      const b = p.brandSupabaseId ? brandById.get(p.brandSupabaseId) : null;
      return {
        id: p.supabaseId,
        name: p.name,
        slug: p.slug,
        brand_id: p.brandSupabaseId ?? null,
        description: p.description ?? null,
        is_active: p.isActive,
        created_at: iso(p.createdAt),
        brand: b ? { id: b.supabaseId, name: b.name } : null,
        product_variants: variantsByProduct.get(p.supabaseId) || [],
      };
    };

    const activeProducts = (bundle.products || []).filter((p) => p.isActive);
    const featuredProducts = [...activeProducts]
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 12)
      .map(shapeProduct);
    const showcaseProducts = [...activeProducts]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .slice(0, 6)
      .map(shapeProduct);

    const categories = (bundle.categories || [])
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .slice(0, 20)
      .map((c) => ({
        id: c.supabaseId,
        name: c.name,
        slug: c.slug,
        image: c.image ?? null,
        description: c.description ?? null,
      }));

    const brands = (bundle.brands || [])
      .filter((b) => b.isActive)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .slice(0, 20)
      .map((b) => ({
        id: b.supabaseId,
        name: b.name,
        slug: b.slug,
        description: b.description ?? null,
        logo_url: b.logoUrl ?? null,
        is_active: b.isActive,
      }));

    const heroes = (heroSlides || []).map((s) => ({
      id: s._id,
      title: s.title ?? null,
      suptitle: s.suptitle ?? null,
      description: s.description ?? null,
      image_url: s.imageUrl ?? null,
      mobile_image_url: s.mobileImageUrl ?? null,
      small_image_url: s.smallImageUrl ?? null,
      button_text: s.buttonText ?? null,
      button_url: s.buttonUrl ?? null,
      product_name: s.productName ?? null,
      product_price: s.productPrice ?? null,
      product_image_url: s.productImageUrl ?? null,
      is_active: true,
      sort_order: s.sortOrder ?? 0,
      created_at: null,
      updated_at: null,
      text_position: s.textPosition ?? null,
      text_color: s.textColor ?? null,
      overlay_opacity: s.overlayOpacity ?? null,
      button_style: s.buttonStyle ?? null,
      subtitle: s.subtitle ?? null,
    }));

    const sectionConfig = featuredCfg
      ? {
          title: featuredCfg.title ?? null,
          subtitle: featuredCfg.subtitle ?? null,
          description: featuredCfg.description ?? null,
          button_text: featuredCfg.buttonText ?? null,
          button_url: featuredCfg.buttonUrl ?? null,
          is_enabled: featuredCfg.isEnabled,
        }
      : null;
    const showcaseConfig = showcaseCfg
      ? {
          title: showcaseCfg.title ?? null,
          background_image: showcaseCfg.backgroundImage ?? null,
          button_text: showcaseCfg.buttonText ?? null,
          button_url: showcaseCfg.buttonUrl ?? null,
          is_enabled: showcaseCfg.isEnabled,
        }
      : null;
    const blogSectionConfig = blogSecCfg
      ? {
          title: blogSecCfg.title ?? null,
          subtitle: blogSecCfg.subtitle ?? null,
          description: blogSecCfg.description ?? null,
        }
      : null;

    const catBySlug = new Map((blogCats || []).map((c) => [c.slug, c]));
    const blogPosts = (blogRows || []).map((p) => {
      const c = p.categorySlug ? catBySlug.get(p.categorySlug) : null;
      return {
        id: p._id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? null,
        featured_image: p.featuredImage ?? null,
        published_at: iso(p.publishedAt),
        reading_time: p.readingTime ?? null,
        author: { name: p.authorName || 'Cigarro' },
        category: c ? { name: c.name, color: c.color ?? null } : null,
      };
    });

    // Transform products to include gallery_images from variants and fix brand format
    const transformProducts = (products) => {
      return (products || []).map((product) => {
        const activeVariants = product.product_variants?.filter((v) => v.is_active !== false) || [];
        const images = activeVariants.flatMap((v) => v.images || []);
        return {
          ...product,
          brand: Array.isArray(product.brand) ? product.brand[0] : product.brand,
          gallery_images: images,
          image: images[0] || null,
        };
      });
    };

    const transformedFeaturedProducts = transformProducts(featuredProducts);
    const transformedShowcaseProducts = transformProducts(showcaseProducts);

    // Categories with products
    const productById = new Map(activeProducts.map((p) => [p.supabaseId, p]));
    const joinsByCategory = new Map();
    for (const j of bundle.productCategories || []) {
      if (!joinsByCategory.has(j.categorySupabaseId)) joinsByCategory.set(j.categorySupabaseId, []);
      joinsByCategory.get(j.categorySupabaseId).push(j);
    }
    const transformedCategoriesWithProducts = (bundle.categories || [])
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .slice(0, 6)
      .map((cat) => {
        const products = (joinsByCategory.get(cat.supabaseId) || [])
          .map((j) => productById.get(j.productSupabaseId))
          .filter((p) => p && p.isActive)
          .map((p) => {
            const shaped = shapeProduct(p);
            const activeVariants = shaped.product_variants?.filter((v) => v.is_active !== false) || [];
            const images = activeVariants.flatMap((v) => v.images || []);
            return {
              ...shaped,
              brand: Array.isArray(shaped.brand) ? shaped.brand[0] : shaped.brand,
              gallery_images: images,
              image: images[0] || null,
            };
          });
        return {
          id: cat.supabaseId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description ?? null,
          image: cat.image ?? null,
          products,
        };
      })
      .filter((cat) => cat.products.length > 0);

    const data = {
      featuredProducts: transformedFeaturedProducts,
      categories,
      brands,
      heroSlides: heroes,
      featuredSectionConfig: sectionConfig,
      showcaseConfig,
      showcaseProducts: transformedShowcaseProducts,
      blogPosts,
      blogSectionConfig,
      categoriesWithProducts: transformedCategoriesWithProducts,
    };

    console.log('✅ Homepage data fetched successfully');

    // Return response with proper caching headers
    // Cloudflare will automatically cache this based on Cache-Control
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache for 24 hours in Cloudflare's CDN
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'CDN-Cache-Control': 'max-age=86400',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Homepage data error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch homepage data', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
