import { useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Users } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { CustomerAside } from '../features/customers/CustomerAside';
import { CustomerOrders } from '../features/customers/CustomerOrders';
import { CustomerSummaryStrip } from '../features/customers/CustomerSummaryStrip';
import type { CustomerProfile } from '../features/customers/customerModel';
import { Badge, Card, EmptyState, Page, PageLayout, Skeleton } from '../ui';

function ProfileSkeleton() {
  return (
    <>
      <Card padding="none">
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </Card>
      <PageLayout
        main={
          <Card padding="none" title="Orders">
            <div className="flex flex-col gap-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        }
        aside={
          <Card>
            <div className="flex flex-col gap-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </Card>
        }
      />
    </>
  );
}

/** Customer profile: summary, orders (each linked to its detail) and contact. */
export function CustomerFormPage() {
  const { id } = useParams();
  const org = useOrg();
  // Route id is the stable userId.
  const data = useQuery(
    api.adminStats.getCustomerProfile,
    org && id ? { orgId: org._id, userId: id } : 'skip',
  );

  if (data === undefined) {
    return (
      <Page title="Customer" backTo="/customers">
        <ProfileSkeleton />
      </Page>
    );
  }

  if (data === null) {
    return (
      <Page title="Customer not found" backTo="/customers">
        <Card padding="none">
          <EmptyState icon={<Users />} title="Customer not found" description="This customer does not exist in this store." />
        </Card>
      </Page>
    );
  }

  const profile = data as CustomerProfile;

  return (
    <Page
      title={profile.name}
      backTo="/customers"
      titleMeta={profile.isAdmin ? <Badge tone="neutral">Admin</Badge> : undefined}
    >
      <CustomerSummaryStrip profile={profile} />
      <PageLayout
        main={<CustomerOrders orders={profile.orders} ordersCapped={profile.ordersCapped} />}
        aside={<CustomerAside profile={profile} />}
      />
    </Page>
  );
}
