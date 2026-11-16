// Super-admin version of the store "Automatic payment confirmation" card, for
// the platform org (merchant payments to Cigarro). The store card reads with
// no saToken, so it cannot serve the platform org from /sa; this one passes
// saToken to the same store-level functions (lib/auth requirePaymentsAdmin).
import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { useAction, useMutation, useQuery } from 'convex/react';
import { CheckCircle2, CircleAlert, Clock3, Smartphone } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Banner, Button, Card, ConfirmDialog, ErrorBanner, Skeleton, useButtonFeedback } from '../../adminnew/ui';
import { formatDateTime, runSa } from '../saUi';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid';
const MACRODROID_INTENT =
  'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;' +
  `package=com.arlosoft.macrodroid;S.browser_fallback_url=${encodeURIComponent(PLAY_URL)};end`;

type Device = 'android' | 'iphone' | 'desktop';

function detectDevice(): Device {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
  return 'desktop';
}

function ago(ms: number, now: number): string {
  const mins = Math.max(0, Math.round((now - ms) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function download(file: File) {
  const href = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

function StatusLine({ tone, icon, children }: { tone: 'ok' | 'wait' | 'bad'; icon: ReactNode; children: ReactNode }) {
  const color =
    tone === 'ok' ? 'text-[var(--admin-success)]' : tone === 'bad' ? 'text-[var(--admin-warning)]' : 'text-[var(--admin-text-muted)]';
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className={`mt-0.5 shrink-0 [&>svg]:size-4 ${color}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 text-[var(--admin-text)]">{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--admin-neutral-soft)] text-xs font-semibold text-[var(--admin-text)]"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <p className="text-sm text-[var(--admin-text)]">{title}</p>
        {children}
      </div>
    </li>
  );
}

function DesktopHint() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(window.location.href, { margin: 1, width: 168 })
      .then((d) => live && setSrc(d))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="flex size-[168px] shrink-0 items-center justify-center rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-white p-1">
        {src ? <img src={src} alt="QR code that opens this page on your phone" className="size-full" /> : <Skeleton className="size-full" />}
      </div>
      <p className="max-w-prose text-[13px] text-[var(--admin-text-muted)]">
        Connect the phone that receives the bank SMS. Scan this code with it, open this page there and tap Connect this phone.
      </p>
    </div>
  );
}

export function PlatformAutoConfirmCard({ orgId, token }: { orgId: Id<'organizations'>; token: string }) {
  const phone = useQuery(api.smsRelay.getStatus, { orgId, saToken: token });
  const gmail = useQuery(api.gmail.getGmailStatus, { orgId, saToken: token });
  const connectPhone = useMutation(api.smsRelay.connectPhone);
  const disconnectPhone = useMutation(api.smsRelay.revokeToken);
  const getGmailUrl = useAction(api.gmail.getOAuthUrl);
  const disconnectGmail = useAction(api.gmail.disconnectGmail);

  const [device] = useState(detectDevice);
  const [setup, setSetup] = useState<{ url?: string; file?: File } | null>(null);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<null | 'redo' | 'phone_off' | 'gmail_off'>(null);
  const connectFb = useButtonFeedback();
  const gmailFb = useButtonFeedback();
  const offFb = useButtonFeedback();

  const start = () => {
    setConfirm(null);
    void connectFb.run(() =>
      runSa(async () => {
        const r = await connectPhone({ orgId, device: device === 'iphone' ? 'iphone' : 'android', saToken: token });
        const s =
          'url' in r ? { url: r.url } : { file: new File([r.macro], r.filename, { type: 'application/octet-stream' }) };
        setSetup(s);
        setShared(false);
        setCopied(false);
        return s;
      }),
    );
  };

  const connectGmail = () => {
    void gmailFb.run(() =>
      runSa(async () => {
        const returnTo = `${window.location.origin}/sa/platform-payments?gmail=connected`;
        const r = await getGmailUrl({ orgId, returnTo, saToken: token });
        window.location.href = r.url;
      }),
    );
  };

  const turnOff = async () => {
    const which = confirm;
    setConfirm(null);
    await offFb.run(() =>
      runSa(async () => {
        if (which === 'phone_off') {
          await disconnectPhone({ orgId, saToken: token });
          setSetup(null);
        } else if (which === 'gmail_off') {
          await disconnectGmail({ orgId, saToken: token });
        }
      }),
    );
  };

  if (phone === undefined || gmail === undefined) {
    return (
      <Card title="Automatic payment confirmation">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-3 h-9 w-40" />
      </Card>
    );
  }

  const now = phone.serverNow;
  const phoneOn = phone.state !== 'not_connected';
  const phoneBroken = phone.state === 'setup_error' || phone.state === 'setup_expired' || phone.state === 'quiet';
  const gmailOn = gmail?.status === 'active';
  const gmailExpired = gmail?.status === 'needs_reconnect';
  const anyOn = phoneOn || gmailOn;

  const phoneStatus = (() => {
    switch (phone.state) {
      case 'connected':
        return (
          <StatusLine tone="ok" icon={<CheckCircle2 />}>
            Phone connected{phone.lastConfirmedAt ? ` · last confirmation ${ago(phone.lastConfirmedAt, now)}` : ' · waiting for the next payment'}
          </StatusLine>
        );
      case 'waiting':
        return (
          <StatusLine tone="wait" icon={<Clock3 />}>
            Phone set up · waiting for the first bank SMS
          </StatusLine>
        );
      case 'quiet':
        return (
          <StatusLine tone="bad" icon={<CircleAlert />}>
            The phone has not sent anything for a day. Check the MacroDroid macro is on.
          </StatusLine>
        );
      case 'setup_error':
        return (
          <StatusLine tone="bad" icon={<CircleAlert />}>
            The phone app was not set up correctly. Set up again to get a fresh file.
          </StatusLine>
        );
      case 'setup_expired':
        return (
          <StatusLine tone="bad" icon={<CircleAlert />}>
            The setup code expired or was already used. Set up again to get a fresh file.
          </StatusLine>
        );
      default:
        return null;
    }
  })();

  return (
    <Card title="Automatic payment confirmation">
      <div className="flex flex-col gap-4">
        {!anyOn && !setup && (
          <p className="max-w-prose text-[13px] text-[var(--admin-text-muted)]">
            A merchant payment is marked paid as soon as the bank's SMS or email reaches Cigarro. Set it up once.
          </p>
        )}

        {(phoneStatus || gmailOn || gmailExpired) && (
          <div className="flex flex-col gap-2.5">
            {phoneStatus}
            {gmailOn && (
              <StatusLine tone="ok" icon={<CheckCircle2 />}>
                Gmail connected{gmail?.accountEmail ? ` · ${gmail.accountEmail}` : ''}
              </StatusLine>
            )}
            {gmailExpired && (
              <StatusLine tone="bad" icon={<CircleAlert />}>
                Gmail access expired. Reconnect to keep confirming payments by email.
              </StatusLine>
            )}
          </div>
        )}

        {setup?.file && device === 'android' && (
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Install MacroDroid (free)">
              <div>
                <Button asChild variant="secondary" size="sm">
                  <a href={MACRODROID_INTENT}>Get MacroDroid</a>
                </Button>
              </div>
            </Step>
            <Step n={2} title="Open the downloaded file with MacroDroid and tap save.">
              <div>
                <Button
                  variant={shared ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => {
                    download(setup.file!);
                    setShared(true);
                  }}
                >
                  {shared ? 'Download again' : 'Download setup file'}
                </Button>
              </div>
            </Step>
            <Step n={3} title="Allow SMS and battery when MacroDroid asks." />
          </ol>
        )}

        {setup?.url && device === 'iphone' && (
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Copy your setup link">
              <div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(setup.url!);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? 'Copied' : 'Copy setup link'}
                </Button>
              </div>
            </Step>
            <Step n={2} title="Shortcuts app: Automation, +, Message. Sender: your bank. Choose Run Immediately." />
            <Step n={3} title="Add action Get Contents of URL, paste the link. Method POST, Request Body JSON: sender = Sender, body = Message." />
          </ol>
        )}

        {device === 'desktop' && (!phoneOn || phoneBroken) && <DesktopHint />}

        <div className="flex flex-wrap items-center gap-2">
          {!phoneOn && !setup && device !== 'desktop' && (
            <Button variant="primary" icon={<Smartphone />} state={connectFb.state} onClick={start}>
              {device === 'iphone' ? 'Set up on this iPhone' : 'Connect this phone'}
            </Button>
          )}
          {phoneBroken && !setup && device !== 'desktop' && (
            <Button variant="primary" state={connectFb.state} onClick={() => setConfirm('redo')}>
              Set up again
            </Button>
          )}
          {gmailExpired && (
            <Button variant={phoneOn ? 'secondary' : 'primary'} size="sm" state={gmailFb.state} onClick={connectGmail}>
              Reconnect Gmail
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--admin-border)] pt-3 text-[13px]">
          {!gmailOn && !gmailExpired && (
            <button
              type="button"
              onClick={connectGmail}
              disabled={gmailFb.busy}
              className="font-medium text-[var(--admin-primary)] hover:underline disabled:opacity-60"
            >
              {gmailFb.busy ? 'Opening Google...' : 'or confirm via Gmail'}
            </button>
          )}
          {phoneOn && !phoneBroken && device !== 'desktop' && !setup && (
            <button
              type="button"
              onClick={() => setConfirm('redo')}
              className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:underline"
            >
              Set up on a new phone
            </button>
          )}
          {phoneOn && (
            <button
              type="button"
              onClick={() => setConfirm('phone_off')}
              className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:underline"
            >
              Disconnect phone
            </button>
          )}
          {gmailOn && (
            <button
              type="button"
              onClick={() => setConfirm('gmail_off')}
              className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:underline"
            >
              Disconnect Gmail
            </button>
          )}
        </div>

        {gmail && !gmail.configured && <Banner tone="critical">Gmail is not available right now. Use the phone instead.</Banner>}
        <ErrorBanner error={connectFb.error ?? gmailFb.error ?? offFb.error} />
        {phone.connectedAt && <p className="text-xs text-[var(--admin-text-muted)]">Phone set up {formatDateTime(phone.connectedAt)}</p>}
      </div>

      <ConfirmDialog
        open={confirm === 'redo'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Set up again?"
        description="You get a fresh file for this phone. Any phone set up before stops sending."
        confirmLabel="Set up again"
        onConfirm={start}
      />
      <ConfirmDialog
        open={confirm === 'phone_off' || confirm === 'gmail_off'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'gmail_off' ? 'Disconnect Gmail?' : 'Disconnect phone?'}
        description="Merchant payments from this source stop confirming automatically until you connect again."
        confirmLabel="Disconnect"
        critical
        onConfirm={turnOff}
      />
    </Card>
  );
}
