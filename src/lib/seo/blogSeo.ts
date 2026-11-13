// Head + JSON-LD model for a blog post (bot parity: functions/ssr-middleware.js
// generateBlogHTML). Pure: runs identically on the server and in the browser.
import { formatBlogDate } from '../blog/blogRender';

export interface BlogPostSeoInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  featuredImage?: string | null;
  authorName?: string | null;
  publishedAt?: number | null;
  updatedAt?: number | null;
}

export function blogPostSeo(post: BlogPostSeoInput, siteName: string, primaryHost: string) {
  const site = `https://${primaryHost}`;
  const canonical = `${site}/blog/${post.slug}`;
  const title = post.metaTitle || `${post.title} | ${siteName} Blog`;
  const description =
    post.metaDescription || post.excerpt || (post.content ? post.content.replace(/<[^>]+>/g, '').substring(0, 160) : '');
  const author = post.authorName || siteName;
  const published = post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined;
  const modified = post.updatedAt ? new Date(post.updatedAt).toISOString() : published;
  const image = post.featuredImage || undefined;
  const crumbs = [
    { name: 'Home', url: `${site}/` },
    { name: 'Blog', url: `${site}/blogs` },
    { name: post.title, url: canonical },
  ];
  const posting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    ...(image ? { image } : {}),
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: { '@type': 'Person', name: author },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      logo: { '@type': 'ImageObject', url: `${site}/icons/android-chrome-512x512.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };
  return {
    title,
    description,
    canonical,
    author,
    image,
    published,
    modified,
    crumbs,
    visibleCrumbs: [{ label: 'Blog', href: '/blogs' }, { label: post.title }],
    extraJsonLd: [posting, breadcrumb],
    dateLabel: published ? formatBlogDate(post.publishedAt as number) : null,
  };
}
