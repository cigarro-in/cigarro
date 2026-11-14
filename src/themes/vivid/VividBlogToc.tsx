import type { MouseEvent } from 'react';
import type { TocItem } from '../../lib/content/toc';
import { scrollToHeading, useActiveHeading } from '../../hooks/useTocScroll';
import './blogToc.css';

// "In this article" for blog posts, vivid look. Pure view: the items come from
// buildToc() in the blog page. Mobile: collapsible block above the article
// (hidden from lg up). Desktop: sticky sidebar card (lg and up) with the active
// section highlighted.

interface VividBlogTocProps {
  items: TocItem[];
  variant: 'mobile' | 'desktop';
}

function onTocClick(event: MouseEvent<HTMLAnchorElement>, id: string, closeDetails: boolean) {
  event.preventDefault();
  if (closeDetails) event.currentTarget.closest('details')?.removeAttribute('open');
  scrollToHeading(id);
}

function DesktopToc({ items }: { items: TocItem[] }) {
  const active = useActiveHeading(items.map((i) => i.id));
  return (
    <nav aria-label="In this article" className="hidden lg:block">
      <div className="vv-toc vv-toc--desktop">
        <p className="vv-toc__title">In this article</p>
        <ol className="vv-toc__list">
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? 'vv-toc__item--h3' : undefined}>
              <a
                href={`#${item.id}`}
                className="vv-toc__link"
                aria-current={active === item.id ? 'location' : undefined}
                onClick={(e) => onTocClick(e, item.id, false)}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function MobileToc({ items }: { items: TocItem[] }) {
  return (
    <details className="vv-toc vv-toc--mobile lg:hidden">
      <summary className="vv-toc__summary">
        In this article
        <span aria-hidden="true" className="vv-toc__chevron">&#9662;</span>
      </summary>
      <div className="vv-toc__body">
        <ol className="vv-toc__list">
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? 'vv-toc__item--h3' : undefined}>
              <a
                href={`#${item.id}`}
                className="vv-toc__link"
                onClick={(e) => onTocClick(e, item.id, true)}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export function VividBlogToc({ items, variant }: VividBlogTocProps) {
  if (items.length === 0) return null;
  return variant === 'mobile' ? <MobileToc items={items} /> : <DesktopToc items={items} />;
}

export default VividBlogToc;
