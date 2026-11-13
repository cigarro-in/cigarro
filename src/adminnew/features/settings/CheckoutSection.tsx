import { Badge, Card, ErrorBanner, Input, Label, Switch } from '../../ui';
import { mergeShippingMethods, toShippingConfig, type ShippingMethod } from '../../../lib/shipping';
import type { SectionProps } from './sections';
import { SaveBar } from './SaveBar';
import { useSettingsDraft } from './useSettingsDraft';

/** Delivery methods at checkout: on or off, label, price and delivery estimate. */
export function CheckoutSection({ raw }: SectionProps) {
  const baseline = mergeShippingMethods((raw as { shippingConfig?: unknown } | null)?.shippingConfig);
  const { draft, update, dirty, discard, save, feedback } = useSettingsDraft<ShippingMethod[]>(baseline);
  if (!draft) return null;

  const patch = (id: ShippingMethod['id'], p: Partial<ShippingMethod>) =>
    update((methods) => methods.map((m) => (m.id === id ? { ...m, ...p } : m)));

  const enabledCount = draft.filter((m) => m.enabled).length;

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner error={feedback.error} />

      <Card title="Delivery methods">
        <div className="flex flex-col gap-3">
          {draft.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-sm font-medium capitalize">{m.id}</span>
                  <Badge tone={m.enabled ? 'success' : 'neutral'}>{m.enabled ? 'On' : 'Off'}</Badge>
                </div>
                <Switch
                  aria-label={`Show ${m.label} at checkout`}
                  checked={m.enabled}
                  onCheckedChange={(checked) => patch(m.id, { enabled: checked })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${m.id}_label`}>Label</Label>
                  <Input id={`${m.id}_label`} value={m.label} onChange={(e) => patch(m.id, { label: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${m.id}_price`}>Price (₹)</Label>
                  <Input
                    id={`${m.id}_price`}
                    type="number"
                    min={0}
                    value={m.priceRupees}
                    onChange={(e) => patch(m.id, { priceRupees: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${m.id}_eta`}>Estimate</Label>
                  <Input id={`${m.id}_eta`} value={m.eta} onChange={(e) => patch(m.id, { eta: e.target.value })} placeholder="5-7 days" />
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            ₹0 shows as Free. Checkout uses the first enabled method
            {enabledCount === 0 ? ', and none is enabled right now' : ''}.
          </p>
        </div>
      </Card>

      <SaveBar
        dirty={dirty}
        state={feedback.state}
        onDiscard={discard}
        onSave={() => void save((methods) => ({ shippingConfig: toShippingConfig(methods) }))}
      />
    </div>
  );
}
