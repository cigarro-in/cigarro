import { useOrg } from '../../../lib/convex/useOrg';
import { SETUP_ANCHOR_AUTO_CONFIRM, SETUP_ANCHOR_UPI } from '../setup/SetupSteps';
import { AdvancedCard } from '../payments/AdvancedCard';
import { AutoConfirmCard } from '../payments/AutoConfirmCard';
import { StoreOptionsCard } from '../payments/StoreOptionsCard';
import { UpiIdsCard } from '../payments/UpiIdsCard';

/**
 * Settings > Payments. Ordered by what a merchant needs first: automatic
 * confirmation, UPI IDs, store payment options, then advanced timing (collapsed).
 * Two columns on wide screens; cards keep their natural height.
 */
export function PaymentsSection() {
  const org = useOrg();
  const orgId = org?._id;
  return (
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
      <div id={SETUP_ANCHOR_AUTO_CONFIRM}>
        <AutoConfirmCard orgId={orgId} />
      </div>
      <div id={SETUP_ANCHOR_UPI}>
        <UpiIdsCard orgId={orgId} />
      </div>
      <StoreOptionsCard orgId={orgId} />
      <AdvancedCard orgId={orgId} />
    </div>
  );
}
