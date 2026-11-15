import { useOrg } from '../../../lib/convex/useOrg';
import { AdvancedCard } from './AdvancedCard';
import { AutoConfirmCard } from './AutoConfirmCard';
import { StoreOptionsCard } from './StoreOptionsCard';
import { UpiIdsCard } from './UpiIdsCard';

/** Payments settings: automatic confirmation (phone or Gmail), UPI IDs, options, advanced. */
export function SettingsTab() {
  const org = useOrg();
  const orgId = org?._id;
  return (
    <div className="flex flex-col gap-3">
      <AutoConfirmCard orgId={orgId} />
      <UpiIdsCard orgId={orgId} />
      <StoreOptionsCard orgId={orgId} />
      <AdvancedCard orgId={orgId} />
    </div>
  );
}
