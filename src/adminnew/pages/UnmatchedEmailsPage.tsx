import { AdminCard, AdminCardContent } from '../components/shared/AdminCard';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { paiseToRupees } from '../../lib/convex/money';
import { formatINR } from '../../utils/currency';

export function UnmatchedEmailsPage() {
  const org = useOrg();
  const emails = useQuery(
    api.admin.listUnmatchedEmails,
    org ? { orgId: org._id } : 'skip',
  );

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader title="Unmatched Bank Emails" description="Payments that did not match any open order" />
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {emails === undefined && <p>Loading...</p>}
        {emails && emails.length === 0 && (
          <AdminCard><AdminCardContent className="p-6 text-center text-gray-600">No unmatched emails</AdminCardContent></AdminCard>
        )}
        {emails?.map((em: any) => (
          <AdminCard key={em._id}>
            <AdminCardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{formatINR(paiseToRupees(em.amountPaise))}</p>
                  <p className="text-sm text-gray-600">{em.senderEmail}</p>
                  {em.upiRef && (
                    <p className="text-xs font-mono text-gray-500">UPI Ref: {em.upiRef}</p>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(em.receivedAt).toLocaleString()}
                </p>
              </div>
              {em.subject && (
                <p className="text-xs text-gray-700 italic">{em.subject}</p>
              )}
            </AdminCardContent>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}
