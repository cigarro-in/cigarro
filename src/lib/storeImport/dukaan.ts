// Pure transform: Dukaan normalized export (imports/<store>/normalized.json, written by
// scripts/dukaan-import/crawl.mjs) + image map (old URL -> new CDN URL, written by
// scripts/dukaan-import/upload-images.mjs) -> importer batches for convex/storeImport.ts.
//
// No Convex or React imports: the /sa import page and the unit tests both use this.
// Catalog money stays RUPEES (the catalog schema contract); the source already
// stores whole rupees, so nothing is converted here.

export interface DukaanNormalized {
  source: { platform: 'dukaan'; storeSlug: string; baseUrl: string; crawledAt: string };
  store: {
    name: string;
    seoTitle: string | null;
    seoDescription: string | null;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    socialLinks: string[];
    cssRootVariables: string;
  };
  homepage: {
    hero: {
      eyebrow: string | null;
      title: string | null;
      lead: string | null;
      ctas: Array<{ href: string; text: string }>;
      images: string[];
    } | null;
    categoryTileSlugs: string[];
    imageUrls: string[];
  };
  collections: Array<{
    slug: string;
    name: string | null;
    url: string;
    title: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    descriptionHtml: string | null;
    childSlugs?: string[];
    parentSlugs?: string[];
    productSlugs: string[];
  }>;
  products: DukaanProduct[];
  pages: Array<{ slug: string; url: string; title: string | null; metaDescription: string | null; contentHtml: string | null }>;
  blogs: Array<{
    slug: string;
    url: string;
    title: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    coverImage?: string | null;
    byline?: string | null;
    contentHtml: string | null;
    contentText: string;
  }>;
}

export interface DukaanProduct {
  sourceId: number;
  slug: string;
  url: string;
  name: string;
  priceRupees: number;
  compareAtRupees: number | null;
  inStock: boolean;
  rating: number | null;
  reviews: number | null;
  descriptionHtml: string;
  descriptionText: string;
  images: Array<{ sourceUrl: string; position: number }>;
  variants: Array<{
    sourceId: number;
    sku: string | null;
    priceRupees: number;
    compareAtRupees: number | null;
    inStock: boolean;
    options: Record<string, string>;
    imageUrl: string | null;
    isDefault: boolean;
  }>;
  unit?: string | null;
  categoryCollectionSlugs: string[];
  seo: { title: string | null; description: string | null };
}

export type ImageMap = Record<string, string>;

export interface CategoryItem {
  sourceKey: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
}

export interface VariantItem {
  sourceKey: string;
  name: string;
  slug: string;
  unit?: string;
  unitsContained?: number;
  images: string[];
  priceRupees: number;
  compareAtPriceRupees?: number;
  stock?: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface ProductItem {
  sourceKey: string;
  slug: string;
  name: string;
  description?: string;
  shortDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  ratingValue?: number;
  reviewCount?: number;
  isActive: boolean;
  variants: VariantItem[];
  categorySourceKeys: string[];
}

export interface BlogItem {
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  status: string;
  authorName: string;
  categorySlug?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

export interface HeroSlideItem {
  title?: string;
  subtitle?: string;
  suptitle?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

// A type alias (not an interface) so it satisfies Convex's object-args constraint.
export type SiteSettingsPatch = {
  siteName?: string;
  metaTitle?: string;
  metaDescription?: string;
  activeTheme?: string;
  brand?: { logoUrl?: string; faviconUrl?: string; brandColor?: string };
  business?: {
    legalName?: string;
    supportEmail?: string;
    supportPhone?: string;
    address?: { line1?: string; pincode?: string; state?: string };
  };
  seo?: { titleTemplate?: string; defaultDescription?: string };
  socials?: { instagram?: string; facebook?: string; x?: string; youtube?: string; whatsapp?: string };
};

export interface ImportPlan {
  storeSlug: string;
  categories: CategoryItem[];
  products: ProductItem[];
  heroSlides: HeroSlideItem[];
  blogs: BlogItem[];
  settings: SiteSettingsPatch;
  /** Image URLs the plan references that have no entry in the image map (kept as source URLs). */
  unmappedImages: string[];
  counts: { categories: number; products: number; variants: number; images: number; blogs: number; staticPages: number };
}

/** Stable, re-runnable key for a source entity. Stored in the catalog's supabaseId field. */
export function sourceKey(storeSlug: string, kind: 'collection' | 'product' | 'variant', id: string | number): string {
  return `dukaan:${storeSlug}:${kind}:${id}`;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PINCODE_RE = /\b(\d{6})\b/;

function mapImage(url: string | null | undefined, map: ImageMap, unmapped: Set<string>): string | undefined {
  if (!url) return undefined;
  const hit = map[url];
  if (hit) return hit;
  unmapped.add(url);
  return url;
}

// Static Dukaan pages that have a home on this platform. Others map to the closest
// listing or a neutral page; see redirects notes in imports/<store>/README.md.
const PAGE_PATHS: Record<string, string> = {
  'about-us': '/about',
  'privacy-policy': '/privacy',
  'terms-conditions': '/terms',
  'refund-policy': '/returns',
  bestseller: '/products',
  'ratings-and-reviews': '/products',
  'frequently-asked-questions-(faq)': '/contact',
  'important-notice:-beware-of-scammers!': '/about',
};

/** Map a Dukaan storefront path (with or without the store prefix or origin) to this platform's path. */
export function mapSourcePath(href: string, sourceSlug: string): string {
  let p = href.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  const prefix = `/${sourceSlug}`;
  if (p === prefix || p === `${prefix}/`) return '/';
  if (p.startsWith(`${prefix}/`)) p = p.slice(prefix.length);
  p = p.replace(/\/+$/, '') || '/';
  const parts = p.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  const [head, rest] = [parts[0], parts.slice(1).join('/')];
  switch (head) {
    case 'shop':
      return '/products';
    case 'search':
    case 'account':
      return '/';
    case 'collections':
      if (!rest) return '/categories';
      return rest === 'all' ? '/products' : `/category/${rest}`;
    case 'products':
      return rest ? `/product/${rest}` : '/products';
    case 'blogs':
      return rest ? `/blog/${rest}` : '/blogs';
    case 'pages':
      return PAGE_PATHS[rest] ?? '/legal';
    default:
      return `/${parts.join('/')}`;
  }
}

/** Rewrite Dukaan image URLs and internal store links inside an HTML fragment. */
export function rewriteHtml(html: string | null | undefined, imageMap: ImageMap, sourceSlug: string, unmapped: Set<string> = new Set()): string {
  if (!html) return '';
  return html
    .replace(/https:\/\/dms\.mydukaan\.io\/[^"'\s)<>]+/g, (u) => {
      const hit = imageMap[u];
      if (hit) return hit;
      unmapped.add(u);
      return u;
    })
    .replace(
      new RegExp(`href="((?:https?:\\/\\/mydukaan\\.io)?\\/${sourceSlug.replace(/[^a-z0-9]/gi, '')}[^"]*)"`, 'g'),
      (_m, href: string) => `href="${mapSourcePath(href, sourceSlug)}"`,
    )
    // Each page has one h1 (the theme's title). Source bodies carry their own h1s.
    .replace(/<(\/?)h1\b/gi, '<$1h2');
}

function variantName(options: Record<string, string>, fallback: string): string {
  const vals = Object.values(options).filter(Boolean);
  return vals.length ? vals.join(' / ') : fallback;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildImportPlan(src: DukaanNormalized, imageMap: ImageMap = {}, opts: { storeSlug: string; activeTheme?: string }): ImportPlan {
  const storeSlug = opts.storeSlug;
  const unmapped = new Set<string>();
  const storeKey = src.source.storeSlug;

  // Categories (Dukaan "collections"). Sorted by name for a stable order.
  const categories: CategoryItem[] = src.collections
    .map((c) => ({
      sourceKey: sourceKey(storeKey, 'collection', c.slug),
      slug: c.slug,
      name: (c.name ?? c.slug).trim(),
      description: c.descriptionHtml ? rewriteHtml(c.descriptionHtml, imageMap, storeKey, unmapped) : undefined,
      image: c.ogImage ? mapImage(c.ogImage, imageMap, unmapped) : undefined,
      metaTitle: c.title ?? undefined,
      metaDescription: c.metaDescription ?? undefined,
      isActive: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categoryKeys = new Set(categories.map((c) => c.sourceKey));

  // Dukaan's parent listings also show products from their subcategories, so a
  // product belongs to every ancestor of the categories it is listed in.
  const parentsOf = new Map(src.collections.map((c) => [c.slug, c.parentSlugs ?? []]));
  const withAncestors = (slugs: string[]) => {
    const out = new Set<string>();
    const stack = [...slugs];
    while (stack.length) {
      const s = stack.pop()!;
      if (out.has(s)) continue;
      out.add(s);
      for (const parent of parentsOf.get(s) ?? []) stack.push(parent);
    }
    return [...out];
  };

  const products: ProductItem[] = src.products.map((p) => {
    const variants: VariantItem[] = p.variants.map((v) => {
      const imgs = [v.imageUrl].filter((x): x is string => !!x).map((u) => mapImage(u, imageMap, unmapped) as string);
      return {
        sourceKey: sourceKey(storeKey, 'variant', v.sourceId),
        name: variantName(v.options, p.name),
        slug: slugify(variantName(v.options, String(v.sourceId))) || String(v.sourceId),
        unit: p.unit ?? undefined,
        images: imgs,
        priceRupees: v.priceRupees,
        compareAtPriceRupees: v.compareAtRupees && v.compareAtRupees > v.priceRupees ? v.compareAtRupees : undefined,
        stock: v.inStock ? undefined : 0,
        isDefault: v.isDefault,
        isActive: true,
      };
    });
    if (variants.length && !variants.some((v) => v.isDefault)) variants[0].isDefault = true;
    const gallery = p.images.map((i) => mapImage(i.sourceUrl, imageMap, unmapped) as string);
    // Gallery images belong to the product; variant images stay on the variant.
    if (variants.length === 0) {
      variants.push({
        sourceKey: sourceKey(storeKey, 'variant', `${p.sourceId}-default`),
        name: p.name,
        slug: p.slug,
        images: gallery,
        priceRupees: p.priceRupees,
        compareAtPriceRupees: p.compareAtRupees && p.compareAtRupees > p.priceRupees ? p.compareAtRupees : undefined,
        isDefault: true,
        isActive: true,
      });
    } else {
      variants[0].images = [...new Set([...variants[0].images, ...gallery])];
    }
    return {
      sourceKey: sourceKey(storeKey, 'product', p.sourceId),
      slug: p.slug,
      name: p.name,
      description: p.descriptionHtml ? rewriteHtml(p.descriptionHtml, imageMap, storeKey, unmapped) : undefined,
      shortDescription: p.descriptionText ? p.descriptionText.slice(0, 280) : undefined,
      metaTitle: p.seo.title ?? undefined,
      metaDescription: p.seo.description ?? undefined,
      ratingValue: p.rating ?? undefined,
      reviewCount: p.reviews ?? undefined,
      isActive: true,
      variants,
      categorySourceKeys: withAncestors(p.categoryCollectionSlugs)
        .map((s) => sourceKey(storeKey, 'collection', s))
        .filter((k) => categoryKeys.has(k)),
    };
  });

  const blogs: BlogItem[] = src.blogs.map((b) => ({
    slug: b.slug,
    title: b.title ?? b.slug,
    excerpt: b.metaDescription ?? undefined,
    content: rewriteHtml(b.contentHtml, imageMap, storeKey, unmapped),
    featuredImage: b.coverImage ? mapImage(b.coverImage, imageMap, unmapped) : undefined,
    status: 'published',
    authorName: src.store.name,
    categorySlug: undefined,
    metaTitle: b.title ?? undefined,
    metaDescription: b.metaDescription ?? undefined,
    ogImage: b.ogImage ? mapImage(b.ogImage, imageMap, unmapped) : undefined,
  }));

  // Static pages: imported as unpublished drafts (no page table exists yet). Legal
  // pages with a route are kept in the draft set too so the copy is not lost.
  const staticPages: BlogItem[] = src.pages.map((p) => ({
    slug: `page-${slugify(p.slug)}`.slice(0, 120),
    title: p.title ?? p.slug,
    excerpt: p.metaDescription ?? undefined,
    content: rewriteHtml(p.contentHtml, imageMap, storeKey, unmapped),
    status: 'draft',
    authorName: src.store.name,
    categorySlug: 'static-page',
    metaTitle: p.title ?? undefined,
    metaDescription: p.metaDescription ?? undefined,
  }));

  // One hero slide from the Dukaan home hero. Dukaan's CTAs point at its own
  // paths; map them onto this platform's routes.
  const heroSrc = src.homepage.hero;
  const hero: HeroSlideItem[] = heroSrc
    ? [
        {
          suptitle: heroSrc.eyebrow ?? undefined,
          title: heroSrc.title ?? undefined,
          subtitle: heroSrc.lead ?? undefined,
          buttonText: heroSrc.ctas[0]?.text || undefined,
          buttonUrl: heroSrc.ctas[0] ? mapSourcePath(heroSrc.ctas[0].href, storeKey) : undefined,
          imageUrl: heroSrc.images[0] ? mapImage(heroSrc.images[0], imageMap, unmapped) : undefined,
          mobileImageUrl: heroSrc.images[0] ? mapImage(heroSrc.images[0], imageMap, unmapped) : undefined,
          sortOrder: 0,
          isActive: true,
        },
      ]
    : [];

  const address = src.store.address ?? undefined;
  const settings: SiteSettingsPatch = {
    siteName: src.store.name,
    metaTitle: src.store.seoTitle ?? undefined,
    metaDescription: src.store.seoDescription ?? undefined,
    activeTheme: opts.activeTheme,
    brand: {
      logoUrl: mapImage(src.store.logoUrl, imageMap, unmapped),
      faviconUrl: mapImage(src.store.logoUrl, imageMap, unmapped),
      // Merchant's accent from the Dukaan theme (--accent: #111111).
      brandColor: '#111111',
    },
    business: {
      legalName: src.store.name,
      // Dukaan often leaves email/phone blank; fall back to an email written inside the address.
      supportEmail: src.store.email || address?.match(EMAIL_RE)?.[0] || undefined,
      supportPhone: src.store.phone || undefined,
      address: address ? { line1: address, pincode: address.match(PINCODE_RE)?.[1] } : undefined,
    },
    seo: { defaultDescription: src.store.seoDescription ?? undefined },
    socials: socialsFrom(src.store.socialLinks),
  };

  const variantCount = products.reduce((n, p) => n + p.variants.length, 0);
  const imageCount = new Set<string>([
    ...products.flatMap((p) => p.variants.flatMap((v) => v.images)),
    ...categories.map((c) => c.image).filter((x): x is string => !!x),
  ]).size;

  return {
    storeSlug,
    categories,
    products,
    heroSlides: hero,
    blogs: [...blogs, ...staticPages],
    settings,
    unmappedImages: [...unmapped].sort(),
    counts: {
      categories: categories.length,
      products: products.length,
      variants: variantCount,
      images: imageCount,
      blogs: blogs.length,
      staticPages: staticPages.length,
    },
  };
}

function socialsFrom(links: string[]): SiteSettingsPatch['socials'] {
  const out: NonNullable<SiteSettingsPatch['socials']> = {};
  for (const link of links) {
    let host = '';
    try {
      host = new URL(link).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }
    if (host.includes('instagram')) out.instagram ??= link;
    else if (host.includes('facebook')) out.facebook ??= link;
    else if (host === 'x.com' || host === 'twitter.com') out.x ??= link;
    else if (host.includes('youtube')) out.youtube ??= link;
    else if (host === 'wa.me' || host.includes('whatsapp')) out.whatsapp ??= link;
  }
  return out;
}

/** Split a list into batches of at most `size`, for sequential importer calls. */
export function batches<T>(items: T[], size = 25): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
