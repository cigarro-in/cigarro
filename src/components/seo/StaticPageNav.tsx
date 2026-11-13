import { Link } from 'react-router-dom';
import { BreadcrumbNav } from '../layout/BreadcrumbNav';
import { BreadcrumbSchema } from './BreadcrumbSchema';
import { useOrgInfo } from '../../lib/org/OrgContext';

interface StaticPageBreadcrumbsProps {
  /** Pathname of the page, e.g. "/terms". */
  path: string;
  /** Last crumb label, e.g. "Terms of Service". */
  crumb: string;
  /** Policy pages sit under Home > Policies (/legal). */
  parent?: boolean;
}

// Visible breadcrumb and BreadcrumbList JSON-LD from one model, the bot
// renderer's shape: Home > [Policies >] page. Absolute URLs use the store's
// primary host, never the request host.
export function StaticPageBreadcrumbs({ path, crumb, parent = false }: StaticPageBreadcrumbsProps) {
  const { primaryHost } = useOrgInfo();
  const origin = `https://${primaryHost}`;
  const visible = [
    ...(parent ? [{ label: 'Policies', href: '/legal' }] : []),
    { label: crumb },
  ];
  const items = [
    { name: 'Home', url: `${origin}/` },
    ...(parent ? [{ name: 'Policies', url: `${origin}/legal` }] : []),
    { name: crumb, url: `${origin}${path}` },
  ];
  return (
    <>
      <BreadcrumbNav customBreadcrumbs={visible} />
      <BreadcrumbSchema items={items} />
    </>
  );
}

export interface RelatedPageLink {
  href: string;
  label: string;
}

// Crawlable internal links the bot renderer also emits ("Related pages").
export function RelatedPages({ links }: { links: RelatedPageLink[] }) {
  if (links.length === 0) return null;
  return (
    <nav aria-label="Related pages" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link to={link.href} className="text-canyon underline underline-offset-4 hover:text-dark">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
