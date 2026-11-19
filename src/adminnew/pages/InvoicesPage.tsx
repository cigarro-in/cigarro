import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { FilePlus2, FileText, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
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
import { Pagination } from '../ui';
import { usePageSize, useCursorPages } from '../hooks/usePagination';

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
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = usePageSize('invoices');
  const pages = useCursorPages(JSON.stringify({ search: search.trim(), pageSize }));
  const pageResult = useQuery(
    api.invoices.listPaged,
    org ? { orgId: org._id, search: search.trim() || undefined, cursor: pages.cursor, pageSize } : 'skip',
  );
  const invoices = pageResult?.page as InvoiceSummary[] | undefined;
  const settings = useQuery(api.invoices.getSettings, org ? { orgId: org._id } : 'skip');
  const saveSettings = useMutation(api.invoices.saveSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const { status: opStatus, setError: setOpError } = useInlineStatus();
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

  const goToPage = (p: number) => {
    if (p > pages.page) {
      if (pageResult?.continueCursor) pages.next(pageResult.continueCursor);
    } else {
      pages.prev();
    }
  };

  const submitSettings = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await saveSettings({ orgId: org._id, ...form, address: form.address || undefined, phone: form.phone || undefined, email: form.email || undefined, gstin: form.gstin || undefined, terms: form.terms || undefined });
      setSettingsOpen(false);
      setMessage('Invoice design and business details updated');
    } catch (error: any) {
      setOpError(error?.message || 'Could not save invoice settings');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader title="Invoices" description="Offline sales and printable receipts" search={{ value: search, onChange: setSearch, placeholder: 'Search invoice or customer…' }}>
        <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Invoice settings</Button>
        <Button onClick={() => navigate('/invoices/new')}><FilePlus2 className="mr-2 h-4 w-4" />New invoice</Button>
      </PageHeader>
      <div className="mx-auto max-w-400 space-y-5 px-6">
        <InlineStatus status={opStatus} />
        {message && <div className="rounded-lg border border-success-muted bg-success-muted px-4 py-3 text-sm text-success">{message}</div>}
        <AdminCard><AdminCardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-border">
          {invoices === undefined ? <tr><td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">Loading invoices…</td></tr> : invoices.length === 0 ? <tr><td colSpan={6} className="px-4 py-16 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-7 w-7" />No invoices yet</td></tr> : invoices.map((invoice) =><tr key={invoice._id} className="cursor-pointer hover:bg-white/50" onClick={() => navigate(`/invoices/${invoice._id}`)}><td className="px-4 py-3 font-semibold text-primary">{invoice.invoiceNumber}</td><td className="px-4 py-3"><div className="font-medium">{invoice.customerName}</div><div className="text-xs text-muted-foreground">{invoice.customerPhone}</div></td><td className="px-4 py-3 text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString('en-IN')}</td><td className="px-4 py-3"><Badge variant={invoice.status === 'voided' ? 'destructive' : 'secondary'} className={invoice.status === 'paid' ? 'bg-success-muted text-success' : invoice.status === 'due' ? 'bg-warning-muted text-warning' : ''}>{invoice.status}</Badge><span className="ml-2 text-xs capitalize text-muted-foreground">{invoice.paymentMethod.replace('_', ' ')}</span></td><td className="px-4 py-3 text-right font-semibold">{formatPaiseINR(invoice.totalPaise)}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost">View & print</Button></td></tr>)}
        </tbody></table></div>
        {invoices && (invoices.length > 0 || pages.page > 1) && (
          <Pagination
            page={pages.page}
            hasNext={!pageResult?.isDone}
            onPageChange={goToPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}
        </AdminCardContent></AdminCard>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Invoice settings</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Business name"><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field><Field label="Invoice prefix"><Input value={form.prefix} maxLength={12} onChange={(e) => setForm({ ...form, prefix: e.target.value })} /></Field><Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Field><Field label="Accent colour"><div className="flex gap-2"><Input type="color" className="w-14 p-1" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /><Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></div></Field></div><Field label="Business address"><Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field><Field label="Footer / terms"><Textarea rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></Field><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={submitSettings} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div></DialogContent></Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
