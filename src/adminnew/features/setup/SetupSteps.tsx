import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useStoreSetup } from '../../hooks/useStoreSetup';
import { formatINR } from '../../../utils/currency';
import { adminPath } from '../../lib/paths';
import { Badge, Button, Card, Skeleton } from '../../ui';
import { PlatformPaymentSheet } from './PlatformPaymentSheet';

// Anchors on the Settings page. The Settings page must give these ids to the
// auto-confirm card and the UPI card.
export const SETUP_ANCHOR_AUTO_CONFIRM = 'payments';
export const SETUP_ANCHOR_UPI = 'upi';

/** Scrolls to a card on this page; falls back to the Settings page when it is not mounted here. */
function useGoToAnchor() {
  const navigate = useNavigate();
  return (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    navigate(`${adminPath('/settings')}#${id}`);
  };
}

function StepMark({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden
      className={
        done
          ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--admin-success)] text-white'
          : 'flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--admin-accent)] text-xs font-semibold text-[var(--admin-text)]'
      }
    >
      {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
    </span>
  );
}

function Step({
  n,
  done,
  title,
  description,
  action,
}: {
  n: number;
  done: boolean;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <StepMark n={n} done={done} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--admin-text)]">{title}</p>
        {description && <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{description}</p>}
      </div>
      <div className="shrink-0 self-center text-sm">{action}</div>
    </li>
  );
}

/**
 * "Get your store ready": the three setup steps with a done tick or an action.
 * Mount inside Settings (its anchors are on that page). The deposit step shows
 * only when the store owes one. Pass the store id; the component loads its own status.
 */
export function SetupSteps({
  orgId,
  className,
}: {
  orgId: Id<'organizations'> | undefined;
  className?: string;
}) {
  const { status } = useStoreSetup(orgId);
  const goTo = useGoToAnchor();
  const [payOpen, setPayOpen] = useState(false);

  const header = (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-[var(--admin-text)]">Get your store ready</h2>
      {status && (
        <p className="text-sm text-[var(--admin-text-muted)]">
          {status.complete ? (
            <span className="text-[var(--admin-success)]">Your store is ready to take payments.</span>
          ) : status.gateEnforced ? (
            "Customers can't pay until these are done."
          ) : (
            'Finish these steps to get the most from your store.'
          )}
        </p>
      )}
    </div>
  );

  if (!status) {
    return (
      <Card className={className}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  const { deposit } = status;

  return (
    <Card className={className}>
      <div className="flex flex-col gap-3">
        {header}
        <ol className="divide-y divide-[var(--admin-border)]">
          <Step
            n={1}
            done={status.autoConfirmDone}
            title="Automatic payment confirmation"
            description="Confirms UPI payments on its own from your bank alerts."
            action={
              status.autoConfirmDone ? (
                <span className="text-xs font-medium text-[var(--admin-success)]">Connected</span>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => goTo(SETUP_ANCHOR_AUTO_CONFIRM)}>
                  Set up
                </Button>
              )
            }
          />
          <Step
            n={2}
            done={status.upiDone}
            title="Add a UPI ID"
            description="Customers pay to this ID."
            action={
              status.upiDone ? (
                <span className="text-xs font-medium text-[var(--admin-success)]">Added</span>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => goTo(SETUP_ANCHOR_UPI)}>
                  Add UPI ID
                </Button>
              )
            }
          />
          {deposit.required && (
            <Step
              n={3}
              done={deposit.done}
              title={`Security deposit ${formatINR(deposit.amountRupees)} (refundable)`}
              description={
                deposit.done
                  ? `${formatINR(deposit.heldRupees)} held by Cigarro.`
                  : 'Held by Cigarro while you sell on the platform.'
              }
              action={
                deposit.done ? (
                  <span className="text-xs font-medium tabular-nums text-[var(--admin-success)]">
                    {formatINR(deposit.heldRupees)} held
                  </span>
                ) : deposit.inReview ? (
                  <Badge tone="info">In review</Badge>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setPayOpen(true)}>
                    Pay {formatINR(deposit.dueNowRupees)}
                  </Button>
                )
              }
            />
          )}
        </ol>
      </div>

      <PlatformPaymentSheet
        open={payOpen}
        onOpenChange={setPayOpen}
        orgId={orgId}
        kind="deposit"
        title={`Pay security deposit ${formatINR(deposit.dueNowRupees)}`}
      />
    </Card>
  );
}
