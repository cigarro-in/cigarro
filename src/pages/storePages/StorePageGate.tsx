import type { ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { StaticPageBreadcrumbs } from '../../components/seo/StaticPageNav';
import { sanitizeBlogBody } from '../../lib/blog/blogRender';
import { IS_SERVER } from '../../lib/ssr/preload';
import { useSetRenderStatus } from '../../lib/ssr/renderStatus';
import { customPagePath, isBuiltInStorePageSlug, storePageBySlug, type StorePageSlug } from '../../lib/storePages/catalog';
import { useCustomStorePage, useStorePage } from '../../hooks/data/useStorePage';
import NotFoundPage from '../NotFoundPage';

// Renders the admin-edited page when one is published, otherwise the built-in
// page passed as `fallback`. Used by both the SSR and client route tables.
export function StorePageGate({ slug, fallback }: { slug: StorePageSlug; fallback: ReactNode }) {
  const page = useStorePage(slug);
  if (!page) return <>{fallback}</>;
  const def = storePageBySlug(slug);
  return (
    <StoredPageView
      path={def?.path ?? `/${slug}`}
      title={page.title}
      body={page.body}
      metaTitle={page.metaTitle}
      metaDescription={page.metaDescription}
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
      title={page.title}
      body={page.body}
      metaTitle={page.metaTitle}
      metaDescription={page.metaDescription}
    />
  );
}

export function StoredPageView({
  path,
  parent = true,
  title,
  body,
  metaTitle,
  metaDescription,
}: {
  path: string;
  /** Built-in policy pages sit under Policies; custom pages sit under Home. */
  parent?: boolean;
  title: string;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
}) {
  const location = useLocation();
  return (
    <>
      <SEOHead
        title={metaTitle || title}
        description={metaDescription || undefined}
        url={location.pathname}
        type="website"
      />
      <StaticPageBreadcrumbs path={path} crumb={title} parent={parent} />
      <main className="min-h-screen bg-background pb-20 md:pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="medium-title leading-tight text-3xl sm:text-4xl lg:text-5xl text-foreground mb-8">{title}</h1>
          <div
            className="space-y-4 text-base leading-relaxed text-foreground [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:mt-8 [&_h3]:font-semibold [&_h3]:text-lg [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
            dangerouslySetInnerHTML={{ __html: sanitizeBlogBody(body) }}
          />
        </div>
      </main>
    </>
  );
}
