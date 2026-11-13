import { isValidElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { cn } from '../../components/ui/utils';
import { Button, type ButtonState } from './Button';
import { Menu } from './Menu';
import { GlobalSearch } from '../features/search/GlobalSearch';

/** Declarative page action. A ReactNode is also accepted wherever a PageAction is. */
export interface PageAction {
  label: string;
  onClick?: () => void;
  /** Router-relative path (e.g. '/products/new'). */
  to?: string;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Feedback state from useButtonFeedback(). */
  state?: ButtonState;
  critical?: boolean;
}

function isAction(value: unknown): value is PageAction {
  return !!value && typeof value === 'object' && !isValidElement(value) && 'label' in (value as object);
}

function ActionButton({ action, primary }: { action: PageAction; primary?: boolean }) {
  const navigate = useNavigate();
  const variant = action.critical ? 'critical' : primary ? 'primary' : 'secondary';
  return (
    <Button
      variant={variant}
      icon={action.icon}
      disabled={action.disabled}
      loading={action.loading}
      state={action.state}
      onClick={() => {
        if (action.to) navigate(action.to);
        action.onClick?.();
      }}
    >
      {action.label}
    </Button>
  );
}

/**
 * Standard admin page frame. Content fills the width to the right of the
 * sidebar, with 16px gutters on phones and 24px from `sm` up (the same inset
 * the floating sidebar uses). Title only: no eyebrow, no subtitle.
 * The header is a compact floating island (52px): rounded, bordered, sticky
 * 12px from the top (below the mobile bar on phones) with a soft backdrop blur.
 *
 *   <Page title="Orders" primaryAction={{ label: 'Create order', to: '/orders/new' }}>
 *     <Card>...</Card>
 *   </Page>
 *
 * - backTo: router-relative path for the back arrow (detail/form pages).
 * - titleMeta: inline badges next to the title (e.g. <StatusBadge order={o} />).
 * - secondaryActions: shown as buttons on desktop, folded into a "More" menu on phones.
 * - width="form": long-form forms only (caps line length at 880px, centered).
 *   Everything else is fluid. `width="wide"` is accepted as an alias of "fluid".
 * - The global search (orders, products, customers; Cmd/Ctrl+K) sits in the island.
 */
export function Page({
  title,
  backTo,
  titleMeta,
  primaryAction,
  secondaryActions,
  width = 'fluid',
  children,
  className,
}: {
  title: ReactNode;
  backTo?: string;
  titleMeta?: ReactNode;
  primaryAction?: PageAction | ReactNode;
  secondaryActions?: Array<PageAction | ReactNode>;
  width?: 'fluid' | 'form' | 'wide';
  children?: ReactNode;
  className?: string;
}) {
  const secondary = secondaryActions ?? [];
  const menuable = secondary.filter(isAction);
  const hasActions = !!primaryAction || secondary.length > 0;

  return (
    <div
      className={cn(
        'w-full px-4 pb-24 pt-3 sm:px-6',
        width === 'form' ? 'mx-auto max-w-[880px]' : 'max-w-none',
        className,
      )}
    >
      {/* Island header: always the same floating panel (sticky, blurred), so
          nothing shifts when it starts sticking. 12px inset matches the sidebar. */}
      <header className="sticky top-[60px] z-20 mb-3 flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_90%,transparent)] px-3 py-2 shadow-[var(--admin-shadow-island)] backdrop-blur-md backdrop-saturate-150 md:top-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {backTo && (
            <Button asChild variant="plain" size="icon" className="-ml-2 size-8" aria-label="Back">
              <Link to={backTo}>
                <ArrowLeft aria-hidden />
              </Link>
            </Button>
          )}
          <h1 className="min-w-0 truncate text-[18px] font-semibold leading-7 tracking-[-0.01em] text-[var(--admin-text)]">{title}</h1>
          {titleMeta && <div className="flex shrink-0 items-center gap-1.5">{titleMeta}</div>}
        </div>
        <GlobalSearch />
        {hasActions && (
          <div className="flex shrink-0 items-center gap-2">
            {secondary.length > 0 && (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  {secondary.map((a, i) => (isAction(a) ? <ActionButton key={i} action={a} /> : <span key={i}>{a}</span>))}
                </div>
                {menuable.length > 0 && (
                  <div className="sm:hidden">
                    <SecondaryMenu actions={menuable} />
                  </div>
                )}
              </>
            )}
            {primaryAction && (isAction(primaryAction) ? <ActionButton action={primaryAction} primary /> : primaryAction)}
          </div>
        )}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function SecondaryMenu({ actions }: { actions: PageAction[] }) {
  const navigate = useNavigate();
  return (
    <Menu
      trigger={
        <Button variant="secondary" size="icon" aria-label="More actions">
          <MoreHorizontal aria-hidden />
        </Button>
      }
      items={actions.map((a) => ({
        label: a.label,
        icon: a.icon,
        disabled: a.disabled || a.loading,
        tone: a.critical ? 'critical' : 'default',
        onSelect: () => {
          if (a.to) navigate(a.to);
          a.onClick?.();
        },
      }))}
    />
  );
}

/** Two-column layout used by detail/form pages: main (2/3) + aside (1/3), stacked on mobile. */
export function PageLayout({ main, aside }: { main: ReactNode; aside?: ReactNode }) {
  if (!aside) return <div className="flex flex-col gap-3">{main}</div>;
  return (
    <div className="grid items-start gap-3 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">{main}</div>
      <div className="flex min-w-0 flex-col gap-3">{aside}</div>
    </div>
  );
}
