import { Card, ErrorBanner, Input, Label } from '../../ui';
import { SingleImagePicker } from '../../components/shared/ImagePicker';
import { siteConfig } from '../../../config/site';
import type { SectionProps } from './sections';
import { SaveBar } from './SaveBar';
import { FieldGrid } from './FieldGrid';
import { useSettingsDraft } from './useSettingsDraft';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Store name, logo, site icon, brand colour, contact, address and social links. */
export function StoreDetailsSection({ live }: SectionProps) {
  const { draft, update, dirty, discard, save, feedback } = useSettingsDraft(live);
  if (!draft) return null;

  const setBrand = (patch: Partial<typeof draft.brand>) =>
    update((d) => ({ ...d, brand: { ...d.brand, ...patch } }));
  const setContact = (patch: Partial<typeof draft.business>) =>
    update((d) => ({ ...d, business: { ...d.business, ...patch } }));
  const setAddress = (patch: Partial<typeof draft.business.address>) =>
    update((d) => ({ ...d, business: { ...d.business, address: { ...d.business.address, ...patch } } }));
  const setSocial = (patch: Partial<typeof draft.socials>) =>
    update((d) => ({ ...d, socials: { ...d.socials, ...patch } }));

  const onSave = () =>
    save((d) => {
      const color = d.brand.brandColor.trim();
      if (color && !HEX.test(color)) throw new Error('Brand colour must be a hex value like #8B4513');
      return {
        siteName: d.name.trim() || undefined,
        brand: {
          logoUrl: d.brand.logoUrl.trim() || undefined,
          faviconUrl: d.brand.faviconUrl.trim() || undefined,
          brandColor: color || undefined,
        },
        // Legal name and GSTIN are edited in the Legal section: keep the live values.
        business: {
          ...live.business,
          supportEmail: d.business.supportEmail.trim() || undefined,
          supportPhone: d.business.supportPhone.trim() || undefined,
          address: {
            line1: d.business.address.line1.trim() || undefined,
            line2: d.business.address.line2.trim() || undefined,
            city: d.business.address.city.trim() || undefined,
            state: d.business.address.state.trim() || undefined,
            pincode: d.business.address.pincode.trim() || undefined,
          },
          openingHours: d.business.openingHours.trim() || undefined,
        },
        socials: {
          instagram: d.socials.instagram.trim() || undefined,
          facebook: d.socials.facebook.trim() || undefined,
          x: d.socials.x.trim() || undefined,
          youtube: d.socials.youtube.trim() || undefined,
          whatsapp: d.socials.whatsapp.trim() || undefined,
        },
      };
    });

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner error={feedback.error} />

      <Card title="Store">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="store_name">Store name</Label>
            <Input id="store_name" value={draft.name} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <FieldGrid>
            <div className="flex flex-col gap-1.5">
              <Label>Logo</Label>
              <SingleImagePicker
                value={draft.brand.logoUrl || null}
                onChange={(url) => setBrand({ logoUrl: url || '' })}
                searchHint={draft.name ? `${draft.name} logo` : undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Site icon</Label>
              <SingleImagePicker
                value={draft.brand.faviconUrl || null}
                onChange={(url) => setBrand({ faviconUrl: url || '' })}
                searchHint={draft.name ? `${draft.name} icon` : undefined}
              />
              <p className="text-xs text-muted-foreground">32 x 32 or 64 x 64 px, PNG or ICO.</p>
            </div>
          </FieldGrid>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand_color">Brand colour</Label>
            <div className="flex max-w-md items-center gap-2">
              <input
                type="color"
                aria-label="Brand colour picker"
                value={HEX.test(draft.brand.brandColor) ? draft.brand.brandColor : siteConfig.theme.primaryColor}
                onChange={(e) => setBrand({ brandColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
              />
              <Input
                id="brand_color"
                value={draft.brand.brandColor}
                onChange={(e) => setBrand({ brandColor: e.target.value })}
                placeholder={siteConfig.theme.primaryColor}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Contact">
        <div className="flex flex-col gap-4">
          <FieldGrid>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="support_email">Support email</Label>
              <Input
                id="support_email"
                type="email"
                value={draft.business.supportEmail}
                onChange={(e) => setContact({ supportEmail: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="support_phone">Support phone</Label>
              <Input
                id="support_phone"
                value={draft.business.supportPhone}
                onChange={(e) => setContact({ supportPhone: e.target.value })}
              />
            </div>
          </FieldGrid>
          <FieldGrid>
            {([
              ['line1', 'Address line 1'],
              ['line2', 'Address line 2'],
              ['city', 'City'],
              ['state', 'State'],
              ['pincode', 'PIN code'],
            ] as const).map(([field, label]) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Label htmlFor={`address_${field}`}>{label}</Label>
                <Input
                  id={`address_${field}`}
                  value={draft.business.address[field]}
                  onChange={(e) => setAddress({ [field]: e.target.value })}
                />
              </div>
            ))}
          </FieldGrid>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opening_hours">Opening hours</Label>
            <Input
              id="opening_hours"
              value={draft.business.openingHours}
              onChange={(e) => setContact({ openingHours: e.target.value })}
              placeholder="Mon-Sat 10:00-19:00"
            />
          </div>
        </div>
      </Card>

      <Card title="Social links">
        <FieldGrid>
          {([
            ['instagram', 'Instagram'],
            ['facebook', 'Facebook'],
            ['x', 'X (Twitter)'],
            ['youtube', 'YouTube'],
            ['whatsapp', 'WhatsApp link'],
          ] as const).map(([field, label]) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Label htmlFor={`social_${field}`}>{label}</Label>
              <Input
                id={`social_${field}`}
                value={draft.socials[field]}
                onChange={(e) => setSocial({ [field]: e.target.value })}
              />
            </div>
          ))}
        </FieldGrid>
      </Card>

      <SaveBar dirty={dirty} state={feedback.state} onSave={() => void onSave()} onDiscard={discard} />
    </div>
  );
}
