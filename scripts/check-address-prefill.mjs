// Phase 5 gate: profile prefill + server-side reverse geocode.
// Run: node scripts/check-address-prefill.mjs
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

const hook = read('src/hooks/data/useMyProfile.ts');
check('profile reads Convex getMyProfile', hook.includes('getMyProfile'));
check('profile exposes name + 10-digit phone', hook.includes('profileName') && hook.includes('profilePhone10'));
check('phone normalized to 10 digits', /replace\(.+\\D/.test(hook) && hook.includes('slice(-10)'));

const drawer = read('src/components/checkout/address/AddressDrawer.tsx');
check('drawer prefill from useMyProfile', drawer.includes('useMyProfile'));
check('drawer free of user_metadata', !drawer.includes('user_metadata'));
check('drawer defaults memoized on values', drawer.includes('useMemo'));

const mobile = read('src/pages/checkout/MobileCheckoutPage.tsx');
check('mobile checkout prefill from useMyProfile', mobile.includes('useMyProfile'));
check('mobile checkout free of user_metadata name/phone', !/userMetadata\.(full_name|phone|contact|name)/.test(mobile));

const form = read('src/components/checkout/address/AddressForm.tsx');
check('form fills blanks only (no typed wipe)', /prev\.full_name \|\| defaultValues/.test(form));
check('form uses shared location hook', form.includes('useCurrentLocation'));

const manager = read('src/components/checkout/AddressManager.tsx');
check('manager uses shared location hook', manager.includes('useCurrentLocation'));
check('manager seeds profile on new-address open', manager.includes('openNewAddress'));

const desktop = read('src/pages/checkout/CheckoutPage.tsx');
check('desktop checkout uses shared location hook', desktop.includes('useCurrentLocation'));
check('never writes zero lat/lng', !desktop.includes('{ lat: 0') && !desktop.includes('lng: 0'));
check('desktop checkout fills city/state blanks-only (no typed wipe)',
  /city: prev\.city \|\| addr\.city/.test(desktop) && /state: prev\.state \|\| addr\.state/.test(desktop));
check('desktop checkout persists the real device fix',
  desktop.includes('res.coords.lat') && desktop.includes('res.coords.lon'));
check('manager fills city/state blanks-only (no typed wipe)',
  /city: prev\.city \|\| addr\.city/.test(manager) && /state: prev\.state \|\| addr\.state/.test(manager));

// No direct browser → Nominatim calls remain anywhere under src/.
import { readdirSync, statSync } from 'node:fs';
let directNominatim = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|jsx?)$/.test(e)) continue;
    if (readFileSync(p, 'utf8').includes('nominatim.openstreetmap.org')) directNominatim.push(p);
  }
})(join(root, 'src'));
check('no direct Nominatim fetches in src/', directNominatim.length === 0);
if (directNominatim.length) console.log('  direct callers: ' + directNominatim.join(', '));

const locHook = read('src/hooks/useCurrentLocation.ts');
check('low-accuracy + bounded timeout + cached fix', locHook.includes('enableHighAccuracy: false') && locHook.includes('maximumAge') && locHook.includes('timeout'));
check('denied/unavailable/timeout mapped inline', locHook.includes('denied') && locHook.includes('unavailable') && locHook.includes('timed out'));
check('device coords travel with the result (never 0,0 downstream)',
  locHook.includes('coords: { lat, lon }') && locHook.includes('Number.isFinite(lat)'));

const geo = read('convex/geocode.ts');
check('server reverse-geocode action exists', geo.includes('export const reverse'));
check('server identifies to Nominatim (UA/Referer)', geo.includes('User-Agent') && geo.includes('Referer'));
check('coords validated', geo.includes('BAD_COORDS'));
check('upstream throttled to ~1/sec (Nominatim max)', geo.includes('NOMINATIM_MIN_GAP_MS') && geo.includes('1100'));
check('results cached by rounded coords', geo.includes('geocodeCache') && geo.includes('toFixed(4)'));
check('attribution returned + displayed', geo.includes('attribution') && desktop.includes('OpenStreetMap contributors'));

const headers = read('_headers');
const html = read('index.html');
const mw = read('functions/ssr-middleware.js');
check('geolocation allowed for self (headers/html/middleware)',
  headers.includes('geolocation=(self)') && html.includes('geolocation=(self)') && mw.includes('geolocation=(self)'));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll address prefill/location checks passed');
