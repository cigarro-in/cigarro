import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, Page, Tabs, type TabItem } from '../ui';
import { StatementTab } from '../features/payments/StatementTab';
import { MatchedEmailsTab } from '../features/payments/MatchedEmailsTab';
import { SettingsTab } from '../features/payments/SettingsTab';

type Tab = 'statement' | 'emails' | 'settings';

const TABS: TabItem<Tab>[] = [
  { id: 'statement', label: 'Statement' },
  { id: 'emails', label: 'Matched emails' },
  { id: 'settings', label: 'Settings' },
];

const TAB_PATH: Record<Tab, string> = {
  statement: '/payments',
  emails: '/payments/emails',
  settings: '/payments/settings',
};

function tabFromPath(pathname: string): Tab {
  if (pathname.endsWith('/settings')) return 'settings';
  if (pathname.endsWith('/emails')) return 'emails';
  return 'statement';
}

export function PaymentsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Google OAuth returns to /payments/settings?gmail=connected. Strip the flag.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('gmail') === 'connected') {
      navigate(location.pathname, { replace: true });
    }
    // Runs once per arrival; the flag is removed on the first pass.
  }, []);

  // The unmatched views are gone; old links land on the statement.
  if (/\/payments\/unmatched\/?$/.test(location.pathname)) {
    return <Navigate to="/payments" replace />;
  }

  const tab = tabFromPath(location.pathname);

  return (
    <Page title="Payments">
      <Card padding="none">
        <Tabs tabs={TABS} value={tab} onChange={(t) => navigate(TAB_PATH[t])} />
      </Card>
      {tab === 'statement' && <StatementTab />}
      {tab === 'emails' && <MatchedEmailsTab />}
      {tab === 'settings' && <SettingsTab />}
    </Page>
  );
}
