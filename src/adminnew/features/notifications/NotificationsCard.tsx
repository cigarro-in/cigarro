import { useState } from 'react';
import { Badge, Button, Card, ErrorBanner, useButtonFeedback } from '../../ui';
import { usePushNotifications, type PushState } from './usePushNotifications';

const COPY: Partial<Record<PushState, string>> = {
  unsupported: 'This browser cannot send notifications. Use Chrome or Edge on Android or desktop, or Safari on iPhone from the Home Screen app.',
  'ios-install':
    'On iPhone and iPad, add this app to your Home Screen first: tap Share, then Add to Home Screen. Open it from the Home Screen, then turn notifications on here.',
  'not-configured': 'Notifications not configured. The platform owner has not set up push keys yet.',
  denied: 'Notifications are blocked for this site. Allow them in your browser settings, then reload this page.',
};

/** Settings card: turn on order notifications for this device and send a test. */
export function NotificationsCard() {
  const push = usePushNotifications();
  const test = useButtonFeedback();
  const [note, setNote] = useState<string | null>(null);
  const { state } = push;
  const hint = COPY[state];

  return (
    <Card title="Order notifications">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Get a phone notification for every new paid order.
          </p>
          {state === 'on' && <Badge tone="success">On</Badge>}
          {state === 'off' && <Badge tone="neutral">Off</Badge>}
        </div>

        {state === 'loading' && <p className="text-sm text-muted-foreground" role="status">Checking this device...</p>}
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

        {state === 'off' && (
          <Button variant="primary" size="sm" className="self-start" loading={push.busy} onClick={() => void push.enable()}>
            Enable
          </Button>
        )}

        {state === 'on' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              state={test.state}
              successLabel="Sent"
              errorLabel="Failed"
              onClick={() => {
                setNote(null);
                void test.run(async () => {
                  const result = await push.sendTest();
                  setNote(result.reconnected ? 'Re-connected this device, test sent.' : 'Test sent.');
                });
              }}
            >
              Send test notification
            </Button>
            <Button variant="plain" size="sm" loading={push.busy} onClick={() => void push.disable()}>
              Turn off
            </Button>
          </div>
        )}

        {state === 'on' && note && !test.error && (
          <p className="text-sm text-muted-foreground" role="status">{note}</p>
        )}
        {state === 'on' && test.error && <ErrorBanner error={test.error} />}
        <ErrorBanner error={push.error} />
      </div>
    </Card>
  );
}
