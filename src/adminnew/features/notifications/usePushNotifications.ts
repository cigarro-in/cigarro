import { useCallback, useEffect, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { useOrgInfo } from '../../../lib/org/OrgContext';
import { toActionError, type ActionError } from '../../ui';

/** Admin service worker (public/admin-sw.js). Scoped per store: /<store>/. */
const ADMIN_SW_PATH = '/admin-sw.js';

export type PushState =
  | 'loading'
  | 'unsupported'
  | 'ios-install'
  | 'not-configured'
  | 'denied'
  | 'off'
  | 'on';

export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac with touch points.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Running from the Home Screen or as an installed app (display-mode standalone). */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Registers the admin worker for this store and waits until it is active. */
async function adminRegistration(slug: string): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(ADMIN_SW_PATH, { scope: `/${slug}/` });
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (worker) {
    await new Promise<void>((resolve, reject) => {
      const onChange = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', onChange);
          resolve();
        } else if (worker.state === 'redundant') {
          worker.removeEventListener('statechange', onChange);
          reject(new Error('The notification worker could not start. Reload and try again.'));
        }
      };
      worker.addEventListener('statechange', onChange);
      onChange();
    });
  }
  return reg;
}

/**
 * Web Push for this store's admin device. The browser subscription is made with
 * the admin worker for /<store>/; the row is stored per store (pushSubscriptions).
 */
export function usePushNotifications() {
  const org = useOrg();
  const orgId = org?._id;
  const { slug } = useOrgInfo();

  // Endpoint of this browser's subscription: undefined while checking, null if none.
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);

  const status = useQuery(
    api.push.status,
    orgId ? { orgId, endpoint: endpoint ?? undefined } : 'skip',
  );
  const subscribeMutation = useMutation(api.push.subscribe);
  const unsubscribeMutation = useMutation(api.push.unsubscribe);
  const testAction = useAction(api.pushNode.sendTest);

  useEffect(() => {
    if (!pushSupported()) {
      setEndpoint(null);
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration(`/${slug}/`)
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setEndpoint(sub?.endpoint ?? null);
      })
      .catch(() => {
        if (!cancelled) setEndpoint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  let state: PushState;
  if (isIosBrowser() && !isStandaloneApp()) state = 'ios-install';
  else if (!pushSupported()) state = 'unsupported';
  else if (endpoint === undefined || status === undefined) state = 'loading';
  else if (!status.configured) state = 'not-configured';
  else if (Notification.permission === 'denied') state = 'denied';
  else state = status.subscribed && Notification.permission === 'granted' ? 'on' : 'off';

  const enable = useCallback(async () => {
    if (!orgId || !status?.publicKey) return;
    setError(null);
    setBusy(true);
    try {
      // First call in the gesture: Notification.requestPermission needs user activation.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const reg = await adminRegistration(slug);
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToKey(status.publicKey),
        }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('The browser returned an incomplete subscription.');
      }
      await subscribeMutation({
        orgId,
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setEndpoint(json.endpoint);
    } catch (err) {
      setError(toActionError(err, 'Could not turn on notifications.'));
    } finally {
      setBusy(false);
    }
  }, [orgId, slug, status?.publicKey, subscribeMutation]);

  const disable = useCallback(async () => {
    if (!orgId) return;
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(`/${slug}/`);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeMutation({ orgId, endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setEndpoint(null);
    } catch (err) {
      setError(toActionError(err, 'Could not turn off notifications.'));
    } finally {
      setBusy(false);
    }
  }, [orgId, slug, unsubscribeMutation]);

  /** Sends a test push to this device. Throws on failure (use with useButtonFeedback). */
  const sendTest = useCallback(async () => {
    if (!orgId || !endpoint) throw new Error('Turn on notifications first.');
    return testAction({ orgId, endpoint });
  }, [orgId, endpoint, testAction]);

  const toggle = useCallback(() => {
    if (state === 'on') void disable();
    else if (state === 'off') void enable();
  }, [state, enable, disable]);

  return {
    state,
    busy,
    error,
    clearError: () => setError(null),
    enable,
    disable,
    toggle,
    sendTest,
  };
}
