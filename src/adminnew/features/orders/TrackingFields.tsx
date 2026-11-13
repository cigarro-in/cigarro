import type { ChangeEvent } from 'react';
import { Input } from '../../ui';
import type { OrderDoc } from './orderModel';

export interface TrackingValues {
  carrier: string;
  number: string;
  url: string;
}

export function trackingFrom(order: Pick<OrderDoc, 'trackingCarrier' | 'trackingNumber' | 'trackingUrl'>): TrackingValues {
  return {
    carrier: order.trackingCarrier ?? '',
    number: order.trackingNumber ?? '',
    url: order.trackingUrl ?? '',
  };
}

/** Always sends all three fields so an admin can also clear them (empty string). */
export function trackingPatch(values: TrackingValues) {
  return {
    trackingCarrier: values.carrier.trim(),
    trackingNumber: values.number.trim(),
    trackingUrl: values.url.trim(),
  };
}

/** Courier, tracking number and tracking link. Controlled; the parent owns the save. */
export function TrackingFields({
  value,
  onChange,
  disabled,
}: {
  value: TrackingValues;
  onChange: (next: TrackingValues) => void;
  disabled?: boolean;
}) {
  const field = (key: keyof TrackingValues) => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Courier</span>
        <Input value={value.carrier} onChange={field('carrier')} placeholder="Delhivery, BlueDart, India Post" disabled={disabled} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Tracking number</span>
        <Input value={value.number} onChange={field('number')} disabled={disabled} />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Tracking link (optional)</span>
        <Input value={value.url} onChange={field('url')} placeholder="https://" disabled={disabled} inputMode="url" />
      </label>
    </div>
  );
}
