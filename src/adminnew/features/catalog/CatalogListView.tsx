import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Search, Trash2 } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import {
  Button,
  BulkActionBar,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  Page,
  Pagination,
  paginate,
  SkeletonTable,
  useButtonFeedback,
  useRowSelection,
  type Column,
  type PageAction,
} from '../../ui';
import { CatalogStatus, CatalogThumb, catalogError } from './catalogShared';

const PAGE_SIZE = 25;

export interface CatalogListRow {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
  isActive: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export interface CatalogListProps<T extends CatalogListRow> {
  /** Singular and plural nouns, lowercase: "collection" / "collections". */
  noun: string;
  plural: string;
  title: string;
  /** Fallback thumbnail icon for rows without an image. */
  icon: ReactNode;
  rows: T[] | undefined;
  /** Extra columns, placed between the name and the product count. */
  columns?: Column<T>[];
  openPath: (id: string) => string;
  newAction: PageAction;
  secondaryActions?: PageAction[];
  searchPlaceholder: string;
  onRemove: (id: string) => Promise<unknown>;
  onSetActive: (ids: string[], isActive: boolean) => Promise<unknown>;
}

/**
 * Shared list for collections, categories and brands: search + status filter,
 * product count, thumbnails, row selection with a bulk bar (show, hide,
 * delete), pagination, and stacked cards on phones.
 */
export function CatalogListView<T extends CatalogListRow>({
  noun,
  plural,
  title,
  icon,
  rows,
  columns,
  openPath,
  newAction,
  secondaryActions,
  searchPlaceholder,
  onRemove,
  onSetActive,
}: CatalogListProps<T>) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const sel = useRowSelection();
  const showFb = useButtonFeedback();
  const hideFb = useButtonFeedback();

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    const term = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === 'all' || (status === 'active') === r.isActive) &&
        (!term || r.name.toLowerCase().includes(term) || r.slug.toLowerCase().includes(term)),
    );
  }, [rows, query, status]);

  const { pageItems, pageCount } = paginate(filtered ?? [], page, PAGE_SIZE);
  const current = Math.min(page, pageCount);
  const from = filtered && filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0;
  const to = filtered ? Math.min(current * PAGE_SIZE, filtered.length) : 0;

  /** Changing the filter resets paging and drops selections that may be off-screen. */
  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
    sel.clear();
  };

  const runNav = (path?: string, onClick?: () => void) => {
    if (path) navigate(path);
    onClick?.();
  };

  const allColumns: Column<T>[] = [
    {
      id: 'thumb',
      header: <span className="sr-only">Image</span>,
      width: 'w-16',
      cell: (r) => <CatalogThumb src={r.image} icon={icon} alt={r.name} />,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--admin-text)]">{r.name}</div>
          <div className="truncate text-xs text-[var(--admin-text-muted)]">{r.slug}</div>
        </div>
      ),
    },
    ...(columns ?? []),
    {
      id: 'products',
      header: 'Products',
      align: 'right',
      width: 'w-28',
      cell: (r) => <span className="tabular-nums">{r.productCount}</span>,
    },
    { id: 'status', header: 'Status', width: 'w-28', cell: (r) => <CatalogStatus active={r.isActive} /> },
  ];

  const applyStatus = (isActive: boolean, fb: typeof showFb) => {
    const ids = sel.ids;
    void fb.run(() => onSetActive(ids, isActive));
  };

  const removeSelected = async () => {
    const ids = sel.ids;
    const failures: string[] = [];
    let removed = 0;
    for (const id of ids) {
      try {
        await onRemove(id);
        removed++;
      } catch (err) {
        failures.push(catalogError(err, `Could not delete this ${noun}.`).message);
      }
    }
    sel.clear();
    if (failures.length > 0) {
      const reasons = Array.from(new Set(failures)).join(' ');
      throw new Error(`${removed} deleted. ${failures.length} not deleted. ${reasons}`);
    }
  };

  const actionError = showFb.error ?? hideFb.error;

  const emptyNode =
    rows && rows.length === 0 ? (
      <EmptyState
        icon={icon}
        title={`No ${plural} yet`}
        description={`Create a ${noun} to group products for shoppers.`}
        action={
          <Button variant="primary" icon={newAction.icon} onClick={() => runNav(newAction.to, newAction.onClick)}>
            {newAction.label}
          </Button>
        }
      />
    ) : (
      <EmptyState icon={<Search />} title="No matches" description="Try another search or status." />
    );

  return (
    <>
      <Page title={title} primaryAction={newAction} secondaryActions={secondaryActions}>
        {actionError && <ErrorBanner error={actionError} />}
        <Card padding="none">
          <FilterBar
            search={{
              value: query,
              onChange: (v) => changeFilter(() => setQuery(v)),
              placeholder: searchPlaceholder,
            }}
          >
            <FilterSelect<StatusFilter>
              label="Status"
              value={status}
              onChange={(v) => changeFilter(() => setStatus(v))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </FilterBar>

          {filtered === undefined ? (
            <SkeletonTable columns={4} />
          ) : pageItems.length === 0 ? (
            emptyNode
          ) : (
            <>
              <ul className="divide-y divide-[var(--admin-border)] sm:hidden">
                {pageItems.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3',
                      sel.isSelected(r.id) && 'bg-[var(--admin-surface-selected)]',
                    )}
                  >
                    <Checkbox label={`Select ${r.name}`} checked={sel.isSelected(r.id)} onCheckedChange={() => sel.toggle(r.id)} />
                    <button
                      type="button"
                      onClick={() => navigate(openPath(r.id))}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
                    >
                      <CatalogThumb src={r.image} icon={icon} alt={r.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--admin-text)]">{r.name}</span>
                        <span className="block text-xs text-[var(--admin-text-muted)]">
                          {r.productCount} {r.productCount === 1 ? 'product' : 'products'}
                        </span>
                      </span>
                      <CatalogStatus active={r.isActive} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <DataTable
                  columns={allColumns}
                  rows={pageItems}
                  getRowId={(r) => r.id}
                  selection={sel}
                  onRowClick={(r) => navigate(openPath(r.id))}
                  rowLabel={(r) => `Open ${noun} ${r.name}`}
                />
              </div>
            </>
          )}

          {filtered !== undefined && filtered.length > 0 && (
            <Pagination
              page={current}
              pageCount={pageCount}
              onPageChange={setPage}
              summary={`${from}–${to} of ${filtered.length}`}
            />
          )}
        </Card>
      </Page>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<Eye />}
              state={showFb.state}
              onClick={() => applyStatus(true, showFb)}
            >
              Show
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<EyeOff />}
              state={hideFb.state}
              onClick={() => applyStatus(false, hideFb)}
            >
              Hide
            </Button>
            <Button
              size="sm"
              variant="critical"
              icon={<Trash2 />}
              onClick={() => {
                setDeleteCount(sel.count);
                setConfirmOpen(true);
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        critical
        title={`Delete ${deleteCount} ${deleteCount === 1 ? noun : plural}?`}
        description="This cannot be undone."
        confirmLabel={`Delete ${deleteCount}`}
        onConfirm={removeSelected}
      />
    </>
  );
}
