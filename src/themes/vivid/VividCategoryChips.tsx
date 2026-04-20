import { Link } from 'react-router-dom';
import type { Category } from '../../types/home';

interface Props {
  categories?: Category[];
  isLoading?: boolean;
}

export function VividCategoryChips({ categories = [], isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-[var(--color-surface)] animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          to={`/category/${cat.slug}`}
          className="vv-chip flex-shrink-0"
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
