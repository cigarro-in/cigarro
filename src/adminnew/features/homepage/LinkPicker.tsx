import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useOrgInfo } from '../../../lib/org/OrgContext';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

// Storefront routes a button can point at. Category and brand pages are
// chosen from the store's own lists; anything else is typed as an address.
type Kind = 'none' | 'category' | 'brand' | 'products' | 'custom';

const KIND_LABEL: Record<Kind, string> = {
  none: 'No link',
  category: 'Category page',
  brand: 'Brand page',
  products: 'All products',
  custom: 'Other address',
};

function kindOf(value: string): Kind {
  if (!value) return 'none';
  if (value.startsWith('/category/')) return 'category';
  if (value.startsWith('/brand/')) return 'brand';
  if (value === '/products') return 'products';
  return 'custom';
}

/** Writes the slide's buttonUrl. Empty string clears the link. Mount it once the value is loaded. */
export function LinkPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { slug } = useOrgInfo();
  const categories = useQuery(api.catalog.listCategories, { orgSlug: slug });
  const brands = useQuery(api.catalog.listBrands, { orgSlug: slug });
  const [kind, setKind] = useState<Kind>(() => kindOf(value));

  const chooseKind = (next: Kind) => {
    setKind(next);
    if (next === 'products') onChange('/products');
    else if (next === 'custom') onChange(kindOf(value) === 'custom' ? value : '');
    else onChange('');
  };

  const currentSlug =
    kind === 'category' && value.startsWith('/category/')
      ? value.slice('/category/'.length)
      : kind === 'brand' && value.startsWith('/brand/')
        ? value.slice('/brand/'.length)
        : undefined;

  const list: { value: string; label: string }[] =
    kind === 'category'
      ? (categories ?? []).map((c) => ({ value: c.slug, label: c.name }))
      : kind === 'brand'
        ? (brands ?? []).map((b) => ({ value: b.slug, label: b.name }))
        : [];

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={kind} onValueChange={(v) => chooseKind(v as Kind)}>
          <SelectTrigger aria-label="Link goes to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(kind === 'category' || kind === 'brand') && (
          <Select value={currentSlug} onValueChange={(s) => onChange(`/${kind}/${s}`)}>
            <SelectTrigger aria-label={kind === 'category' ? 'Category' : 'Brand'}>
              <SelectValue placeholder={kind === 'category' ? 'Choose a category' : 'Choose a brand'} />
            </SelectTrigger>
            <SelectContent>
              {list.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {kind === 'custom' && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/products?search=cigar or https://"
          aria-label="Link address"
        />
      )}
    </div>
  );
}
