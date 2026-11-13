import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Users } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { formatOrderDate } from '../../lib/orders/format';
import { formatINR } from '../../utils/currency';
import { CustomerCards } from '../features/customers/CustomerCards';
import {
  matchesCustomer,
  sortByLastOrder,
  type CustomerListRow,
} from '../features/customers/customerModel';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  Page,
  Pagination,
  paginate,
  type Column,
} from '../ui';

const PAGE_SIZE = 25;

const COLUMNS: Column<CustomerListRow>[] = [
  {
    id: 'name',
    header: 'Customer',
    cell: (c) => (
      <span className="flex items-center gap-2">
        <span className="font-medium text-foreground">{c.name}</span>
        {c.isAdmin && <Badge tone="neutral">Admin</Badge>}
      </span>
    ),
  },
  {
    id: 'phone',
    header: 'Phone',
    hideBelow: 'md',
    cell: (c) => <span className="tabular-nums text-muted-foreground">{c.phone || '-'}</span>,
  },
  {
    id: 'orders',
    header: 'Orders',
    align: 'right',
    cell: (c) => <span className="tabular-nums">{c.orderCount}</span>,
  },
  {
    id: 'spent',
    header: 'Total spent',
    align: 'right',
    hideBelow: 'sm',
    cell: (c) => <span className="tabular-nums">{formatINR(c.totalSpent)}</span>,
  },
  {
    id: 'last',
    header: 'Last order',
    align: 'right',
    cell: (c) => (
      <span className="text-muted-foreground">{c.lastOrderDate ? formatOrderDate(c.lastOrderDate) : 'Never'}</span>
    ),
  },
];

/** Customers in this store with order count, lifetime spend and last order. */
export function CustomersPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const raw = useQuery(api.adminStats.listCustomersForAdmin, org ? { orgId: org._id } : 'skip');

  const rows = useMemo<CustomerListRow[] | undefined>(() => {
    if (raw === undefined) return undefined;
    return sortByLastOrder(
      raw.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        isAdmin: c.is_admin,
        orderCount: c.orderCount,
        totalSpent: c.totalSpent,
        lastOrderDate: c.lastOrderDate ?? null,
        createdAt: c.created_at,
      })),
    );
  }, [raw]);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => matchesCustomer(r, query)),
    [rows, query],
  );
  const { pageItems, pageCount } = paginate(filtered, page, PAGE_SIZE);
  const currentPage = Math.min(page, pageCount);
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const onQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };
  const open = (c: CustomerListRow) => navigate(`/customers/${c.id}`);
  const loading = rows === undefined;
  const nothing = !loading && filtered.length === 0;

  return (
    <Page title="Customers">
      <Card padding="none">
        <FilterBar search={{ value: query, onChange: onQuery, placeholder: 'Search name or phone' }} />
        {nothing ? (
          <EmptyState
            icon={<Users />}
            title={query ? 'No customers match' : 'No customers yet'}
            description={query ? 'Try a different name or phone number.' : 'Customers appear here after their first order or sign-in.'}
          />
        ) : (
          <>
            <div className="md:hidden">
              <CustomerCards rows={pageItems} loading={loading} onOpen={open} />
            </div>
            <div className="hidden md:block">
              <DataTable
                columns={COLUMNS}
                rows={loading ? undefined : pageItems}
                getRowId={(c) => c.id}
                onRowClick={open}
                rowLabel={(c) => `Open customer ${c.name}`}
              />
            </div>
          </>
        )}
        {!nothing && !loading && (
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`${start}–${end} of ${filtered.length}`}
          />
        )}
      </Card>
    </Page>
  );
}
