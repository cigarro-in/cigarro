import { ExternalLink, MessageCircle, Phone } from 'lucide-react';
import { formatINR } from '../../../utils/currency';
import { Badge, Button, Card, CardSection } from '../../ui';
import { mapsHref, telHref, whatsappHref, type CustomerProfile, type CustomerProfileAddress } from './customerModel';

function AddressBlock({ address }: { address: CustomerProfileAddress }) {
  const hasGps = address.latitude != null && address.longitude != null;
  const title = address.label || (address.source === 'saved' ? 'Saved address' : 'From an order');
  return (
    <div className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{title}</span>
        {address.isDefault && <Badge tone="info">Default</Badge>}
      </div>
      <div className="text-sm text-muted-foreground">
        {address.name}
        {address.phone ? ` · ${address.phone}` : ''}
      </div>
      <div className="text-sm text-muted-foreground">
        {[address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ')}
      </div>
      {hasGps && (
        <a
          href={mapsHref(address.latitude!, address.longitude!)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          Open in Maps
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </div>
  );
}

/** Contact, addresses and referral in one panel, split by hairlines (no boxed sub-cards). */
export function CustomerAside({ profile }: { profile: CustomerProfile }) {
  const { phone, addresses, referral } = profile;
  return (
    <Card>
      <CardSection title="Contact">
        {phone ? (
          <div className="flex flex-col gap-3">
            <span className="text-base font-medium tabular-nums">{phone}</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" asChild icon={<Phone />}>
                <a href={telHref(phone)}>Call</a>
              </Button>
              <Button variant="secondary" size="sm" asChild icon={<MessageCircle />}>
                <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No phone on file</span>
        )}
      </CardSection>

      <CardSection title="Addresses">
        {addresses.length === 0 ? (
          <span className="text-sm text-muted-foreground">No addresses yet</span>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {addresses.map((a) => (
              <AddressBlock key={`${a.source}-${a.id}`} address={a} />
            ))}
          </div>
        )}
      </CardSection>

      {referral && (
        <CardSection title="Referrals">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Code</dt>
              <dd className="font-medium tabular-nums">{referral.code}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Rewards earned</dt>
              <dd className="font-medium tabular-nums">{formatINR(referral.totalRewardsEarned)}</dd>
            </div>
            {referral.referredByCode && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Referred with</dt>
                <dd className="font-medium tabular-nums">{referral.referredByCode}</dd>
              </div>
            )}
          </dl>
        </CardSection>
      )}
    </Card>
  );
}
