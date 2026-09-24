// Phase 6 gate: latest-intent quantity model, no double animation/counting.
// Run: node scripts/check-cart-coalescing.mjs
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

const cart = read('src/hooks/useCart.tsx');
check('intent version tracked per mutation', cart.includes('localVersion'));
check('server confirmation tracked', cart.includes('ackedVersion'));
check('stale server snapshots ignored while intent unconfirmed',
  /localVersion\.current !== ackedVersion\.current/.test(cart));
check('matching snapshot confirms without rehydrate',
  cart.includes('ackedVersion.current = localVersion.current'));
check('persists coalesce (trailing-edge drain)', /queued/.test(cart) && /inFlight/.test(cart));
check('no per-tap persist queue', !cart.includes('opQueue'));
// Failed persist must reconcile to authoritative state WITHOUT clobbering
// newer user intent: the old bare `await loadCart()` caught its own errors
// and overwrote optimistic taps made mid-reload. The drain error path now
// pins failedVersion, refetches server lines, and applies them only when
// localVersion hasn't moved — then rethrows for the row error.
const errPath = cart.slice(cart.indexOf('Race-safe recovery'));
check('failure pins the failed intent version', errPath.includes('failedVersion = localVersion.current'));
check('failure refetches authoritative lines (no blind loadCart)',
  errPath.includes('convex.query(api.userState.listCart') && !errPath.includes('await loadCart()'));
check('reconcile gated on no newer intent (pre-apply version check)',
  errPath.includes('localVersion.current === failedVersion') && errPath.includes('setItemsSync(serverItems)'));
check('abandoned intent acked only after successful reconcile',
  errPath.includes('ackedVersion.current = failedVersion'));
check('failed reload never acks (catch preserves + skips ack)',
  /catch \{\s*\/\* keep optimistic state, never ack \*\//.test(errPath) &&
  !/catch[^}]*ackedVersion/.test(errPath.slice(0, 2000)));
check('failure still rethrows for row error', /w\.reject\(error\)/.test(errPath) && /throw error/.test(errPath));
check('no revert-to-stale-previous', !cart.includes('setItemsSync(previous)'));
// Failed persist must not acknowledge local intent: the only ack site is the
// matching-snapshot confirm (server echo), never the drain error path.
check('failed persist never acks intent (single ack site)',
  (cart.match(/ackedVersion\.current = localVersion\.current/g) || []).length === 1);
// Failed loadCart must keep optimistic state, not wipe to [].
const loadFail = cart.slice(cart.indexOf("Failed to load cart:"));
check('failed load preserves optimistic state (no wipe)',
  loadFail.slice(0, 400).includes('Keep optimistic') && !/setItemsSync\(\[\]\)/.test(loadFail.slice(0, 400)));

const stepper = read('src/components/cart/QuantityStepper.tsx');
check('44px touch targets', stepper.includes('min-h-[44px]') && stepper.includes('min-w-[44px]'));
check('accessible labels', stepper.includes('aria-label') && stepper.includes('aria-live'));

const mini = read('src/components/cart/MiniCart.tsx');
check('mini-cart stable keys (no index in keys)',
  !/itemKey = `[^`]*\$\{index\}/.test(mini) && !/key=\{[^}]*index/.test(mini));
const cartPage = read('src/pages/checkout/CartPage.tsx');
check('cart page stable keys (no index)', !cartPage.includes('-${index}'));
const mobile = read('src/pages/checkout/MobileCheckoutPage.tsx');
check('mobile checkout keys carry comboId', mobile.includes("item.combo_id || 'none'"));
const panel = read('src/themes/vivid/VividCartPanel.tsx');
check('vivid panel keys carry comboId', panel.includes('item.combo_id'));
const vivid = read('src/themes/vivid/VividCart.tsx');
check('vivid cart keys carry comboId', vivid.includes('item.combo_id'));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll quantity coalescing checks passed');
