import { useMemo, useState } from 'react';
import { useConvex, useMutation, usePaginatedQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import type { PaginationOptions, PaginationResult } from 'convex/server';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { ORG_SLUG } from '../../lib/convex/org';
import { InlineStatus, useInlineStatus, type InlineStatusState } from '../../components/common/InlineStatus';
import { PageHeader } from '../components/shared/PageHeader';

// Typed references, not `api.redirects.*`: convex/_generated has no redirects
// module until `npx convex dev` runs codegen. Paths must match convex/redirects.ts.
type Status = 301 | 302 | 410;
type Source = 'manual' | 'import' | 'slug_change';

interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  status: Status;
  source: Source;
  hits: number;
  lastHitAt: number | null;
  updatedAt: number;
}

interface ImportResult {
  index: number;
  ok: boolean;
  fromPath?: string;
  toPath?: string;
  status?: Status;
  error?: string;
}

const listRef = makeFunctionReference<
  'query',
  { orgSlug: string; search?: string; paginationOpts: PaginationOptions },
  PaginationResult<RedirectRow>
>('redirects:list');
const upsertRef = makeFunctionReference<
  'mutation',
  { orgSlug: string; id?: string; fromPath: string; toPath: string; status?: string },
  { fromPath: string; toPath: string; status: Status }
>('redirects:upsert');
const removeRef = makeFunctionReference<
  'mutation',
  { orgSlug: string; id: string },
  { deleted: boolean }
>('redirects:remove');
const importRef = makeFunctionReference<
  'mutation',
  { orgSlug: string; rows: { from: string; to?: string; status?: string }[] },
  { results: ImportResult[]; imported: number; failed: number }
>('redirects:bulkImport');
const exportRef = makeFunctionReference<
  'query',
  { orgSlug: string },
  RedirectRow[]
>('redirects:exportAll');

const MAX_IMPORT_CHUNK = 2000;

const ERROR_TEXT: Record<string, string> = {
  PATH_IS_LIVE: 'This path is a live page. Redirects cannot shadow live pages.',
  REDIRECT_LOOP: 'This redirect would create a loop.',
  REDIRECT_CHAIN_TOO_LONG: 'The redirect chain is too long.',
  INVALID_FROM: 'The from path is invalid.',
  INVALID_TO: 'The target must be a path or an https URL.',
  INVALID_STATUS: 'Status must be 301, 302 or 410.',
  NOT_ORG_ADMIN: 'Admin access required.',
  NOT_FOUND: 'That redirect no longer exists.',
};

function errorMessage(error: any, fallback: string): string {
  const code = error?.data?.code;
  if (code && ERROR_TEXT[code]) return ERROR_TEXT[code];
  if (typeof error?.data?.message === 'string') return error.data.message;
  return fallback;
}

// Minimal RFC 4180 parser: quoted fields, "" escapes, CRLF or LF.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Accepts a header row (from,to,status) and drops it when present.
function csvToImportRows(text: string) {
  const rows = parseCsv(text);
  const body =
    rows.length && rows[0][0]?.trim().toLowerCase() === 'from' ? rows.slice(1) : rows;
  return body.map((r) => ({
    from: (r[0] ?? '').trim(),
    to: (r[1] ?? '').trim(),
    status: (r[2] ?? '').trim(),
  }));
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatDate(ms: number | null): string {
  return ms ? new Date(ms).toLocaleDateString() : '—';
}

export function RedirectsPage() {
  const convex = useConvex();
  const [search, setSearch] = useState('');
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

  const {
    results,
    status: pageStatus,
    loadMore,
  } = usePaginatedQuery(listRef, { orgSlug: ORG_SLUG, search: search.trim() || undefined }, { initialNumItems: 50 });
  const upsert = useMutation(upsertRef);
  const remove = useMutation(removeRef);
  const importRows = useMutation(importRef);

  const [editing, setEditing] = useState<null | { id?: string; fromPath: string; toPath: string; status: Status }>(null);
  const [editStatus, setEditStatus] = useState<InlineStatusState>({ kind: null, message: '' });
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importStatus, setImportStatus] = useState<InlineStatusState>({ kind: null, message: '' });

  const parsedCount = useMemo(() => csvToImportRows(importText).length, [importText]);
  const loading = pageStatus === 'LoadingFirstPage';

  const openNew = () => {
    setEditStatus({ kind: null, message: '' });
    setEditing({ fromPath: '', toPath: '', status: 301 });
  };

  const openEdit = (row: RedirectRow) => {
    setEditStatus({ kind: null, message: '' });
    setEditing({ id: row.id, fromPath: row.fromPath, toPath: row.toPath, status: row.status });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setEditStatus({ kind: null, message: '' });
    try {
      await upsert({
        orgSlug: ORG_SLUG,
        id: editing.id,
        fromPath: editing.fromPath,
        toPath: editing.status === 410 ? '' : editing.toPath,
        status: String(editing.status),
      });
      setEditing(null);
      setOpOk('Redirect saved.');
    } catch (error: any) {
      setEditStatus({ kind: 'error', message: errorMessage(error, 'Could not save the redirect.') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: RedirectRow) => {
    if (!confirm(`Delete the redirect from ${row.fromPath}?`)) return;
    try {
      await remove({ orgSlug: ORG_SLUG, id: row.id });
      setOpOk(`Deleted ${row.fromPath}.`);
    } catch (error: any) {
      setOpError(errorMessage(error, 'Could not delete the redirect.'));
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setImportText(await file.text());
    setImportResults(null);
  };

  const runImport = async () => {
    const rows = csvToImportRows(importText);
    if (!rows.length) {
      setImportStatus({ kind: 'error', message: 'Nothing to import. Paste CSV rows or choose a file.' });
      return;
    }
    setImporting(true);
    setImportStatus({ kind: null, message: '' });
    const all: ImportResult[] = [];
    try {
      for (let start = 0; start < rows.length; start += MAX_IMPORT_CHUNK) {
        const chunk = rows.slice(start, start + MAX_IMPORT_CHUNK);
        const res = await importRows({ orgSlug: ORG_SLUG, rows: chunk });
        for (const r of res.results) all.push({ ...r, index: r.index + start });
      }
      setImportResults(all);
      const ok = all.filter((r) => r.ok).length;
      setImportStatus({ kind: 'ok', message: `Imported ${ok} of ${all.length} rows.` });
    } catch (error: any) {
      setImportStatus({ kind: 'error', message: errorMessage(error, 'Import failed. Nothing was saved.') });
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = async () => {
    try {
      const rows = await convex.query(exportRef, { orgSlug: ORG_SLUG });
      const lines = [['from', 'to', 'status'].join(',')];
      for (const r of rows) lines.push([r.fromPath, r.toPath, r.status].map(csvCell).join(','));
      const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redirects-${ORG_SLUG}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setOpOk(`Exported ${rows.length} redirects.`);
    } catch (error: any) {
      setOpError(errorMessage(error, 'Export failed.'));
    }
  };

  const rows = (results ?? []) as RedirectRow[];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Redirects"
        description="301/302/410 redirects for migrated or renamed URLs"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Filter by from path prefix, e.g. /product/',
        }}
      >
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setImportResults(null);
            setImportStatus({ kind: null, message: '' });
            setImportOpen(true);
          }}
        >
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add redirect
        </Button>
      </PageHeader>

      <div className="mx-auto flex max-w-400 flex-col gap-4 px-4 py-4 sm:px-6">
        <InlineStatus status={opStatus} />

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Hits</TableHead>
                <TableHead>Last hit</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading redirects…
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {search ? 'No redirects match this prefix.' : 'No redirects yet. Add one or import a CSV.'}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => openEdit(row)}>
                  <TableCell className="font-mono text-xs">{row.fromPath}</TableCell>
                  <TableCell className="font-mono text-xs">{row.status === 410 ? '—' : row.toPath}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === 410 ? 'destructive' : 'secondary'}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.source.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.hits}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(row.lastHitAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${row.fromPath}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${row.fromPath}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(row);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pageStatus === 'CanLoadMore' && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => loadMore(50)}>
              Load more
            </Button>
          </div>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit redirect' : 'Add redirect'}</DialogTitle>
            <DialogDescription>
              The from path is matched exactly (case-insensitive, query string ignored). Use a path or an https URL as the target.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="redirect-from">From path</Label>
                <Input
                  id="redirect-from"
                  placeholder="/old-product-name"
                  value={editing.fromPath}
                  onChange={(e) => setEditing({ ...editing, fromPath: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="redirect-to">To</Label>
                <Input
                  id="redirect-to"
                  placeholder="/product/new-product-name or https://…"
                  value={editing.toPath}
                  disabled={editing.status === 410}
                  onChange={(e) => setEditing({ ...editing, toPath: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="redirect-status">Status</Label>
                <select
                  id="redirect-status"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: Number(e.target.value) as Status })}
                >
                  <option value={301}>301 Moved permanently</option>
                  <option value={302}>302 Found (temporary)</option>
                  <option value={410}>410 Gone (removed, no target)</option>
                </select>
              </div>
              <InlineStatus status={editStatus} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving || !editing?.fromPath.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => !importing && setImportOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import redirects</DialogTitle>
            <DialogDescription>
              CSV with columns from,to[,status]. A header row is optional. Status defaults to 301; leave to empty for 410.
              Up to 2000 rows per call. Valid rows are saved even when others fail.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} />
            <Textarea
              rows={8}
              className="font-mono text-xs"
              placeholder={'from,to,status\n/old-brand,/brand/new-brand,301\n/discontinued,,410'}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportResults(null);
              }}
            />
            <p className="text-xs text-muted-foreground">{parsedCount} row(s) detected</p>
            <InlineStatus status={importStatus} />
            {importResults && (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.map((r) => (
                      <TableRow key={r.index}>
                        <TableCell className="tabular-nums">{r.index + 1}</TableCell>
                        <TableCell>
                          <Badge variant={r.ok ? 'secondary' : 'destructive'}>{r.ok ? 'Saved' : 'Failed'}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.ok ? `${r.fromPath} → ${r.status === 410 ? 'gone' : r.toPath} (${r.status})` : r.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
              Close
            </Button>
            <Button onClick={runImport} disabled={importing || parsedCount === 0}>
              {importing ? 'Importing…' : `Import ${parsedCount} row(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
