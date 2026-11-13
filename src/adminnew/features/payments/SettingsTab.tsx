import { useOrg } from '../../../lib/convex/useOrg';
import { AdvancedCard } from './AdvancedCard';
import { BankSendersCard } from './BankSendersCard';
import { GoogleCard } from './GoogleCard';
import { StoreOptionsCard } from './StoreOptionsCard';
import { UpiIdsCard } from './UpiIdsCard';

/** Payments settings: UPI IDs, Google, bank senders, options, advanced. */
export function SettingsTab() {
  const org = useOrg();
  const orgId = org?._id;
  return (
    <div className="flex flex-col gap-3">
      <UpiIdsCard orgId={orgId} />
      <GoogleCard orgId={orgId} />
      <BankSendersCard orgId={orgId} />
      <StoreOptionsCard orgId={orgId} />
      <AdvancedCard orgId={orgId} />
    </div>
  );
}
