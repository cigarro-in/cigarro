// Server entry (Vite SSR build -> functions/_ssr). Runs in the Pages Functions
// Worker: no Node APIs, no window/document. Flag-gated by SSR_ROUTES on the edge.
import type { ReactNode } from 'react';
import { renderToReadableStream } from 'react-dom/server.browser';
import { StaticRouter } from 'react-router';
import type { HelmetServerState } from 'react-helmet-async';
import App, { type HelmetServerContext } from './App';
import { OrgProvider, type OrgInfo } from './lib/org/OrgContext';
import { PreloadProvider } from './lib/ssr/PreloadContext';
import { preloadKey, type PreloadMap } from './lib/ssr/preload';
import { themeIdFromPreload } from './lib/ssr/themeFromPreload';
import { fetchPreload, type PreloadRequest } from './lib/ssr/fetchPreload';
import { RenderStatusContext, type RenderStatusCell } from './lib/ssr/renderStatus';
import { RoutesOverrideContext } from './routes/AppRoutes';
import { SsrRoutes } from './routes/ssrRoutes';
import { DEFAULT_THEME_ID, resolveThemeId, themeHtmlAttrs } from './themes/registry';

export { fetchPreload, type PreloadRequest, type PreloadMap, type OrgInfo };
export { serializePreload } from './lib/ssr/fetchPreload';
export { preloadKey, themeIdFromPreload };

export interface RenderInput {
  /** Path + query of the request, e.g. "/" */
  url: string;
  org: OrgInfo;
  preload: PreloadMap;
  themeId?: string | null;
}

export interface RenderOutput {
  /** Markup for the inside of #root. */
  html: string;
  /** Helmet tags (title, meta, link, script) as HTML, for <head>. */
  head: string;
  /** Attributes for <html> (data-theme). */
  htmlAttrs: Record<string, string>;
  /** 200, or 404 when the route resolved to a missing or inactive entity. */
  status: number;
}

// ---------------------------------------------------------------------------
// Route table. One entry per server-rendered route. `match` decides whether the
// route serves a pathname; `preloadRequests` lists the Convex reads the route's
// hooks make (args must equal the client hook args, or the preload is never
// hit); `trimPreload` drops fields the route never reads. The edge runs both
// before render, and the trimmed map is the one serialized, so the server
// render and the client's first render read the same data.
// ---------------------------------------------------------------------------
export interface SsrRoute {
  id: string;
  match(pathname: string): Record<string, string> | null;
  preloadRequests(params: Record<string, string>, org: OrgInfo): PreloadRequest[];
  /** Reads that depend on a first-stage result (e.g. related posts need the post's category). */
  followUpRequests?(preload: PreloadMap, params: Record<string, string>, org: OrgInfo): PreloadRequest[];
  trimPreload(preload: PreloadMap, params: Record<string, string>): PreloadMap;
}

// Convex queries the home route reads. Must match the args the client hooks
// pass (same orgSlug, same keys) or the preload is never hit.
function homePreloadRequests(org: OrgInfo): PreloadRequest[] {
  const orgSlug = org.slug;
  return [
    { fnName: 'content:getSiteSettings', args: { orgSlug } },
    { fnName: 'catalog:fullCatalog', args: { orgSlug } },
    { fnName: 'content:listHeroSlides', args: { orgSlug } },
    { fnName: 'content:listBlogPosts', args: { limit: 6, orgSlug } },
    { fnName: 'content:listHomepageComponents', args: { orgSlug } },
    ...['featured_products', 'product_showcase', 'blog_section', 'brands_section', 'categories_section'].map(
      (name) => ({ fnName: 'content:getSectionConfig', args: { name, orgSlug } }),
    ),
  ];
}

// Fields the home page (and the header search it renders) never reads from the
// preloaded queries. Dropped before render AND serialization, so the SSR markup
// and the client's hydration input are built from the same data. Product
// `description` is kept: the header search indexes it.
const UNUSED_PRODUCT_FIELDS = ['shortDescription', 'specifications', 'metaDescription', 'metaTitle'];
const UNUSED_BLOG_FIELDS = ['content', 'metaTitle', 'metaDescription'];

function without(row: unknown, fields: string[]): unknown {
  if (!row || typeof row !== 'object') return row;
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const f of fields) delete copy[f];
  return copy;
}

export function trimHomePreload(preload: PreloadMap): PreloadMap {
  const out: PreloadMap = { ...preload };
  for (const key of Object.keys(out)) {
    const value = out[key] as { products?: unknown[] } | unknown[] | null;
    if (key.startsWith('catalog:fullCatalog:') && value && !Array.isArray(value) && Array.isArray(value.products)) {
      out[key] = { ...value, products: value.products.map((p) => without(p, UNUSED_PRODUCT_FIELDS)) };
    } else if (key.startsWith('content:listBlogPosts:') && Array.isArray(value)) {
      out[key] = value.map((row) => without(row, UNUSED_BLOG_FIELDS));
    }
  }
  return out;
}

// Product route. The full catalog is still needed (related and brand lists,
// header search), but only as far as the product page and the shell read it:
// the bulky editorial fields and the collections payload are dropped. Every
// product row stays, so header search indexes the same catalog as the client.
const TRIM_FULLCATALOG: Record<string, string[]> = {
  products: ['_id', 'createdAt', 'updatedAt', 'shortDescription', 'specifications', 'metaDescription', 'metaTitle', 'origin'],
  variants: ['_id', 'imageAltText', 'createdAt', 'updatedAt'],
  brands: ['_id', 'createdAt', 'updatedAt', 'description', 'heritage', 'metaDescription', 'metaTitle'],
  categories: ['_id', 'createdAt', 'updatedAt', 'description', 'imageAltText', 'metaDescription', 'metaTitle'],
};

function trimFullCatalogRows(rows: unknown, drop: string[] | undefined): unknown {
  if (!Array.isArray(rows) || !drop) return rows;
  return rows.map((row) => without(row, drop));
}

// Walks every fullCatalog bundle in the preload map and drops fields per table.
// Collections are never read by the catalog routes, so they are always dropped.
function trimCatalogBundles(preload: PreloadMap, drop: Record<string, string[] | undefined>): PreloadMap {
  const out: PreloadMap = { ...preload };
  for (const key of Object.keys(out)) {
    const bundle = out[key] as Record<string, unknown> | null;
    if (!key.startsWith('catalog:fullCatalog:') || !bundle || typeof bundle !== 'object') continue;
    out[key] = {
      ...bundle,
      products: trimFullCatalogRows(bundle.products, drop.products),
      variants: trimFullCatalogRows(bundle.variants, drop.variants),
      brands: trimFullCatalogRows(bundle.brands, drop.brands),
      categories: trimFullCatalogRows(bundle.categories, drop.categories),
      collections: [],
      collectionProducts: [],
    };
  }
  return out;
}

export function trimProductPreload(preload: PreloadMap): PreloadMap {
  return trimCatalogBundles(preload, TRIM_FULLCATALOG);
}

// Category listings read the category's own copy (description, meta), the
// product rows and each variant's first image (cards and the header read
// images[0] only). Brand copy is not read on these routes: brand name and slug only.
const TRIM_CATEGORY: Record<string, string[]> = {
  products: [...TRIM_FULLCATALOG.products, 'description'],
  variants: ['_id', 'createdAt', 'updatedAt'],
  brands: ['_id', 'createdAt', 'updatedAt', 'description', 'heritage', 'metaDescription', 'metaTitle'],
  categories: ['_id', 'createdAt', 'updatedAt', 'image', 'imageAltText'],
};

export function trimCategoryPreload(preload: PreloadMap): PreloadMap {
  return trimListingPreload(preload, TRIM_CATEGORY);
}

// Brand page: the brand's own copy (description, heritage, meta, logo) is read,
// so only the internal ids and timestamps are dropped from brands.
const TRIM_BRAND: Record<string, string[]> = {
  products: TRIM_CATEGORY.products,
  variants: TRIM_CATEGORY.variants,
  brands: ['_id', 'createdAt', 'updatedAt'],
  categories: TRIM_CATEGORY.categories,
};

export function trimBrandPreload(preload: PreloadMap): PreloadMap {
  return trimListingPreload(preload, TRIM_BRAND);
}

// Blog post: the post row is read whole (body, meta, author, dates). Related rows
// show title, excerpt, image, author and date only. The shell keeps product
// descriptions (header search).
const TRIM_BLOG: Record<string, string[]> = {
  products: TRIM_FULLCATALOG.products,
  variants: TRIM_CATEGORY.variants,
  brands: ['_id', 'createdAt', 'updatedAt', 'heritage', 'metaDescription', 'metaTitle', 'description'],
  categories: TRIM_CATEGORY.categories,
};

export function trimBlogPreload(preload: PreloadMap): PreloadMap {
  const out = trimListingPreload(preload, TRIM_BLOG);
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (!key.startsWith('content:listRelatedPosts:') || !Array.isArray(value)) continue;
    out[key] = value.map((row) => without(row, ['content', 'metaTitle', 'metaDescription']));
  }
  return out;
}

// Shared listing trim: catalog bundles minus the listed fields, each variant
// reduced to its first image.
function trimListingPreload(preload: PreloadMap, drop: Record<string, string[] | undefined>): PreloadMap {
  const out = trimCatalogBundles(preload, drop);
  for (const key of Object.keys(out)) {
    const bundle = out[key] as { variants?: unknown } | null;
    if (!key.startsWith('catalog:fullCatalog:') || !bundle || !Array.isArray(bundle.variants)) continue;
    out[key] = {
      ...bundle,
      variants: bundle.variants.map((v) => {
        const row = v as { images?: unknown };
        return Array.isArray(row.images) ? { ...row, images: row.images.slice(0, 1) } : v;
      }),
    };
  }
  return out;
}

const PRODUCT_PATH = /^\/product\/([^/]+)\/?$/;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const homeRoute: SsrRoute = {
  id: 'home',
  match: (pathname) => (pathname === '/' ? {} : null),
  preloadRequests: (_params, org) => homePreloadRequests(org),
  trimPreload: (preload) => trimHomePreload(preload),
};

const productRoute: SsrRoute = {
  id: 'product',
  match(pathname) {
    const m = PRODUCT_PATH.exec(pathname);
    return m ? { slug: safeDecode(m[1]) } : null;
  },
  preloadRequests({ slug }, org) {
    const orgSlug = org.slug;
    // Mirrors the hooks ProductPage calls: useCatalogProduct, useFullCatalog,
    // useCatalogCombos, and useStoreSettings (SEOHead, header, footer).
    return [
      { fnName: 'content:getSiteSettings', args: { orgSlug } },
      { fnName: 'catalog:getProductBySlug', args: { slug, orgSlug } },
      { fnName: 'catalog:fullCatalog', args: { orgSlug } },
      { fnName: 'catalog:listCombos', args: { activeOnly: true, orgSlug } },
    ];
  },
  trimPreload: (preload) => trimProductPreload(preload),
};

// Category listing (/category/:slug) and category+brand listing
// (/category/:category/:brand). Mirrors useCategoryListing: site settings for the
// shell and head, and the full catalog for the rows. No Convex calls beyond that.
const CATEGORY_PATH = /^\/category\/([^/]+)\/?$/;
const CATEGORY_BRAND_PATH = /^\/category\/([^/]+)\/([^/]+)\/?$/;
const BRAND_PATH = /^\/brand\/([^/]+)\/?$/;

function categoryPreloadRequests(org: OrgInfo): PreloadRequest[] {
  const orgSlug = org.slug;
  return [
    { fnName: 'content:getSiteSettings', args: { orgSlug } },
    { fnName: 'catalog:fullCatalog', args: { orgSlug } },
  ];
}

const categoryRoute: SsrRoute = {
  id: 'category',
  match(pathname) {
    const m = CATEGORY_PATH.exec(pathname);
    return m ? { slug: safeDecode(m[1]) } : null;
  },
  preloadRequests: (_params, org) => categoryPreloadRequests(org),
  trimPreload: (preload) => trimCategoryPreload(preload),
};

const brandRoute: SsrRoute = {
  id: 'brand',
  match(pathname) {
    const m = BRAND_PATH.exec(pathname);
    return m ? { slug: safeDecode(m[1]) } : null;
  },
  preloadRequests: (_params, org) => categoryPreloadRequests(org),
  trimPreload: (preload) => trimBrandPreload(preload),
};

const categoryBrandRoute: SsrRoute = {
  id: 'category-brand',
  match(pathname) {
    const m = CATEGORY_BRAND_PATH.exec(pathname);
    return m ? { category: safeDecode(m[1]), brand: safeDecode(m[2]) } : null;
  },
  preloadRequests: (_params, org) => categoryPreloadRequests(org),
  trimPreload: (preload) => trimCategoryPreload(preload),
};

// Blog post (/blog/:slug). Related posts are keyed by the post's own category, so
// they are a second stage, built from the post row. Args mirror useRelatedPosts.
const BLOG_PATH = /^\/blog\/([^/]+)\/?$/;
const blogRoute: SsrRoute = {
  id: 'blog',
  match(pathname) {
    const m = BLOG_PATH.exec(pathname);
    return m ? { slug: safeDecode(m[1]) } : null;
  },
  preloadRequests({ slug }, org) {
    const orgSlug = org.slug;
    return [
      { fnName: 'content:getSiteSettings', args: { orgSlug } },
      { fnName: 'catalog:fullCatalog', args: { orgSlug } },
      { fnName: 'content:getBlogPostBySlug', args: { slug, orgSlug } },
    ];
  },
  followUpRequests(preload, { slug }, org) {
    const orgSlug = org.slug;
    const post = preload[preloadKey('content:getBlogPostBySlug', { slug, orgSlug })] as
      | { categorySlug?: string | null; slug?: string }
      | null
      | undefined;
    if (!post) return [];
    const categorySlug = post.categorySlug || undefined;
    const excludeSlug = post.slug;
    return [{ fnName: 'content:listRelatedPosts', args: { ...(categorySlug ? { categorySlug } : {}), excludeSlug, limit: 3, orgSlug } }];
  },
  trimPreload: (preload) => trimBlogPreload(preload),
};

const SSR_ROUTES: SsrRoute[] = [homeRoute, productRoute, categoryRoute, categoryBrandRoute, brandRoute, blogRoute];

// Route that serves a pathname, with its params. Null when no SSR route matches.
export function matchSsrRoute(pathname: string): { route: SsrRoute; params: Record<string, string> } | null {
  for (const route of SSR_ROUTES) {
    const params = route.match(pathname);
    if (params) return { route, params };
  }
  return null;
}

// Preload plan for a pathname: the Convex reads to run and the trim to apply.
export function planSsrRoute(pathname: string, org: OrgInfo) {
  const hit = matchSsrRoute(pathname);
  if (!hit) return null;
  const { route, params } = hit;
  return {
    id: route.id,
    requests: route.preloadRequests(params, org),
    followUpRequests: (preload: PreloadMap) => route.followUpRequests?.(preload, params, org) ?? [],
    trimPreload: (preload: PreloadMap) => route.trimPreload(preload, params),
  };
}

// SSR_ROUTES flag entries: an exact path ("/"), a path with '*' segments (each
// '*' matches exactly one non-empty segment: "/product/*", "/category/*/*"), or
// "*" for every SSR-capable route (the route table still decides the match).
export function flagCovers(pattern: string, pathname: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === pathname;
  const want = pattern.split('/');
  const got = pathname.split('/');
  if (want.length !== got.length) return false;
  return want.every((seg, i) => (seg === '*' ? got[i].length > 0 : seg === got[i]));
}

function helmetToHead(state: HelmetServerState | undefined): string {
  if (!state) return '';
  return [
    state.title?.toString() ?? '',
    state.meta?.toString() ?? '',
    state.link?.toString() ?? '',
    state.script?.toString() ?? '',
  ].join('');
}

export async function render({ url, org, preload, themeId }: RenderInput): Promise<RenderOutput> {
  const helmetContext: HelmetServerContext = {};
  const theme = resolveThemeId(themeId ?? DEFAULT_THEME_ID);
  const renderErrors: unknown[] = [];
  const statusCell: RenderStatusCell = { status: 200 };

  // HelmetProvider lives inside App (it owns the storefront Helmet tree), so the
  // server context is handed down through App's helmetContext prop.
  const routeOverride = (location: unknown): ReactNode => <SsrRoutes location={location} />;
  const tree = (
    <OrgProvider org={org}>
      <PreloadProvider map={preload}>
        <RenderStatusContext.Provider value={statusCell}>
          <RoutesOverrideContext.Provider value={routeOverride}>
            <StaticRouter location={url}>
              <App initialThemeId={theme} helmetContext={helmetContext} />
            </StaticRouter>
          </RoutesOverrideContext.Provider>
        </RenderStatusContext.Provider>
      </PreloadProvider>
    </OrgProvider>
  );

  const stream = await renderToReadableStream(tree, {
    onError(error: unknown) {
      renderErrors.push(error);
    },
  });
  await stream.allReady;
  const html = await new Response(stream).text();
  if (renderErrors.length > 0) {
    // A recoverable Suspense error still yields markup, but the page is not
    // trustworthy as SEO HTML: let the caller fall back to the SPA shell.
    throw new Error(`SSR render errors: ${renderErrors.length}; first: ${String((renderErrors[0] as Error)?.message ?? renderErrors[0])}`);
  }

  return {
    html,
    head: helmetToHead(helmetContext.helmet),
    htmlAttrs: themeHtmlAttrs(theme),
    status: statusCell.status,
  };
}
