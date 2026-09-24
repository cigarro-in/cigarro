// Phase 7 gate: order + search thumbnails.
// Run: node scripts/check-order-images.mjs
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

const schema = read('convex/schema.ts');
check('order item carries optional image snapshot', /orderItemV = v\.object\(\{[\s\S]*?image: v\.optional\(v\.string\(\)\)/.test(schema));

const orders = read('convex/orders.ts');
check('creation snapshots variant image', orders.includes('variantImage') || orders.includes('(variant as any).images'));
check('creation snapshots combo image', orders.includes('comboImage'));

const hook = read('src/hooks/data/useMyOrders.ts');
check('normalized item exposes imageUrl', hook.includes('imageUrl'));
check('snapshot wins, catalog fallback, placeholder last', hook.includes('resolveOrderItemImageUrl'));
check('no raw getProductImageUrl chain in views required', hook.includes("getProductImageUrl(v?.images?.[0]"));

const vivid = read('src/themes/vivid/VividOrders.tsx');
check('vivid orders render item thumbnail', vivid.includes('order.items[0].imageUrl'));

const classic = read('src/pages/user/OrdersPage.tsx');
check('classic orders resolve images via data layer', classic.includes('resolveOrderItemImageUrl'));
check('classic orders free of hardcoded empty image', !classic.includes("image: ''"));

const mobile = read('src/components/layout/MobileHeader.tsx');
check('mobile search carries image key', /image: displayImages\[0\]/.test(mobile));

const admin = read('src/adminnew/pages/OrderFormPage.tsx');
check('admin order detail shows snapshot thumbnail', admin.includes('getProductImageUrl((item as any).image)'));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll order/search image checks passed');
