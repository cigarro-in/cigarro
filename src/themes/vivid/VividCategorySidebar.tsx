import { useMemo } from 'react';
import type { Category, CategoryWithProducts } from '../../types/home';

interface Props {
  categories?: Category[];
  categoriesWithProducts?: CategoryWithProducts[];
  activeSlug?: string;
  onSelect: (slug: string) => void;
}

export function VividCategorySidebar({ categories = [], categoriesWithProducts = [], activeSlug, onSelect }: Props) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    categoriesWithProducts.forEach((c) => m.set(c.slug, c.products.length));
    return m;
  }, [categoriesWithProducts]);

  const visible = categories.filter((c) => (counts.get(c.slug) || 0) > 0 || categoriesWithProducts.length === 0);

  if (visible.length === 0) return null;

  return (
    <aside className="vv-card overflow-hidden sticky top-20">
      <div className="py-2">
        {visible.map((cat) => {
          const active = cat.slug === activeSlug;
          const count = counts.get(cat.slug);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.slug)}
              className={`vv-side-link w-full ${active ? 'vv-side-link--active' : ''}`}
            >
              <span className="truncate text-left">{cat.name}</span>
              {count !== undefined && (
                <span className="vv-side-count">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
