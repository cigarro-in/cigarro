import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useOrg } from '../../lib/convex/useOrg';
import {
  Badge,
  BulkActionBar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  Page,
  useButtonFeedback,
  useRowSelection,
  type BadgeTone,
  type Column,
} from '../ui';
import {
  STATUS_LABEL,
  discountStatus,
  isCustomerOnly,
  summarizeDiscount,
  usesText,
  type DiscountRow,
  type DiscountStatus,
} from '../features/discounts/discountRules';
import { discountError } from '../features/discounts/discountErrors';

const STATUS_TONE: Record<DiscountStatus, BadgeTone> = {
  active: 'success',
  scheduled: 'info',
  expired: 'neutral',
  used_up: 'warning',
  off: 'neutral',
};

type Row = DiscountRow & { status: DiscountStatus; summary: string };

export function DiscountsPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const orgSlug = org?.slug;

  const rows = useQuery(api.discounts.listDiscountsForAdmin, orgSlug ? { orgSlug } : 'skip');
  const setStatus = useMutation(api.discounts.setDiscountsStatus);
  const removeDiscount = useMutation(api.discounts.deleteDiscount);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DiscountStatus>('all');
  const sel = useRowSelection();
  const onFb = useButtonFeedback();
  const offFb = useButtonFeedback();
  const delFb = useButtonFeedback();
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);

  const all: Row[] | undefined = useMemo(() => {
    if (rows === undefined) return undefined;
    const now = Date.now();
    return rows.map((d) => ({
      ...d,
      status: discountStatus(d, now),
      summary: summarizeDiscount(d),
    }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!all) return undefined;
    const needle = query.trim().toLowerCase();
    return all.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (!needle) return true;
      return `${d.name} ${d.code ?? ''} ${d.summary}`.toLowerCase().includes(needle);
    });
  }, [all, query, statusFilter]);

  const setActive = (ids: string[], isActive: boolean, fb: typeof onFb) =>
    fb.run(async () => {
      await setStatus({ orgSlug: orgSlug!, ids: ids as Id<'discounts'>[], isActive });
      // Keep the selection a moment so the button can show its result.
      setTimeout(() => sel.clear(), 1200);
    });

  const columns: Column<Row>[] = [
    {
      id: 'discount',
      header: 'Discount',
      cell: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--admin-text)]">{d.name}</div>
          {d.code ? (
            <div className="font-mono text-xs text-[var(--admin-text-muted)]">{d.code}</div>
          ) : (
            <div className="text-xs text-[var(--admin-text-muted)]">No code needed</div>
          )}
        </div>
      ),
    },
    {
      id: 'summary',
      header: 'What it does',
      cell: (d) => (
        <span className="min-w-[200px] text-[var(--admin-text)]">
          {d.summary}
          {isCustomerOnly(d) && <span className="ml-1.5"><Badge tone="attention">Selected customers</Badge></span>}
        </span>
      ),
    },
    {
      id: 'uses',
      header: 'Uses',
      hideBelow: 'md',
      cell: (d) => <span className="whitespace-nowrap tabular-nums text-[var(--admin-text-muted)]">{usesText(d)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (d) => <Badge tone={STATUS_TONE[d.status]} dot>{STATUS_LABEL[d.status]}</Badge>,
    },
  ];

  const loading = rows === undefined;
  const hasAny = (all?.length ?? 0) > 0;
  const error = onFb.error ?? offFb.error ?? delFb.error;

  return (
    <Page title="Discounts" primaryAction={{ label: 'Add discount', to: '/discounts/new', icon: <Plus /> }}>
      {error && <ErrorBanner error={error} />}
      <Card padding="none">
        <FilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search by name, code or offer' }}>
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'expired', label: 'Expired' },
              { value: 'used_up', label: 'Used up' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </FilterBar>
        <DataTable<Row>
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(d) => d._id}
          selection={sel}
          onRowClick={(d) => navigate(`/discounts/${d._id}`)}
          rowLabel={(d) => `Open ${d.name}`}
          empty={
            hasAny ? (
              <EmptyState title="No discounts match these filters" />
            ) : (
              <EmptyState
                title="No discounts yet"
                description="Create one to offer a code, or a saving on every order."
                action={<Button variant="primary" icon={<Plus />} onClick={() => navigate('/discounts/new')}>Add discount</Button>}
              />
            )
          }
        />
      </Card>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        noun="selected"
        actions={
          <>
            <Button size="sm" icon={<Eye />} state={onFb.state} onClick={() => void setActive(sel.ids, true, onFb)}>
              Turn on
            </Button>
            <Button size="sm" icon={<EyeOff />} state={offFb.state} onClick={() => void setActive(sel.ids, false, offFb)}>
              Turn off
            </Button>
            <Button size="sm" variant="critical" icon={<Trash2 />} onClick={() => setConfirmIds(sel.ids)}>
              Delete
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={confirmIds !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmIds(null);
        }}
        title={`Delete ${confirmIds?.length ?? 0} ${confirmIds?.length === 1 ? 'discount' : 'discounts'}?`}
        description="Deleted discounts cannot be recovered. Orders that already used them are not changed."
        confirmLabel="Delete"
        critical
        onConfirm={async () => {
          const ids = confirmIds ?? [];
          try {
            await Promise.all(ids.map((id) => removeDiscount({ orgSlug: orgSlug!, id: id as Id<'discounts'> })));
            sel.clear();
          } catch (err) {
            throw discountError(err);
          }
        }}
      />
    </Page>
  );
}
