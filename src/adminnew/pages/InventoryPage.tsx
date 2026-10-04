import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Boxes, History, PackageCheck, Pencil, Search } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { ORG_SLUG } from '../../lib/convex/org';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { PageHeader } from '../components/shared/PageHeader';
import { AdminCard, AdminCardContent } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

type InventoryRow = {
  variantSupabaseId: string;
  productName: string;
  variantName: string;
  imageUrl?: string;
  trackInventory: boolean;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  lowStock: boolean;
  updatedAt?: number;
};

const movementLabels: Record<string, string> = {
  opening_balance: 'Opening balance',
  manual_adjustment: 'Stock count',
  stock_received: 'Stock received',
  online_reservation: 'Online reservation',
  reservation_release: 'Reservation released',
  online_sale: 'Online sale',
  offline_sale: 'Offline sale',
  sale_reversal: 'Invoice voided',
  return: 'Customer return',
};

export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const org = useOrg();
  const rows = useQuery(api.inventory.list, org ? { orgId: org._id, orgSlug: ORG_SLUG } : 'skip') as InventoryRow[] | undefined;
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(searchParams.get('lowStock') === '1');
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [historyFor, setHistoryFor] = useState<InventoryRow | null>(null);
  const [targetOnHand, setTargetOnHand] = useState(0);
  const [reorderPoint, setReorderPoint] = useState(10);
  const [reason, setReason] = useState<'manual_adjustment' | 'stock_received' | 'return'>('manual_adjustment');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const { status: opStatus, setError: setOpError } = useInlineStatus();
  const adjust = useMutation(api.inventory.adjust);
  const history = useQuery(
    api.inventory.history,
    org && historyFor ? { orgId: org._id, orgSlug: ORG_SLUG, variantSupabaseId: historyFor.variantSupabaseId, limit: 100 } : 'skip',
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) =>
      (!lowOnly || row.lowStock) &&
      (!term || `${row.productName} ${row.variantName}`.toLowerCase().includes(term)),
    );
  }, [rows, search, lowOnly]);
  const tracked = (rows ?? []).filter((x) => x.trackInventory);
  const lowCount = tracked.filter((x) => x.lowStock).length;
  const totalAvailable = tracked.reduce((sum, x) => sum + x.available, 0);
  const totalReserved = tracked.reduce((sum, x) => sum + x.reserved, 0);

  const openEdit = (row: InventoryRow) => {
    setEditing(row);
    setTargetOnHand(row.onHand);
    setReorderPoint(row.reorderPoint);
    setReason('manual_adjustment');
    setNote('');
    setSavedMessage('');
  };

  const save = async () => {
    if (!org || !editing) return;
    setSaving(true);
    try {
      await adjust({
        orgId: org._id,
        orgSlug: ORG_SLUG,
        variantSupabaseId: editing.variantSupabaseId,
        targetOnHand,
        reorderPoint,
        reason,
        note: note.trim() || undefined,
      });
      setSavedMessage('Inventory updated');
      setEditing(null);
    } catch (error: any) {
      const code = error?.data?.code;
      setOpError(code === 'STOCK_BELOW_RESERVED'
        ? `Stock cannot be below ${error?.data?.reserved ?? editing.reserved} reserved units.`
        : error?.message || 'Could not update inventory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader
        title="Inventory"
        description="Live stock across online and offline sales"
        search={{ value: search, onChange: setSearch, placeholder: 'Search products or variants…' }}
      >
        <Button variant={lowOnly ? 'default' : 'outline'} onClick={() => setLowOnly((v) => !v)}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Low stock {lowCount > 0 ? `(${lowCount})` : ''}
        </Button>
      </PageHeader>

      <div className="mx-auto flex max-w-400 flex-col gap-4 px-4 py-4 sm:px-6">
        <InlineStatus status={opStatus} />
        {savedMessage && <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{savedMessage}</div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric icon={PackageCheck} label="Available to sell" value={totalAvailable} />
          <Metric icon={Boxes} label="Reserved online" value={totalReserved} />
          <Metric icon={AlertTriangle} label="Low stock variants" value={lowCount} danger={lowCount > 0} />
        </div>

        <AdminCard>
          <AdminCardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent"><TableHead>Product</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Available</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                  {rows === undefined ? (
                    <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground">Loading inventory…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground"><Search className="mx-auto mb-2 size-5" />No matching inventory</TableCell></TableRow>
                  ) : filtered.map((row) => (
                    <TableRow key={row.variantSupabaseId}>
                      <TableCell><div className="font-medium">{row.productName}</div><div className="text-xs text-muted-foreground">{row.variantName}</div></TableCell>
                      <TableCell className="text-right font-mono">{row.trackInventory ? row.onHand : '—'}</TableCell>
                      <TableCell className="text-right font-mono">{row.trackInventory ? row.reserved : '—'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{row.trackInventory ? row.available : '∞'}</TableCell>
                      <TableCell>{!row.trackInventory ? <Badge variant="secondary">Not tracked</Badge> : row.available < 0 ? <Badge variant="destructive">Oversold · {Math.abs(row.available)} short</Badge> : row.available === 0 ? <Badge variant="destructive">Out of stock</Badge> : row.lowStock ? <Badge variant="outline">Low · {row.reorderPoint}</Badge> : <Badge variant="secondary">Healthy</Badge>}</TableCell>
                      <TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setHistoryFor(row)}><History data-icon="inline-start" />History</Button>{row.trackInventory && <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil data-icon="inline-start" />Adjust</Button>}</div></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </AdminCardContent>
        </AdminCard>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust inventory</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{editing?.productName} · {editing?.variantName}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>On-hand quantity</Label><Input type="number" min={editing?.reserved ?? 0} step="1" value={targetOnHand} onChange={(e) => setTargetOnHand(Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Low-stock alert at</Label><Input type="number" min="0" step="1" value={reorderPoint} onChange={(e) => setReorderPoint(Number(e.target.value))} /></div>
          </div>
          <div className="space-y-2"><Label>Reason</Label><Select value={reason} onValueChange={(v: typeof reason) => setReason(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual_adjustment">Stock count / correction</SelectItem><SelectItem value="stock_received">New stock received</SelectItem><SelectItem value="return">Customer return</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional reference or explanation" /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save adjustment'}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(open) => !open && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Movement history</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{historyFor?.productName} · {historyFor?.variantName}</p>
          <div className="max-h-96 divide-y overflow-y-auto">
            {history === undefined ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : history.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No movements yet</p> : history.map((item: any) => (
              <div key={item._id} className="flex items-center justify-between py-3 text-sm">
                <div><div className="font-medium">{movementLabels[item.type] ?? item.type}</div><div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('en-IN')}{item.note ? ` · ${item.note}` : ''}</div></div>
                <div className="text-right"><div className={item.quantityDelta > 0 ? 'font-semibold text-success' : item.quantityDelta < 0 ? 'font-semibold text-destructive' : 'font-semibold text-primary'}>{item.quantityDelta > 0 ? '+' : ''}{item.quantityDelta || (item.reservedDelta > 0 ? `Reserved ${item.reservedDelta}` : `Released ${Math.abs(item.reservedDelta)}`)}</div><div className="text-xs text-muted-foreground">On hand: {item.onHandAfter} · Reserved: {item.reservedAfter}</div></div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value, danger }: { icon: typeof Boxes; label: string; value: number; danger?: boolean }) {
  return <AdminCard><AdminCardContent className="flex items-center gap-3 py-4"><div className={`rounded-md p-2 ${danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}><Icon className="size-4" /></div><div><div className="text-xl font-semibold">{value.toLocaleString('en-IN')}</div><div className="text-xs text-muted-foreground">{label}</div></div></AdminCardContent></AdminCard>;
}
