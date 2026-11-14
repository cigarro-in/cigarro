import type { MouseEvent } from 'react';
import type { TocItem } from '../../lib/content/toc';
import { scrollToHeading, useActiveHeading } from '../../hooks/useTocScroll';
import './blogToc.css';

// "In this article" for blog posts, classic look. Pure view: the items come from
// buildToc() in the blog page. Two variants: the mobile collapsible block above
// the article (hidden from lg up) and the desktop sticky sidebar card (lg and up).

interface ClassicBlogTocProps {
  items: TocItem[];
  variant: 'mobile' | 'desktop';
}

function onTocClick(event: MouseEvent<HTMLAnchorElement>, id: string, closeDetails: boolean) {
  event.preventDefault();
  if (closeDetails) event.currentTarget.closest('details')?.removeAttribute('open');
  scrollToHeading(id);
}

function TocLinks({ items, active }: { items: TocItem[]; active?: string | null }) {
  return (
    <ol className="list-none m-0 p-0 space-y-1">
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <li key={item.id} className={item.level === 3 ? 'pl-4' : undefined}>
            <a
              href={`#${item.id}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(e) => onTocClick(e, item.id, false)}
              className={[
                'classic-toc-link block border-l-2 py-1.5 pl-3 pr-2 text-sm leading-snug transition-colors',
                isActive
                  ? 'border-canyon text-canyon font-medium'
                  : 'border-coyote/30 text-dark/70 hover:text-canyon hover:border-canyon/60',
              ].join(' ')}
            >
              {item.text}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function DesktopToc({ items }: { items: TocItem[] }) {
  const active = useActiveHeading(items.map((i) => i.id));
  return (
    <nav aria-label="In this article" className="hidden lg:block">
      <div className="rounded-xl border border-coyote/20 bg-white p-5 shadow-sm">
        <p className="font-serif text-lg text-dark mb-3">In this article</p>
        <TocLinks items={items} active={active} />
      </div>
    </nav>
  );
}

function MobileToc({ items }: { items: TocItem[] }) {
  return (
    <details className="lg:hidden mb-8 rounded-xl border border-coyote/20 bg-white px-5 py-4 shadow-sm group">
      <summary className="cursor-pointer list-none flex items-center justify-between font-serif text-lg text-dark">
        In this article
        <span aria-hidden="true" className="text-canyon text-sm transition-transform group-open:rotate-180">
          &#9662;
        </span>
      </summary>
      <div className="mt-3 pt-3 border-t border-coyote/20">
        <ol className="list-none m-0 p-0 space-y-1">
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? 'pl-4' : undefined}>
              <a
                href={`#${item.id}`}
                onClick={(e) => onTocClick(e, item.id, true)}
                className="classic-toc-link block py-1.5 text-sm leading-snug text-dark/75 hover:text-canyon"
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

export function ClassicBlogToc({ items, variant }: ClassicBlogTocProps) {
  if (items.length === 0) return null;
  return variant === 'mobile' ? <MobileToc items={items} /> : <DesktopToc items={items} />;
}
