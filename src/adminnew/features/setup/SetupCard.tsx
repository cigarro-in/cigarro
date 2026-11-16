import { useNavigate } from 'react-router-dom';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useStoreSetup } from '../../hooks/useStoreSetup';
import { adminPath } from '../../lib/paths';
import { Button, Card, ErrorBanner, useButtonFeedback } from '../../ui';

/**
 * Dashboard card for an unfinished store setup. Hidden once setup is complete
 * or the merchant dismisses it. Pass the store id; the component loads its own status.
 */
export function SetupCard({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const { status, dismiss } = useStoreSetup(orgId);
  const navigate = useNavigate();
  const dismissFeedback = useButtonFeedback();

  if (!status || !status.cardVisible || status.complete) return null;

  const { doneCount, totalCount } = status;

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Finish setting up your store</h2>
          <p className="text-sm text-[var(--admin-text-muted)]">
            <span className="tabular-nums">
              {doneCount} of {totalCount}
            </span>{' '}
            done.{' '}
            {status.gateEnforced
              ? "Customers can't pay until setup is complete."
              : 'Finish these steps to get the most from your store.'}
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={doneCount}
          className="flex w-full gap-1"
        >
          {Array.from({ length: totalCount }, (_, i) => (
            <span
              key={i}
              className={
                i < doneCount
                  ? "h-1.5 flex-1 rounded-full bg-[var(--admin-primary)] transition-colors duration-300 motion-reduce:transition-none"
                  : "h-1.5 flex-1 rounded-full bg-[var(--admin-neutral-soft)] transition-colors duration-300 motion-reduce:transition-none"
              }
            />
          ))}
        </div>

        <ErrorBanner error={dismissFeedback.error} />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => navigate(`${adminPath('/settings')}#setup`)}>
            Continue setup
          </Button>
          <Button
            variant="plain"
            size="sm"
            state={dismissFeedback.state}
            onClick={() => void dismissFeedback.run(dismiss)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  );
}
