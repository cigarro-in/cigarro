import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { FileSpreadsheet, MoreHorizontal, Package, Plus } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { formatINR } from '../../utils/currency';
import { cn } from '../../components/ui/utils';
import { useCursorPages, usePageSize } from '../hooks/usePagination';
import { ProductImportExport } from '../features/ProductImportExport';
import { CategoryPicker, CollectionPicker, useCatalogTaxonomy } from '../features/products';
import {
  Badge,
  BulkActionBar,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  Menu,
  Page,
  Pagination,
  Tabs,
  useButtonFeedback,
  useRowSelection,
  type Column,
} from '../ui';

type StatusView = 'all' | 'active' | 'draft';
type StockFilter = 'all' | 'in' | 'out' | 'untracked';
type GroupKind = 'collection' | 'category';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  brandId: string | null;
  brandName: string | null;
  categoryIds: string[];
  collectionIds: string[];
  image: string | null;
  price: number | null;
  variantCount: number;
  /** null when no option tracks stock. */
  stock: number | null;
}

function StockCell({ stock }: { stock: number | null }) {
  if (stock === null) return <span className="text-[var(--admin-text-muted)]">-</span>;
  return (
    <span className={cn('tabular-nums', stock <= 0 ? 'text-[var(--admin-critical)]' : 'text-[var(--admin-text)]')}>
      {stock <= 0 ? 'Out of stock' : `${stock} in stock`}
    </span>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]">
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <Package className="size-4 text-[var(--admin-text-subtle)]" aria-hidden />
      )}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Draft'}</Badge>;
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { slug: orgSlug } = useOrgInfo();
  const taxonomy = useCatalogTaxonomy(orgSlug);

  const [view, setView] = useState<StatusView>('all');
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [category, setCategory] = useState('all');
  const [collection, setCollection] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [pageSize, setPageSize] = usePageSize('products');
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [groupDialog, setGroupDialog] = useState<{ kind: GroupKind; mode: 'add' | 'remove' } | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  const search = q.trim();
  const pages = useCursorPages(
    JSON.stringify({ view, search, brand, category, collection, stockFilter, pageSize }),
  );

  // Convex is the catalog source of truth; reactive, so imports and edits
  // refresh the list with no manual refetch. Filtering and stock run server-side.
  const result = useQuery(api.adminCatalog.listProductsPageForAdmin, {
    orgSlug,
    view,
    search: search || undefined,
    brand: brand === 'all' ? undefined : brand,
    category: category === 'all' ? undefined : category,
    collection: collection === 'all' ? undefined : collection,
    stock: stockFilter,
    pageSize,
    cursor: pages.cursor,
  });
  // Full list is only needed by the import/export dialog.
  const allRows = useQuery(api.adminCatalog.listProductsForAdmin, importOpen ? { orgSlug } : 'skip');
  const deleteProduct = useMutation(api.adminCatalog.deleteProduct);
  const setActive = useMutation(api.adminCatalog.setProductsActive);
  const setMembership = useMutation(api.adminProducts.setProductsGroupMembership);

  const sel = useRowSelection();
  const activateFb = useButtonFeedback();
  const draftFb = useButtonFeedback();
  const groupFb = useButtonFeedback();

  // Boundary normalization: Convex page rows (camelCase, rupees) → list rows.
  const products = useMemo<ProductRow[] | undefined>(() => {
    if (!result) return undefined;
    return result.page.map((p: any) => {
      const variants: any[] = p.product_variants ?? [];
      const def = variants.find((v) => v.isDefault) ?? variants[0];
      return {
        id: p.supabaseId,
        name: p.name,
        slug: p.slug,
        isActive: !!p.isActive,
        brandId: p.brand?.supabaseId ?? p.brandSupabaseId ?? null,
        brandName: p.brand?.name ?? null,
        categoryIds: p.categorySupabaseIds ?? [],
        collectionIds: p.collectionSupabaseIds ?? [],
        image: def?.images?.[0] ?? variants.find((v) => v.images?.length)?.images?.[0] ?? null,
        price: def ? def.priceRupees : null,
        variantCount: variants.length,
        stock: p.stock ?? null,
      };
    });
  }, [result]);

  const filtersActive = view !== 'all' || !!q || brand !== 'all' || category !== 'all' || collection !== 'all' || stockFilter !== 'all';
  const clearFilters = () => {
    setView('all');
    setQ('');
    setBrand('all');
    setCategory('all');
    setCollection('all');
    setStockFilter('all');
  };

  const option = (list: { id: string; label: string }[] | undefined, noneLabel: string) => [
    { value: 'all', label: 'All' },
    { value: 'none', label: noneLabel },
    ...(list ?? []).map((o) => ({ value: o.id, label: o.label })),
  ];

  // ---------- bulk actions ----------
  const runStatus = (isActive: boolean) => {
    const fb = isActive ? activateFb : draftFb;
    (isActive ? draftFb : activateFb).reset();
    void fb.run(() => setActive({ supabaseIds: sel.ids, isActive, orgSlug }));
  };

  const openGroup = (kind: GroupKind, mode: 'add' | 'remove') => {
    setGroupIds([]);
    groupFb.reset();
    setGroupDialog({ kind, mode });
  };

  const applyGroup = async () => {
    if (!groupDialog) return;
    const ok = await groupFb.run(async () => {
      for (const groupSupabaseId of groupIds) {
        await setMembership({
          orgSlug,
          kind: groupDialog.kind,
          groupSupabaseId,
          productSupabaseIds: sel.ids,
          mode: groupDialog.mode,
        });
      }
      return true;
    });
    if (ok) setGroupDialog(null);
  };

  const columns: Column<ProductRow>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <Thumb src={p.image} />
          <div className="min-w-0">
            <div className="truncate font-medium">{p.name}</div>
            {p.brandName && <div className="truncate text-xs text-[var(--admin-text-muted)]">{p.brandName}</div>}
          </div>
        </div>
      ),
    },
    { id: 'status', header: 'Status', cell: (p) => <StatusPill active={p.isActive} />, width: 'w-24' },
    { id: 'stock', header: 'Stock', cell: (p) => <StockCell stock={p.stock} />, width: 'w-32' },
    {
      id: 'options',
      header: 'Options',
      cell: (p) => <span className="tabular-nums text-[var(--admin-text-muted)]">{p.variantCount}</span>,
      align: 'right',
      width: 'w-20',
      hideBelow: 'md',
    },
    {
      id: 'price',
      header: 'Price',
      cell: (p) => (p.price === null ? <span className="text-[var(--admin-text-muted)]">-</span> : <span className="tabular-nums">{formatINR(p.price)}</span>),
      align: 'right',
      width: 'w-28',
    },
  ];

  const loading = products === undefined;
  const rows = products ?? [];
  const hasNext = !!result && !result.isDone;
  // Next uses the cursor the server returned for this page; prev pops the stack.
  const goToPage = (target: number) => {
    if (target > pages.page) {
      if (result?.continueCursor) pages.next(result.continueCursor);
    } else {
      pages.prev();
    }
  };

  // A sparse filter can scan maxScan docs with no match and return an empty
  // page that is not the last. Keep advancing so the user never sees that gap.
  useEffect(() => {
    if (!loading && rows.length === 0 && result && !result.isDone && result.continueCursor) {
      pages.next(result.continueCursor);
    }
  }, [loading, rows.length, result, pages.next]);

  const empty = (
    <EmptyState
      icon={<Package />}
      title={filtersActive ? 'No products match these filters' : 'No products yet'}
      description={filtersActive ? undefined : 'Add your first product or import a spreadsheet.'}
      action={
        filtersActive ? (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => navigate('/products/new')}>
            Add product
          </Button>
        )
      }
    />
  );

  const groupNoun = groupDialog?.kind === 'category' ? 'categories' : 'collections';

  return (
    <Page
      title="Products"
      primaryAction={{ label: 'Add product', icon: <Plus aria-hidden />, to: '/products/new' }}
      secondaryActions={[{ label: 'Import / Export', icon: <FileSpreadsheet aria-hidden />, onClick: () => setImportOpen(true) }]}
    >
      <ErrorBanner error={activateFb.error ?? draftFb.error} />

      <Card padding="none">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'draft', label: 'Draft' },
          ]}
        />
        <FilterBar
          search={{ value: q, onChange: setQ, placeholder: 'Search products', debounceMs: 150 }}
          end={
            filtersActive ? (
              <Button variant="plain" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : undefined
          }
        >
          <FilterSelect label="Brand" value={brand} options={option(taxonomy.brands, 'No brand')} onChange={setBrand} />
          <FilterSelect label="Category" value={category} options={option(taxonomy.categories, 'No category')} onChange={setCategory} />
          <FilterSelect
            label="Collection"
            value={collection}
            options={option(taxonomy.collections, 'No collection')}
            onChange={setCollection}
          />
          <FilterSelect<StockFilter>
            label="Stock"
            value={stockFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'in', label: 'In stock' },
              { value: 'out', label: 'Out of stock' },
              { value: 'untracked', label: 'Not tracked' },
            ]}
            onChange={setStockFilter}
          />
        </FilterBar>

        {/* Phones: card rows */}
        <div className="border-t border-[var(--admin-border)] sm:hidden">
          {loading ? (
            <DataTable columns={columns} rows={undefined} getRowId={(p) => p.id} />
          ) : rows.length === 0 ? (
            empty
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {rows.map((p) => {
                const isSel = sel.isSelected(p.id);
                return (
                  <li
                    key={p.id}
                    className={cn('flex items-center gap-3 px-3 py-3', isSel && 'bg-[var(--admin-surface-selected)]')}
                  >
                    <Checkbox label={`Select ${p.name}`} checked={isSel} onCheckedChange={() => sel.toggle(p.id)} />
                    <button
                      type="button"
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Thumb src={p.image} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--admin-text)]">{p.name}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
                          <StatusPill active={p.isActive} />
                          <StockCell stock={p.stock} />
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-[var(--admin-text)]">
                        {p.price === null ? '-' : formatINR(p.price)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Tablet and up: table */}
        <div className="hidden border-t border-[var(--admin-border)] sm:block">
          <DataTable
            columns={columns}
            rows={loading ? undefined : rows}
            getRowId={(p) => p.id}
            selection={sel}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            rowLabel={(p) => `Open ${p.name}`}
            empty={empty}
          />
        </div>

        {!loading && (rows.length > 0 || pages.page > 1) && (
          <Pagination
            page={pages.page}
            hasNext={hasNext}
            onPageChange={goToPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}
      </Card>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        actions={
          <>
            <Button size="sm" state={activateFb.state} successLabel="Done" onClick={() => runStatus(true)}>
              Set active
            </Button>
            <Button size="sm" state={draftFb.state} successLabel="Done" onClick={() => runStatus(false)}>
              Set draft
            </Button>
            <Menu
              align="end"
              side="top"
              trigger={
                <Button size="sm" variant="secondary" icon={<MoreHorizontal aria-hidden />} aria-label="More bulk actions">
                  More
                </Button>
              }
              sections={[
                {
                  items: [
                    { label: 'Add to collection', onSelect: () => openGroup('collection', 'add') },
                    { label: 'Remove from collection', onSelect: () => openGroup('collection', 'remove') },
                  ],
                },
                {
                  items: [
                    { label: 'Add to category', onSelect: () => openGroup('category', 'add') },
                    { label: 'Remove from category', onSelect: () => openGroup('category', 'remove') },
                  ],
                },
                { items: [{ label: 'Delete products', tone: 'critical', onSelect: () => setConfirmDelete(true) }] },
              ]}
            />
          </>
        }
      />

      <Dialog
        open={groupDialog !== null}
        onOpenChange={(o) => !o && setGroupDialog(null)}
        title={
          groupDialog
            ? `${groupDialog.mode === 'add' ? 'Add' : 'Remove'} ${sel.count} ${sel.count === 1 ? 'product' : 'products'} ${groupDialog.mode === 'add' ? 'to' : 'from'} ${groupNoun}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setGroupDialog(null)} disabled={groupFb.busy}>
              Cancel
            </Button>
            <Button
              variant={groupDialog?.mode === 'remove' ? 'critical' : 'primary'}
              state={groupFb.state}
              disabled={!groupIds.length}
              onClick={() => void applyGroup()}
            >
              {groupDialog?.mode === 'remove' ? 'Remove' : 'Add'}
            </Button>
          </>
        }
      >
        {groupDialog?.kind === 'category' ? (
          <CategoryPicker taxonomy={taxonomy} value={groupIds} onChange={setGroupIds} />
        ) : (
          <CollectionPicker taxonomy={taxonomy} value={groupIds} onChange={setGroupIds} />
        )}
        <ErrorBanner error={groupFb.error} />
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${sel.count} ${sel.count === 1 ? 'product' : 'products'}?`}
        description="They will be removed from the store with their options. This cannot be undone."
        confirmLabel="Delete"
        critical
        onConfirm={async () => {
          for (const supabaseId of sel.ids) {
            await deleteProduct({ supabaseId, orgSlug });
          }
          sel.clear();
        }}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen} title="Import / Export products" size="lg">
        <div className="max-h-[70vh] overflow-y-auto">
          <ProductImportExport products={allRows || []} />
        </div>
      </Dialog>
    </Page>
  );
}
