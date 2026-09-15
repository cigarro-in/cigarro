import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { FilePlus2, FileText, ReceiptIndianRupee, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../../convex/_generated/api';
import { formatPaiseINR } from '../../lib/convex/money';
import { useOrg } from '../../lib/convex/useOrg';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { AdminCard, AdminCardContent } from '../components/shared/AdminCard';
import { PageHeader } from '../components/shared/PageHeader';

type InvoiceSummary = {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  createdAt: number;
  status: 'paid' | 'due' | 'voided';
  paymentMethod: string;
  totalPaise: number;
};

export function InvoicesPage() {
  const org = useOrg();
  const navigate = useNavigate();
  const invoices = useQuery(api.invoices.list, org ? { orgId: org._id, limit: 150 } : 'skip') as InvoiceSummary[] | undefined;
  const settings = useQuery(api.invoices.getSettings, org ? { orgId: org._id } : 'skip');
  const saveSettings = useMutation(api.invoices.saveSettings);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ prefix: 'INV', businessName: '', address: '', phone: '', email: '', gstin: '', terms: '', accentColor: '#9a4f2d' });

  useEffect(() => {
    if (!settings) return;
    setForm({
      prefix: settings.prefix,
      businessName: settings.businessName,
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      gstin: settings.gstin ?? '',
      terms: settings.terms ?? '',
      accentColor: settings.accentColor ?? '#9a4f2d',
    });
  }, [settings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (invoices ?? []).filter((invoice) => !term || `${invoice.invoiceNumber} ${invoice.customerName} ${invoice.customerPhone ?? ''}`.toLowerCase().includes(term));
  }, [invoices, search]);
  const paidTotal = (invoices ?? []).filter((x) => x.status === 'paid').reduce((sum, x) => sum + x.totalPaise, 0);
  const dueTotal = (invoices ?? []).filter((x) => x.status === 'due').reduce((sum, x) => sum + x.totalPaise, 0);

  const submitSettings = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await saveSettings({ orgId: org._id, ...form, address: form.address || undefined, phone: form.phone || undefined, email: form.email || undefined, gstin: form.gstin || undefined, terms: form.terms || undefined });
      setSettingsOpen(false);
      setMessage('Invoice design and business details updated');
    } catch (error: any) {
      toast.error(error?.message || 'Could not save invoice settings');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--color-creme)] pb-16">
      <PageHeader title="Invoices" description="Offline sales, receipts and printable invoices" search={{ value: search, onChange: setSearch, placeholder: 'Search invoice or customer…' }}>
        <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Invoice settings</Button>
        <Button onClick={() => navigate('/admin/invoices/new')}><FilePlus2 className="mr-2 h-4 w-4" />New invoice</Button>
      </PageHeader>
      <div className="mx-auto max-w-[1600px] space-y-5 px-6 pt-6">
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Summary icon={FileText} label="Invoices created" value={(invoices ?? []).length.toLocaleString('en-IN')} />
          <Summary icon={ReceiptIndianRupee} label="Paid offline sales" value={formatPaiseINR(paidTotal)} />
          <Summary icon={ReceiptIndianRupee} label="Payment due" value={formatPaiseINR(dueTotal)} warning={dueTotal > 0} />
        </div>
        <AdminCard><AdminCardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-[var(--color-coyote)]/20 bg-[var(--color-coyote)]/5 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right"></th></tr></thead><tbody className="divide-y divide-[var(--color-coyote)]/15">
          {invoices === undefined ? <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-500">Loading invoices…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-500"><FileText className="mx-auto mb-2 h-7 w-7" />No invoices yet</td></tr> : filtered.map((invoice) => <tr key={invoice._id} className="cursor-pointer hover:bg-white/50" onClick={() => navigate(`/admin/invoices/${invoice._id}`)}><td className="px-4 py-3 font-semibold text-[var(--color-canyon)]">{invoice.invoiceNumber}</td><td className="px-4 py-3"><div className="font-medium">{invoice.customerName}</div><div className="text-xs text-gray-500">{invoice.customerPhone}</div></td><td className="px-4 py-3 text-gray-600">{new Date(invoice.createdAt).toLocaleDateString('en-IN')}</td><td className="px-4 py-3"><Badge variant={invoice.status === 'voided' ? 'destructive' : 'secondary'} className={invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : invoice.status === 'due' ? 'bg-amber-100 text-amber-800' : ''}>{invoice.status}</Badge><span className="ml-2 text-xs capitalize text-gray-500">{invoice.paymentMethod.replace('_', ' ')}</span></td><td className="px-4 py-3 text-right font-semibold">{formatPaiseINR(invoice.totalPaise)}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost">View & print</Button></td></tr>)}
        </tbody></table></div></AdminCardContent></AdminCard>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Invoice settings</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-4"><Field label="Business name"><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field><Field label="Invoice prefix"><Input value={form.prefix} maxLength={12} onChange={(e) => setForm({ ...form, prefix: e.target.value })} /></Field><Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Field><Field label="Accent colour"><div className="flex gap-2"><Input type="color" className="w-14 p-1" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /><Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></div></Field></div><Field label="Business address"><Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field><Field label="Footer / terms"><Textarea rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></Field><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={submitSettings} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div></DialogContent></Dialog>
    </div>
  );
}

function Summary({ icon: Icon, label, value, warning }: { icon: typeof FileText; label: string; value: string; warning?: boolean }) { return <AdminCard><AdminCardContent className="flex items-center gap-4 py-5"><div className={`rounded-xl p-3 ${warning ? 'bg-amber-100 text-amber-700' : 'bg-[var(--color-canyon)]/10 text-[var(--color-canyon)]'}`}><Icon className="h-5 w-5" /></div><div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-gray-500">{label}</div></div></AdminCardContent></AdminCard>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
