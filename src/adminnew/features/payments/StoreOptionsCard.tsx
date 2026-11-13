import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Button, Card, ErrorBanner, Switch, useButtonFeedback } from '../../ui';

/** Wallet and lucky-discount switches. Saved together. */
export function StoreOptionsCard({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const settings = useQuery(api.organizations.getSettings, orgId ? { orgId } : 'skip');
  const update = useMutation(api.organizations.updateSettings);
  const save = useButtonFeedback();
  const [draft, setDraft] = useState<{ wallet: boolean; lucky: boolean } | null>(null);

  const wallet = draft?.wallet ?? settings?.walletEnabled ?? true;
  const lucky = draft?.lucky ?? settings?.luckyEnabled ?? true;
  const dirty = draft !== null;

  const persist = () => {
    if (!orgId) return;
    save.run(async () => {
      await update({ orgId, walletEnabled: wallet, luckyEnabled: lucky });
      setDraft(null);
    });
  };

  return (
    <Card
      title="Options"
      actions={
        <Button variant="primary" size="sm" state={save.state} disabled={!dirty} onClick={persist}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">Wallet</span>
          <Switch
            checked={wallet}
            disabled={settings === undefined}
            aria-label="Wallet"
            onCheckedChange={(v) => setDraft({ wallet: v, lucky })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Lucky discount</div>
            <p className="text-xs text-muted-foreground">Adds 1–99 paise per order so amounts match exactly.</p>
          </div>
          <Switch
            checked={lucky}
            disabled={settings === undefined}
            aria-label="Lucky discount"
            onCheckedChange={(v) => setDraft({ wallet, lucky: v })}
          />
        </div>
        <ErrorBanner error={save.error} />
      </div>
    </Card>
  );
}
