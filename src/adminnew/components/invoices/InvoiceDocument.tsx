import { formatPaiseINR } from '../../../lib/convex/money';
import type { CSSProperties } from 'react';

export type PrintableInvoice = {
  invoiceNumber: string;
  status: 'paid' | 'due' | 'voided';
  paymentMethod: string;
  paymentReference?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  seller: {
    businessName: string;
    address?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    terms?: string;
    accentColor?: string;
  };
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  taxRateBps: number;
  taxPaise: number;
  totalPaise: number;
  notes?: string;
  createdAt: number;
};

const paymentLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function InvoiceDocument({ invoice }: { invoice: PrintableInvoice }) {
  const accent = invoice.seller.accentColor || '#9a4f2d';
  return (
    <>
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        body * { visibility: hidden !important; }
        .invoice-print-root, .invoice-print-root * { visibility: visible !important; }
        .invoice-print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; margin: 0 !important; }
      }`}</style>
      <article className="invoice-print-root mx-auto min-h-[297mm] w-full max-w-[210mm] overflow-hidden bg-white text-slate-900 shadow-xl" style={{ '--invoice-accent': accent } as CSSProperties}>
        <div className="h-3 bg-[var(--invoice-accent)]" />
        <div className="flex min-h-[calc(297mm-12px)] flex-col p-10 sm:p-14">
          <header className="flex items-start justify-between gap-8 border-b border-slate-200 pb-8">
            <div>
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--invoice-accent)] text-xl font-bold text-white">{invoice.seller.businessName.charAt(0).toUpperCase()}</div>
              <h1 className="text-2xl font-bold tracking-tight">{invoice.seller.businessName}</h1>
              <div className="mt-2 max-w-sm whitespace-pre-line text-xs leading-5 text-slate-500">{invoice.seller.address}</div>
              <div className="mt-1 text-xs text-slate-500">{[invoice.seller.phone, invoice.seller.email].filter(Boolean).join(' · ')}</div>
              {invoice.seller.gstin && <div className="mt-1 text-xs font-medium text-slate-700">GSTIN: {invoice.seller.gstin}</div>}
            </div>
            <div className="text-right">
              <div className="text-4xl font-light uppercase tracking-[0.18em] text-slate-300">Invoice</div>
              <div className="mt-4 text-lg font-bold text-[var(--invoice-accent)]">{invoice.invoiceNumber}</div>
              <div className="mt-1 text-xs text-slate-500">{new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : invoice.status === 'voided' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{invoice.status}</div>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-10 py-8">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Bill to</div><div className="mt-3 font-semibold">{invoice.customerName}</div><div className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-500">{invoice.customerAddress}</div><div className="mt-1 text-xs text-slate-500">{[invoice.customerPhone, invoice.customerEmail].filter(Boolean).join(' · ')}</div></div>
            <div className="text-right"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment</div><div className="mt-3 font-semibold">{paymentLabel(invoice.paymentMethod)}</div>{invoice.paymentReference && <div className="mt-1 text-xs text-slate-500">Reference: {invoice.paymentReference}</div>}</div>
          </section>

          <table className="w-full text-sm">
            <thead><tr className="bg-slate-950 text-left text-[10px] uppercase tracking-wider text-white"><th className="rounded-l-lg px-4 py-3">Item</th><th className="px-4 py-3 text-center">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="rounded-r-lg px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{invoice.items.map((item, index) => <tr key={`${item.productName}-${item.variantName}-${index}`}><td className="px-4 py-4"><div className="font-medium">{item.productName}</div><div className="mt-0.5 text-xs text-slate-400">{item.variantName}</div></td><td className="px-4 py-4 text-center">{item.quantity}</td><td className="px-4 py-4 text-right">{formatPaiseINR(item.unitPricePaise)}</td><td className="px-4 py-4 text-right font-semibold">{formatPaiseINR(item.lineTotalPaise)}</td></tr>)}</tbody>
          </table>

          <section className="ml-auto mt-8 w-full max-w-xs space-y-3 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatPaiseINR(invoice.subtotalPaise)}</span></div>
            {invoice.discountPaise > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>− {formatPaiseINR(invoice.discountPaise)}</span></div>}
            {invoice.taxPaise > 0 && <div className="flex justify-between text-slate-500"><span>Tax ({(invoice.taxRateBps / 100).toFixed(2)}%)</span><span>{formatPaiseINR(invoice.taxPaise)}</span></div>}
            <div className="flex items-end justify-between border-t-2 border-slate-950 pt-4"><span className="font-bold uppercase tracking-wider">Total</span><span className="text-2xl font-bold text-[var(--invoice-accent)]">{formatPaiseINR(invoice.totalPaise)}</span></div>
          </section>

          {(invoice.notes || invoice.seller.terms) && <footer className="mt-auto border-t border-slate-200 pt-8 text-xs leading-5 text-slate-500">{invoice.notes && <div className="mb-3"><span className="font-semibold text-slate-700">Note:</span> {invoice.notes}</div>}<div>{invoice.seller.terms}</div></footer>}
        </div>
      </article>
    </>
  );
}
