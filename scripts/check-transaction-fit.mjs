// Phase 2 gate: transaction one-viewport + QR download wiring (static).
// Live viewport fit still needs a manual device pass with a real order.
// Run: node scripts/check-transaction-fit.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const failures = [];
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures.push(name);
};

const page = read('src/pages/checkout/TransactionProcessingPage.tsx');
check('QR download reuses generated data URL (no regen)', page.includes('href={qrCode}'));
check('QR download has safe filename', page.includes('cigarro-order-') && page.includes('-upi-qr.png'));
check('QR download labeled + accessible', page.includes('Download QR') && page.includes('aria-label'));
check('QR download has inline unsupported fallback', page.includes('qrDownloadSupported'));
check('shell keeps emergency scroll, never overflow-hidden',
  page.includes('overflow-y-auto') && !/['"]overflow-hidden/.test(page));
check('shell clips decorative x-overflow', page.includes('overflow-x-clip'));
check('compact pending (icon/amount/QR trimmed)', page.includes('w-14 h-14') && page.includes('w-36 h-36') && page.includes('text-3xl font-mono'));

const vivid = read('src/themes/vivid/VividShell.tsx');
check('vivid hides bottom nav on transaction', vivid.includes("startsWith('/transaction')"));
const layout = read('src/components/layout/MobileLayout.tsx');
check('classic hides bottom nav on transaction', layout.includes("startsWith('/transaction')"));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll transaction fit/download checks passed');
