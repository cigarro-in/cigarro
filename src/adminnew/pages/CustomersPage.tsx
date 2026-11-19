import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Users } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { formatOrderDate } from '../../lib/orders/format';
import { formatINR } from '../../utils/currency';
import { CustomerCards } from '../features/customers/CustomerCards';
import type { CustomerListRow } from '../features/customers/customerModel';
import { useCursorPages, usePageSize } from '../hooks/usePagination';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  Page,
  Pagination,
  type Column,
} from '../ui';

const LIST_KEY = 'customers';

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

/**
 * Customers in this store, newest signup first, with order count, lifetime
 * spend and last order. Search matches name or phone on the server.
 */
export function CustomersPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = usePageSize(LIST_KEY);

  const search = query.trim();
  const pages = useCursorPages(JSON.stringify({ search, pageSize }));

  const result = useQuery(
    api.adminStats.listCustomersPage,
    org ? { orgId: org._id, search: search || undefined, cursor: pages.cursor, pageSize } : 'skip',
  );

  const rows: CustomerListRow[] | undefined = result?.page.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    isAdmin: c.is_admin,
    orderCount: c.orderCount,
    totalSpent: c.totalSpent,
    lastOrderDate: c.lastOrderDate ?? null,
    createdAt: c.created_at,
  }));

  const loading = rows === undefined;
  const empty = !loading && rows.length === 0;
  const hasNext = result ? !result.isDone : false;

  const onPageChange = (target: number) => {
    if (target > pages.page && result?.continueCursor) pages.next(result.continueCursor);
    else if (target < pages.page) pages.prev();
  };
  const open = (c: CustomerListRow) => navigate(`/customers/${c.id}`);

  return (
    <Page title="Customers">
      <Card padding="none">
        <FilterBar
          search={{ value: query, onChange: setQuery, placeholder: 'Search name or phone' }}
        />
        {empty && pages.page === 1 && result?.isDone ? (
          <EmptyState
            icon={<Users />}
            title={search ? 'No customers match' : 'No customers yet'}
            description={
              search ? 'Try a different name or phone number.' : 'Customers appear here after their first order or sign-in.'
            }
          />
        ) : (
          <>
            <div className="md:hidden">
              <CustomerCards rows={rows ?? []} loading={loading} onOpen={open} />
            </div>
            <div className="hidden md:block">
              <DataTable
                columns={COLUMNS}
                rows={loading ? undefined : rows}
                getRowId={(c) => c.id}
                onRowClick={open}
                rowLabel={(c) => `Open customer ${c.name}`}
                empty={<EmptyState icon={<Users />} title={search ? 'No customers match' : 'No customers on this page'} />}
              />
            </div>
          </>
        )}
        {!loading && (rows.length > 0 || pages.page > 1 || hasNext) && (
          <Pagination
            page={pages.page}
            hasNext={hasNext}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}
      </Card>
    </Page>
  );
}
