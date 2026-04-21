import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Copy, RefreshCw, Link2, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';

function randomSecret(length = 40) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

export function PaymentSettingsPage() {
  const org = useOrg();
  const settings = useQuery(
    api.organizations.getSettings,
    org ? { orgId: org._id } : 'skip',
  );
  const appConfig = useQuery(api.appConfig.get, {});
  const update = useMutation(api.organizations.updateSettings);
  const setAppConfig = useMutation(api.appConfig.set);
  const testConnection = useAction(api.scheduler.testGasConnection);

  const [upiVpa, setUpiVpa] = useState('');
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [slotTimeoutMin, setSlotTimeoutMin] = useState('10');
  const [quarantineMin, setQuarantineMin] = useState('20');
  const [slotsPerBase, setSlotsPerBase] = useState('100');
  const [gasUrl, setGasUrl] = useState('');
  const [gasSecret, setGasSecret] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setUpiVpa(settings.upiVpa);
    setWalletEnabled(settings.walletEnabled);
    setSlotTimeoutMin(String(Math.round(settings.slotTimeoutMs / 60000)));
    setQuarantineMin(String(Math.round(settings.quarantineMs / 60000)));
    setSlotsPerBase(String(settings.slotsPerBase));
    setGasUrl(settings.gasWebhookUrl ?? '');
  }, [settings]);

  const handleSaveGeneral = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await update({
        orgId: org._id,
        upiVpa: upiVpa.trim(),
        walletEnabled,
        slotTimeoutMs: Math.round(parseFloat(slotTimeoutMin) * 60000),
        quarantineMs: Math.round(parseFloat(quarantineMin) * 60000),
        slotsPerBase: parseInt(slotsPerBase, 10),
      });
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e?.data?.code || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGas = async (url: string, secret?: string) => {
    if (!org) return;
    setSaving(true);
    try {
      await update({
        orgId: org._id,
        gasWebhookUrl: url.trim() || '',
        ...(secret !== undefined ? { gasWebhookSecret: secret } : {}),
      });
      toast.success('Apps Script saved');
    } catch (e: any) {
      const code = e?.data?.code;
      if (code === 'INVALID_GAS_URL')
        toast.error('URL must start with https://script.google.com/…');
      else if (code === 'SECRET_TOO_SHORT')
        toast.error('Secret must be at least 20 characters');
      else toast.error(code || 'Failed to save');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!org) return;
    try {
      const r: any = await testConnection({ orgId: org._id });
      if (r?.error) {
        toast.error(`${r.error}${r.message ? ': ' + r.message : ''}`);
      } else if (r?.skipped) {
        toast.message(`Skipped: ${r.skipped}`);
      } else {
        toast.success(
          `OK — fetched ${r?.ingested ?? 0}, matched ${r?.matched ?? 0}, duplicates ${r?.duplicates ?? 0}`,
        );
      }
    } catch (e: any) {
      toast.error(e?.data?.code || e?.message || 'Test failed');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader title="Payment Settings" description="UPI, slots, and bank-email connection" />
      <div className="p-6 max-w-[720px] mx-auto space-y-4">
        {settings === undefined ? (
          <p>Loading...</p>
        ) : (
          <>
            <GmailConnectionCard
              connected={settings.gasConnected}
              currentUrl={settings.gasWebhookUrl}
              onOpenWizard={() => setWizardOpen(true)}
              onTest={handleTest}
              onDisconnect={async () => {
                if (!confirm('Disconnect the Apps Script? Payments will stop auto-confirming.'))
                  return;
                await handleSaveGas('', '');
              }}
            />

            <Card>
              <CardHeader><CardTitle>UPI &amp; Slots</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Primary UPI VPA</Label>
                  <Input value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="store@ybl" />
                  <p className="text-xs text-gray-500 mt-1">
                    This is the VPA embedded in the UPI deep-link customers see.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Wallet Enabled</Label>
                  <Switch checked={walletEnabled} onCheckedChange={setWalletEnabled} />
                </div>
                <Button onClick={handleSaveGeneral} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <button
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  {advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  Advanced
                </button>
              </CardHeader>
              {advancedOpen && (
                <CardContent className="space-y-4">
                  <div>
                    <Label>Slot Timeout (minutes)</Label>
                    <Input
                      type="number"
                      value={slotTimeoutMin}
                      onChange={(e) => setSlotTimeoutMin(e.target.value)}
                      min="1"
                      max="60"
                    />
                    <p className="text-xs text-gray-500 mt-1">How long a UPI slot is held (1–60 min).</p>
                  </div>
                  <div>
                    <Label>Quarantine (minutes)</Label>
                    <Input
                      type="number"
                      value={quarantineMin}
                      onChange={(e) => setQuarantineMin(e.target.value)}
                      min="0"
                      max="1440"
                    />
                    <p className="text-xs text-gray-500 mt-1">Late-arrival grace window after expiry.</p>
                  </div>
                  <div>
                    <Label>Slots Per Base Amount</Label>
                    <Input
                      type="number"
                      value={slotsPerBase}
                      onChange={(e) => setSlotsPerBase(e.target.value)}
                      min="10"
                      max="1000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Unique paise offsets. Higher = more concurrent orders at same base.
                    </p>
                  </div>
                  <div>
                    <Label>Bank Email Alias (legacy)</Label>
                    <Input value={settings.bankEmailAlias} disabled />
                  </div>
                  <div>
                    <Label>Apps Script Web App URL (manual)</Label>
                    <Input value={gasUrl} onChange={(e) => setGasUrl(e.target.value)} placeholder="https://script.google.com/..." />
                  </div>
                  <div>
                    <Label>Apps Script Secret (manual)</Label>
                    <Input
                      type="password"
                      value={gasSecret}
                      onChange={(e) => setGasSecret(e.target.value)}
                      placeholder="Leave blank to keep existing"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only paste if reconfiguring manually. Use the wizard for new setup.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveGeneral} disabled={saving} variant="secondary">
                      Save slot settings
                    </Button>
                    <Button
                      onClick={() =>
                        handleSaveGas(gasUrl, gasSecret.trim() ? gasSecret.trim() : undefined)
                      }
                      disabled={saving}
                    >
                      Save Apps Script
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </>
        )}

        <ConnectGmailWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onComplete={handleSaveGas}
          templateUrl={appConfig?.gasTemplateUrl ?? ''}
        />

        {/* Platform-level config — only shown to users with owner role somewhere */}
        <PlatformConfigCard
          currentTemplateUrl={appConfig?.gasTemplateUrl ?? ''}
          currentSenders={appConfig?.bankSenders ?? []}
          onSave={async (templateUrl, sendersCsv) => {
            try {
              await setAppConfig({
                gasTemplateUrl: templateUrl.trim(),
                bankSenders: sendersCsv
                  .split(/[\n,]/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              toast.success('Platform config saved');
            } catch (e: any) {
              const code = e?.data?.code;
              if (code === 'NOT_PLATFORM_OWNER')
                toast.error('Only owners can edit platform config');
              else if (code === 'INVALID_TEMPLATE_URL')
                toast.error('URL must look like https://script.google.com/home/projects/…/copy');
              else toast.error(code || 'Save failed');
            }
          }}
        />
      </div>
    </div>
  );
}

function GmailConnectionCard(props: {
  connected: boolean;
  currentUrl: string | null;
  onOpenWizard: () => void;
  onTest: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Bank-email connection</CardTitle>
        {props.connected ? (
          <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>
        ) : (
          <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Not connected</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {props.connected ? (
          <>
            <p className="text-sm text-gray-600">
              Your Apps Script is relaying bank emails to this store.
            </p>
            {props.currentUrl && (
              <p className="text-xs font-mono text-gray-500 break-all">{props.currentUrl}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={props.onTest}>
                <RefreshCw className="w-4 h-4 mr-2" /> Test
              </Button>
              <Button size="sm" variant="outline" onClick={props.onOpenWizard}>
                Reconnect
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={props.onDisconnect}>
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Connect an Apps Script that reads bank-alert emails from your Gmail and
              relays them here so orders auto-confirm.
            </p>
            <Button onClick={props.onOpenWizard}>
              <Link2 className="w-4 h-4 mr-2" /> Connect Gmail
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PlatformConfigCard(props: {
  currentTemplateUrl: string;
  currentSenders: string[];
  onSave: (templateUrl: string, sendersCsv: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(props.currentTemplateUrl);
  const [sendersCsv, setSendersCsv] = useState(props.currentSenders.join('\n'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUrl(props.currentTemplateUrl);
    setSendersCsv(props.currentSenders.join('\n'));
  }, [props.currentTemplateUrl, props.currentSenders]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await props.onSave(url, sendersCsv);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Platform Config (owners only)
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">
            These settings apply to every tenant. Only users with an <b>owner</b> role
            on any org can save.
          </p>
          <div>
            <Label>Apps Script template copy-URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/home/projects/<PROJECT_ID>/copy"
            />
            <p className="text-xs text-gray-500 mt-1">
              Create a master Apps Script project with <code>gas/Cigarro.gs</code>,
              share "Anyone with link · Viewer", copy the project ID from the URL,
              build the <code>/copy</code> form and paste here.
            </p>
          </div>
          <div>
            <Label>Allowed bank-alert senders</Label>
            <textarea
              className="w-full rounded-md border border-gray-300 p-2 text-sm font-mono"
              rows={5}
              value={sendersCsv}
              onChange={(e) => setSendersCsv(e.target.value)}
              placeholder={'@hdfcbank.bank.in\n@icicibank.com\nalerts@sbi.co.in'}
            />
            <p className="text-xs text-gray-500 mt-1">
              One per line. Gmail <code>from:</code> patterns. GAS searches these senders'
              mail. Max 20 entries.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save platform config'}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

function ConnectGmailWizard(props: {
  open: boolean;
  onClose: () => void;
  onComplete: (url: string, secret: string) => Promise<void>;
  templateUrl: string;
}) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState(() => randomSecret(40));
  const [submitting, setSubmitting] = useState(false);

  const copyTemplateLink = props.templateUrl;

  const reset = () => {
    setStep(1);
    setUrl('');
    setSecret(randomSecret(40));
  };

  const handleClose = () => {
    props.onClose();
    setTimeout(reset, 300);
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s).then(
      () => toast.success('Copied'),
      () => toast.error('Copy failed'),
    );
  };

  const handleFinish = async () => {
    if (!url.trim()) return toast.error('Paste the Web App URL first');
    setSubmitting(true);
    try {
      await props.onComplete(url.trim(), secret);
      handleClose();
    } catch {
      // toast already fired inside onComplete
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Connect Gmail — step {step} of 4</DialogTitle>
          <DialogDescription>
            Sets up an Apps Script in your own Google account to relay bank emails.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {copyTemplateLink ? (
              <>
                <p className="text-sm">
                  Click below to open our template in Google Apps Script. In the page that opens,
                  click <b>Make a copy</b> at the top-right.
                </p>
                <Button asChild>
                  <a href={copyTemplateLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Apps Script template
                  </a>
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                Platform template URL not configured yet. Ask your platform owner to set it in
                <b> Payment Settings → Platform Config</b>.
              </div>
            )}
            <p className="text-xs text-gray-500">
              The copy lives in <b>your</b> Google Drive and reads <b>your</b> Gmail — we never see
              your inbox.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>I copied it → Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm">
              In your copy of Apps Script, go to <b>Project Settings (gear icon, left sidebar)</b> →
              <b> Script Properties</b> → <b>Add script property</b>:
            </p>
            <div className="bg-gray-50 border rounded-lg p-3 text-sm font-mono space-y-1">
              <div>Name: <b>CONVEX_SECRET</b></div>
              <div className="flex items-center gap-2">
                Value:
                <code className="px-2 py-1 bg-white rounded border break-all">{secret}</code>
                <Button size="sm" variant="ghost" onClick={() => copy(secret)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Save the property, then come back here. Keep this secret — you'll paste it into our
              system in the final step (it'll autofill for you).
            </p>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Property saved → Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm">
              Now deploy the script as a Web App. In Apps Script click <b>Deploy</b> (top-right)
              → <b>New deployment</b>:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1 text-gray-700">
              <li>Select type: <b>Web app</b></li>
              <li>Execute as: <b>Me</b></li>
              <li>Who has access: <b>Anyone</b></li>
              <li>Click <b>Deploy</b> → approve the permissions (you'll see a "Google hasn't
                verified this app" warning — that's normal, click <b>Advanced</b> → <b>Go to (project name)</b>
                → <b>Allow</b>).</li>
            </ul>
            <p className="text-sm">
              Copy the <b>Web app URL</b> Google shows you and paste below:
            </p>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={!url.trim()}>Next</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm">
              We'll save and fire a test poke. You should see a <b>convex-sent</b> Gmail label
              appear on any recent HDFC mails within seconds.
            </p>
            <div className="bg-gray-50 border rounded-lg p-3 text-xs space-y-1">
              <div><b>URL:</b> <span className="font-mono break-all">{url}</span></div>
              <div><b>Secret:</b> <span className="font-mono">{secret.slice(0, 8)}…</span></div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={handleFinish} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save & test'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
