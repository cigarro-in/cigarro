import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { StaticPageBreadcrumbs } from '../../components/seo/StaticPageNav';
import { sanitizeBlogBody } from '../../lib/blog/blogRender';
import { storePageBySlug, type StorePageSlug } from '../../lib/storePages/catalog';
import { useStorePage } from '../../hooks/data/useStorePage';

// Renders the admin-edited page when one is published, otherwise the built-in
// page passed as `fallback`. Used by both the SSR and client route tables.
export function StorePageGate({ slug, fallback }: { slug: StorePageSlug; fallback: ReactNode }) {
  const page = useStorePage(slug);
  if (!page) return <>{fallback}</>;
  return <StoredPageView slug={slug} title={page.title} body={page.body} metaTitle={page.metaTitle} metaDescription={page.metaDescription} />;
}

function StoredPageView({
  slug,
  title,
  body,
  metaTitle,
  metaDescription,
}: {
  slug: StorePageSlug;
  title: string;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
}) {
  const location = useLocation();
  const def = storePageBySlug(slug);
  return (
    <>
      <SEOHead
        title={metaTitle || title}
        description={metaDescription || undefined}
        url={location.pathname}
        type="website"
      />
      <StaticPageBreadcrumbs path={def?.path ?? `/${slug}`} crumb={title} parent />
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
