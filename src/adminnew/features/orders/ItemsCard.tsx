import { Package } from 'lucide-react';
import { getProductImageUrl } from '../../../lib/images/urls';
import { formatINR } from '../../../utils/currency';
import { paiseToRupees } from '../../../lib/convex/money';
import { Card } from '../../ui';
import { splitItemName, type OrderDoc } from './orderModel';

export function ItemsCard({ order }: { order: OrderDoc }) {
  const items = order.items ?? [];
  const units = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <Card title={`Items${units ? ` (${units})` : ''}`} padding="none">
      <ul className="divide-y divide-border">
        {items.map((item, index) => {
          const { product, variant } = splitItemName(item.name);
          return (
            <li key={`${index}-${item.name}`} className="flex items-center gap-4 px-4 py-3">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {item.image ? (
                  <img src={getProductImageUrl(item.image)} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <Package className="size-5 text-muted-foreground/70" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">{product}</p>
                {variant && <p className="truncate text-sm text-muted-foreground">{variant}</p>}
                <p className="text-sm text-muted-foreground">
                  {formatINR(paiseToRupees(item.unitPricePaise))} each · Qty {item.qty}
                </p>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                {formatINR(paiseToRupees(item.unitPricePaise * item.qty))}
              </p>
            </li>
          );
        })}
        {items.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No items on this order.</li>}
      </ul>
    </Card>
  );
}
