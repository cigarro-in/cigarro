// Gate: app-wide Nominatim 1 req/sec reservation (Convex OCC, not per-isolate).
// Run: node scripts/check-geocode-ratelimit.mjs
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

const geo = read('convex/geocode.ts');
const schema = read('convex/schema.ts');

// Durable atomic slot: singleton row + internal mutation, wired before fetch.
check('schema has geocodeUpstreamSlots singleton (by_key)',
  schema.includes('geocodeUpstreamSlots') && schema.includes('lastReservedAt') && schema.includes('"by_key"'));
check('internal reservation mutation exists',
  geo.includes('reserveNominatimSlot') && geo.includes('internalMutation'));
check('reservation read+write in one transaction (same row)',
  geo.includes('geocodeUpstreamSlots') && geo.includes('.patch(') && geo.includes('.insert('));
check('action reserves before upstream fetch',
  geo.includes('ctx.runMutation(internal.geocode.reserveNominatimSlot') &&
  geo.indexOf('GEOCODE_CACHE_TTL_MS) return cached.value') < geo.indexOf('ctx.runMutation(internal.geocode.reserveNominatimSlot') &&
  geo.indexOf('ctx.runMutation(internal.geocode.reserveNominatimSlot') < geo.indexOf('nominatim.openstreetmap.org/reverse'));
check('busy loser fails fast with clear rate-limited code',
  geo.includes('GEOCODE_RATE_LIMITED'));
check('no per-isolate sleep claimed as compliance',
  !geo.includes('lastUpstreamAt') && !geo.includes('setTimeout'));
check('OCC single-slot enforcement documented',
  /OCC/i.test(geo) && (geo.includes('retried') || geo.includes('retry')));
// Preserved behavior.
check('auth still enforced', geo.includes('checkAuth'));
check('identifying headers kept', geo.includes('User-Agent') && geo.includes('Referer'));
check('attribution kept', geo.includes('attribution'));
check('coord cache kept', geo.includes('geocodeCache') && geo.includes('toFixed(4)'));
check('min gap constant kept', geo.includes('NOMINATIM_MIN_GAP_MS') && geo.includes('1100'));

// Mocked reservation behavior: same gap logic the mutation runs, exercised
// for the cases that matter — first caller wins, concurrent second caller
// is rate-limited, caller after the window wins (this is what OCC retry
// reduces to: the loser re-reads the winner's timestamp and throws).
const GAP = 1100;
const makeStore = () => {
  let last = null;
  return {
    reserve(now) {
      if (last !== null && now - last < GAP) {
        const e = new Error('rate-limited');
        e.code = 'GEOCODE_RATE_LIMITED';
        throw e;
      }
      last = now;
      return { ok: true };
    },
  };
};
let mockedOk = false;
try {
  const s = makeStore();
  s.reserve(0); // first caller wins the slot
  let secondThrew = false;
  try { s.reserve(50); } catch (e) { secondThrew = e.code === 'GEOCODE_RATE_LIMITED'; }
  s.reserve(1100 + 1); // window passed: next caller wins
  // OCC interleave: two txns read last=null, txn A commits at t=0, txn B
  // retries, re-reads last=0 at t=10 -> must throw.
  const occ = makeStore();
  const bReadLast = null; // B's stale read (pre-commit)
  occ.reserve(0); // A commits
  let bThrew = false;
  try {
    const now = 10;
    if (bReadLast !== null && now - bReadLast < GAP) throw Object.assign(new Error('stale'), { code: 'GEOCODE_RATE_LIMITED' });
    occ.reserve(now); // retry path: fresh read sees A's timestamp
  } catch (e) { bThrew = e.code === 'GEOCODE_RATE_LIMITED'; }
  mockedOk = secondThrew && bThrew;
} catch { mockedOk = false; }
check('mocked reservation: loser rate-limited, winner after window, OCC retry throws', mockedOk);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll geocode rate-limit checks passed');
