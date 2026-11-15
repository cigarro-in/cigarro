import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { paiseToRupees } from '../../../lib/convex/money';
import { formatINR } from '../../../utils/currency';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Input,
  Skeleton,
  Tabs,
  formatOrderDate,
  formatOrderNumber,
  useButtonFeedback,
  type BadgeTone,
} from '../../ui';

const STALE_MS = 24 * 60 * 60 * 1000;
const MACRODROID_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid';

type Platform = 'android' | 'iphone';

function ago(ms: number, now: number): string {
  const mins = Math.max(0, Math.round((now - ms) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const OUTCOME: Record<string, { label: string; tone: BadgeTone }> = {
  matched: { label: 'Matched', tone: 'success' },
  credit_unmatched: { label: 'Credit not matched', tone: 'warning' },
  ignored: { label: 'Ignored', tone: 'neutral' },
  duplicate: { label: 'Duplicate', tone: 'info' },
};

const SUFFIX_LABEL: Record<string, string> = {
  T: 'Transactional',
  S: 'Service',
  P: 'Promotional',
  G: 'Government',
};

type RecentData = FunctionReturnType<typeof api.smsRelay.recentMessages>;

function RecentMessages({
  data,
  openTexts,
  onToggleText,
}: {
  data: RecentData | undefined;
  openTexts: Record<string, boolean>;
  onToggleText: (id: string) => void;
}) {
  if (data === undefined) return <Skeleton className="h-24 w-full" />;
  if (data.messages.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        description="Each SMS the phone sends appears here, including the ones that were skipped and why."
      />
    );
  }
  const now = data.serverNow;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <ul className="divide-y divide-border">
        {data.messages.map((m) => {
          const outcome = OUTCOME[m.outcome] ?? OUTCOME.ignored;
          const amount = m.amountPaise !== null ? formatINR(paiseToRupees(m.amountPaise)) : null;
          const isOpen = !!openTexts[m._id];
          return (
            <li key={m._id} className="flex flex-col gap-2 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span
                  className="w-20 shrink-0 text-xs text-muted-foreground"
                  title={formatOrderDate(m.at, { withTime: true, now: new Date(now) })}
                >
                  {ago(m.at, now)}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs">{m.entity}</span>
                  {m.suffix && (
                    <Badge tone="neutral">{SUFFIX_LABEL[m.suffix] ?? m.suffix}</Badge>
                  )}
                </span>
                <Badge tone={outcome.tone} dot>
                  {outcome.label}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-0 text-xs text-muted-foreground sm:pl-[5.75rem]">
                {m.outcome === 'matched' && (
                  <>
                    {m.orderId ? (
                      <Link to={`/orders/${m.orderId}`} className="font-medium text-primary hover:underline">
                        Order {formatOrderNumber(m.orderNumber, m.displayOrderId)}
                      </Link>
                    ) : (
                      <span>Matched</span>
                    )}
                    {amount && <span>{amount}</span>}
                  </>
                )}
                {m.outcome === 'credit_unmatched' && (
                  <>
                    {amount && <span className="font-medium text-foreground">{amount}</span>}
                    <span>{m.reason ?? 'No order with that exact amount'}</span>
                  </>
                )}
                {m.outcome === 'ignored' && <span>{m.reason ?? 'Skipped'}</span>}
                {m.outcome === 'duplicate' && <span>Same message already received</span>}
                {m.body && (
                  <Button size="sm" variant="plain" onClick={() => onToggleText(m._id)} aria-expanded={isOpen}>
                    {isOpen ? 'Hide text' : 'Show text'}
                  </Button>
                )}
              </div>

              {m.body && isOpen && (
                <pre className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {m.body}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyBox({ label, text, copied, onCopy }: { label: string; text: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button size="sm" variant="secondary" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

/**
 * SMS relay: a phone app (Android) or a Shortcuts automation (iPhone) posts
 * each bank credit SMS to a per-store webhook URL. Matches land in Payments.
 */
export function SmsRelayCard({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const status = useQuery(api.smsRelay.getStatus, orgId ? { orgId } : 'skip');
  const recent = useQuery(api.smsRelay.recentMessages, orgId ? { orgId } : 'skip');
  const [openTexts, setOpenTexts] = useState<Record<string, boolean>>({});
  const toggleText = (id: string) => setOpenTexts((s) => ({ ...s, [id]: !s[id] }));
  const generate = useMutation(api.smsRelay.generateToken);
  const revoke = useMutation(api.smsRelay.revokeToken);
  const setSenders = useMutation(api.smsRelay.setAllowedSmsSenders);
  const genFb = useButtonFeedback();
  const revokeFb = useButtonFeedback();
  const sendersFb = useButtonFeedback();

  const [platform, setPlatform] = useState<Platform>('android');
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<'url' | 'json' | null>(null);
  const [confirm, setConfirm] = useState<'rotate' | 'revoke' | null>(null);
  const [senderDraft, setSenderDraft] = useState<string | null>(null);

  const relay = status?.relay ?? null;
  const now = status?.serverNow ?? Date.now();
  const savedSenders = status?.allowedSmsSenders ?? [];
  const senderText = senderDraft ?? savedSenders.join(', ');
  const sendersDirty = senderDraft !== null && senderDraft !== savedSenders.join(', ');
  const detected = (status?.detectedSmsSenders ?? []).map((d) => d.entity);
  const detectedKey = detected.join(',');
  const savedKey = savedSenders.join(',');
  const detectedMatchesSaved = detectedKey === savedKey;

  const doGenerate = () => {
    if (!orgId) return;
    genFb.run(async () => {
      const res = await generate({ orgId });
      setFreshUrl(res.url);
      setCopied(null);
      setConfirm(null);
    });
  };

  const doRevoke = () => {
    if (!orgId) return;
    return revokeFb.run(async () => {
      await revoke({ orgId });
      setFreshUrl(null);
    });
  };

  const doSaveSenders = () => {
    if (!orgId) return;
    const list = senderText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    sendersFb.run(async () => {
      await setSenders({ orgId, senders: list });
      setSenderDraft(null);
    });
  };

  const doAcceptDetected = () => {
    if (!orgId || detected.length === 0) return;
    sendersFb.run(async () => {
      await setSenders({ orgId, senders: detected });
      setSenderDraft(null);
    });
  };

  const markCopied = async (kind: 'url' | 'json', text: string) => {
    if (await copyText(text)) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  // Connection status
  let statusBanner: ReactNode;
  if (status === undefined) {
    statusBanner = null;
  } else if (!relay) {
    statusBanner = <Banner tone="info" title="Not set up">Generate a webhook URL below, then follow the steps for your phone.</Banner>;
  } else if (!relay.active) {
    statusBanner = <Banner tone="critical" title="Revoked">The old URL no longer works. Generate a new one to reconnect.</Banner>;
  } else if (relay.lastSmsAt === null) {
    statusBanner = <Banner tone="warning" title="Connected, no messages yet">Send a test SMS from a bank account, or wait for a real credit.</Banner>;
  } else if (now - relay.lastSmsAt < STALE_MS) {
    statusBanner = <Banner tone="success" title="Connected">Last message {ago(relay.lastSmsAt, now)}.</Banner>;
  } else {
    statusBanner = (
      <Banner tone="warning" title="No bank SMS in 24 hours">
        Last message {ago(relay.lastSmsAt, now)}. Check that the phone app is running and not restricted by battery settings.
      </Banner>
    );
  }

  const maskedUrl = relay ? `…/receiveBankSms/••••••••${relay.tokenLast4}` : '';
  const androidJson = '{"sender": "<SENDER>", "body": "<MESSAGE>"}';
  const iphoneJson = '{"sender": "<Sender>", "body": "<Shortcut Input>"}';

  return (
    <Card title="SMS relay (Android or iPhone)" padding="default">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Forwards bank credit SMS from your phone into the same payment matching as bank emails. The SMS goes straight from your phone to this store's webhook, with no SMS relay service in between.
        </p>

        {statusBanner}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Recent messages</span>
          <p className="text-xs text-muted-foreground">
            The last 20 SMS from the phone, newest first. Skipped messages show why; their text is never kept.
          </p>
          <RecentMessages data={recent} openTexts={openTexts} onToggleText={toggleText} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Webhook URL</span>
          {freshUrl ? (
            <div className="flex flex-col gap-2">
              <Banner tone="warning" title="Copy this URL now">
                It is shown once. Paste it into your phone app now. Leaving this page hides it; rotate to get a new one.
              </Banner>
              <CopyBox label="Full URL" text={freshUrl} copied={copied === 'url'} onCopy={() => markCopied('url', freshUrl)} />
            </div>
          ) : relay?.active ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">{maskedUrl}</code>
              <Button size="sm" variant="secondary" onClick={() => setConfirm('rotate')} disabled={!orgId}>
                Rotate URL
              </Button>
              <Button size="sm" variant="plain" onClick={() => setConfirm('revoke')} disabled={!orgId}>
                Revoke
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="primary" size="sm" state={genFb.state} onClick={doGenerate} disabled={!orgId || status === undefined}>
                Generate webhook URL
              </Button>
            </div>
          )}
          <ErrorBanner error={genFb.error} />
          <ErrorBanner error={revokeFb.error} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Setup</span>
          <Tabs<Platform>
            value={platform}
            onChange={setPlatform}
            tabs={[
              { id: 'android', label: 'Android' },
              { id: 'iphone', label: 'iPhone' },
            ]}
          />

          {platform === 'android' ? (
            <div className="flex flex-col gap-3">
              <Steps
                items={[
                  <>
                    Install <a className="underline" href={MACRODROID_PLAY_URL} target="_blank" rel="noreferrer">MacroDroid</a> from Google Play. The free version is what we set up; check that its HTTP request action is available.
                  </>,
                  'Create a macro. Trigger: SMS received. Set the sender to Any number. The server checks each SMS and keeps only bank credits, so nothing else needs to be listed on the phone.',
                  'Add an action: HTTP request, method POST, the webhook URL above, body type JSON, header Content-Type: application/json.',
                  <>Body: <code className="font-mono text-xs">{androidJson}</code>. Replace the two placeholders with MacroDroid&apos;s sender and message magic text.</>,
                  'Turn off battery optimisation for MacroDroid (Android Settings > Apps > MacroDroid > Battery > Unrestricted) so the phone does not stop it overnight.',
                ]}
              />
              <CopyBox label="Body template" text={androidJson} copied={copied === 'json'} onCopy={() => markCopied('json', androidJson)} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Steps
                items={[
                  'Open Shortcuts, go to Automation, tap +, choose Create Personal Automation, then Message.',
                  'Leave Sender empty so the automation runs for any sender. The server checks each SMS and keeps only bank credits.',
                  'Next, add the action Get Contents of URL. URL: the webhook URL above. Tap Show More: Method POST, Request Body JSON, and a Content-Type: application/json header.',
                  <>Body: a Dictionary with two keys, <code className="font-mono text-xs">sender</code> = the Sender variable and <code className="font-mono text-xs">body</code> = the Shortcut Input (message text). A Dictionary avoids quote-escaping bugs.</>,
                  'On iOS 17 or later, choose Run Immediately (not Run After Confirmation). Then Edit, Info, Privacy: turn on Allow Running When Locked, so it runs with the phone locked.',
                  'Older iOS, or iOS 27 with "Confirm Before Run" on, asks you to tap before each run. Turn that off, or the relay will miss messages.',
                ]}
              />
              <CopyBox label="Equivalent JSON body" text={iphoneJson} copied={copied === 'json'} onCopy={() => markCopied('json', iphoneJson)} />
              <p className="text-xs text-muted-foreground">
                Apple does not allow any third-party app to read SMS on iPhone, so this uses the built-in Shortcuts app only. Labels vary by iOS version; check them on your phone.
              </p>
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">Send a test:</span> send a bank credit SMS to the phone (or wait for one), then check Payments &gt; Matched. The status above updates with the last message time.
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="sms-senders" className="text-sm font-medium">
            Allowed bank sender IDs
          </label>
          <Input
            id="sms-senders"
            value={senderText}
            onChange={(e) => setSenderDraft(e.target.value)}
            placeholder="HDFCBK, ICICIT, AXISBK"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <p className="text-xs text-muted-foreground">
            Only SMS from these senders count. Match is on the sender ID, like HDFCBK for VM-HDFCBK-S; the prefix and suffix are ignored. Leave empty and the relay accepts only bank credit SMS from transactional or service senders.
          </p>
          <div>
            <Button variant="secondary" size="sm" state={sendersFb.state} disabled={!sendersDirty || !orgId} onClick={doSaveSenders}>
              Save senders
            </Button>
          </div>
          <ErrorBanner error={sendersFb.error} />
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">Detected bank senders</span>
          {detected.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None yet. Each bank credit SMS that is matched adds its sender ID here.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Detected: <span className="font-mono text-xs">{detected.join(', ')}</span>
              </p>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  state={sendersFb.state}
                  disabled={!orgId || detectedMatchesSaved}
                  onClick={doAcceptDetected}
                >
                  {detectedMatchesSaved ? 'Saved' : 'Only accept these'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Saves the detected IDs as the allowed list, replacing the list above.
              </p>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'rotate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Rotate the webhook URL?"
        description="The current URL stops working immediately. You must paste the new URL into your phone app."
        confirmLabel="Rotate URL"
        critical
        onConfirm={async () => {
          await doGenerate();
        }}
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Revoke the webhook URL?"
        description="Messages sent to the old URL will be refused. Generate a new URL to reconnect."
        confirmLabel="Revoke"
        critical
        onConfirm={async () => {
          await doRevoke();
          setConfirm(null);
        }}
      />
    </Card>
  );
}
