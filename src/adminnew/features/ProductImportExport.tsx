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
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../components/shared/PageHeader';
import {
  AdminCard,
  AdminCardContent,
  AdminCardDescription,
  AdminCardHeader,
  AdminCardTitle,
} from '../components/shared/AdminCard';
import { supabase } from '../../lib/supabase/client';
import { invalidateStorefront } from '../../lib/cache/invalidateStorefront';
import { toast } from 'sonner';

/* ------------------------------------------------------------------------
   Sheet schema
   ------------------------------------------------------------------------
   Each row = one variant. Rows that share a "Name" become a single product
   with multiple variants. The first row of a group supplies product-level
   metadata (description, brand, category).

   Columns (bold = required, rest optional):
     Name*              product display name
     Slug               auto-derived from Name if blank
     Brand              name; matched case-insensitive to brands.name
     Category           name; matched case-insensitive to categories.name
     Short Description
     Description
     Origin
     Is Active          "yes"/"no" (default yes)
     Is Featured        "yes"/"no"
     Meta Title
     Meta Description
     Variant Name*      e.g. "Pack of 20"
     Variant Type       pack | carton | box | bundle (default pack)
     Price*             numeric
     Compare At Price   numeric (shows strikethrough)
     Stock              integer (default 0)
     Is Default         "yes"/"no" (first-seen variant becomes default if none)
     Images             comma-separated URLs (applied to the variant)
   ------------------------------------------------------------------------ */

interface SheetRow {
  Name?: string;
  Slug?: string;
  Brand?: string;
  Category?: string;
  'Short Description'?: string;
  Description?: string;
  Origin?: string;
  'Is Active'?: string;
  'Is Featured'?: string;
  'Meta Title'?: string;
  'Meta Description'?: string;
  'Variant Name'?: string;
  'Variant Type'?: string;
  Price?: string | number;
  'Compare At Price'?: string | number;
  Stock?: string | number;
  'Is Default'?: string;
  Images?: string;
  _row?: number;
}

interface RowError {
  row: number;
  reason: string;
}

interface Summary {
  productsCreated: number;
  variantsCreated: number;
  skipped: number;
  errors: RowError[];
  warnings: string[];
}

const REQUIRED = ['Name', 'Variant Name', 'Price'] as const;

const TEMPLATE_ROWS: SheetRow[] = [
  {
    Name: 'Marlboro Red',
    Slug: '',
    Brand: 'Marlboro',
    Category: 'Cigarettes',
    'Short Description': 'Full-flavoured classic',
    Description: 'Iconic full-flavour blend.',
    Origin: 'USA',
    'Is Active': 'yes',
    'Is Featured': 'no',
    'Meta Title': '',
    'Meta Description': '',
    'Variant Name': 'Pack of 20',
    'Variant Type': 'pack',
    Price: 450,
    'Compare At Price': 500,
    Stock: 100,
    'Is Default': 'yes',
    Images: 'https://example.com/marlboro-pack.jpg',
  },
  {
    Name: 'Marlboro Red',
    Brand: 'Marlboro',
    'Variant Name': 'Carton of 10',
    'Variant Type': 'carton',
    Price: 4200,
    'Compare At Price': 5000,
    Stock: 20,
    'Is Default': 'no',
    Images: '',
  },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function yes(v?: string) {
  return String(v || '').trim().toLowerCase() === 'yes';
}

function toNumber(v: unknown, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

function toInt(v: unknown, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return isNaN(n) ? fallback : n;
}

function splitList(s?: string) {
  return (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function ProductImportExport() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [brands, setBrands] = useState<Array<{ id: string; name: string; slug?: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug?: string }>>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: c }] = await Promise.all([
        supabase.from('brands').select('id, name, slug'),
        supabase.from('categories').select('id, name, slug'),
      ]);
      setBrands(b || []);
      setCategories(c || []);
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
      // Strip decorative * from column names, keep as plain strings
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
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'cigarro-products-template.xlsx');
  };

  const onExport = async () => {
    setWorking(true);
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id, name, slug, description, short_description, origin,
          is_active, is_featured, meta_title, meta_description,
          brand:brands(name),
          categories:product_categories(category:categories(name)),
          variants:product_variants(id, variant_name, variant_type, price, compare_at_price, stock, is_default, is_active, images)
        `)
        .order('name');
      if (error) throw error;

      const rows: SheetRow[] = [];
      for (const p of (products as any[]) || []) {
        const brand = Array.isArray(p.brand) ? p.brand[0]?.name : p.brand?.name;
        const catName = (p.categories || [])
          .map((pc: any) =>
            Array.isArray(pc.category) ? pc.category[0]?.name : pc.category?.name
          )
          .filter(Boolean)[0];
        const variants = (p.variants || []).filter((v: any) => v.is_active !== false);
        if (variants.length === 0) {
          rows.push({
            Name: p.name,
            Slug: p.slug,
            Brand: brand,
            Category: catName,
            'Short Description': p.short_description,
            Description: p.description,
            Origin: p.origin,
            'Is Active': p.is_active ? 'yes' : 'no',
            'Is Featured': p.is_featured ? 'yes' : 'no',
            'Meta Title': p.meta_title,
            'Meta Description': p.meta_description,
          });
          continue;
        }
        variants.forEach((v: any, idx: number) => {
          rows.push({
            Name: p.name,
            Slug: idx === 0 ? p.slug : '',
            Brand: brand,
            Category: idx === 0 ? catName : '',
            'Short Description': idx === 0 ? p.short_description : '',
            Description: idx === 0 ? p.description : '',
            Origin: idx === 0 ? p.origin : '',
            'Is Active': idx === 0 ? (p.is_active ? 'yes' : 'no') : '',
            'Is Featured': idx === 0 ? (p.is_featured ? 'yes' : 'no') : '',
            'Meta Title': idx === 0 ? p.meta_title : '',
            'Meta Description': idx === 0 ? p.meta_description : '',
            'Variant Name': v.variant_name,
            'Variant Type': v.variant_type,
            Price: v.price,
            'Compare At Price': v.compare_at_price,
            Stock: v.stock,
            'Is Default': v.is_default ? 'yes' : 'no',
            Images: (v.images || []).join(', '),
          });
        });
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, `cigarro-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Exported ${rows.length} rows`);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setWorking(false);
    }
  };

  const resolveBrand = (name?: string) => {
    if (!name) return null;
    const q = name.trim().toLowerCase();
    return brands.find((b) => b.name.toLowerCase() === q) || null;
  };
  const resolveCategory = (name?: string) => {
    if (!name) return null;
    const q = name.trim().toLowerCase();
    return categories.find((c) => c.name.toLowerCase() === q) || null;
  };

  const allocateSlug = async (base: string, used: Set<string>): Promise<string> => {
    let candidate = base || 'product';
    let n = 1;
    // Check in-session set first, then DB
    while (true) {
      if (!used.has(candidate)) {
        const { data } = await supabase
          .from('products')
          .select('slug')
          .eq('slug', candidate)
          .maybeSingle();
        if (!data) {
          used.add(candidate);
          return candidate;
        }
      }
      n += 1;
      candidate = `${base}-${n}`;
      if (n > 50) throw new Error(`Could not allocate unique slug from "${base}"`);
    }
  };

  const onImport = async () => {
    if (!rows || rows.length === 0) return;
    setWorking(true);
    setProgress(0);
    const result: Summary = {
      productsCreated: 0,
      variantsCreated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };
    const usedSlugs = new Set<string>();

    try {
      // Validate + group rows by Name
      const groups = new Map<string, SheetRow[]>();
      for (const r of rows) {
        const name = String(r.Name || '').trim();
        if (!name) {
          result.errors.push({ row: r._row || 0, reason: 'Missing Name' });
          continue;
        }
        for (const field of REQUIRED) {
          if (!String((r as any)[field] || '').trim()) {
            result.errors.push({
              row: r._row || 0,
              reason: `Missing required column "${field}"`,
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
          result.warnings.push(`"${name}": brand "${head.Brand}" not found — skipped brand link`);
        }

        const slug = await allocateSlug(String(head.Slug || slugify(name)), usedSlugs);

        const productPayload: any = {
          name,
          slug,
          brand_id: brand?.id || null,
          brand: brand?.name || head.Brand || null, // legacy column
          description: String(head.Description || ''),
          short_description: String(head['Short Description'] || ''),
          origin: String(head.Origin || ''),
          is_active: head['Is Active'] === undefined ? true : yes(head['Is Active']),
          is_featured: yes(head['Is Featured']),
          meta_title: String(head['Meta Title'] || ''),
          meta_description: String(head['Meta Description'] || ''),
          // legacy price column — use first variant's price so schema stays happy
          price: toNumber(head.Price),
        };

        const { data: created, error: insErr } = await supabase
          .from('products')
          .insert(productPayload)
          .select('id')
          .single();

        if (insErr || !created) {
          result.errors.push({
            row: head._row || 0,
            reason: `Product "${name}": ${insErr?.message || 'insert failed'}`,
          });
          result.skipped += 1;
          setProgress(Math.round(((i + 1) / entries.length) * 100));
          continue;
        }

        result.productsCreated += 1;
        const productId = created.id;

        // Category link (first row only)
        const category = resolveCategory(head.Category);
        if (head.Category && !category) {
          result.warnings.push(`"${name}": category "${head.Category}" not found`);
        }
        if (category) {
          await supabase
            .from('product_categories')
            .insert({ product_id: productId, category_id: category.id });
        }

        // Variants
        const hasDefault = productRows.some((r) => yes(r['Is Default']));
        for (let v = 0; v < productRows.length; v++) {
          const r = productRows[v];
          const variantPayload: any = {
            product_id: productId,
            variant_name: String(r['Variant Name']),
            variant_type: String(r['Variant Type'] || 'pack'),
            price: toNumber(r.Price),
            compare_at_price: r['Compare At Price'] ? toNumber(r['Compare At Price']) : null,
            stock: toInt(r.Stock, 0),
            is_default: hasDefault ? yes(r['Is Default']) : v === 0,
            is_active: true,
            images: splitList(r.Images),
          };
          const { error: vErr } = await supabase.from('product_variants').insert(variantPayload);
          if (vErr) {
            result.errors.push({
              row: r._row || 0,
              reason: `Variant "${r['Variant Name']}" for "${name}": ${vErr.message}`,
            });
          } else {
            result.variantsCreated += 1;
          }
        }

        setProgress(Math.round(((i + 1) / entries.length) * 100));
      }

      setSummary(result);
      if (result.productsCreated > 0) await invalidateStorefront();
      toast.success(
        `Imported ${result.productsCreated} product${
          result.productsCreated === 1 ? '' : 's'
        }, ${result.variantsCreated} variant${result.variantsCreated === 1 ? '' : 's'}`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Products · Import / Export"
        description="Bulk upload a catalog or export your current one."
      >
        <Button variant="outline" onClick={onDownloadTemplate} disabled={working}>
          <Download className="w-4 h-4 mr-2" />
          Template
        </Button>
        <Button variant="outline" onClick={onExport} disabled={working}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export current
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Bulk import
            </AdminCardTitle>
            <AdminCardDescription>
              Upload an XLSX or CSV. Each row is one variant; rows that share a "Name"
              become a single product. Download the template for the exact column set.
            </AdminCardDescription>
          </AdminCardHeader>

          <AdminCardContent className="space-y-5">
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
                      {['Row', 'Name', 'Variant', 'Price', 'Brand', 'Category'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--color-dark)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 40).map((r, idx) => (
                      <tr key={idx} className="border-t border-[var(--color-coyote)]/20">
                        <td className="px-3 py-2 text-[var(--color-dark)]/60">{r._row}</td>
                        <td className="px-3 py-2 font-medium">{r.Name}</td>
                        <td className="px-3 py-2">{r['Variant Name']}</td>
                        <td className="px-3 py-2">{r.Price}</td>
                        <td className="px-3 py-2">{r.Brand}</td>
                        <td className="px-3 py-2">{r.Category}</td>
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
                    {summary.productsCreated} product{summary.productsCreated === 1 ? '' : 's'} created · {summary.variantsCreated}{' '}
                    variant{summary.variantsCreated === 1 ? '' : 's'}
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
    </div>
  );
}
