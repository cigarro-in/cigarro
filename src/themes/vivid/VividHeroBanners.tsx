import type { HeroSlide } from '../../types/home';

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

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-4 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
      {active.map((s, i) => {
        // Desktop/main image from 768px up; phone image below. Fall back to the
        // main image when there is no phone image, and to the phone image when
        // there is no main image.
        const desktopSrc = s.image_url || s.mobile_image_url;
        const phoneSrc = s.mobile_image_url || s.image_url;
        const hasDesktopSource = Boolean(s.image_url && s.mobile_image_url);
        const first = i === 0;
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
                alt={s.title || ''}
                className="w-full h-full object-cover"
                loading={first ? 'eager' : 'lazy'}
                fetchpriority={first ? 'high' : 'auto'}
                decoding="async"
              />
            </picture>
            {(s.title || s.suptitle || s.button_text) && (
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
  );
}
