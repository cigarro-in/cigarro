import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { useOrg } from '../../../lib/convex/useOrg';
import { paiseToRupees } from '../../../lib/convex/money';
import { formatINR } from '../../../utils/currency';
import { Banner, Button, Card, useButtonFeedback } from '../../ui';
import { renderInvoiceJpeg, type InvoiceData } from './invoiceImage';
import { customerName, orderNumberLabel, splitItemName, whatsappUrl, type OrderDoc } from './orderModel';

const money = (paise: number) => formatINR(paiseToRupees(paise));

function invoiceStatus(order: OrderDoc): string {
  switch (order.status) {
    case 'paid':
    case 'late_paid':
      return 'Paid';
    case 'refunded':
      return 'Refunded';
    case 'pending':
      return 'Payment pending';
    default:
      return 'Cancelled';
  }
}

export function buildInvoiceData(order: OrderDoc, storeName: string): InvoiceData {
  const a = order.address;
  const discount = order.discountPaise ?? 0;
  const delivery = order.shippingPricePaise ?? 0;
  const wallet = order.walletDebitPaise ?? 0;
  const total = order.cartTotalPaise + delivery - discount;
  return {
    storeName,
    orderNumber: orderNumberLabel(order),
    date: new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    customerName: customerName(order),
    phone: a?.phone || undefined,
    addressLines: a ? [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter((l): l is string => !!l && l.trim() !== '') : [],
    lines: (order.items ?? []).map((item) => {
      const { product, variant } = splitItemName(item.name);
      return {
        name: product,
        variant,
        qty: item.qty,
        unit: money(item.unitPricePaise),
        amount: money(item.unitPricePaise * item.qty),
      };
    }),
    subtotal: money(order.cartTotalPaise),
    discount: discount > 0 ? `-${money(discount)}` : null,
    delivery: delivery > 0 ? money(delivery) : 'Free',
    wallet: wallet > 0 ? money(wallet) : null,
    total: money(total),
    status: invoiceStatus(order),
  };
}

/**
 * Share invoice: a JPEG via the native share sheet (files). Where files cannot
 * be shared, the JPEG downloads and a WhatsApp chat link is offered, since
 * wa.me cannot attach a file.
 */
export function InvoiceCard({ order }: { order: OrderDoc }) {
  const org = useOrg();
  const share = useButtonFeedback();
  const [fallback, setFallback] = useState<{ url: string; fileName: string; waHref: string | null } | null>(null);

  useEffect(() => {
    const url = fallback?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [fallback]);

  const number = orderNumberLabel(order);
  const fileName = `invoice-${number}.jpg`;

  const onShare = () =>
    share.run(async () => {
      const blob = await renderInvoiceJpeg(buildInvoiceData(order, org?.name ?? 'Store'));
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `Invoice ${number}` });
          setFallback(null);
          return true;
        } catch (err) {
          if ((err as DOMException)?.name === 'AbortError') return true;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      const text = `Invoice for order ${number} from ${org?.name ?? 'the store'}. The image is attached.`;
      setFallback({ url, fileName, waHref: whatsappUrl(order.address?.phone, text) });
      return true;
    });

  return (
    <Card title="Invoice">
      <div className="flex flex-col gap-3">
        <Button variant="secondary" fullWidth icon={<Share2 aria-hidden />} state={share.state} onClick={() => void onShare()}
          successLabel="Shared" errorLabel="Could not share">
          Share invoice
        </Button>
        {share.error && <Banner tone="critical">{share.error.message}</Banner>}
        {fallback && (
          <Banner tone="info" title={`Downloaded ${fallback.fileName}`}>
            <div className="flex flex-col gap-2">
              <span>Sharing files is not available here. Attach the downloaded image in WhatsApp.</span>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <a href={fallback.url} download={fallback.fileName}>
                    <Download aria-hidden />
                    Download again
                  </a>
                </Button>
                {fallback.waHref && (
                  <Button asChild size="sm" variant="secondary">
                    <a href={fallback.waHref} target="_blank" rel="noopener noreferrer">
                      Open WhatsApp chat
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </Banner>
        )}
      </div>
    </Card>
  );
}
