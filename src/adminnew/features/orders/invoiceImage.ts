// Renders a clean invoice to a JPEG on a canvas. No dependency, no DOM capture.

export interface InvoiceLine {
  name: string;
  variant?: string;
  qty: number;
  unit: string;
  amount: string;
}

export interface InvoiceData {
  storeName: string;
  orderNumber: string;
  date: string;
  customerName: string;
  phone?: string;
  addressLines: string[];
  lines: InvoiceLine[];
  subtotal: string;
  discount: string | null;
  delivery: string;
  wallet: string | null;
  total: string;
  status: string;
}

const WIDTH = 1080;
const PAD = 64;
const SCALE = 2;
const INK = '#111827';
const MUTED = '#6b7280';
const RULE = '#e5e7eb';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

/** Truncates with an ellipsis so the text fits maxWidth in the given font. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, f: string): string {
  ctx.font = f;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

/** Draws the invoice on ctx and returns the bottom y (CSS px). Same call measures and paints. */
function paint(ctx: CanvasRenderingContext2D, inv: InvoiceData): number {
  const R = WIDTH - PAD;
  const qtyX = R - 340;
  const priceX = R - 200;
  let y = PAD;

  const text = (s: string, x: number, yy: number, f: string, color: string, align: CanvasTextAlign = 'left') => {
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, yy);
  };
  const rule = (yy: number) => {
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, yy);
    ctx.lineTo(R, yy);
    ctx.stroke();
  };

  // Header: store name, invoice label, order number and date.
  y += 52;
  text(fit(ctx, inv.storeName, R - PAD - 260, font(700, 52)), PAD, y, font(700, 52), INK);
  text('INVOICE', R, y, font(600, 26), MUTED, 'right');
  y += 50;
  text(`Order ${inv.orderNumber}`, PAD, y, font(600, 34), INK);
  text(inv.date, R, y, font(400, 28), MUTED, 'right');
  y += 36;
  rule(y);

  // Bill to.
  y += 46;
  text('BILL TO', PAD, y, font(600, 22), MUTED);
  y += 42;
  text(inv.customerName, PAD, y, font(700, 34), INK);
  y += 42;
  if (inv.phone) {
    text(inv.phone, PAD, y, font(400, 28), INK);
    y += 38;
  }
  for (const line of inv.addressLines) {
    text(line, PAD, y, font(400, 28), INK);
    y += 36;
  }
  y += 22;
  rule(y);

  // Items.
  y += 44;
  text('ITEM', PAD, y, font(600, 22), MUTED);
  text('QTY', qtyX, y, font(600, 22), MUTED, 'right');
  text('PRICE', priceX, y, font(600, 22), MUTED, 'right');
  text('AMOUNT', R, y, font(600, 22), MUTED, 'right');
  y += 22;
  rule(y);
  y += 42;

  const nameMax = qtyX - PAD - 60;
  for (const line of inv.lines) {
    text(fit(ctx, line.name, nameMax, font(600, 30)), PAD, y, font(600, 30), INK);
    text(String(line.qty), qtyX, y, font(400, 28), INK, 'right');
    text(line.unit, priceX, y, font(400, 28), INK, 'right');
    text(line.amount, R, y, font(600, 28), INK, 'right');
    if (line.variant) {
      y += 36;
      text(fit(ctx, line.variant, nameMax, font(400, 25)), PAD, y, font(400, 25), MUTED);
    }
    y += 26;
    rule(y);
    y += 40;
  }

  // Totals, right-aligned under the amount column.
  const labelX = R - 260;
  const totalRow = (label: string, value: string) => {
    text(label, labelX, y, font(400, 28), MUTED, 'right');
    text(value, R, y, font(400, 28), INK, 'right');
    y += 46;
  };
  const totalsTop = y;
  totalRow('Subtotal', inv.subtotal);
  if (inv.discount) totalRow('Discount', inv.discount);
  totalRow('Delivery', inv.delivery);
  if (inv.wallet) totalRow('Paid from wallet', inv.wallet);
  y += 6;
  rule(y);
  y += 52;
  text('Total', labelX, y, font(700, 34), INK, 'right');
  text(inv.total, R, y, font(700, 40), INK, 'right');
  text(inv.status, PAD, totalsTop, font(600, 28), INK);
  y += 60;

  // Footer.
  text(`Thank you for shopping with ${inv.storeName}`, WIDTH / 2, y, font(400, 24), MUTED, 'center');
  return y + PAD / 2;
}

export async function renderInvoiceJpeg(inv: InvoiceData): Promise<Blob> {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('Canvas is not available in this browser.');
  const height = paint(probe, inv);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = Math.ceil(height) * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = 'alphabetic';
  paint(ctx, inv);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render the invoice image.'))), 'image/jpeg', 0.92),
  );
}
