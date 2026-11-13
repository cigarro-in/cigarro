import { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { adminAbsoluteUrl } from '../../lib/paths';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  useButtonFeedback,
} from '../../ui';

/**
 * Google (Gmail) connection that reads bank alerts for payment confirmation.
 * Connect returns to /payments/settings?gmail=connected.
 */
export function GoogleCard({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const status = useQuery(api.gmail.getGmailStatus, orgId ? { orgId } : 'skip');
  const getConnectUrl = useAction(api.gmail.getOAuthUrl);
  const disconnect = useAction(api.gmail.disconnectGmail);
  const connect = useButtonFeedback();
  const disc = useButtonFeedback();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const connectGoogle = () => {
    if (!orgId) return;
    connect.run(async () => {
      const r = await getConnectUrl({
        orgId,
        returnTo: adminAbsoluteUrl('/payments/settings') + '?gmail=connected',
      });
      window.location.href = r.url;
    });
  };

  const runDisconnect = async () => {
    if (!orgId) return;
    setConfirmOpen(false);
    setNotice(null);
    const r = await disc.run(() => disconnect({ orgId }));
    if (r && (r as { revoked?: boolean }).revoked === false) {
      setNotice('Disconnected, but Google did not confirm. Remove the app at myaccount.google.com/permissions.');
    }
  };

  const connState: 'loading' | 'active' | 'needs_reconnect' | 'none' =
    status === undefined ? 'loading'
      : status === null ? 'none'
      : status.status === 'active' ? 'active'
      : status.status === 'needs_reconnect' ? 'needs_reconnect'
      : 'none';

  return (
    <Card title="Google" padding="default">
      <div className="flex flex-col gap-3">
        {connState === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}

        {connState === 'active' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Connected{status?.accountEmail ? <> as <span className="font-medium">{status.accountEmail}</span></> : ''}.
            </p>
            <Button variant="secondary" size="sm" state={disc.state} onClick={() => setConfirmOpen(true)}>
              Disconnect
            </Button>
          </div>
        )}

        {connState === 'needs_reconnect' && (
          <Banner
            tone="warning"
            action={
              <Button variant="secondary" size="sm" state={connect.state} onClick={connectGoogle}>
                Reconnect
              </Button>
            }
          >
            Google access expired{status?.accountEmail ? ` for ${status.accountEmail}` : ''}. Payments will not confirm
            automatically until you reconnect.
          </Banner>
        )}

        {connState === 'none' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Connect Google for payment confirmation</p>
            <Button variant="primary" size="sm" state={connect.state} onClick={connectGoogle} disabled={!orgId}>
              Connect Google
            </Button>
          </div>
        )}

        {status && !status.configured && (
          <Banner tone="critical">
            Server keys missing. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_TOKEN_KEY in Convex.
          </Banner>
        )}
        {status?.lastError && <Banner tone="warning">Last error: {status.lastError}</Banner>}
        {notice && <Banner tone="warning">{notice}</Banner>}

        <ErrorBanner error={connect.error ?? disc.error} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect Google?"
        description="Order auto-confirm stops until you reconnect."
        confirmLabel="Disconnect"
        critical
        onConfirm={runDisconnect}
      />
    </Card>
  );
}
