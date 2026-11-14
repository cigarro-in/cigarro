import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { RelatedPages, StaticPageBreadcrumbs, type RelatedPageLink } from '../../components/seo/StaticPageNav';
import { sanitizeBlogBody } from '../../lib/blog/blogRender';
import { builtInStorePage, type BuiltInStorePageSlug } from '../../lib/content/builtinPages';
import { fillStorePageTokens, storePageTokenValues, type TokenValue } from '../../lib/content/storePageTokens';
import { IS_SERVER } from '../../lib/ssr/preload';
import { useSetRenderStatus } from '../../lib/ssr/renderStatus';
import { customPagePath, isBuiltInStorePageSlug, storePageBySlug } from '../../lib/storePages/catalog';
import { useCustomStorePage, useStorePage } from '../../hooks/data/useStorePage';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { useShippingMethods } from '../../hooks/data/useContent';
import { formatINR } from '../../utils/currency';
import NotFoundPage from '../NotFoundPage';

// Layout around each built-in page: breadcrumb parent and the related links
// shown under the body. The body itself comes from the store's saved page or
// from the built-in default HTML (src/lib/content/builtinPages.ts).
const BUILTIN_NAV: Record<BuiltInStorePageSlug, { parent: boolean; related: RelatedPageLink[] }> = {
  about: {
    parent: false,
    related: [
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/contact', label: 'Contact us' },
    ],
  },
  contact: {
    parent: false,
    related: [
      { href: '/shipping', label: 'Shipping policy' },
      { href: '/returns', label: 'Returns and refunds' },
    ],
  },
  legal: { parent: false, related: [] },
  terms: {
    parent: true,
    related: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/shipping', label: 'Shipping policy' },
      { href: '/returns', label: 'Returns and refunds' },
    ],
  },
  privacy: {
    parent: true,
    related: [
      { href: '/terms', label: 'Terms of service' },
      { href: '/shipping', label: 'Shipping policy' },
      { href: '/returns', label: 'Returns and refunds' },
    ],
  },
  shipping: {
    parent: true,
    related: [
      { href: '/returns', label: 'Returns and refunds' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
  returns: {
    parent: true,
    related: [
      { href: '/shipping', label: 'Shipping policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
};

// One shipping method as the Shipping page lists it (same wording as checkout).
function deliveryLine(m: { label: string; eta: string; priceRupees: number }): string {
  return `${m.label}: ${m.eta}${m.priceRupees === 0 ? ', free' : `, ${formatINR(m.priceRupees)}`}`;
}

// Values for {{tokens}} in page text: store settings plus live shipping methods.
function useStorePageTokens(): Record<string, TokenValue> {
  const { settings } = useStoreSettings();
  const { methods } = useShippingMethods();
  return useMemo(
    () => storePageTokenValues(settings, methods.map(deliveryLine)),
    [settings, methods],
  );
}

// A built-in page: the store's published version when one exists, otherwise
// the default HTML. Same renderer, URL, meta tags and breadcrumbs either way.
export function StorePageGate({ slug }: { slug: BuiltInStorePageSlug }) {
  const page = useStorePage(slug);
  const tokens = useStorePageTokens();
  const def = builtInStorePage(slug);
  if (!def) return null;
  const nav = BUILTIN_NAV[slug];
  const path = storePageBySlug(slug)?.path ?? `/${slug}`;
  const title = fillStorePageTokens(page?.title || def.title, tokens, 'text');
  const seoSource = page?.metaTitle || def.seoTitle;
  const descriptionSource = page?.metaDescription || def.seoDescription;
  return (
    <StoredPageView
      path={path}
      parent={nav.parent}
      title={title}
      body={page ? page.body : def.html}
      tokens={tokens}
      metaTitle={fillStorePageTokens(seoSource, tokens, 'text')}
      metaDescription={fillStorePageTokens(descriptionSource, tokens, 'text')}
      keywords={def.keywords.map((k) => fillStorePageTokens(k, tokens, 'text'))}
      related={nav.related}
    />
  );
}

// /pages/:slug. Serves a published custom page; a missing, unpublished or
// built-in slug is a 404 (built-in pages live at their own URLs).
export function CustomStorePageRoute() {
  const { slug = '' } = useParams<{ slug: string }>();
  return <CustomStorePageGate slug={slug} />;
}

export function CustomStorePageGate({ slug }: { slug: string }) {
  const setStatus = useSetRenderStatus();
  const page = useCustomStorePage(slug);
  const tokens = useStorePageTokens();
  // On the server a missing preload means we cannot tell whether the page
  // exists. Throw so the edge falls back instead of serving a wrong 404.
  if (page === undefined && IS_SERVER) throw new Error(`SSR store page preload missing: ${slug}`);
  if (isBuiltInStorePageSlug(slug) || page === null) {
    setStatus(404);
    return <NotFoundPage />;
  }
  if (page === undefined) return null;
  return (
    <StoredPageView
      path={customPagePath(slug)}
      parent={false}
      title={fillStorePageTokens(page.title, tokens, 'text')}
      body={page.body}
      tokens={tokens}
      metaTitle={page.metaTitle ? fillStorePageTokens(page.metaTitle, tokens, 'text') : null}
      metaDescription={page.metaDescription ? fillStorePageTokens(page.metaDescription, tokens, 'text') : null}
    />
  );
}

// The one renderer for every store page body (saved or default). Body HTML is
// filled with tokens, then sanitized, then styled by the .rich-text class.
export function StoredPageView({
  path,
  parent = true,
  title,
  body,
  tokens,
  metaTitle,
  metaDescription,
  keywords,
  related = [],
}: {
  path: string;
  /** Built-in policy pages sit under Policies; custom pages sit under Home. */
  parent?: boolean;
  title: string;
  body: string;
  tokens: Record<string, TokenValue>;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords?: string[];
  /** Links shown under the body (non-content widgets stay outside the HTML). */
  related?: RelatedPageLink[];
}) {
  const location = useLocation();
  const html = useMemo(() => sanitizeBlogBody(fillStorePageTokens(body, tokens, 'html')), [body, tokens]);
  return (
    <>
      <SEOHead
        title={metaTitle || title}
        description={metaDescription || undefined}
        url={location.pathname}
        type="website"
        keywords={keywords}
      />
      <StaticPageBreadcrumbs path={path} crumb={title} parent={parent} />
      <main className="min-h-screen bg-background pb-20 md:pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="medium-title leading-tight text-3xl sm:text-4xl lg:text-5xl text-foreground mb-8">{title}</h1>
          <div className="rich-text text-foreground" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <RelatedPages links={related} />
      </main>
    </>
  );
}
