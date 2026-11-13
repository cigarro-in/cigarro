import { Copy, MapPin } from 'lucide-react';
import { Button, Card, EmptyState, useButtonFeedback } from '../../ui';
import { mapsUrl, type OrderDoc } from './orderModel';

/** Address big and bold, with copy and an Open in Maps link when GPS was captured. */
export function ShippingAddressCard({ order }: { order: OrderDoc }) {
  const copy = useButtonFeedback();
  const a = order.address;

  if (!a) {
    return (
      <Card title="Ship to">
        <EmptyState title="No address on this order" />
      </Card>
    );
  }

  const lines = [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter((l): l is string => !!l && l.trim() !== '');
  const plain = [a.name, ...lines, a.phone].filter(Boolean).join('\n');
  const hasGps = typeof a.latitude === 'number' && typeof a.longitude === 'number';

  return (
    <Card
      title="Ship to"
      actions={
        <Button size="sm" variant="plain" state={copy.state} onClick={() => void copy.run(() => navigator.clipboard.writeText(plain))}
          icon={<Copy aria-hidden />} successLabel="Copied" errorLabel="Copy failed">
          Copy
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-lg font-bold leading-tight text-foreground">{a.name}</p>
        <div className="text-base font-semibold leading-relaxed text-foreground">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        {a.phone && <p className="text-sm text-muted-foreground tabular-nums">{a.phone}</p>}
        {hasGps && (
          <Button asChild size="sm" variant="secondary" className="mt-1 w-fit">
            <a href={mapsUrl(a.latitude as number, a.longitude as number)} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden />
              Open in Maps
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}
