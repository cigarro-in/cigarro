import { Clock, Truck, Zap } from 'lucide-react';
import { useShippingMethods } from '../../../hooks/data/useContent';
import { formatINR } from '../../../utils/currency';
import { cn } from '../../../components/ui/utils';
import { Section } from './Section';
import type { CheckoutModel } from './useCheckoutModel';

const ICONS: Record<string, typeof Truck> = { standard: Truck, express: Clock, priority: Zap };

// Delivery speed. Same admin-configured methods as the shared ShippingOptions
// used on mobile, laid out side by side.
export function DeliverySection({ model, step }: { model: CheckoutModel; step: number }) {
  const { methods } = useShippingMethods();
  const { activeShippingId, setSelectedShipping } = model;
  return (
    <Section step={step} title="Delivery">
      <div role="radiogroup" aria-label="Delivery speed" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {methods.map((m) => {
          const Icon = ICONS[m.id] ?? Truck;
          const selected = m.id === activeShippingId;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedShipping(m.id)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                selected ? 'border-accent bg-accent/5' : 'border-border hover:border-foreground/30',
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className={cn('h-4 w-4', selected ? 'text-accent' : 'text-muted-foreground')} />
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {m.priceRupees === 0 ? 'Free' : formatINR(m.priceRupees)}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">{m.label}</span>
              <span className="text-xs text-muted-foreground">{m.eta}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
