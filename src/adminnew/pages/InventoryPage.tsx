import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Boxes, History, PackageCheck, Pencil, Search } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
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
  const org = useOrg();
  const rows = useQuery(api.inventory.list, org ? { orgId: org._id } : 'skip') as InventoryRow[] | undefined;
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
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
    org && historyFor ? { orgId: org._id, variantSupabaseId: historyFor.variantSupabaseId, limit: 100 } : 'skip',
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
    <div className="min-h-screen bg-[var(--color-creme)] pb-16">
      <PageHeader
        title="Inventory"
        description="Live stock across online and offline sales"
        search={{ value: search, onChange: setSearch, placeholder: 'Search products or variants…' }}
      >
        <Button variant={lowOnly ? 'default' : 'outline'} onClick={() => setLowOnly((v) => !v)}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Low stock {lowCount > 0 ? `(${lowCount})` : ''}
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 pt-6">
        <InlineStatus status={opStatus} />
        {savedMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{savedMessage}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric icon={PackageCheck} label="Available to sell" value={totalAvailable} />
          <Metric icon={Boxes} label="Reserved online" value={totalReserved} />
          <Metric icon={AlertTriangle} label="Low stock variants" value={lowCount} danger={lowCount > 0} />
        </div>

        <AdminCard>
          <AdminCardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-coyote)]/20 bg-[var(--color-coyote)]/5 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">On hand</th><th className="px-4 py-3 text-right">Reserved</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-coyote)]/15">
                  {rows === undefined ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-500">Loading inventory…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-500"><Search className="mx-auto mb-2 h-6 w-6" />No matching inventory</td></tr>
                  ) : filtered.map((row) => (
                    <tr key={row.variantSupabaseId} className="hover:bg-white/50">
                      <td className="px-4 py-3"><div className="font-medium text-[var(--color-dark)]">{row.productName}</div><div className="text-xs text-gray-500">{row.variantName}</div></td>
                      <td className="px-4 py-3 text-right font-mono">{row.trackInventory ? row.onHand : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-700">{row.trackInventory ? row.reserved : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{row.trackInventory ? row.available : '∞'}</td>
                      <td className="px-4 py-3">{!row.trackInventory ? <Badge variant="secondary">Not tracked</Badge> : row.available < 0 ? <Badge variant="destructive">Oversold · {Math.abs(row.available)} short</Badge> : row.available === 0 ? <Badge variant="destructive">Out of stock</Badge> : row.lowStock ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Low · reorder at {row.reorderPoint}</Badge> : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Healthy</Badge>}</td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setHistoryFor(row)}><History className="mr-1 h-4 w-4" />History</Button>{row.trackInventory && <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil className="mr-1 h-4 w-4" />Adjust</Button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCardContent>
        </AdminCard>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust inventory</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">{editing?.productName} · {editing?.variantName}</p>
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
          <p className="text-sm text-gray-600">{historyFor?.productName} · {historyFor?.variantName}</p>
          <div className="max-h-[55vh] divide-y overflow-y-auto">
            {history === undefined ? <p className="py-8 text-center text-sm text-gray-500">Loading…</p> : history.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No movements yet</p> : history.map((item: any) => (
              <div key={item._id} className="flex items-center justify-between py-3 text-sm">
                <div><div className="font-medium">{movementLabels[item.type] ?? item.type}</div><div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString('en-IN')}{item.note ? ` · ${item.note}` : ''}</div></div>
                <div className="text-right"><div className={item.quantityDelta > 0 ? 'font-semibold text-emerald-700' : item.quantityDelta < 0 ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>{item.quantityDelta > 0 ? '+' : ''}{item.quantityDelta || (item.reservedDelta > 0 ? `Reserved ${item.reservedDelta}` : `Released ${Math.abs(item.reservedDelta)}`)}</div><div className="text-xs text-gray-500">On hand: {item.onHandAfter} · Reserved: {item.reservedAfter}</div></div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value, danger }: { icon: typeof Boxes; label: string; value: number; danger?: boolean }) {
  return <AdminCard><AdminCardContent className="flex items-center gap-4 py-5"><div className={`rounded-xl p-3 ${danger ? 'bg-red-100 text-red-700' : 'bg-[var(--color-canyon)]/10 text-[var(--color-canyon)]'}`}><Icon className="h-5 w-5" /></div><div><div className="text-2xl font-bold">{value.toLocaleString('en-IN')}</div><div className="text-sm text-gray-500">{label}</div></div></AdminCardContent></AdminCard>;
}
