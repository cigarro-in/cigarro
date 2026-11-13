import type { ComponentType } from 'react';
import { Link, Navigate, NavLink } from 'react-router-dom';
import { ArrowRight, CreditCard } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { adminPath } from '../lib/paths';
import { Button, Card, Page, Skeleton } from '../ui';
import { cn } from '../../components/ui/utils';
import { SETTINGS_SECTIONS, type SectionProps, type SettingsSectionId } from './settings/sections';
import { useLiveStoreSettings } from './settings/useSettingsDraft';
import { StoreDetailsSection } from './settings/StoreDetailsSection';
import { CheckoutSection } from './settings/CheckoutSection';
import { ReferralSection } from './settings/ReferralSection';
import { LegalSection } from './settings/LegalSection';
import { AdvancedSection } from './settings/AdvancedSection';

const SECTION_VIEW: Record<SettingsSectionId, ComponentType<SectionProps>> = {
  store: StoreDetailsSection,
  checkout: CheckoutSection,
  referral: ReferralSection,
  legal: LegalSection,
  advanced: AdvancedSection,
};

/**
 * Settings index and section shell. Desktop: section list on the left, the open
 * section on the right. Phone: the list on its own, then one section at a time.
 * Each section is its own sub-route (/settings/<id>) and saves only its own fields.
 */
export function SettingsManager({ section }: { section: SettingsSectionId | null }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { raw, live } = useLiveStoreSettings();

  // Desktop has no separate empty index: open the first section instead.
  if (!section && isDesktop) return <Navigate to={adminPath(`/settings/${SETTINGS_SECTIONS[0].id}`)} replace />;

  const current = SETTINGS_SECTIONS.find((s) => s.id === section) ?? null;
  const View = section ? SECTION_VIEW[section] : null;

  return (
    <Page title={current ? current.label : 'Settings'} backTo={current && !isDesktop ? '/settings' : undefined}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <aside className={cn("flex w-full flex-col gap-3 md:w-60 md:shrink-0", section && "hidden md:flex")}>
          <Card padding="none">
            <nav aria-label="Settings sections" className="flex flex-col p-1.5">
              {SETTINGS_SECTIONS.map((s) => (
                <NavLink
                  key={s.id}
                  to={adminPath(`/settings/${s.id}`)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors',
                      isActive
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.description}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground md:hidden" aria-hidden />
                </NavLink>
              ))}
            </nav>
          </Card>

          <Card title="Payments">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                UPI IDs, Gmail, bank senders, wallet and the lucky discount are managed on the Payments page.
              </p>
              <Button asChild variant="secondary" size="sm" className="self-start">
                <Link to={adminPath('/payments/settings')}>
                  <CreditCard aria-hidden />
                  Open Payments settings
                </Link>
              </Button>
            </div>
          </Card>
        </aside>

        <div className={cn("min-w-0 flex-1", !section && "hidden md:block")}>
          {View && live ? (
            <View live={live} raw={raw ?? null} />
          ) : View ? (
            <div className="flex flex-col gap-3" role="status" aria-label="Loading settings">
              <Card>
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-2/3" />
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
