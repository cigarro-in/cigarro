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
 * Shell-wide prompt shown while payments are not confirmed automatically: no
 * connected phone (convex/smsRelay.ts getStatus) and no working Gmail
 * (convex/gmail.ts getGmailStatus), or a phone that stopped sending.
 * Dismissal is remembered per store.
 */
export function GmailBanner() {
  const org = useOrg();
  const { slug } = useOrgInfo();
  const location = useLocation();
  const storageKey = `adminGmailBannerDismissed:${slug}`;
  const [dismissed, setDismissed] = useState(() => readStoredPreference(storageKey) === '1');
  const status = useQuery(api.gmail.getGmailStatus, org ? { orgId: org._id } : 'skip');
  const phone = useQuery(api.smsRelay.getStatus, org ? { orgId: org._id } : 'skip');

  if (dismissed || status === undefined || phone === undefined) return null;
  if (location.pathname.startsWith('/payments')) return null;
  const gmailOn = status?.status === 'active';
  const phoneProblem = phone.state === 'quiet' || phone.state === 'setup_error';
  const phoneOn = phone.state !== 'not_connected' && !phoneProblem;
  if (phoneOn || (gmailOn && !phoneProblem)) return null;

  const needsReconnect = phoneProblem || status?.status === 'needs_reconnect';

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
            <Link to={SETTINGS_PATH}>{needsReconnect ? 'Check' : 'Set up'}</Link>
          </Button>
        }
      >
        {phoneProblem
          ? 'Your phone stopped confirming payments. Open Payments to fix it'
          : needsReconnect
            ? 'Payments are not confirming automatically. Reconnect to fix it'
            : 'Turn on automatic payment confirmation. It takes a minute'}
      </Banner>
    </div>
  );
}
