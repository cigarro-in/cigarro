import { QuantityStepper } from '../../../components/cart/QuantityStepper';
import { getProductImageUrl } from '../../../lib/images/urls';
import { formatINR } from '../../../utils/currency';
import { Section } from './Section';
import type { CheckoutModel } from './useCheckoutModel';

const brandName = (brand: any): string => {
  if (!brand) return '';
  if (typeof brand === 'string') return brand;
  if (Array.isArray(brand)) return brand[0]?.name || '';
  return brand.name || '';
};

// Items in this order, with quantity editing (cart or buy-now item, as on mobile).
// A retry order's items are fixed by the source order, so they are read-only.
export function ItemsSection({ model, step }: { model: CheckoutModel; step: number }) {
  const { items, updateItemQuantity, isRetryPayment } = model;
  return (
    <Section step={step} title={`Items (${items.length})`}>
      <ul className="divide-y divide-border">
        {items.map((item: any) => {
          const unit = Number(item.variant_price || item.price || 0);
          return (
            <li
              key={`${item.id}-${item.variant_id || 'default'}-${item.combo_id || 'none'}`}
              className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                <img
                  src={getProductImageUrl(item.image || item.gallery_images?.[0] || item.product_variants?.[0]?.images?.[0])}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = getProductImageUrl(); }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.name}{item.variant_name && ` (${item.variant_name})`}
                </p>
                {brandName(item.brand) && <p className="text-xs text-muted-foreground">{brandName(item.brand)}</p>}
                <p className="mt-1 text-sm text-muted-foreground">{formatINR(unit)} each</p>
              </div>
              {isRetryPayment ? (
                <span className="text-sm text-muted-foreground">Qty {item.quantity}</span>
              ) : (
                <QuantityStepper
                  quantity={item.quantity}
                  onChange={(next) => updateItemQuantity(item.id, next, item.variant_id, item.combo_id)}
                  min={0}
                  size="sm"
                  className="gap-1"
                  buttonClassName="rounded-md border border-border bg-background text-foreground hover:bg-muted"
                  valueClassName="text-foreground"
                />
              )}
              <span className="w-24 text-right text-sm font-medium tabular-nums text-foreground">
                {formatINR(unit * Number(item.quantity ?? 1))}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
