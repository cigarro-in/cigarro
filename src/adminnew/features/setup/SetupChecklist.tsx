import type { Id } from '../../../../convex/_generated/dataModel';
import { useStoreSetup } from '../../hooks/useStoreSetup';
import { Card } from '../../ui';
import { SetupSteps } from './SetupSteps';

/**
 * Setup checklist at the top of Settings. Full steps while setup is unfinished;
 * one compact line once the store is ready. The #setup anchor always exists so
 * /settings#setup lands here.
 */
export function SetupChecklist({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const { status } = useStoreSetup(orgId);

  if (status?.complete) {
    return (
      <div id="setup">
        <Card>
          <p className="text-sm font-medium text-[var(--admin-success)]">Your store is ready to take payments.</p>
        </Card>
      </div>
    );
  }

  return (
    <div id="setup">
      <SetupSteps orgId={orgId} />
    </div>
  );
}
