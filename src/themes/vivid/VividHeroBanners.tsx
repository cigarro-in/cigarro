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
      {active.map((s) => (
        <a
          key={s.id}
          href={s.button_url || '#'}
          className="vv-banner shrink-0 snap-start w-[85%] md:w-auto relative block overflow-hidden"
        >
          <img src={s.mobile_image_url || s.image_url} alt={s.title} className="w-full h-full object-cover" />
          {(s.title || s.button_text) && (
            <span className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white">
              {s.suptitle && <span className="block text-[11px] uppercase tracking-wider opacity-80">{s.suptitle}</span>}
              {s.title && <span className="block font-serif text-lg leading-tight">{s.title}</span>}
              {s.button_text && <span className="mt-1 inline-block text-xs font-medium uppercase tracking-wide underline underline-offset-4">{s.button_text}</span>}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
