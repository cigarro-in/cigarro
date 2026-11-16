import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, Page, Tabs, type TabItem } from '../ui';
import { StatementTab } from '../features/payments/StatementTab';
import { MatchedEmailsTab } from '../features/payments/MatchedEmailsTab';
import { CigarroAccountTab } from '../features/payments/CigarroAccountTab';
import { NeedsReviewCard } from '../features/payments/NeedsReviewCard';

type Tab = 'statement' | 'account' | 'emails';

const TABS: TabItem<Tab>[] = [
  { id: 'statement', label: 'Statement' },
  { id: 'account', label: 'Cigarro account' },
  { id: 'emails', label: 'Matched emails' },
];

const TAB_PATH: Record<Tab, string> = {
  statement: '/payments',
  account: '/payments/account',
  emails: '/payments/emails',
};

function tabFromPath(pathname: string): Tab {
  if (pathname.endsWith('/emails')) return 'emails';
  if (pathname.endsWith('/account')) return 'account';
  return 'statement';
}

export function PaymentsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // The unmatched views are gone; old links land on the statement.
  if (/\/payments\/unmatched\/?$/.test(location.pathname)) {
    return <Navigate to="/payments" replace />;
  }

  const tab = tabFromPath(location.pathname);

  return (
    <Page title="Payments">
      <NeedsReviewCard />
      <Card padding="none">
        <Tabs tabs={TABS} value={tab} onChange={(t) => navigate(TAB_PATH[t])} />
      </Card>
      {tab === 'statement' && <StatementTab />}
      {tab === 'account' && <CigarroAccountTab />}
      {tab === 'emails' && <MatchedEmailsTab />}
    </Page>
  );
}
