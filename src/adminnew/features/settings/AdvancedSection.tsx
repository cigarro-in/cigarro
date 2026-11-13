import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { ORG_SLUG } from '../../../lib/convex/org';
import { useTheme } from '../../../themes';
import { Badge, Button, Card, ErrorBanner, Input, Label, Textarea, useButtonFeedback } from '../../ui';
import type { SectionProps } from './sections';
import { SaveBar } from './SaveBar';
import { FieldGrid } from './FieldGrid';
import { useSettingsDraft } from './useSettingsDraft';

/** Storefront theme, search metadata and analytics. Theme switches apply at once. */
export function AdvancedSection({ live }: Pick<SectionProps, 'live'>) {
  return (
    <div className="flex flex-col gap-3">
      <ThemeCard />
      <SearchCard live={live} />
    </div>
  );
}

function ThemeCard() {
  const { themeId, availableThemes, setTheme } = useTheme();
  const mutate = useMutation(api.adminCatalog.saveSiteSettings);
  const feedback = useButtonFeedback();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const choose = (id: string) => {
    if (id === themeId) return;
    setPendingId(id);
    void feedback
      .run(async () => {
        await mutate({ orgSlug: ORG_SLUG, activeTheme: id });
        setTheme(id);
      })
      .finally(() => setPendingId(null));
  };

  return (
    <Card title="Storefront theme">
      <div className="flex flex-col gap-3">
        <ErrorBanner error={feedback.error} />
        {availableThemes.map((t) => {
          const active = t.id === themeId;
          const pending = pendingId === t.id;
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  {active && <Badge tone="success">Active</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              {!active && (
                <Button
                  size="sm"
                  variant="secondary"
                  state={pending ? feedback.state : 'idle'}
                  successLabel="Applied"
                  onClick={() => choose(t.id)}
                  disabled={pendingId !== null}
                >
                  Use theme
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SearchCard({ live }: Pick<SectionProps, 'live'>) {
  const { draft, update, dirty, discard, save, feedback } = useSettingsDraft(live);
  if (!draft) return null;

  const onSave = () =>
    save((d) => ({
      metaTitle: d.metaTitle.trim() || undefined,
      metaDescription: d.metaDescription.trim() || undefined,
      seo: {
        titleTemplate: d.seo.titleTemplate.trim() || undefined,
        defaultDescription: d.seo.defaultDescription.trim() || undefined,
        googleSiteVerification: d.seo.googleSiteVerification.trim() || undefined,
        bingSiteVerification: d.seo.bingSiteVerification.trim() || undefined,
        gaMeasurementId: d.seo.gaMeasurementId.trim() || undefined,
      },
    }));

  const setSeo = (patch: Partial<typeof draft.seo>) => update((d) => ({ ...d, seo: { ...d.seo, ...patch } }));

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner error={feedback.error} />
      <Card title="Search and analytics">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta_title">Home page title</Label>
            <Input
              id="meta_title"
              value={draft.metaTitle}
              onChange={(e) => update((d) => ({ ...d, metaTitle: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Shown in browser tabs and search results.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta_description">Home page description</Label>
            <Textarea
              id="meta_description"
              rows={3}
              value={draft.metaDescription}
              onChange={(e) => update((d) => ({ ...d, metaDescription: e.target.value }))}
            />
          </div>
          <FieldGrid>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seo_title_template">Title template</Label>
              <Input
                id="seo_title_template"
                value={draft.seo.titleTemplate}
                onChange={(e) => setSeo({ titleTemplate: e.target.value })}
                placeholder="%s | Your Store"
              />
              <p className="text-xs text-muted-foreground">%s is replaced by the page title.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seo_default_description">Default description</Label>
              <Input
                id="seo_default_description"
                value={draft.seo.defaultDescription}
                onChange={(e) => setSeo({ defaultDescription: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="google_verification">Google site verification</Label>
              <Input
                id="google_verification"
                value={draft.seo.googleSiteVerification}
                onChange={(e) => setSeo({ googleSiteVerification: e.target.value })}
                placeholder="Content value only"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bing_verification">Bing site verification</Label>
              <Input
                id="bing_verification"
                value={draft.seo.bingSiteVerification}
                onChange={(e) => setSeo({ bingSiteVerification: e.target.value })}
                placeholder="Content value only"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="ga_id">Google Analytics ID</Label>
              <Input
                id="ga_id"
                value={draft.seo.gaMeasurementId}
                onChange={(e) => setSeo({ gaMeasurementId: e.target.value })}
                placeholder="G-XXXXXXXXXX"
                className="max-w-md"
              />
            </div>
          </FieldGrid>
        </div>
      </Card>
      <SaveBar dirty={dirty} state={feedback.state} onDiscard={discard} onSave={() => void onSave()} />
    </div>
  );
}
