import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { saErrorMessage } from '../session';
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
  const status = useInlineStatus();

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
      status.setOk(`Loaded ${file.name}.`);
    } catch (err) {
      setNormalized(null);
      status.setError(err instanceof Error ? err.message : 'Could not read that file.');
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
      status.setError('Could not read the redirects file.');
    }
  };

  const onPickMap = async (file: File | undefined) => {
    if (!file) return;
    try {
      setImageMap(await readJson<ImageMap>(file));
      setMapName(file.name);
    } catch {
      status.setError('Could not read the image map file.');
    }
  };

  const run = async () => {
    if (!plan || !store) return;
    setRunning(true);
    setResults([]);
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
      status.setOk(`Import finished for "${store.slug}".`);
    } catch (err) {
      status.setError(`Import stopped: ${saErrorMessage(err)}. Re-run after fixing; completed rows are updated in place.`);
    } finally {
      setRunning(false);
    }
  };

  if (!store && stores !== undefined) {
    return <p className="p-6 text-sm">Store not found. <Link to="/sa/stores">Back to stores</Link></p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link to={`/sa/stores/${orgId}`} className="text-sm underline">← {store?.name ?? 'Store'}</Link>
        <h1 className="mt-2 text-xl font-semibold">Import catalog from Dukaan</h1>
        <p className="text-sm text-muted-foreground">
          Upload the normalized export produced by <code>scripts/dukaan-import/crawl.mjs</code>. Re-running is safe: rows are matched by their source IDs.
        </p>
      </div>

      {!writeOpen && (
        <p className="text-sm text-amber-700">Write access is closed. Re-launch from Citadel to import.</p>
      )}

      <section className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="import-normalized">Normalized export (normalized.json)</Label>
          <Input id="import-normalized" type="file" accept="application/json,.json" onChange={(e) => void onPickNormalized(e.target.files?.[0])} />
          {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="import-map">Image map (image-map.json, optional)</Label>
          <Input id="import-map" type="file" accept="application/json,.json" onChange={(e) => void onPickMap(e.target.files?.[0])} />
          {mapName && <p className="text-xs text-muted-foreground">{mapName} · {Object.keys(imageMap).length} entries</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="import-redirects">Redirects (redirects.csv, optional)</Label>
          <Input id="import-redirects" type="file" accept=".csv,text/csv" onChange={(e) => void onPickRedirects(e.target.files?.[0])} />
          {redirectName && <p className="text-xs text-muted-foreground">{redirectName} · {redirectRows.length} rows</p>}
        </div>
        <div className="grid gap-2 max-w-sm">
          <Label htmlFor="import-theme">Theme id to activate</Label>
          <Input id="import-theme" value={activeTheme} onChange={(e) => setActiveTheme(e.target.value.trim())} />
        </div>
      </section>

      {plan && (
        <section className="space-y-3">
          <h2 className="font-medium">Plan</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell>Categories</TableCell><TableCell>{plan.counts.categories}</TableCell></TableRow>
              <TableRow><TableCell>Products</TableCell><TableCell>{plan.counts.products}</TableCell></TableRow>
              <TableRow><TableCell>Variants</TableCell><TableCell>{plan.counts.variants}</TableCell></TableRow>
              <TableRow><TableCell>Images referenced</TableCell><TableCell>{plan.counts.images}</TableCell></TableRow>
              <TableRow><TableCell>Blog posts</TableCell><TableCell>{plan.counts.blogs}</TableCell></TableRow>
              <TableRow><TableCell>Static pages (drafts)</TableCell><TableCell>{plan.counts.staticPages}</TableCell></TableRow>
            </TableBody>
          </Table>
          {plan.unmappedImages.length > 0 && (
            <p className="text-sm text-amber-700">
              {plan.unmappedImages.length} image URLs have no uploaded copy and would still point at Dukaan. Upload images first (scripts/dukaan-import/images.mjs) and attach the image map.
            </p>
          )}
          <Button onClick={() => void run()} disabled={running || !writeOpen}>
            {running ? 'Importing…' : `Import into ${store?.slug ?? 'store'}`}
          </Button>
        </section>
      )}

      {results.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Results</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.entity}>
                  <TableCell>{r.entity}</TableCell>
                  <TableCell>{r.batches}</TableCell>
                  <TableCell>{r.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <InlineStatus status={status.status} />
    </div>
  );
}
