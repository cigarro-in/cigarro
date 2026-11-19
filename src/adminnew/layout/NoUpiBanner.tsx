import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { Banner, Button } from '../ui';
import { adminPath } from '../lib/paths';

const SETTINGS_PATH = adminPath('/settings#payments');

/**
 * Shell-wide warning while the store has no UPI ID (convex/lib/payingVpa.ts).
 * Checkout is closed until one is added, so it cannot be dismissed.
 */
export function NoUpiBanner() {
  const org = useOrg();
  const payment = useQuery(api.organizations.getPaymentVpa, org ? { orgId: org._id } : 'skip');
  if (!payment || payment.vpa) return null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 pt-3 sm:px-4">
      <Banner
        tone="warning"
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to={SETTINGS_PATH}>Add UPI ID</Link>
          </Button>
        }
      >
        Checkout is off: no UPI ID is set. Customers see &quot;We&apos;re upgrading our payment system&quot; until you add one
      </Banner>
    </div>
  );
}
