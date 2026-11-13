# Admin UI primitives

Everything a store-admin or super-admin page needs. Import from `src/adminnew/ui`:

```tsx
import { Page, Card, Button, DataTable, FilterBar, StatusBadge, formatOrderNumber } from '../ui';
```

`src/adminnew/pages/DashboardPage.tsx` (Overview) is the reference page.

## Rules

- **One admin look.** Styling comes from `src/adminnew/styles/admin.css` (`html.admin-root`). Never import storefront themes (`src/themes/*`), theme tokens (`--vv-*`) or storefront colours (`bg-creme`, `bg-canyon`). Use the `--admin-*` tokens or plain shadcn utilities (`bg-primary`, `text-muted-foreground`, `border`), which map to admin tokens.
- **Fluid width.** Every page is wrapped in `<Page>`. Content fills the space to the right of the sidebar, with 16px side gutters on phones and 24px from `sm` up (the sidebar's own inset). No centered max-width. Use `width="form"` only for long-form forms (caps the line at 880px, centered).
- **Title only.** No eyebrow text above the title, no subtitle under it. Put status next to the title with `titleMeta`.
- **Islands.** The Page header and the desktop sidebar are floating islands: rounded 12px panels with a hairline border and a restrained shadow, inset 12px from the viewport. The header is compact (52px tall, 18px title), sticky (12px from the top, below the mobile bar on phones) with a soft backdrop blur. It always looks the same, so nothing shifts when it starts sticking. Keep 12px (`gap-3`) between page-level blocks. The phone drawer stays edge-attached.
- **Motion.** Hover and press feedback is 120-180ms (`transition-colors duration-150`, `active:scale-[0.98]`). No gradients, no bounce. Everything that moves respects `prefers-reduced-motion` (`motion-reduce:` variants or the reduced-motion block in `admin.css`).
- **No toasts** (sonner is banned). Confirm results on the button (`useButtonFeedback`), show messages with `Banner` / `ErrorBanner` next to the action. Include the Convex code (`error.data.code`): `toActionError` extracts it.
- **No spinners for page loads.** Render skeletons with the final layout (`Skeleton`, `SkeletonTable`, or `DataTable loading`). Never blank the whole page between routes.
- **Money**: paise at the Convex boundary, rupees in UI (`paiseToRupees`, `formatINR`).
- **Orders**: always display one stage via `StatusBadge` / `deriveOrderStage`; never show payment and shipping status side by side. Order numbers via `formatOrderNumber` (plain digits, never `#`), dates via `formatOrderDate`.

## Layout

```tsx
<Page
  title="Order 10234"
  backTo="/orders"
  titleMeta={<StatusBadge order={order} />}
  primaryAction={{ label: 'Mark as shipped', onClick: ship, state: shipFb.state }}
  secondaryActions={[{ label: 'Refund', onClick: openRefund }, { label: 'Cancel order', critical: true, onClick: cancel }]}
>
  <PageLayout main={<Card title="Items">...</Card>} aside={<Card title="Customer">...</Card>} />
</Page>
```

- `Page({ title, backTo?, titleMeta?, primaryAction?, secondaryActions?, width?: 'fluid' | 'form', children })`. Every Page header includes the global search (`features/search/GlobalSearch.tsx`), so do not add another search field to a page. Actions are `PageAction` objects (`label, onClick?, to?, icon?, disabled?, loading?, state?, critical?`) or any ReactNode. Secondary actions fold into a "More" menu on phones.
- `PageLayout({ main, aside? })`: 2/3 + 1/3 on desktop, stacked on mobile.
- `Card({ title?, actions?, footer?, padding?: 'default' | 'none', children })`: flat, hairline border. Use `padding="none"` for tables. `CardSection` divides a card.

## Lists

```tsx
const sel = useRowSelection();
const [preset, setPreset] = useState<DateRangePreset>('all');
const range = getDateRange(preset);

<Card padding="none">
  <Tabs value={view} onChange={setView} tabs={[{ id: 'all', label: 'All' }, { id: 'unpaid', label: 'Awaiting payment', count: 3 }]} />
  <FilterBar search={{ value: q, onChange: setQ, placeholder: 'Search orders' }}>
    <DateRangePresets value={preset} onChange={setPreset} />
    <FilterChip label="Unpaid" active={unpaid} onClick={() => setUnpaid(!unpaid)} />
    <FilterSelect label="Payment" value={pay} options={[{ value: 'all', label: 'All' }]} onChange={setPay} />
  </FilterBar>
  <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} selection={sel}
    onRowClick={(r) => navigate(`/orders/${r.id}`)} rowLabel={(r) => `Open order ${r.number}`}
    empty={<EmptyState title="No orders" />} />
  <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
</Card>
<BulkActionBar count={sel.count} onClear={sel.clear} actions={<Button size="sm">Mark as shipped</Button>} />
```

- Filters always sit at the top of the list, inside the card: Tabs, then FilterBar, then the table.
- `DataTable` columns: `{ id, header, cell(row), align?, width?, hideBelow?: 'sm'|'md'|'lg' }`. `rows === undefined` or `loading` renders a skeleton with the same row height.
- `DateRangePresets` presets: Today, Yesterday, Last 7 days, This month, Last month, All time. `getDateRange(preset)` returns `{ from, to }` ms timestamps (`to` exclusive, `null` = open). `inDateRange(ts, range)` filters client-side.
- `BulkActionBar` is fixed to the bottom of the viewport and renders only while `count > 0`.
- `paginate(items, page, pageSize)` slices client-side lists.

## Buttons and feedback

```tsx
const save = useButtonFeedback();
<Button variant="primary" state={save.state} onClick={() => save.run(() => updateProduct(args))}>Save</Button>
<ErrorBanner error={save.error} />
```

- `Button({ variant: 'primary'|'secondary'|'plain'|'critical', size: 'sm'|'md'|'lg'|'icon', loading?, state?, successLabel?, errorLabel?, icon?, fullWidth?, asChild? })`. Labels swap in place without width change. One primary button per view.
- `useButtonFeedback()` returns `{ state, error, run, reset, busy }`. `run(fn)` resolves to the result or `undefined` on error.
- `ConfirmDialog({ open, onOpenChange, title, description?, confirmLabel, critical?, onConfirm })` for irreversible actions; async errors render inline.

## Other

- `Badge({ tone, dot? })`, tones: neutral, info, success, warning, critical, attention.
- `StatusBadge({ order } | { stage })`: label and tone from `src/lib/orders/orderStage.ts`.
- `Banner({ tone, title?, action?, onDismiss? })`, `ErrorBanner({ error })`.
- `EmptyState({ icon?, title, description?, action? })`.
- `Menu({ trigger, items | sections, header?, align? })`. Items: `{ label, onSelect?, href?, external?, icon?, tone?: 'critical', disabled?, suffix? }`. The trigger must be a ref-forwarding element (a `Button`, or a native button). Never wrap `SidebarMenuButton` (not forwardRef): Radix then cannot anchor the menu and it renders off-screen.
- `EmptyState({ icon?, title, description?, action? })`: write a short, plain sentence for `description` that says what will appear here and how.
- `Dialog`, `Sheet`, `ConfirmDialog`, `OtpInput`, `Checkbox` (with indeterminate), plus re-exported `Input`, `Textarea`, `Label`, `Switch`, `Select*`.

## Global search

`Page` renders `GlobalSearch` in its header. It calls one query, `api.adminStats.searchAdmin({ orgId, text })` (requireOrgAdmin), and groups results as Orders (five-digit number, customer name or phone), Products (title) and Customers (name or phone). Results link with `adminPath()`. Keys: Cmd/Ctrl+K focuses it, arrows move, Enter opens, Escape closes. Below `sm` it collapses to an icon that opens the field over the island.

## Overview greeting

`src/adminnew/features/overview/greetings.ts` holds 100 phrases in five time-of-day groups (20 each). `greetingTitle(now, name)` returns `"<phrase>, <first name>"`. The phrase is picked by a hash of the local day and time-of-day bucket, so it is stable for a few hours and changes the next day. Keep phrases free of commas and full stops.

## Order stage model (`src/lib/orders/orderStage.ts`)

`deriveOrderStage(order)` folds payment + shipping into one of: `unpaid`, `paid` (to prepare), `preparing`, `shipped`, `delivered`, `cancelled` (cancelled, expired, voided), `refunded`, `returned`. Use `STAGE_LABEL`, `STAGE_TONE`, `STAGE_ACTIONS` / `nextOrderActions(order)` (first entry is the primary action) and `ORDER_ACTION_LABEL`. The comment above `OrderAction` maps each action to its Convex mutation.
