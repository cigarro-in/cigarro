import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Ban, FileCheck2, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../../convex/_generated/api';
import { formatPaiseINR, paiseToRupees, rupeesToPaise } from '../../lib/convex/money';
import { useOrg } from '../../lib/convex/useOrg';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { InvoiceDocument } from '../components/invoices/InvoiceDocument';
import { PageHeader } from '../components/shared/PageHeader';

type Line = {
  variantSupabaseId: string;
  productName: string;
  variantName: string;
  available: number;
  quantity: number;
  unitPriceRupees: number;
};

type InventoryOption = {
  variantSupabaseId: string;
  productName: string;
  variantName: string;
  trackInventory: boolean;
  available: number;
  priceRupees: number;
};

export function InvoiceFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const org = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const inventory = useQuery(api.inventory.list, org && isNew ? { orgId: org._id } : 'skip') as InventoryOption[] | undefined;
  const invoice = useQuery(api.invoices.get, !isNew ? { invoiceId: id as any } : 'skip');
  const createInvoice = useMutation(api.invoices.create);
  const voidInvoice = useMutation(api.invoices.voidInvoice);
  const [customerName, setCustomerName] = useState('Walk-in customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [discountRupees, setDiscountRupees] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [status, setStatus] = useState<'paid' | 'due'>('paid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const idempotencyKey = useRef(crypto.randomUUID());
  const printed = useRef(false);

  useEffect(() => {
    if (!isNew && invoice && location.search.includes('print=1') && !printed.current) {
      printed.current = true;
      window.setTimeout(() => window.print(), 250);
    }
  }, [isNew, invoice, location.search]);

  const subtotalPaise = useMemo(() => lines.reduce((sum, line) => sum + rupeesToPaise(line.unitPriceRupees) * line.quantity, 0), [lines]);
  const discountPaise = Math.min(rupeesToPaise(discountRupees), subtotalPaise);
  const taxPaise = Math.round((subtotalPaise - discountPaise) * taxPercent / 100);
  const totalPaise = subtotalPaise - discountPaise + taxPaise;

  const addLine = () => {
    const row = inventory?.find((x) => x.variantSupabaseId === selectedVariant);
    if (!row || lines.some((x) => x.variantSupabaseId === row.variantSupabaseId)) return;
    setLines((current) => [...current, {
      variantSupabaseId: row.variantSupabaseId,
      productName: row.productName,
      variantName: row.variantName,
      available: row.trackInventory ? row.available : Number.MAX_SAFE_INTEGER,
      quantity: 1,
      unitPriceRupees: row.priceRupees,
    }]);
    setSelectedVariant('');
  };
  const updateLine = (index: number, patch: Partial<Line>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));

  const save = async (printAfter: boolean) => {
    if (!org) return;
    if (!customerName.trim()) return toast.error('Customer name is required');
    if (lines.length === 0) return toast.error('Add at least one item');
    const invalid = lines.find((line) => !Number.isInteger(line.quantity) || line.quantity <= 0 || line.quantity > line.available || line.unitPriceRupees < 0);
    if (invalid) return toast.error(`${invalid.productName} has an invalid quantity or insufficient available stock`);
    setSaving(true);
    try {
      const result = await createInvoice({
        orgId: org._id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        items: lines.map((line) => ({ variantSupabaseId: line.variantSupabaseId, quantity: line.quantity, unitPricePaise: rupeesToPaise(line.unitPriceRupees) })),
        discountPaise,
        taxRateBps: Math.round(taxPercent * 100),
        status,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: idempotencyKey.current,
      });
      navigate(`/admin/invoices/${result.invoiceId}${printAfter ? '?print=1' : ''}`);
    } catch (error: any) {
      const code = error?.data?.code;
      toast.error(code === 'INSUFFICIENT_STOCK' ? 'Stock changed while creating this invoice. Review the available quantities and try again.' : error?.message || 'Could not create invoice');
    } finally { setSaving(false); }
  };

  const voidCurrent = async () => {
    if (!invoice || invoice.status === 'voided') return;
    const reason = window.prompt('Why is this invoice being voided? Stock will be restored.');
    if (!reason?.trim()) return;
    setSaving(true);
    try {
      await voidInvoice({ invoiceId: invoice._id, reason: reason.trim() });
      setMessage('Invoice voided and stock restored');
    } catch (error: any) { toast.error(error?.message || 'Could not void invoice'); }
    finally { setSaving(false); }
  };

  if (!isNew) {
    if (invoice === undefined) return <div className="p-12 text-center text-gray-500">Loading invoice…</div>;
    if (invoice === null) return <div className="p-12 text-center text-gray-500">Invoice not found</div>;
    return <div className="min-h-screen bg-slate-100 pb-16"><PageHeader title={invoice.invoiceNumber} description={`Invoice for ${invoice.customerName}`} backUrl="/admin/invoices"><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / save PDF</Button>{invoice.status !== 'voided' && <Button variant="destructive" disabled={saving} onClick={voidCurrent}><Ban className="mr-2 h-4 w-4" />Void & restore stock</Button>}</PageHeader>{message && <div className="mx-auto mt-5 max-w-[210mm] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}<div className="px-4 pt-7"><InvoiceDocument invoice={invoice} /></div></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-creme)] pb-20">
      <PageHeader title="Create invoice" description="Record an offline sale and update inventory instantly" backUrl="/admin/invoices">
        <Button variant="outline" disabled={saving} onClick={() => save(false)}><Save className="mr-2 h-4 w-4" />Save</Button>
        <Button disabled={saving} onClick={() => save(true)}><Printer className="mr-2 h-4 w-4" />{saving ? 'Creating…' : 'Save & print'}</Button>
      </PageHeader>
      <div className="mx-auto grid max-w-[1500px] gap-6 px-6 pt-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <AdminCard><AdminCardHeader><AdminCardTitle>Customer</AdminCardTitle></AdminCardHeader><AdminCardContent><div className="grid gap-4 sm:grid-cols-2"><Field label="Customer name"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field><Field label="Phone"><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></Field><Field label="Email"><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></Field><Field label="Address"><Textarea rows={2} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} /></Field></div></AdminCardContent></AdminCard>
          <AdminCard><AdminCardHeader><AdminCardTitle>Items</AdminCardTitle></AdminCardHeader><AdminCardContent><div className="flex gap-2"><Select value={selectedVariant} onValueChange={setSelectedVariant}><SelectTrigger className="flex-1"><SelectValue placeholder="Choose a product variant" /></SelectTrigger><SelectContent>{(inventory ?? []).filter((row) => !lines.some((line) => line.variantSupabaseId === row.variantSupabaseId)).map((row) => <SelectItem key={row.variantSupabaseId} value={row.variantSupabaseId} disabled={row.trackInventory && row.available <= 0}>{row.productName} · {row.variantName} — {row.trackInventory ? `${row.available} available` : 'not tracked'}</SelectItem>)}</SelectContent></Select><Button onClick={addLine} disabled={!selectedVariant}><Plus className="mr-2 h-4 w-4" />Add</Button></div>
            <div className="mt-4 space-y-3">{lines.length === 0 ? <div className="rounded-lg border border-dashed py-12 text-center text-sm text-gray-500">Add products to begin the invoice</div> : lines.map((line, index) => <div key={line.variantSupabaseId} className="grid items-end gap-3 rounded-lg border border-[var(--color-coyote)]/20 bg-white/60 p-3 sm:grid-cols-[1fr_110px_140px_120px_40px]"><div><div className="font-medium">{line.productName}</div><div className="text-xs text-gray-500">{line.variantName} · {line.available === Number.MAX_SAFE_INTEGER ? 'Stock not tracked' : `${line.available} available`}</div></div><Field label="Quantity"><Input type="number" min="1" max={line.available} step="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} /></Field><Field label="Price (₹)"><Input type="number" min="0" step="0.01" value={line.unitPriceRupees} onChange={(e) => updateLine(index, { unitPriceRupees: Number(e.target.value) })} /></Field><div className="pb-2 text-right font-semibold">{formatPaiseINR(rupeesToPaise(line.unitPriceRupees) * line.quantity)}</div><Button size="icon" variant="ghost" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>)}</div>
          </AdminCardContent></AdminCard>
          <AdminCard><AdminCardHeader><AdminCardTitle>Payment & notes</AdminCardTitle></AdminCardHeader><AdminCardContent><div className="grid gap-4 sm:grid-cols-2"><Field label="Payment status"><Select value={status} onValueChange={(v: typeof status) => setStatus(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="due">Payment due</SelectItem></SelectContent></Select></Field><Field label="Payment method"><Select value={paymentMethod} onValueChange={(v: typeof paymentMethod) => setPaymentMethod(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></Field><Field label="Payment reference"><Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /></Field><Field label="Invoice note"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div></AdminCardContent></AdminCard>
        </div>
        <div><AdminCard className="sticky top-24"><AdminCardHeader><AdminCardTitle>Invoice total</AdminCardTitle></AdminCardHeader><AdminCardContent className="space-y-4"><div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{formatPaiseINR(subtotalPaise)}</span></div><Field label="Discount (₹)"><Input type="number" min="0" max={paiseToRupees(subtotalPaise)} step="0.01" value={discountRupees} onChange={(e) => setDiscountRupees(Number(e.target.value))} /></Field><Field label="Tax / GST (%)"><Input type="number" min="0" max="100" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} /></Field>{discountPaise > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>Discount</span><span>− {formatPaiseINR(discountPaise)}</span></div>}{taxPaise > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Tax</span><span>{formatPaiseINR(taxPaise)}</span></div>}<div className="flex items-end justify-between border-t-2 border-[var(--color-dark)] pt-4"><span className="font-semibold">Total</span><span className="text-2xl font-bold text-[var(--color-canyon)]">{formatPaiseINR(totalPaise)}</span></div><div className="rounded-lg bg-[var(--color-canyon)]/8 p-3 text-xs leading-5 text-gray-600"><FileCheck2 className="mb-1 h-4 w-4 text-[var(--color-canyon)]" />Saving creates the invoice and deducts stock in one transaction. If anything fails, neither is changed.</div></AdminCardContent></AdminCard></div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
