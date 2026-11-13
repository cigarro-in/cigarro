import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { convexUrl } from '../../../lib/convex/client';
import { Banner, Button, Card, ErrorBanner, Input, Label, useButtonFeedback } from '../../ui';

// The browser knows the .cloud URL; the OAuth callback lives on .site.
const GMAIL_CALLBACK_URL = convexUrl.replace('.convex.cloud', '.convex.site') + '/gmailOAuthCallback';

type Draft = { timeout: string; quarantine: string; slots: string };

/** Slot timing and fingerprint settings. Collapsed by default. */
export function AdvancedCard({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const settings = useQuery(api.organizations.getSettings, orgId ? { orgId } : 'skip');
  const update = useMutation(api.organizations.updateSettings);
  const save = useButtonFeedback();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const current: Draft = {
    timeout: String(Math.round((settings?.slotTimeoutMs ?? 10 * 60_000) / 60_000)),
    quarantine: String(Math.round((settings?.quarantineMs ?? 20 * 60_000) / 60_000)),
    slots: String(settings?.slotsPerBase ?? 100),
  };
  const val = draft ?? current;

  const timeoutMin = parseFloat(val.timeout);
  const quarantineMin = parseFloat(val.quarantine);
  const slots = parseInt(val.slots, 10);
  const problem =
    !(timeoutMin >= 1 && timeoutMin <= 60) ? 'Slot timeout must be 1–60 minutes'
      : !(quarantineMin >= 0 && quarantineMin <= 1440) ? 'Quarantine must be 0–1440 minutes'
      : !(Number.isInteger(slots) && slots >= 10 && slots <= 1000) ? 'Slots per amount must be 10–1000'
      : null;

  const persist = () => {
    if (!orgId || problem) return;
    save.run(async () => {
      await update({
        orgId,
        slotTimeoutMs: Math.round(timeoutMin * 60_000),
        quarantineMs: Math.round(quarantineMin * 60_000),
        slotsPerBase: slots,
      });
      setDraft(null);
    });
  };

  return (
    <Card
      title="Advanced"
      actions={
        <Button variant="plain" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </Button>
      }
    >
      {open && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="pay-timeout">Slot timeout (min)</Label>
              <Input
                id="pay-timeout"
                type="number"
                min={1}
                max={60}
                value={val.timeout}
                onChange={(e) => setDraft({ ...val, timeout: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="pay-quarantine">Quarantine (min)</Label>
              <Input
                id="pay-quarantine"
                type="number"
                min={0}
                max={1440}
                value={val.quarantine}
                onChange={(e) => setDraft({ ...val, quarantine: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="pay-slots">Slots per amount</Label>
              <Input
                id="pay-slots"
                type="number"
                min={10}
                max={1000}
                value={val.slots}
                onChange={(e) => setDraft({ ...val, slots: e.target.value })}
              />
            </div>
          </div>

          {problem && <Banner tone="critical">{problem}</Banner>}

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Forwarding alias</span>
            <code className="break-all font-mono text-sm">{settings?.bankEmailAlias ?? '—'}</code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Google redirect URI</span>
            <code className="break-all font-mono text-sm">{GMAIL_CALLBACK_URL}</code>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" state={save.state} disabled={!!problem || !draft || !orgId} onClick={persist}>
              Save
            </Button>
          </div>
          <ErrorBanner error={save.error} />
        </div>
      )}
    </Card>
  );
}
