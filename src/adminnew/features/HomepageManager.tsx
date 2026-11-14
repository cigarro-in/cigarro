import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Page,
  PageLayout,
  Sheet,
  Skeleton,
  Switch,
  toActionError,
  type ActionError,
} from '../ui';
import { useStoreHostname } from './account/useStoreAccount';
import { useHomepageAdmin } from './homepage/useHomepageAdmin';
import { HeroSlidesPanel, type HeroSlideRow } from './homepage/HeroSlidesPanel';
import { SectionSettingsPanel } from './homepage/SectionSettingsPanel';
import type { HomepageSectionKey } from './homepage/sections';

const THEME_NAME: Record<string, string> = { classic: 'Classic', vivid: 'Vivid' };

// Homepage editor: sections in the order the active theme renders them.
// Hero slides open in a sheet; product and category sections open in a sheet
// for their heading and collection.
export function HomepageManager() {
  const navigate = useNavigate();
  const home = useHomepageAdmin();
  const address = useStoreHostname(home.storeId);
  const [error, setError] = useState<ActionError | null>(null);
  const [openKey, setOpenKey] = useState<HomepageSectionKey | null>(null);

  const attempt = async (fn: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(toActionError(err, fallback));
    }
  };

  const open = home.sections.find((s) => s.def.key === openKey) ?? null;
  const shownHero = home.slides.filter((s) => s.isActive).length;
  const themeName = THEME_NAME[home.themeId] ?? 'Classic';

  const viewLink = address ? (
    <Button variant="secondary" asChild>
      <a href={address.url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-4 w-4" aria-hidden />
        View homepage
      </a>
    </Button>
  ) : null;

  return (
    <Page title="Homepage" secondaryActions={viewLink ? [viewLink] : []}>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <PageLayout
        main={
          <Card title="Sections" padding="none">
            {home.loading ? (
              <div className="space-y-px p-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="my-2 h-14 w-full" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {home.sections.map(({ def, enabled }) => {
                  const isHero = def.key === 'hero_section';
                  const summary = isHero
                    ? home.slides.length === 0
                      ? 'No slides yet'
                      : `${shownHero} of ${home.slides.length} slides shown`
                    : def.description;
                  return (
                    <li key={def.key} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{def.label}</p>
                          <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Shown' : 'Hidden'}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{summary}</p>
                      </div>
                      <Switch
                        aria-label={`Show ${def.label}`}
                        checked={enabled}
                        onCheckedChange={(v) =>
                          void attempt(() => home.setSectionEnabled(def.key, v), 'Could not update this section.')
                        }
                      />
                      <Button variant="secondary" size="sm" onClick={() => setOpenKey(def.key)}>
                        {isHero ? 'Manage slides' : 'Edit'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        }
        aside={
          <div className="space-y-3">
            <Card title="Theme">
              <p className="text-sm text-foreground">
                This store uses the <strong className="font-semibold">{themeName}</strong> theme.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Only the settings this theme shows are listed. The order of sections is set by the theme.
              </p>
            </Card>
            <Card title="Live address">
              {address === undefined ? (
                <Skeleton className="h-4 w-40" />
              ) : address ? (
                <p className="break-all text-sm text-foreground">{address.hostname}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No live domain yet. Changes show on the store once it has one.
                </p>
              )}
            </Card>
          </div>
        }
      />

      <Sheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpenKey(null)}
        title={open?.def.label ?? ''}
      >
        {open?.def.key === 'hero_section' && (
          <HeroSlidesPanel
            slides={home.slides as HeroSlideRow[]}
            themeId={home.themeId}
            onAdd={() => {
              setOpenKey(null);
              navigate('/hero-slides/new');
            }}
            onEdit={(id) => {
              setOpenKey(null);
              navigate(`/hero-slides/${id}`);
            }}
            onMove={(index, direction) => {
              const next = [...home.slides];
              const target = index + direction;
              [next[index], next[target]] = [next[target], next[index]];
              return home.setSlideOrder(next);
            }}
            onToggle={(slide, isActive) => home.setSlideActive(slide, isActive)}
            onDelete={(id) => home.removeSlide(id)}
          />
        )}
        {open && open.def.key !== 'hero_section' && (
          <SectionSettingsPanel
            key={open.def.key}
            def={open.def}
            slug={home.slug}
            themeId={home.themeId}
            collectionId={open.collectionId}
            collections={home.collections}
            onSetHeading={home.setSectionHeading}
            onSetCollection={home.setSectionCollection}
            onSetImage={home.setSectionImage}
          />
        )}
      </Sheet>
    </Page>
  );
}
