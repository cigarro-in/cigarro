import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { readStoredPreference, writeStoredPreference } from '../../lib/browserStorage';
import { Banner, Button } from '../ui';

const SETTINGS_PATH = '/payments/settings';

/**
 * Shell-wide prompt shown while the store has no working Gmail connection
 * (convex/gmail.ts getGmailStatus). Dismissal is remembered per store.
 */
export function GmailBanner() {
  const org = useOrg();
  const { slug } = useOrgInfo();
  const location = useLocation();
  const storageKey = `adminGmailBannerDismissed:${slug}`;
  const [dismissed, setDismissed] = useState(() => readStoredPreference(storageKey) === '1');
  const status = useQuery(api.gmail.getGmailStatus, org ? { orgId: org._id } : 'skip');

  if (dismissed || status === undefined) return null;
  if (status && status.status === 'active') return null;
  if (location.pathname.startsWith('/payments')) return null;

  const needsReconnect = status?.status === 'needs_reconnect';

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 pt-3 sm:px-4">
      <Banner
        tone={needsReconnect ? 'warning' : 'info'}
        onDismiss={() => {
          writeStoredPreference(storageKey, '1');
          setDismissed(true);
        }}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to={SETTINGS_PATH}>{needsReconnect ? 'Reconnect' : 'Connect'}</Link>
          </Button>
        }
      >
        {needsReconnect
          ? 'Gmail needs to be reconnected to keep confirming UPI payments automatically'
          : 'Connect Gmail to confirm UPI payments automatically'}
      </Banner>
    </div>
  );
}
