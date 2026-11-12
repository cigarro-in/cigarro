import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import { api } from '../../../convex/_generated/api';
import { useSa } from '../SuperGate';
import { saErrorMessage } from '../session';

// Moved from the store admin Payments page (Platform Config card). Platform-wide
// bank-alert senders shared by every store.
export function PlatformConfigPage() {
  const { token, writeOpen } = useSa();
  const appConfig = useQuery(api.appConfig.get, { saToken: token });
  const setAppConfig = useMutation(api.appConfig.set);
  const status = useInlineStatus();
  const [csv, setCsv] = useState('');
  const [saving, setSaving] = useState(false);

  const customSenders = appConfig?.customBankSenders ?? [];
  const defaultSenders = appConfig?.defaultBankSenders ?? [];
  const mergedSenders = appConfig?.bankSenders ?? [];
  const customKey = customSenders.join('\n');

  // Re-seed the textarea only when the saved list changes.
  useEffect(() => {
    setCsv(customKey);
  }, [customKey]);

  const onSave = async () => {
    setSaving(true);
    try {
      await setAppConfig({
        saToken: token,
        bankSenders: csv.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      });
      status.setOk(`Saved ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (err) {
      status.setError(saErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Platform config</h1>
      <p className="text-sm text-muted-foreground">
        These settings apply to every store. Senders are added to the built-in defaults, never replace them. Max 20 entries.
      </p>
      <div className="rounded-xl border p-4 space-y-3">
        <Label htmlFor="sa-senders">Additional bank-alert senders</Label>
        <textarea
          id="sa-senders"
          className="w-full rounded-md border border-border p-2 text-sm font-mono"
          rows={4}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'@icicibank.com\nalerts@sbi.co.in'}
          disabled={!writeOpen}
        />
        <div className="rounded-lg bg-muted border p-3 text-xs">
          <p className="font-semibold mb-1">Currently searched ({mergedSenders.length})</p>
          <ul className="space-y-0.5">
            {mergedSenders.map((s) => (
              <li key={s} className="font-mono">
                {s}
                {defaultSenders.includes(s) && <span className="text-muted-foreground ml-2">(default)</span>}
                {customSenders.includes(s) && !defaultSenders.includes(s) && <span className="ml-2">(custom)</span>}
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={() => void onSave()} disabled={!writeOpen || saving}>
          {saving ? 'Saving...' : 'Save platform config'}
        </Button>
        <InlineStatus status={status.status} />
      </div>
    </div>
  );
}
