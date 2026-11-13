import { Button, Card, ErrorBanner, Input, Label, Switch } from '../../ui';
import type { StoreStateMinAge } from '../../../lib/storeSettings';
import type { SectionProps } from './sections';
import { SaveBar } from './SaveBar';
import { FieldGrid } from './FieldGrid';
import { useSettingsDraft } from './useSettingsDraft';

/** Legal identity on invoices, and the age gate shown to visitors on entry. */
export function LegalSection({ live }: SectionProps) {
  const { draft, update, dirty, discard, save, feedback } = useSettingsDraft(live);
  if (!draft) return null;

  const setGate = (patch: Partial<typeof draft.ageGate>) => update((d) => ({ ...d, ageGate: { ...d.ageGate, ...patch } }));
  const setRules = (rules: StoreStateMinAge[]) => setGate({ stateMinAge: rules });

  const onSave = () =>
    save((d) => {
      const ages = [d.ageGate.minAge, ...d.ageGate.stateMinAge.map((r) => r.minAge)];
      if (ages.some((a) => !Number.isInteger(a) || a < 0 || a > 100))
        throw new Error('Minimum ages must be whole numbers between 0 and 100');
      return {
        // Contact and address are edited in Store details: keep the live values.
        business: {
          ...live.business,
          legalName: d.business.legalName.trim() || undefined,
          gstin: d.business.gstin.trim() || undefined,
        },
        ageGate: {
          enabled: d.ageGate.enabled,
          minAge: d.ageGate.minAge,
          stateMinAge: d.ageGate.stateMinAge
            .map((r) => ({ state: r.state.trim(), minAge: r.minAge }))
            .filter((r) => r.state !== ''),
        },
      };
    });

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner error={feedback.error} />

      <Card title="Business">
        <FieldGrid>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input
              id="legal_name"
              value={draft.business.legalName}
              onChange={(e) => update((d) => ({ ...d, business: { ...d.business, legalName: e.target.value } }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              value={draft.business.gstin}
              onChange={(e) => update((d) => ({ ...d, business: { ...d.business, gstin: e.target.value } }))}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
        </FieldGrid>
      </Card>

      <Card title="Age gate">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="age_gate_on">Show age gate</Label>
              <p className="text-xs text-muted-foreground">
                {draft.ageGate.enabled ? 'Visitors confirm their age before browsing' : 'No age check on entry'}
              </p>
            </div>
            <Switch id="age_gate_on" checked={draft.ageGate.enabled} onCheckedChange={(checked) => setGate({ enabled: checked })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min_age">Minimum age</Label>
            <Input
              id="min_age"
              type="number"
              min={0}
              max={100}
              value={draft.ageGate.minAge}
              onChange={(e) => setGate({ minAge: Number(e.target.value) || 0 })}
              className="max-w-xs"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>State-specific minimum ages</Label>
            {draft.ageGate.stateMinAge.map((rule, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  aria-label="State"
                  className="min-w-0 flex-1"
                  value={rule.state}
                  placeholder="Karnataka"
                  onChange={(e) =>
                    setRules(draft.ageGate.stateMinAge.map((r, i) => (i === idx ? { ...r, state: e.target.value } : r)))
                  }
                />
                <Input
                  aria-label="Minimum age for state"
                  className="w-28"
                  type="number"
                  min={0}
                  max={100}
                  value={rule.minAge}
                  onChange={(e) =>
                    setRules(
                      draft.ageGate.stateMinAge.map((r, i) => (i === idx ? { ...r, minAge: Number(e.target.value) || 0 } : r)),
                    )
                  }
                />
                <Button size="sm" variant="secondary" onClick={() => setRules(draft.ageGate.stateMinAge.filter((_, i) => i !== idx))}>
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRules([...draft.ageGate.stateMinAge, { state: '', minAge: draft.ageGate.minAge }])}
              >
                Add state rule
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">The tobacco warning on the gate is fixed text.</p>
        </div>
      </Card>

      <SaveBar dirty={dirty} state={feedback.state} onDiscard={discard} onSave={() => void onSave()} />
    </div>
  );
}
