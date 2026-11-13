import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import {
  Banner,
  Button,
  Card,
  CardSection,
  DataTable,
  Input,
  Label,
  Page,
  PageLayout,
  Skeleton,
  type Column,
} from '../../adminnew/ui';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { saErrorMessage } from '../session';
import { formatCount } from '../saUi';
import {
  importBlogPostsRef,
  importSeedRedirectsRef,
  importCategoriesRef,
  importHeroSlidesRef,
  importProductsRef,
  importSiteSettingsRef,
  listStoresRef,
} from '../refs';
import {
  batches,
  buildImportPlan,
  type DukaanNormalized,
  type ImageMap,
  type ImportPlan,
} from '../../lib/storeImport/dukaan';

// Super-admin import of a migrated Dukaan store. Runs entirely from the browser:
// the JSON files are read locally, transformed by the pure planner, and sent to
// convex/storeImport.ts in batches under the SA write window. Every mutation is
// idempotent, so re-running the import updates rows in place.

interface StepResult {
  entity: string;
  batches: number;
  summary: string;
}

type Notice = { tone: 'success' | 'critical'; text: string };

async function readJson<T>(file: File): Promise<T> {
  return JSON.parse(await file.text()) as T;
}

export function StoreImportPage() {
  const { orgId: orgParam } = useParams();
  const orgId = (orgParam ?? '') as Id<'organizations'>;
  const { token, writeOpen } = useSa();
  const stores = useQuery(listStoresRef, { saToken: token });
  const store = stores?.find((s) => s._id === orgId);

  const importCategories = useMutation(importCategoriesRef);
  const importProducts = useMutation(importProductsRef);
  const importHero = useMutation(importHeroSlidesRef);
  const importBlogs = useMutation(importBlogPostsRef);
  const importSettings = useMutation(importSiteSettingsRef);
  const importRedirects = useMutation(importSeedRedirectsRef);

  const [normalized, setNormalized] = useState<DukaanNormalized | null>(null);
  const [imageMap, setImageMap] = useState<ImageMap>({});
  const [activeTheme, setActiveTheme] = useState('vivid');
  const [fileName, setFileName] = useState('');
  const [mapName, setMapName] = useState('');
  const [redirectRows, setRedirectRows] = useState<{ from: string; to: string; status: 301 | 302 | 410 }[]>([]);
  const [redirectName, setRedirectName] = useState('');
  const [results, setResults] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const plan: ImportPlan | null = useMemo(() => {
    if (!normalized || !store) return null;
    return buildImportPlan(normalized, imageMap, { storeSlug: store.slug, activeTheme: activeTheme || undefined });
  }, [normalized, imageMap, store, activeTheme]);

  const onPickNormalized = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await readJson<DukaanNormalized>(file);
      if (data?.source?.platform !== 'dukaan' || !Array.isArray(data.products)) {
        throw new Error('This file is not a Dukaan normalized export.');
      }
      setNormalized(data);
      setFileName(file.name);
      setResults([]);
      setNotice({ tone: 'success', text: `Loaded ${file.name}.` });
    } catch (err) {
      setNormalized(null);
      setNotice({ tone: 'critical', text: err instanceof Error ? err.message : 'Could not read that file.' });
    }
  };

  // redirects.csv (from,to,status) from the Dukaan export. Plain CSV, no quoted fields.
  const onPickRedirects = async (file: File | undefined) => {
    if (!file) return;
    try {
      const lines = (await file.text()).trim().split(String.fromCharCode(10)).slice(1);
      const rows = lines
        .filter((l) => l.trim() !== '')
        .map((l) => {
          const [from = '', to = '', status = '301'] = l.split(',');
          const n = Number(status.trim());
          return { from: from.trim(), to: to.trim(), status: (n === 302 || n === 410 ? n : 301) as 301 | 302 | 410 };
        });
      setRedirectRows(rows);
      setRedirectName(file.name);
    } catch {
      setNotice({ tone: 'critical', text: 'Could not read the redirects file.' });
    }
  };

  const onPickMap = async (file: File | undefined) => {
    if (!file) return;
    try {
      setImageMap(await readJson<ImageMap>(file));
      setMapName(file.name);
    } catch {
      setNotice({ tone: 'critical', text: 'Could not read the image map file.' });
    }
  };

  const run = async () => {
    if (!plan || !store) return;
    setRunning(true);
    setResults([]);
    setNotice(null);
    const log: StepResult[] = [];
    const push = (r: StepResult) => {
      log.push(r);
      setResults([...log]);
    };
    try {
      let cats = { created: 0, updated: 0 };
      const catBatches = batches(plan.categories);
      for (const b of catBatches) {
        const r = await importCategories({ saToken: token, orgId, items: b });
        cats = { created: cats.created + r.created, updated: cats.updated + r.updated };
      }
      push({ entity: 'Categories', batches: catBatches.length, summary: `${cats.created} created, ${cats.updated} updated` });

      let prods = { created: 0, updated: 0 };
      let vars = { created: 0, updated: 0 };
      let links = 0;
      const prodBatches = batches(plan.products, 20);
      for (const b of prodBatches) {
        const r = await importProducts({ saToken: token, orgId, items: b });
        prods = { created: prods.created + r.products.created, updated: prods.updated + r.products.updated };
        vars = { created: vars.created + r.variants.created, updated: vars.updated + r.variants.updated };
        links += r.links;
      }
      push({
        entity: 'Products',
        batches: prodBatches.length,
        summary: `${prods.created} created, ${prods.updated} updated · variants ${vars.created} created, ${vars.updated} updated · category links ${links}`,
      });

      if (plan.heroSlides.length) {
        const r = await importHero({ saToken: token, orgId, items: plan.heroSlides });
        push({ entity: 'Hero slides', batches: 1, summary: `${r.created} created, ${r.replaced} replaced` });
      }

      let blogs = { created: 0, updated: 0 };
      const blogBatches = batches(plan.blogs, 25);
      for (const b of blogBatches) {
        const r = await importBlogs({ saToken: token, orgId, items: b });
        blogs = { created: blogs.created + r.created, updated: blogs.updated + r.updated };
      }
      push({ entity: 'Blog posts and static pages', batches: blogBatches.length, summary: `${blogs.created} created, ${blogs.updated} updated` });

      const s = await importSettings({ saToken: token, orgId, ...plan.settings });
      push({ entity: 'Site settings', batches: 1, summary: s.updated ? 'updated' : 'created' });

      if (redirectRows.length) {
        let imported = 0;
        let failed = 0;
        const redirectBatches = batches(redirectRows, 200);
        for (const b of redirectBatches) {
          const r = await importRedirects({ saToken: token, orgId, rows: b });
          imported += r.imported;
          failed += r.failed;
        }
        push({ entity: 'Redirects', batches: redirectBatches.length, summary: `${imported} imported, ${failed} failed (re-run is safe)` });
      }
      setNotice({ tone: 'success', text: `Import finished for "${store.slug}".` });
    } catch (err) {
      setNotice({
        tone: 'critical',
        text: `Import stopped: ${saErrorMessage(err)}. Re-run after fixing; completed rows are updated in place.`,
      });
    } finally {
      setRunning(false);
    }
  };

  const resultColumns: Column<StepResult>[] = [
    { id: 'step', header: 'Step', cell: (r) => r.entity },
    { id: 'batches', header: 'Batches', align: 'right', cell: (r) => <span className="tabular-nums">{r.batches}</span> },
    { id: 'outcome', header: 'Outcome', cell: (r) => <span className="text-[var(--admin-text-muted)]">{r.summary}</span> },
  ];

  if (!store && stores !== undefined) {
    return (
      <Page title="Import catalog" backTo="/sa/stores">
        <Card>
          <p className="text-sm text-[var(--admin-text-muted)]">This store was not found.</p>
          <Link to="/sa/stores" className="mt-2 inline-block text-sm font-medium text-[var(--admin-primary)] hover:underline">
            Back to stores
          </Link>
        </Card>
      </Page>
    );
  }

  const fileField = (id: string, label: string, accept: string, onPick: (f: File | undefined) => void, hint: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="file" accept={accept} disabled={running} onChange={(e) => onPick(e.target.files?.[0])} />
      <p className="text-xs text-[var(--admin-text-muted)]">{hint}</p>
    </div>
  );

  const planRows: [string, number][] = plan
    ? [
        ['Categories', plan.counts.categories],
        ['Products', plan.counts.products],
        ['Variants', plan.counts.variants],
        ['Images referenced', plan.counts.images],
        ['Blog posts', plan.counts.blogs],
        ['Static pages (drafts)', plan.counts.staticPages],
      ]
    : [];

  return (
    <Page
      title={store ? `Import into ${store.name}` : <Skeleton className="inline-block h-6 w-56 align-middle" />}
      backTo={`/sa/stores/${orgId}?tab=import`}
    >
      {!writeOpen && <Banner tone="warning">Write access is closed. Re-launch from Citadel to import.</Banner>}
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      <PageLayout
        main={
          <>
            <Card title="Source files">
              <CardSection>
                <div className="grid gap-5">
                  {fileField(
                    'import-normalized',
                    'Normalized export (normalized.json)',
                    'application/json,.json',
                    (f) => void onPickNormalized(f),
                    fileName || 'Produced by scripts/dukaan-import/crawl.mjs',
                  )}
                  {fileField(
                    'import-map',
                    'Image map (image-map.json, optional)',
                    'application/json,.json',
                    (f) => void onPickMap(f),
                    mapName ? `${mapName} · ${formatCount(Object.keys(imageMap).length)} entries` : 'Maps Dukaan image URLs to uploaded copies',
                  )}
                  {fileField(
                    'import-redirects',
                    'Redirects (redirects.csv, optional)',
                    '.csv,text/csv',
                    (f) => void onPickRedirects(f),
                    redirectName ? `${redirectName} · ${formatCount(redirectRows.length)} rows` : 'Columns: from, to, status',
                  )}
                  <div className="grid max-w-sm gap-1.5">
                    <Label htmlFor="import-theme">Theme to activate</Label>
                    <Input id="import-theme" value={activeTheme} disabled={running} onChange={(e) => setActiveTheme(e.target.value.trim())} />
                  </div>
                </div>
              </CardSection>
            </Card>
            {results.length > 0 && (
              <Card title="Results" padding="none">
                <DataTable columns={resultColumns} rows={results} getRowId={(r) => r.entity} />
              </Card>
            )}
          </>
        }
        aside={
          <>
            {!plan && (
              <Card title="Plan">
                <p className="text-[13px] text-[var(--admin-text-muted)]">Pick the export file. The counts of what will be imported show here before anything is written.</p>
              </Card>
            )}
            {plan && (
              <Card
                title="Plan"
                footer={
                  <Button variant="primary" onClick={() => void run()} disabled={running || !writeOpen} loading={running}>
                    {running ? 'Importing' : `Import into ${store?.slug ?? 'store'}`}
                  </Button>
                }
              >
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {planRows.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-medium text-[var(--admin-text-muted)]">{label}</dt>
                      <dd className="mt-1 text-xl font-semibold tabular-nums text-[var(--admin-text)]">{formatCount(value)}</dd>
                    </div>
                  ))}
                </dl>
                {plan.unmappedImages.length > 0 && (
                  <div className="mt-5">
                    <Banner tone="warning">
                      {formatCount(plan.unmappedImages.length)} image URLs have no uploaded copy and would still point at Dukaan. Upload images
                      first (scripts/dukaan-import/images.mjs) and attach the image map.
                    </Banner>
                  </div>
                )}
              </Card>
            )}

          </>
        }
      />
    </Page>
  );
}
