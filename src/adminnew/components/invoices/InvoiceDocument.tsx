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
  const isDue = invoice.status === 'due';
  return (
    <>
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        body * { visibility: hidden !important; }
        .invoice-print-root, .invoice-print-root * { visibility: visible !important; }
        .invoice-print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; margin: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }`}</style>
      <article className="invoice-print-root mx-auto min-h-[297mm] w-full max-w-[210mm] overflow-hidden bg-[#f7f4ef] text-[#211d1a] shadow-2xl" style={{ '--invoice-accent': accent } as CSSProperties}>
        <header className="relative overflow-hidden bg-[#211d1a] px-10 py-9 text-white sm:px-12">
          <div className="absolute -right-14 -top-24 h-64 w-64 rounded-full border-[42px] border-white/[0.035]" />
          <div className="absolute bottom-0 left-0 h-1.5 w-full bg-[var(--invoice-accent)]" />
          <div className="relative flex items-start justify-between gap-8">
            <div className="flex items-center gap-4">
              <img src="/icons/android-chrome-192x192.png" alt="" className="h-14 w-14 rounded-2xl border border-white/15 object-cover" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50">Premium retail</div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">{invoice.seller.businessName}</h1>
                {invoice.seller.gstin && <div className="mt-1 text-[10px] tracking-wide text-white/60">GSTIN {invoice.seller.gstin}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-[var(--font-family-serif)] text-4xl font-normal italic leading-none text-white">Invoice</div>
              <div className="mt-3 text-sm font-semibold tracking-wide text-[#d69a72]">{invoice.invoiceNumber}</div>
            </div>
          </div>
        </header>

        <div className="flex min-h-[calc(297mm-128px)] flex-col px-10 pb-9 pt-8 sm:px-12">
          <section className="grid grid-cols-[1.25fr_.75fr] gap-4">
            <div className="rounded-2xl border border-[#ded7ce] bg-white px-5 py-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--invoice-accent)]">Billed to</div>
              <div className="mt-2 text-base font-bold">{invoice.customerName}</div>
              {invoice.customerAddress && <div className="mt-1 max-w-sm whitespace-pre-line text-xs leading-5 text-[#6e665f]">{invoice.customerAddress}</div>}
              {(invoice.customerPhone || invoice.customerEmail) && <div className="mt-1 text-xs text-[#6e665f]">{[invoice.customerPhone, invoice.customerEmail].filter(Boolean).join(' · ')}</div>}
            </div>
            <div className="rounded-2xl border border-[#ded7ce] bg-[#eee8e0] px-5 py-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <Meta label="Issue date" value={new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                <Meta label="Status" value={invoice.status.toUpperCase()} accent />
                <Meta label="Payment" value={paymentLabel(invoice.paymentMethod)} />
                <Meta label="Reference" value={invoice.paymentReference || '—'} />
              </div>
            </div>
          </section>

          <section className="mt-7 overflow-hidden rounded-2xl border border-[#ded7ce] bg-white">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#2d2824] text-left text-[9px] uppercase tracking-[0.18em] text-white/75"><th className="px-5 py-3.5">Description</th><th className="w-20 px-3 py-3.5 text-center">Qty</th><th className="w-32 px-3 py-3.5 text-right">Unit price</th><th className="w-32 px-5 py-3.5 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-[#ebe6df]">{invoice.items.map((item, index) => <tr key={`${item.productName}-${item.variantName}-${index}`}><td className="px-5 py-4"><div className="font-semibold text-[#211d1a]">{item.productName}</div><div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[#92877e]">{item.variantName}</div></td><td className="px-3 py-4 text-center font-medium">{item.quantity}</td><td className="px-3 py-4 text-right text-[#6e665f]">{formatPaiseINR(item.unitPricePaise)}</td><td className="px-5 py-4 text-right font-bold">{formatPaiseINR(item.lineTotalPaise)}</td></tr>)}</tbody>
            </table>
          </section>

          <section className="mt-6 grid grid-cols-[1fr_310px] items-start gap-8">
            <div className="pt-2">
              {invoice.notes && <div><div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--invoice-accent)]">A note for you</div><p className="mt-2 max-w-sm text-xs leading-5 text-[#6e665f]">{invoice.notes}</p></div>}
            </div>
            <div className="overflow-hidden rounded-2xl bg-[#211d1a] text-white">
              <div className="space-y-2.5 px-5 py-4 text-xs">
                <div className="flex justify-between text-white/65"><span>Subtotal</span><span>{formatPaiseINR(invoice.subtotalPaise)}</span></div>
                {invoice.discountPaise > 0 && <div className="flex justify-between text-[#c8e6cf]"><span>Discount</span><span>− {formatPaiseINR(invoice.discountPaise)}</span></div>}
                {invoice.taxPaise > 0 && <div className="flex justify-between text-white/65"><span>Tax ({(invoice.taxRateBps / 100).toFixed(2)}%)</span><span>{formatPaiseINR(invoice.taxPaise)}</span></div>}
              </div>
              <div className="flex items-end justify-between bg-[var(--invoice-accent)] px-5 py-4 text-white">
                <div><div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">{isDue ? 'Amount due' : 'Total paid'}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wide">{invoice.status}</div></div>
                <div className="text-2xl font-bold tracking-tight">{formatPaiseINR(invoice.totalPaise)}</div>
              </div>
            </div>
          </section>

          <footer className="mt-auto grid grid-cols-[1fr_auto] items-end gap-8 border-t border-[#d8d0c7] pt-5 text-[10px] leading-4 text-[#756c64]">
            <div>
              <div className="font-semibold text-[#211d1a]">{invoice.seller.terms || 'Thank you for your business.'}</div>
              {invoice.seller.address && <div className="mt-1 whitespace-pre-line">{invoice.seller.address}</div>}
              <div className="mt-1">{[invoice.seller.phone, invoice.seller.email].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="text-right"><div className="text-lg font-bold tracking-[0.22em] text-[#211d1a]">CIGARRO</div><div className="mt-1 uppercase tracking-[0.16em]">Original for recipient</div></div>
          </footer>
        </div>
      </article>
    </>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div><div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#92877e]">{label}</div><div className={`mt-1 font-semibold ${accent ? 'text-[var(--invoice-accent)]' : 'text-[#211d1a]'}`}>{value}</div></div>;
}
