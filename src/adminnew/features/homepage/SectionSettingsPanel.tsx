import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Banner, Button, ErrorBanner, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toActionError, useButtonFeedback, type ActionError } from '../../ui';
import type { HomepageSectionDef, HomepageSectionKey } from './sections';

// Sheet body for one product or category section: heading and collection link.
// Only the controls the active theme reads are shown (see sections.ts).
export function SectionSettingsPanel({
  def,
  slug,
  collectionId,
  collections,
  onSetHeading,
  onSetCollection,
}: {
  def: HomepageSectionDef;
  slug: string;
  collectionId: string | null;
  collections: { supabaseId: string; title: string; isActive?: boolean }[];
  onSetHeading: (key: HomepageSectionKey, title: string) => Promise<void>;
  onSetCollection: (key: HomepageSectionKey, collectionId: string | null) => Promise<void>;
}) {
  const config = useQuery(api.content.getSectionConfig, { orgSlug: slug, name: def.key });
  const [draft, setDraft] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<ActionError | null>(null);
  const heading = useButtonFeedback();

  const linked = def.collectionLink && !!collectionId;
  const linkedCollection = linked ? collections.find((c) => c.supabaseId === collectionId) : undefined;
  const current = draft ?? config?.title ?? '';
  const dirty = draft !== null && draft.trim() !== (config?.title ?? '');

  const saveHeading = () =>
    heading.run(async () => {
      const title = current.trim();
      if (!title) throw new Error('Add a heading before saving.');
      await onSetHeading(def.key, title);
      setDraft(null);
    });

  const pickCollection = async (value: string) => {
    setLinkError(null);
    try {
      await onSetCollection(def.key, value === 'latest' ? null : value);
    } catch (err) {
      setLinkError(toActionError(err, 'Could not change the collection. Try again.'));
    }
  };

  return (
    <div className="space-y-6">
      {def.collectionLink && (
        <div className="space-y-2">
          <Label>Products come from</Label>
          <Select value={collectionId ?? 'latest'} onValueChange={pickCollection}>
            <SelectTrigger aria-label="Products come from">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest products</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.supabaseId} value={c.supabaseId}>
                  {c.title}
                  {c.isActive === false ? ' (inactive)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {linkedCollection
              ? 'The title and products follow this collection. Rename it under Products, Collections.'
              : 'Shows the newest products. Pick a collection to show its products instead.'}
          </p>
          <ErrorBanner error={linkError} onDismiss={() => setLinkError(null)} />
        </div>
      )}

      {def.hasHeading && !linked && (
        <div className="space-y-2">
          <Label htmlFor="section-heading">Heading</Label>
          <Input
            id="section-heading"
            value={current}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty) void saveHeading();
            }}
          />
          <div>
            <Button variant="primary" size="sm" state={heading.state} disabled={!dirty && heading.state === 'idle'} onClick={() => void saveHeading()}>
              Save heading
            </Button>
          </div>
          <ErrorBanner error={heading.error} />
        </div>
      )}

      {!def.hasHeading && !def.collectionLink && (
        <Banner tone="info">Each category row takes its name from the category. Use the switch on the list to show or hide this section.</Banner>
      )}
    </div>
  );
}
