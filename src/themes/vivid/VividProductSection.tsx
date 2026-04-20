import type { HomepageProduct } from '../../types/home';
import { VividProductCard } from './VividProductCard';

interface Props {
  title: string;
  products?: HomepageProduct[];
  isLoading?: boolean;
  anchorId?: string;
}

export function VividProductSection({ title, products = [], isLoading, anchorId }: Props) {
  if (!isLoading && products.length === 0) return null;

  return (
    <section id={anchorId} className="scroll-mt-20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="vv-section-title">
          {title}
          <span className="vv-section-count">{isLoading ? '—' : products.length}</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="vv-card flex items-center gap-4 p-3">
                <div className="w-24 h-24 bg-[var(--color-surface-2)] rounded-lg animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-[var(--color-surface-2)] rounded animate-pulse" />
                  <div className="h-4 w-1/3 bg-[var(--color-surface-2)] rounded animate-pulse" />
                </div>
              </div>
            ))
          : products.map((p) => <VividProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
