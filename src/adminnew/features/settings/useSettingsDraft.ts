import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { api } from '../../../../convex/_generated/api';
import { ORG_SLUG } from '../../../lib/convex/org';
import { resolveStoreSettings, type RawStoreSettings, type StoreSettings } from '../../../lib/storeSettings';
import { useButtonFeedback } from '../../ui';

export type SiteSettingsArgs = FunctionArgs<typeof api.adminCatalog.saveSiteSettings>;
/** Arguments a section sends. orgSlug is added by the hook. */
export type SectionSaveArgs = Omit<SiteSettingsArgs, 'orgSlug'>;

/**
 * Live store settings. `raw` is `undefined` while loading and `null` when the
 * store has never saved settings (defaults apply). `live` is the normalised view.
 */
export function useLiveStoreSettings(): {
  raw: RawStoreSettings | null | undefined;
  live: StoreSettings | null;
} {
  const data = useQuery(api.content.getSiteSettings, { orgSlug: ORG_SLUG });
  if (data === undefined) return { raw: undefined, live: null };
  const raw = (data ?? null) as RawStoreSettings | null;
  return { raw, live: resolveStoreSettings(raw) };
}

/**
 * Draft state for one settings section. The draft starts from `baseline` (the
 * live values), tracks dirty state against it, and resets when the live values
 * change while the draft has no local edits. `save` sends only what the
 * section builds, so sections never overwrite each other's fields.
 */
export function useSettingsDraft<T>(baseline: T | null) {
  const baseKey = baseline === null ? '' : JSON.stringify(baseline);
  const [draft, setDraft] = useState<T | null>(baseline);
  const prevKey = useRef('');

  useEffect(() => {
    const prev = prevKey.current;
    prevKey.current = baseKey;
    if (baseKey === '') return;
    setDraft((d) => (d === null || JSON.stringify(d) === prev ? (JSON.parse(baseKey) as T) : d));
  }, [baseKey]);

  const dirty = draft !== null && baseKey !== '' && JSON.stringify(draft) !== baseKey;

  const update = useCallback((fn: (d: T) => T) => {
    setDraft((d) => (d === null ? d : fn(d)));
  }, []);

  const discard = useCallback(() => {
    if (baseKey !== '') setDraft(JSON.parse(baseKey) as T);
  }, [baseKey]);

  const mutate = useMutation(api.adminCatalog.saveSiteSettings);
  const feedback = useButtonFeedback();
  const runFeedback = feedback.run;

  // build() runs inside feedback.run, so a validation error it throws shows
  // inline like any other failure.
  const save = useCallback(
    (build: (d: T) => SectionSaveArgs) => {
      if (draft === null) return undefined;
      return runFeedback(async () => {
        await mutate({ orgSlug: ORG_SLUG, ...build(draft) });
      });
    },
    [draft, runFeedback, mutate],
  );

  return { draft, update, dirty, discard, save, feedback };
}
