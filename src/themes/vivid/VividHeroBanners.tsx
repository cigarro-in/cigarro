import { Helmet } from 'react-helmet-async';
import type { HeroSlide } from '../../types/home';

/** Readable label from a banner link ("/product/sobranie-cocktail" -> "Sobranie cocktail"). */
function labelFromUrl(url: string | undefined, index: number): string {
  const segment = (url || '').split(/[?#]/)[0].split('/').filter(Boolean).pop();
  if (!segment) return `Promotion ${index + 1}`;
  const words = decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : `Promotion ${index + 1}`;
}

interface Props {
  slides?: HeroSlide[];
  isLoading?: boolean;
}

export function VividHeroBanners({ slides = [], isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-4 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="vv-banner animate-pulse shrink-0 snap-start w-[85%] md:w-auto"
          />
        ))}
      </div>
    );
  }

  const active = slides.filter((s) => s.is_active).slice(0, 3);
  if (active.length === 0) return null;

  // The first banner is the page's LCP image. Preload it from <head> (the server
  // render emits these tags before the large preload payload), one hint per
  // breakpoint so a phone never downloads the desktop image.
  const lead = active[0];
  const leadDesktop = lead.image_url || lead.mobile_image_url;
  const leadPhone = lead.mobile_image_url || lead.image_url;
  const leadSplit = Boolean(lead.image_url && lead.mobile_image_url);

  return (
    <>
    <Helmet>
      {leadSplit ? (
        <link rel="preload" as="image" href={leadPhone} media="(max-width: 767px)" fetchPriority="high" />
      ) : (
        <link rel="preload" as="image" href={leadPhone} fetchPriority="high" />
      )}
      {leadSplit && <link rel="preload" as="image" href={leadDesktop} media="(min-width: 768px)" fetchPriority="high" />}
    </Helmet>
    <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-4 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
      {active.map((s, i) => {
        // Desktop/main image from 768px up; phone image below. Fall back to the
        // main image when there is no phone image, and to the phone image when
        // there is no main image.
        const desktopSrc = s.image_url || s.mobile_image_url;
        const phoneSrc = s.mobile_image_url || s.image_url;
        const hasDesktopSource = Boolean(s.image_url && s.mobile_image_url);
        const first = i === 0;
        // The caption (when present) names the link; otherwise the image alt must.
        const hasCaption = Boolean(s.title || s.suptitle || s.button_text);
        return (
          <a
            key={s.id}
            href={s.button_url || '#'}
            className="vv-banner shrink-0 snap-start w-[85%] md:w-auto relative block overflow-hidden"
          >
            <picture className="block w-full h-full">
              {hasDesktopSource && <source media="(min-width: 768px)" srcSet={desktopSrc} />}
              <img
                src={phoneSrc}
                alt={hasCaption ? '' : labelFromUrl(s.button_url, i)}
                className="w-full h-full object-cover"
                loading={first ? 'eager' : 'lazy'}
                fetchpriority={first ? 'high' : 'low'}
                decoding="async"
              />
            </picture>
            {hasCaption && (
              <span className="absolute inset-x-0 bottom-0 p-3 bg-black/60 text-white">
                {s.suptitle && <span className="block text-[11px] uppercase tracking-wider opacity-80">{s.suptitle}</span>}
                {s.title && <span className="block font-serif text-lg leading-tight">{s.title}</span>}
                {s.button_text && <span className="mt-1 inline-block text-xs font-medium uppercase tracking-wide underline underline-offset-4">{s.button_text}</span>}
              </span>
            )}
          </a>
        );
      })}
    </div>
    </>
  );
}
