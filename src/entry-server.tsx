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
  status: number;
}

// Convex queries the home route reads. Must match the args the client hooks
// pass (same orgSlug, same keys) or the preload is never hit.
export function homePreloadRequests(org: OrgInfo): PreloadRequest[] {
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

  // HelmetProvider lives inside App (it owns the storefront Helmet tree), so the
  // server context is handed down through App's helmetContext prop.
  const routeOverride = (location: unknown): ReactNode => <SsrRoutes location={location} />;
  const tree = (
    <OrgProvider org={org}>
      <PreloadProvider map={preload}>
        <RoutesOverrideContext.Provider value={routeOverride}>
          <StaticRouter location={url}>
            <App initialThemeId={theme} helmetContext={helmetContext} />
          </StaticRouter>
        </RoutesOverrideContext.Provider>
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
    status: 200,
  };
}
