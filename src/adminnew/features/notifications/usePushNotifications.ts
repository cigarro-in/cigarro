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

function sameKey(current: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((byte, i) => byte === expected[i]);
}

/** Convex error data (`code`, plus PUSH_FAILED's `removed` and `statusCode`), if any. */
function pushErrorData(err: unknown): { code?: string; removed?: number; statusCode?: number | null } {
  const data = (err as { data?: unknown } | null)?.data;
  return data && typeof data === 'object' ? (data as { code?: string; removed?: number; statusCode?: number | null }) : {};
}

/** A readable message for a failed test push (no raw Convex wrapper text). */
function friendlyTestError(err: unknown): Error {
  const data = pushErrorData(err);
  if (data.code === 'PUSH_FAILED') {
    return new Error(
      `The push service rejected this device (status ${data.statusCode ?? 'unknown'}). Try again, or turn notifications off and on.`,
    );
  }
  if (data.code === 'NOT_CONFIGURED') return new Error('Notifications are not configured yet.');
  return new Error(toActionError(err, 'Could not send the test notification.').message);
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

  const publicKey = status?.publicKey ?? null;

  /** Replaces this browser's subscription with one made for the current VAPID key, and saves it. */
  const resubscribe = useCallback(
    async (key: string): Promise<string> => {
      if (!orgId) throw new Error('Notifications are not ready yet. Reload and try again.');
      const reg = await adminRegistration(slug);
      const old = await reg.pushManager.getSubscription();
      if (old) {
        // Drops the server row for the old endpoint (no-op if already gone), then the browser one.
        await unsubscribeMutation({ orgId, endpoint: old.endpoint }).catch(() => undefined);
        await old.unsubscribe();
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToKey(key),
      });
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
      return json.endpoint;
    },
    [orgId, slug, subscribeMutation, unsubscribeMutation],
  );

  // Keys were changed after this device subscribed: the stored subscription can never
  // be used, so re-subscribe with the current public key. Runs once per key change.
  useEffect(() => {
    if (!pushSupported() || !orgId || !publicKey || typeof endpoint !== 'string') return;
    if (Notification.permission !== 'granted') return;
    let cancelled = false;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration(`/${slug}/`);
      const sub = await reg?.pushManager.getSubscription();
      if (!sub || cancelled) return;
      if (sameKey(sub.options?.applicationServerKey, urlBase64ToKey(publicKey))) return;
      await resubscribe(publicKey);
    })().catch((err) => console.warn('Could not refresh the notification key', err));
    return () => {
      cancelled = true;
    };
  }, [endpoint, orgId, slug, publicKey, resubscribe]);

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

  /**
   * Sends a test push to this device. If the server dropped this browser's subscription
   * (expired at the push service, or no record of it), re-subscribes this device once and
   * retries. Throws a readable Error on failure (use with useButtonFeedback).
   */
  const sendTest = useCallback(async (): Promise<{ reconnected: boolean }> => {
    if (!orgId || !endpoint) throw new Error('Turn on notifications first.');
    try {
      await testAction({ orgId, endpoint });
      return { reconnected: false };
    } catch (err) {
      const data = pushErrorData(err);
      const stale =
        data.code === 'NOT_SUBSCRIBED' || (data.code === 'PUSH_FAILED' && (data.removed ?? 0) > 0);
      if (!stale) throw friendlyTestError(err);
    }
    if (!publicKey) throw new Error('Notifications are not configured yet.');
    if (Notification.permission !== 'granted') {
      throw new Error('Notifications are blocked for this site. Allow them in your browser settings, then reload this page.');
    }
    const fresh = await resubscribe(publicKey);
    try {
      await testAction({ orgId, endpoint: fresh });
    } catch (err) {
      throw friendlyTestError(err);
    }
    return { reconnected: true };
  }, [orgId, endpoint, publicKey, resubscribe, testAction]);

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
