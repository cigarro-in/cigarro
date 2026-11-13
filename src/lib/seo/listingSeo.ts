// Head + JSON-LD + breadcrumb model for listing pages (category, category+brand),
// shared by every theme so SSR head matches the bot HTML
// (functions/ssr-middleware.js generateCategoryHTML / generateCategoryBrandHTML).
// Pure: no browser or Convex access, so it runs identically on server and client.

// Raw category row (camelCase, as the catalog returns it).
export interface ListingCategory {
  name: string;
  slug: string;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface ListingBrand {
  name: string;
  slug: string;
}

export interface ListingProduct {
  name: string;
  slug: string;
  price?: number | null;
}

export interface ListingSeoInput {
  category: ListingCategory;
  brand?: ListingBrand | null;
  products: ListingProduct[];
  siteName: string;
  primaryHost: string;
}

export interface ListingSeo {
  /** Visible heading (h1). */
  heading: string;
  title: string;
  description: string;
  /** Breadcrumb model, absolute URLs (JSON-LD). */
  crumbs: Array<{ name: string; url: string }>;
  /** Visible breadcrumb model, relative hrefs; the last item has no href. */
  visibleCrumbs: Array<{ label: string; href?: string }>;
  /** JSON-LD blocks: CollectionPage, ItemList, BreadcrumbList. */
  extraJsonLd: Record<string, unknown>[];
}

export function listingSeo({ category, brand, products, siteName, primaryHost }: ListingSeoInput): ListingSeo {
  const site = `https://${primaryHost}`;
  const categoryUrl = `${site}/category/${category.slug}`;

  if (!brand) {
    const heading = category.name;
    const title = category.metaTitle || `${category.name} | ${siteName}`;
    const description =
      category.metaDescription || category.description || `Shop premium ${category.name} at ${siteName}`;
    const canonical = categoryUrl;
    const crumbs = [
      { name: 'Home', url: `${site}/` },
      { name: 'Categories', url: `${site}/categories` },
      { name: category.name, url: canonical },
    ];
    return {
      heading,
      title,
      description,
      crumbs,
      visibleCrumbs: [{ label: 'Categories', href: '/categories' }, { label: category.name }],
      extraJsonLd: collectionJsonLd({ name: heading, description, canonical, products, site, crumbs }),
    };
  }

  // Category + brand combo: the bot's title/description formula, verbatim.
  const heading = `${brand.name} ${category.name}`;
  const count = products.length;
  const title = `${heading} Online India | ${siteName}`;
  const description = `Shop ${heading} online in India at ${siteName}: ${count} ${count === 1 ? 'product' : 'products'} with variant prices in INR. For adults of legal smoking age only.`;
  const canonical = `${categoryUrl}/${brand.slug}`;
  const crumbs = [
    { name: 'Home', url: `${site}/` },
    { name: category.name, url: categoryUrl },
    { name: brand.name, url: canonical },
  ];
  return {
    heading,
    title,
    description,
    crumbs,
    visibleCrumbs: [{ label: category.name, href: `/category/${category.slug}` }, { label: brand.name }],
    extraJsonLd: collectionJsonLd({ name: heading, description, canonical, products, site, crumbs }),
  };
}

function collectionJsonLd(input: {
  name: string;
  description: string;
  canonical: string;
  products: ListingProduct[];
  site: string;
  crumbs: Array<{ name: string; url: string }>;
}): Record<string, unknown>[] {
  const { name, description, canonical, products, site, crumbs } = input;
  const blocks: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name,
      description,
      url: canonical,
    },
  ];
  // ItemList mirrors the visible product list: every row, in the same order.
  if (products.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name,
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.name,
        url: `${site}/product/${p.slug}`,
      })),
    });
  }
  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  });
  return blocks;
}

// Brand page head model (bot parity: functions/ssr-middleware.js generateBrandHTML).
export interface BrandSeoInput {
  brand: { name: string; slug: string; description?: string | null; logoUrl?: string | null; metaTitle?: string | null; metaDescription?: string | null };
  products: ListingProduct[];
  siteName: string;
  primaryHost: string;
}

export function brandSeo({ brand, products, siteName, primaryHost }: BrandSeoInput) {
  const site = `https://${primaryHost}`;
  const canonical = `${site}/brand/${brand.slug}`;
  const title = brand.metaTitle || `${brand.name} Products | ${siteName}`;
  const description =
    brand.metaDescription || brand.description || `Shop premium ${brand.name} cigarettes and tobacco products at ${siteName}`;
  const crumbs = [
    { name: 'Home', url: `${site}/` },
    { name: 'Brands', url: `${site}/brands` },
    { name: brand.name, url: canonical },
  ];
  const brandLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name: brand.name,
    description,
    url: canonical,
    ...(brand.logoUrl ? { logo: brand.logoUrl } : {}),
  };
  return {
    heading: brand.name,
    title,
    description,
    crumbs,
    visibleCrumbs: [{ label: 'Brands', href: '/brands' }, { label: brand.name }],
    // Bot brand pages emit Brand, ItemList and BreadcrumbList (no CollectionPage).
    extraJsonLd: [brandLd, ...collectionJsonLd({ name: brand.name, description, canonical, products, site, crumbs }).filter((b) => b['@type'] !== 'CollectionPage')],
  };
}
