import { EntityCombobox } from './EntityCombobox';
import { useCatalogTaxonomy } from './useCatalogTaxonomy';

type Taxonomy = ReturnType<typeof useCatalogTaxonomy>;

/**
 * Brand / category / collection pickers with inline "Create '<text>'".
 * Pass the object from useCatalogTaxonomy(orgSlug) so one page shares one
 * set of subscriptions.
 */
export function BrandPicker({
  taxonomy,
  value,
  onChange,
  id,
}: {
  taxonomy: Taxonomy;
  value: string;
  onChange: (brandId: string) => void;
  id?: string;
}) {
  return (
    <EntityCombobox
      id={id}
      noun="brand"
      options={taxonomy.brands}
      value={value}
      onChange={onChange}
      onCreate={taxonomy.createBrand}
    />
  );
}

export function CategoryPicker({
  taxonomy,
  value,
  onChange,
  id,
}: {
  taxonomy: Taxonomy;
  value: string[];
  onChange: (categoryIds: string[]) => void;
  id?: string;
}) {
  return (
    <EntityCombobox
      id={id}
      multiple
      noun="category"
      options={taxonomy.categories}
      value={value}
      onChange={onChange}
      onCreate={taxonomy.createCategory}
    />
  );
}

export function CollectionPicker({
  taxonomy,
  value,
  onChange,
  id,
}: {
  taxonomy: Taxonomy;
  value: string[];
  onChange: (collectionIds: string[]) => void;
  id?: string;
}) {
  return (
    <EntityCombobox
      id={id}
      multiple
      noun="collection"
      options={taxonomy.collections}
      value={value}
      onChange={onChange}
      onCreate={taxonomy.createCollection}
    />
  );
}
