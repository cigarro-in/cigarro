import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  AdminCard,
  AdminCardContent,
  AdminCardHeader,
  AdminCardTitle,
} from '../components/shared/AdminCard';
import { supabase } from '../../lib/supabase/client';
import { invalidateStorefront } from '../../lib/cache/invalidateStorefront';
import { toast } from 'sonner';

/* ============================================================
   Sheet schema — one row per variant, rows sharing Name = one
   product. Every column that the database stores is included
   (images excluded by request).
   ============================================================ */

const PRODUCT_COLUMNS = [
  'Name',
  'Slug',
  'Brand',
  'Categories',
  'Collections',
  'Short Description',
  'Description',
  'Origin',
  'Is Active',
  'Is Featured',
  'Meta Title',
  'Meta Description',
  'Canonical URL',
  'Specifications',
] as const;

const VARIANT_COLUMNS = [
  'Variant Name',
  'Variant Type',
  'Price',
  'Compare At Price',
  'Cost Price',
  'Stock',
  'Is Default',
  'Is Variant Active',
  'Units Contained',
  'Unit',
  'Track Inventory',
  'Weight',
] as const;

interface SheetRow extends Record<string, unknown> {
  _row?: number;
}

interface RowError {
  row: number;
  reason: string;
}

interface Summary {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  skipped: number;
  errors: RowError[];
  warnings: string[];
}

const REQUIRED = ['Name', 'Variant Name', 'Price'] as const;

// ---------- helpers ----------

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function yes(v: unknown) {
  return String(v ?? '').trim().toLowerCase() === 'yes';
}

function toNumber(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

function toInt(v: unknown, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return isNaN(n) ? fallback : n;
}

function splitList(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseSpecs(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  String(v ?? '')
    .split(';')
    .forEach((entry) => {
      const [k, ...rest] = entry.split(':');
      const key = (k ?? '').trim();
      const val = rest.join(':').trim();
      if (key) out[key] = val;
    });
  return out;
}

function stringifySpecs(v: unknown): string {
  if (!v || typeof v !== 'object') return '';
  return Object.entries(v as Record<string, unknown>)
    .map(([k, val]) => `${k}:${val ?? ''}`)
    .join('; ');
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

// ---------- component ----------

interface Props {
  /** Optional callback so parent can refresh its product list after import */
  onAfterImport?: () => void;
}

export function ProductImportExport({ onAfterImport }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: c }, { data: col }] = await Promise.all([
        supabase.from('brands').select('id, name'),
        supabase.from('categories').select('id, name'),
        supabase.from('collections').select('id, name').then((res) => res).catch(() => ({ data: [] })),
      ]);
      setBrands(b || []);
      setCategories(c || []);
      setCollections((col as any) || []);
    })();
  }, []);

  const onPick = (f: File | null) => {
    setSummary(null);
    setRows(null);
    setFile(f);
  };

  const onParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const first = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(first, { defval: '' });
      const clean: SheetRow[] = raw.map((r, i) => {
        const out: any = {};
        for (const k of Object.keys(r)) out[k.replace(/\*/g, '').trim()] = r[k];
        out._row = i + 2;
        return out;
      });
      setRows(clean);
      toast.success(`${clean.length} row${clean.length === 1 ? '' : 's'} parsed`);
    } catch (err) {
      console.error(err);
      toast.error('Could not parse the file. Expected XLSX or CSV.');
    } finally {
      setParsing(false);
    }
  };

  const onDownloadTemplate = () => {
    const sample: SheetRow[] = [
      {
        Name: 'Marlboro Red',
        Slug: 'marlboro-red',
        Brand: 'Marlboro',
        Categories: 'Cigarettes',
        Collections: '',
        'Short Description': 'Full-flavoured classic',
        Description: 'Iconic full-flavour American blend.',
        Origin: 'USA',
        'Is Active': 'yes',
        'Is Featured': 'no',
        'Meta Title': 'Marlboro Red — Premium Cigarettes',
        'Meta Description': '',
        'Canonical URL': '',
        Specifications: 'Nicotine:1.0mg; Tar:10mg; Length:84mm',
        'Variant Name': 'Pack of 20',
        'Variant Type': 'pack',
        Price: 450,
        'Compare At Price': 500,
        'Cost Price': 320,
        Stock: 100,
        'Is Default': 'yes',
        'Is Variant Active': 'yes',
        'Units Contained': 20,
        Unit: 'sticks',
        'Track Inventory': 'yes',
        Weight: 25,
      },
      {
        Name: 'Marlboro Red',
        'Variant Name': 'Carton of 10',
        'Variant Type': 'carton',
        Price: 4200,
        'Compare At Price': 5000,
        Stock: 20,
        'Is Default': 'no',
        'Is Variant Active': 'yes',
        'Units Contained': 200,
        Unit: 'sticks',
        'Track Inventory': 'yes',
      },
    ];
    // Force column order by creating sheet with header row
    const header = [...PRODUCT_COLUMNS, ...VARIANT_COLUMNS];
    const ws = XLSX.utils.json_to_sheet(sample, { header: header as unknown as string[] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'cigarro-products-template.xlsx');
  };

  const onExport = async () => {
    setWorking(true);
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(
          `id, name, slug, description, short_description, origin, specifications,
           is_active, is_featured, meta_title, meta_description, canonical_url,
           brand:brands(name),
           categories:product_categories(category:categories(name)),
           collections:collection_products(collection:collections(name)),
           variants:product_variants(id, variant_name, variant_type, price, compare_at_price,
             cost_price, stock, is_default, is_active, units_contained, unit, track_inventory,
             weight)`
        )
        .order('name');
      if (error) throw error;

      const rows: SheetRow[] = [];
      for (const p of (products as any[]) || []) {
        const brand = Array.isArray(p.brand) ? p.brand[0]?.name : p.brand?.name;
        const categoryNames = (p.categories || [])
          .map((pc: any) =>
            Array.isArray(pc.category) ? pc.category[0]?.name : pc.category?.name
          )
          .filter(Boolean);
        const collectionNames = (p.collections || [])
          .map((pc: any) =>
            Array.isArray(pc.collection) ? pc.collection[0]?.name : pc.collection?.name
          )
          .filter(Boolean);
        const variants = p.variants || [];

        const productCols = {
          Name: p.name,
          Slug: p.slug,
          Brand: brand || '',
          Categories: categoryNames.join(', '),
          Collections: collectionNames.join(', '),
          'Short Description': p.short_description || '',
          Description: p.description || '',
          Origin: p.origin || '',
          'Is Active': p.is_active ? 'yes' : 'no',
          'Is Featured': p.is_featured ? 'yes' : 'no',
          'Meta Title': p.meta_title || '',
          'Meta Description': p.meta_description || '',
          'Canonical URL': p.canonical_url || '',
          Specifications: stringifySpecs(p.specifications),
        };

        if (variants.length === 0) {
          rows.push({
            ...productCols,
            'Variant Name': '',
            'Variant Type': '',
            Price: '',
          });
          continue;
        }

        variants.forEach((v: any, idx: number) => {
          const productPart = idx === 0
            ? productCols
            : ({
                Name: p.name,
                Slug: p.slug, // repeat slug on every row to aid lookup if user rearranges
              } as Partial<typeof productCols>);
          rows.push({
            ...productPart,
            'Variant Name': v.variant_name,
            'Variant Type': v.variant_type,
            Price: v.price,
            'Compare At Price': v.compare_at_price ?? '',
            'Cost Price': v.cost_price ?? '',
            Stock: v.stock,
            'Is Default': v.is_default ? 'yes' : 'no',
            'Is Variant Active': v.is_active === false ? 'no' : 'yes',
            'Units Contained': v.units_contained ?? '',
            Unit: v.unit ?? '',
            'Track Inventory': v.track_inventory ? 'yes' : 'no',
            Weight: v.weight ?? '',
          });
        });
      }

      const header = [...PRODUCT_COLUMNS, ...VARIANT_COLUMNS];
      const ws = XLSX.utils.json_to_sheet(rows, { header: header as unknown as string[] });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, `cigarro-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Export failed');
    } finally {
      setWorking(false);
    }
  };

  const resolveBrand = (name: unknown) => {
    const q = String(name ?? '').trim().toLowerCase();
    if (!q) return null;
    return brands.find((b) => b.name.toLowerCase() === q) || null;
  };
  const resolveCategories = (namesCsv: unknown) => {
    return splitList(namesCsv)
      .map((n) => categories.find((c) => c.name.toLowerCase() === n.toLowerCase()))
      .filter((x): x is { id: string; name: string } => !!x);
  };
  const resolveCollections = (namesCsv: unknown) => {
    return splitList(namesCsv)
      .map((n) => collections.find((c) => c.name.toLowerCase() === n.toLowerCase()))
      .filter((x): x is { id: string; name: string } => !!x);
  };

  const onImport = async () => {
    if (!rows || rows.length === 0) return;
    setWorking(true);
    setProgress(0);
    const result: Summary = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Group by Name
      const groups = new Map<string, SheetRow[]>();
      for (const r of rows) {
        const name = String(r.Name ?? '').trim();
        if (!name) {
          result.errors.push({ row: (r._row as number) || 0, reason: 'Missing Name' });
          continue;
        }
        for (const f of REQUIRED) {
          if (!String(r[f] ?? '').trim()) {
            result.errors.push({
              row: (r._row as number) || 0,
              reason: `Missing required column "${f}"`,
            });
          }
        }
        const g = groups.get(name) || [];
        g.push(r);
        groups.set(name, g);
      }

      if (result.errors.length > 0) {
        setSummary(result);
        return;
      }

      const entries = Array.from(groups.entries());
      for (let i = 0; i < entries.length; i++) {
        const [name, productRows] = entries[i];
        const head = productRows[0];

        const brand = resolveBrand(head.Brand);
        if (head.Brand && !brand) {
          result.warnings.push(`"${name}": brand "${head.Brand}" not found`);
        }

        const explicitSlug = String(head.Slug ?? '').trim();
        const slug = explicitSlug || slugify(name);

        // ---------- DEDUPE: look up existing product by slug ----------
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        const productPayload: any = {
          name,
          slug,
          brand_id: brand?.id || null,
          brand: brand?.name || str(head.Brand) || null,
          description: str(head.Description),
          short_description: str(head['Short Description']),
          origin: str(head.Origin),
          specifications: parseSpecs(head.Specifications),
          is_active:
            head['Is Active'] === undefined || head['Is Active'] === ''
              ? true
              : yes(head['Is Active']),
          is_featured: yes(head['Is Featured']),
          meta_title: str(head['Meta Title']),
          meta_description: str(head['Meta Description']),
          canonical_url: str(head['Canonical URL']),
          price: toNumber(head.Price, 0),
        };

        let productId: string | null = null;

        if (existing?.id) {
          const { error: upErr } = await supabase
            .from('products')
            .update(productPayload)
            .eq('id', existing.id);
          if (upErr) {
            result.errors.push({
              row: (head._row as number) || 0,
              reason: `Update "${name}": ${upErr.message}`,
            });
            result.skipped += 1;
            setProgress(Math.round(((i + 1) / entries.length) * 100));
            continue;
          }
          productId = existing.id;
          result.productsUpdated += 1;
        } else {
          const { data: created, error: insErr } = await supabase
            .from('products')
            .insert(productPayload)
            .select('id')
            .single();
          if (insErr || !created) {
            result.errors.push({
              row: (head._row as number) || 0,
              reason: `Insert "${name}": ${insErr?.message || 'failed'}`,
            });
            result.skipped += 1;
            setProgress(Math.round(((i + 1) / entries.length) * 100));
            continue;
          }
          productId = created.id;
          result.productsCreated += 1;
        }

        if (!productId) continue;

        // ---------- Category & Collection links (replace set) ----------
        const cats = resolveCategories(head.Categories);
        const missingCats = splitList(head.Categories).filter(
          (n) => !cats.some((c) => c.name.toLowerCase() === n.toLowerCase())
        );
        for (const miss of missingCats) {
          result.warnings.push(`"${name}": category "${miss}" not found`);
        }
        await supabase.from('product_categories').delete().eq('product_id', productId);
        if (cats.length > 0) {
          await supabase.from('product_categories').insert(
            cats.map((c) => ({ product_id: productId, category_id: c.id }))
          );
        }

        const cols = resolveCollections(head.Collections);
        const missingCols = splitList(head.Collections).filter(
          (n) => !cols.some((c) => c.name.toLowerCase() === n.toLowerCase())
        );
        for (const miss of missingCols) {
          result.warnings.push(`"${name}": collection "${miss}" not found`);
        }
        await supabase.from('collection_products').delete().eq('product_id', productId).catch(() => {});
        if (cols.length > 0) {
          await supabase.from('collection_products').insert(
            cols.map((c) => ({ product_id: productId, collection_id: c.id }))
          ).catch(() => {});
        }

        // ---------- Variants (match by variant_name within product) ----------
        const { data: existingVariants } = await supabase
          .from('product_variants')
          .select('id, variant_name')
          .eq('product_id', productId);
        const variantByName = new Map<string, string>();
        (existingVariants || []).forEach((v) => variantByName.set(v.variant_name, v.id));

        const hasDefault = productRows.some((r) => yes(r['Is Default']));
        for (let v = 0; v < productRows.length; v++) {
          const r = productRows[v];
          const variantName = String(r['Variant Name']);
          const payload: any = {
            variant_name: variantName,
            variant_type: str(r['Variant Type']) || 'pack',
            price: toNumber(r.Price, 0),
            compare_at_price: toNumber(r['Compare At Price']),
            cost_price: toNumber(r['Cost Price']),
            stock: toInt(r.Stock, 0),
            is_default: hasDefault ? yes(r['Is Default']) : v === 0,
            is_active: r['Is Variant Active'] === '' || r['Is Variant Active'] === undefined
              ? true
              : yes(r['Is Variant Active']),
            units_contained: toInt(r['Units Contained']) || null,
            unit: str(r.Unit) || null,
            track_inventory: yes(r['Track Inventory']),
            weight: toNumber(r.Weight),
          };

          const existingVariantId = variantByName.get(variantName);
          if (existingVariantId) {
            const { error: vErr } = await supabase
              .from('product_variants')
              .update(payload)
              .eq('id', existingVariantId);
            if (vErr) {
              result.errors.push({
                row: (r._row as number) || 0,
                reason: `Variant "${variantName}": ${vErr.message}`,
              });
            } else {
              result.variantsUpdated += 1;
            }
          } else {
            const { error: vErr } = await supabase
              .from('product_variants')
              .insert({ product_id: productId, ...payload });
            if (vErr) {
              result.errors.push({
                row: (r._row as number) || 0,
                reason: `Variant "${variantName}": ${vErr.message}`,
              });
            } else {
              result.variantsCreated += 1;
            }
          }
        }

        setProgress(Math.round(((i + 1) / entries.length) * 100));
      }

      setSummary(result);
      if (result.productsCreated > 0 || result.productsUpdated > 0) {
        await invalidateStorefront();
        onAfterImport?.();
      }
      toast.success(
        `${result.productsCreated + result.productsUpdated} product${
          result.productsCreated + result.productsUpdated === 1 ? '' : 's'
        } processed (${result.productsCreated} new, ${result.productsUpdated} updated)`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Import failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle className="flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            Export
          </AdminCardTitle>
        </AdminCardHeader>
        <AdminCardContent className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-[var(--color-dark)]/70 max-w-xl">
            Download your full catalog (products, variants, categories, collections, specs) as XLSX.
            Images are not exported — manage those through the Assets library.
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" onClick={onDownloadTemplate} disabled={working}>
              <Download className="w-4 h-4 mr-2" />
              Blank template
            </Button>
            <Button onClick={onExport} disabled={working}>
              {working ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Export catalog
            </Button>
          </div>
        </AdminCardContent>
      </AdminCard>

      {/* Import */}
      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Import
          </AdminCardTitle>
        </AdminCardHeader>
        <AdminCardContent className="space-y-4">
          <div className="flex items-start gap-2 text-xs text-[var(--color-dark)]/70 bg-[var(--color-creme-light)] border border-[var(--color-coyote)]/20 rounded-lg p-3">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              The import <strong>dedupes by Slug</strong>: rows that match an existing product
              update it (product + variants + categories + collections); new rows create new
              products. You can export → edit → re-upload the same file safely.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working}>
              Choose file…
            </Button>
            {file && (
              <span className="text-sm text-[var(--color-dark)]/70 flex items-center gap-2">
                {file.name}
                <button
                  onClick={() => onPick(null)}
                  className="text-[var(--color-dark)]/50 hover:text-red-500"
                  aria-label="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            <Button onClick={onParse} disabled={!file || parsing || working}>
              {parsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Preview
            </Button>
            {rows && (
              <Button
                onClick={onImport}
                disabled={working}
                className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
              >
                {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Import {rows.length} row{rows.length === 1 ? '' : 's'}
              </Button>
            )}
          </div>

          {working && (
            <div>
              <div className="h-1.5 rounded-full bg-[var(--color-coyote)]/30 overflow-hidden">
                <div
                  className="h-full bg-[var(--color-canyon)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--color-dark)]/60 mt-2">{progress}%</p>
            </div>
          )}

          {rows && rows.length > 0 && !summary && (
            <div className="overflow-x-auto border border-[var(--color-coyote)]/30 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-creme)]">
                  <tr>
                    {['Row', 'Name', 'Variant', 'Price', 'Brand', 'Categories'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--color-dark)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 40).map((r, idx) => (
                    <tr key={idx} className="border-t border-[var(--color-coyote)]/20">
                      <td className="px-3 py-2 text-[var(--color-dark)]/60">{String(r._row ?? '')}</td>
                      <td className="px-3 py-2 font-medium">{String(r.Name ?? '')}</td>
                      <td className="px-3 py-2">{String(r['Variant Name'] ?? '')}</td>
                      <td className="px-3 py-2">{String(r.Price ?? '')}</td>
                      <td className="px-3 py-2">{String(r.Brand ?? '')}</td>
                      <td className="px-3 py-2">{String(r.Categories ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 40 && (
                <p className="text-xs text-[var(--color-dark)]/60 p-3 border-t border-[var(--color-coyote)]/20">
                  …and {rows.length - 40} more. All rows will be imported.
                </p>
              )}
            </div>
          )}

          {summary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-dark)]">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-semibold">
                  {summary.productsCreated} new · {summary.productsUpdated} updated · {summary.variantsCreated + summary.variantsUpdated} variants
                  {summary.skipped > 0 && ` · ${summary.skipped} skipped`}
                </span>
              </div>
              {summary.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">Warnings</p>
                  {summary.warnings.slice(0, 20).map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                  {summary.warnings.length > 20 && <p>…and {summary.warnings.length - 20} more</p>}
                </div>
              )}
              {summary.errors.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Errors
                  </p>
                  {summary.errors.slice(0, 30).map((e, i) => (
                    <p key={i}>
                      Row {e.row}: {e.reason}
                    </p>
                  ))}
                  {summary.errors.length > 30 && <p>…and {summary.errors.length - 30} more</p>}
                </div>
              )}
            </div>
          )}
        </AdminCardContent>
      </AdminCard>
    </div>
  );
}
