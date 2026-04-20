import type { HeroSlide } from '../../types/home';

interface Props {
  slides?: HeroSlide[];
  isLoading?: boolean;
}

export function VividHeroBanners({ slides = [], isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="vv-banner animate-pulse" />
        ))}
      </div>
    );
  }

  const active = slides.filter((s) => s.is_active).slice(0, 3);
  if (active.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {active.map((s) => (
        <a key={s.id} href={s.button_url || '#'} className="vv-banner">
          <img src={s.mobile_image_url || s.image_url} alt={s.title} />
        </a>
      ))}
    </div>
  );
}
