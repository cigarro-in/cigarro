import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { IndianRupee, Percent, Receipt, RefreshCw } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useOrg } from '../../lib/convex/useOrg';
import { cn } from '../../components/ui/utils';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  Page,
  PageLayout,
  Skeleton,
  Switch,
  useButtonFeedback,
} from '../ui';
import {
  EMPTY_DRAFT,
  KIND_OPTIONS,
  dayToMs,
  draftToSummaryInput,
  rowToDraft,
  summarizeDiscount,
  validateDraft,
  type DiscountDraft,
  type DiscountKind,
  type DiscountRow,
} from '../features/discounts/discountRules';
import { CollapsibleSection } from '../features/discounts/CollapsibleSection';
import { PickMany } from '../features/discounts/PickMany';
import { discountError } from '../features/discounts/discountErrors';

const KIND_ICON: Record<DiscountKind, typeof Percent> = {
  percentage: Percent,
  fixed_amount: IndianRupee,
  cart_value: Receipt,
};

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function DiscountFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const org = useOrg();
  const orgSlug = org?.slug;
  const orgId = org?._id;

  const row = useQuery(
    api.discounts.getDiscountForEdit,
    isEdit && orgSlug ? { orgSlug, id: id as Id<'discounts'> } : 'skip',
  ) as DiscountRow | null | undefined;
  const customers = useQuery(api.adminStats.listCustomersForAdmin, orgId ? { orgId } : 'skip');
  const products = useQuery(api.adminCatalog.listProductsForAdmin, orgSlug ? { orgSlug } : 'skip');

  const saveDiscount = useMutation(api.discounts.saveDiscount);
  const removeDiscount = useMutation(api.discounts.deleteDiscount);
  const saveFb = useButtonFeedback();

  const [draft, setDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(!isEdit);
  const [attempted, setAttempted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!hydrated && row) {
      setDraft(rowToDraft(row));
      setHydrated(true);
    }
  }, [hydrated, row]);

  const set = (patch: Partial<DiscountDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const preview = useMemo(
    () => (parseFloat(draft.value) > 0 ? summarizeDiscount(draftToSummaryInput(draft)) : null),
    [draft],
  );

  const productItems = useMemo(
    () =>
      (products ?? [])
        .filter((p) => p.isActive)
        .map((p) => ({ id: p.supabaseId, label: p.name })),
    [products],
  );
  const customerItems = useMemo(
    () =>
      (customers ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        sub: c.phone || undefined,
      })),
    [customers],
  );

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    set({ code });
  };

  const onSave = () => {
    setAttempted(true);
    if (errors.length > 0 || !orgSlug) return;
    // A cleared optional field is sent as 0 on edit: a Convex patch cannot
    // remove a field, and the backend treats 0 as "not set".
    const clear = (n: number | undefined) => n ?? (isEdit ? 0 : undefined);
    const isPct = draft.kind === 'percentage';
    const uses = num(draft.usageLimit);
    const payload = {
      name: draft.name.trim(),
      code: draft.code.trim() || undefined,
      description: draft.description.trim(),
      type: draft.kind,
      value: parseFloat(draft.value),
      min_cart_value: clear(num(draft.minOrder)),
      max_discount_amount: clear(isPct ? num(draft.maxDiscount) : undefined),
      applicable_to: draft.appliesTo,
      product_ids: draft.appliesTo === 'products' ? draft.productIds : [],
      start_date: clear(dayToMs(draft.startDate, 'start')),
      end_date: clear(dayToMs(draft.endDate, 'end')),
      usage_limit: clear(uses ? Math.floor(uses) : undefined),
      is_active: draft.isActive,
      allowed_user_ids: draft.customerIds,
    };
    void saveFb.run(async () => {
      if (isEdit) await saveDiscount({ orgSlug, id: id as Id<'discounts'>, ...payload });
      else await saveDiscount({ orgSlug, ...payload });
      setTimeout(() => navigate('/discounts'), 600);
    });
  };

  if (isEdit && row === undefined) {
    return (
      <Page title="Edit discount" backTo="/discounts">
        <Card>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        </Card>
      </Page>
    );
  }

  if (isEdit && row === null) {
    return (
      <Page title="Discount not found" backTo="/discounts">
        <Card>
          <EmptyState
            title="This discount no longer exists"
            description="It may have been deleted."
            action={<Button onClick={() => navigate('/discounts')}>Back to discounts</Button>}
          />
        </Card>
      </Page>
    );
  }

  const isPct = draft.kind === 'percentage';
  const isBig = draft.kind === 'cart_value';
  const valueLabel = isPct ? 'How much off (%)' : 'Amount off (₹)';

  return (
    <Page
      title={isEdit ? draft.name || 'Edit discount' : 'New discount'}
      backTo="/discounts"
      primaryAction={{
        label: isEdit ? 'Save changes' : 'Create discount',
        onClick: onSave,
        state: saveFb.state,
      }}
      secondaryActions={isEdit ? [{ label: 'Delete', critical: true, onClick: () => setConfirmDelete(true) }] : []}
    >
      <ErrorBanner error={saveFb.error} />
      {attempted && errors.length > 0 && (
        <Banner tone="critical" title="Fix these before saving">
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Banner>
      )}

      <PageLayout
        main={
          <>
            <Card title="What kind of discount is it?">
              <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Discount type">
                {KIND_OPTIONS.map((o) => {
                  const Icon = KIND_ICON[o.kind];
                  const active = draft.kind === o.kind;
                  return (
                    <button
                      key={o.kind}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set({ kind: o.kind })}
                      className={cn(
                        'flex min-h-[120px] flex-col items-start gap-2 rounded-[var(--admin-radius)] border p-4 text-left transition-colors',
                        active
                          ? 'border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] ring-1 ring-[var(--admin-primary)]'
                          : 'border-[var(--admin-border-strong)] hover:bg-[var(--admin-surface-hover)]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-9 items-center justify-center rounded-full',
                          active ? 'bg-[var(--admin-primary)] text-[var(--admin-text-on-primary)]' : 'bg-[var(--admin-neutral-soft)] text-[var(--admin-text-muted)]',
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="text-[15px] font-semibold text-[var(--admin-text)]">{o.title}</span>
                      <span className="text-sm text-[var(--admin-text-muted)]">{o.example}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="The basics">
              <div className="flex flex-col gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="disc-name">Name customers will see</Label>
                  <Input
                    id="disc-name"
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="e.g. Diwali sale"
                  />
                </div>

                <div className={cn('grid gap-4', isBig ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="disc-value">{valueLabel}</Label>
                    <Input
                      id="disc-value"
                      inputMode="decimal"
                      value={draft.value}
                      onChange={(e) => set({ value: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder={isPct ? 'e.g. 10' : 'e.g. 100'}
                    />
                  </div>
                  {isBig && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="disc-min">Only when the bill is over (₹)</Label>
                      <Input
                        id="disc-min"
                        inputMode="decimal"
                        value={draft.minOrder}
                        onChange={(e) => set({ minOrder: e.target.value.replace(/[^0-9.]/g, '') })}
                        placeholder="e.g. 999"
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="disc-code">Code (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="disc-code"
                      value={draft.code}
                      onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                      placeholder="e.g. DIWALI10"
                      className="font-mono"
                    />
                    <Button variant="secondary" icon={<RefreshCw />} onClick={generateCode} aria-label="Generate a code">
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--admin-text-muted)]">
                    Customers type this at checkout. Leave it empty if no code is needed.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="disc-desc">Note for your team (optional)</Label>
                  <Input
                    id="disc-desc"
                    value={draft.description}
                    onChange={(e) => set({ description: e.target.value })}
                    placeholder="Why this discount exists"
                  />
                </div>
              </div>
            </Card>

            <Card padding="none" title="More options">
              <CollapsibleSection
                title="Limits"
                hint={[
                  !isBig && draft.minOrder ? `Over ${draft.minOrder}` : null,
                  isPct && draft.maxDiscount ? `Saving up to ₹${draft.maxDiscount}` : null,
                  draft.usageLimit ? `${draft.usageLimit} uses` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Minimum order, maximum saving, number of uses'}
                defaultOpen={(!isBig && !!draft.minOrder) || (isPct && !!draft.maxDiscount) || !!draft.usageLimit}
              >
                {!isBig && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="disc-min2">Minimum order (₹)</Label>
                    <Input
                      id="disc-min2"
                      inputMode="decimal"
                      value={draft.minOrder}
                      onChange={(e) => set({ minOrder: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="Leave empty for no minimum"
                    />
                  </div>
                )}
                {isPct && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="disc-cap">Most they can save (₹)</Label>
                    <Input
                      id="disc-cap"
                      inputMode="decimal"
                      value={draft.maxDiscount}
                      onChange={(e) => set({ maxDiscount: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="Leave empty for no cap"
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="disc-uses">Total number of uses</Label>
                  <Input
                    id="disc-uses"
                    inputMode="numeric"
                    value={draft.usageLimit}
                    onChange={(e) => set({ usageLimit: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Dates"
                hint={
                  draft.startDate || draft.endDate
                    ? `${draft.startDate || 'Now'} to ${draft.endDate || 'no end date'}`
                    : 'Always on unless you set dates'
                }
                defaultOpen={!!draft.startDate || !!draft.endDate}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="disc-start">Starts on</Label>
                    <Input id="disc-start" type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="disc-end">Ends on (the whole day counts)</Label>
                    <Input id="disc-end" type="date" value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} />
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Which products it applies to"
                hint={draft.appliesTo === 'all' ? 'All products' : `Only ${draft.appliesTo === 'products' ? 'selected products' : draft.appliesTo}`}
                defaultOpen={draft.appliesTo !== 'all'}
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="disc-applies">Applies to</Label>
                  <select
                    id="disc-applies"
                    value={draft.appliesTo}
                    onChange={(e) => set({ appliesTo: e.target.value as DiscountDraft['appliesTo'] })}
                    className="h-9 rounded-[var(--admin-radius)] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)] focus:border-[var(--admin-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus)]/20"
                  >
                    <option value="all">All products</option>
                    <option value="products">Selected products</option>
                    <option value="combos">Combos</option>
                    <option value="variants">Specific variants</option>
                  </select>
                </div>
                {draft.appliesTo === 'products' && (
                  <PickMany
                    items={productItems}
                    value={draft.productIds}
                    onChange={(productIds) => set({ productIds })}
                    searchPlaceholder="Search products"
                    emptyText="No active products yet."
                    loading={products === undefined}
                  />
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Only for selected customers"
                hint={draft.customerIds.length ? `${draft.customerIds.length} selected` : 'Open to every customer'}
                defaultOpen={draft.customerIds.length > 0}
              >
                <p className="text-sm text-[var(--admin-text-muted)]">
                  Leave this empty for everyone. Add customers to make it a private offer for them.
                </p>
                <PickMany
                  items={customerItems}
                  value={draft.customerIds}
                  onChange={(customerIds) => set({ customerIds })}
                  searchPlaceholder="Search by name or phone"
                  emptyText="No customers yet."
                  loading={customers === undefined}
                />
              </CollapsibleSection>
            </Card>
          </>
        }
        aside={
          <>
            <Card title="How it works">
              <div className="flex flex-col gap-2">
                {preview ? (
                  <p className="text-[17px] font-semibold leading-snug text-[var(--admin-text)]">{preview}</p>
                ) : (
                  <p className="text-sm text-[var(--admin-text-muted)]">Enter the amount to see how this discount works.</p>
                )}
                {draft.code && (
                  <p className="text-sm text-[var(--admin-text-muted)]">
                    Customers enter <span className="font-mono text-[var(--admin-text)]">{draft.code}</span>
                  </p>
                )}
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--admin-text)]">Turned on</p>
                  <p className="text-xs text-[var(--admin-text-muted)]">Off means no customer can use it.</p>
                </div>
                <Switch checked={draft.isActive} onCheckedChange={(isActive) => set({ isActive })} aria-label="Turned on" />
              </div>
            </Card>
          </>
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this discount?"
        description="Customers will no longer be able to use it. This cannot be undone."
        confirmLabel="Delete discount"
        critical
        onConfirm={async () => {
          try {
            await removeDiscount({ orgSlug: orgSlug!, id: id as Id<'discounts'> });
          } catch (err) {
            throw discountError(err);
          }
          navigate('/discounts');
        }}
      />
    </Page>
  );
}
