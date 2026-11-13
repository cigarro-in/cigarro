import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { Package, Plus } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import { ORG_SLUG } from '../../../lib/convex/org';
import { Button, EmptyState, Input, SkeletonText } from '../../ui';
import { CatalogThumb } from './catalogShared';

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  brandId: string | null;
  image: string | null;
  active: boolean;
}

/** Active and inactive products for the membership pickers, in one Convex query. */
export function useCatalogProducts(): CatalogProduct[] | undefined {
  const rows = useQuery(api.adminCatalog.listProductsForAdmin, { orgSlug: ORG_SLUG });
  return useMemo(
    () =>
      rows?.map((p: any) => {
        const variants: any[] = p.product_variants ?? [];
        const variant = variants.find((v) => v.isDefault) ?? variants[0];
        return {
          id: p.supabaseId,
          name: p.name,
          brand: p.brand?.name ?? null,
          brandId: p.brandSupabaseId ?? null,
          image: variant?.images?.[0] ?? null,
          active: p.isActive !== false,
        };
      }),
    [rows],
  );
}

/**
 * Add/remove products for a collection or category. Selected products keep
 * their order (the storefront sorts collections by sortOrder from that order).
 */
export function ProductMembers({
  selectedIds,
  products,
  onChange,
}: {
  selectedIds: string[];
  products: CatalogProduct[] | undefined;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (products === undefined) return <SkeletonText lines={3} />;

  const selected = selectedIds.map((pid) => byId.get(pid)).filter((p): p is CatalogProduct => !!p);
  const matches = term
    ? products
        .filter(
          (p) =>
            p.active &&
            !selectedSet.has(p.id) &&
            (p.name.toLowerCase().includes(term) || (p.brand ?? '').toLowerCase().includes(term)),
        )
        .slice(0, 8)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products to add"
        aria-label="Search products to add"
      />

      {term && (
        <div className="overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[var(--admin-text-muted)]">No active products match.</p>
          ) : (
            matches.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-[var(--admin-border)] px-3 py-2 last:border-b-0">
                <CatalogThumb src={p.image} icon={<Package />} alt={p.name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--admin-text)]">{p.name}</div>
                  {p.brand && <div className="truncate text-xs text-[var(--admin-text-muted)]">{p.brand}</div>}
                </div>
                <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => onChange([...selectedIds, p.id])}>
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {selected.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="No products yet"
          description="Search above to add products."
          className="py-6"
        />
      ) : (
        <ul className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          {selected.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <CatalogThumb src={p.image} icon={<Package />} alt={p.name} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--admin-text)]">{p.name}</div>
                {p.brand && <div className="truncate text-xs text-[var(--admin-text-muted)]">{p.brand}</div>}
              </div>
              <Button
                size="sm"
                variant="plain"
                aria-label={`Remove ${p.name}`}
                onClick={() => onChange(selectedIds.filter((x) => x !== p.id))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Read-only list of the products assigned to a brand (brands are set on the product). */
export function BrandProductList({ products, brandId }: { products: CatalogProduct[] | undefined; brandId: string | undefined }) {
  if (products === undefined) return <SkeletonText lines={3} />;
  const mine = brandId ? products.filter((p) => p.brandId === brandId) : [];
  if (mine.length === 0) {
    return (
      <EmptyState
        icon={<Package />}
        title="No products in this brand"
        description="Set the brand on a product in the product editor."
        className="py-6"
      />
    );
  }
  return (
    <ul className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
      {mine.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-3 py-2">
          <CatalogThumb src={p.image} icon={<Package />} alt={p.name} className="size-9" />
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--admin-text)]">{p.name}</div>
        </li>
      ))}
    </ul>
  );
}
