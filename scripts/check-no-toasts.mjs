// Phase 3 gate: no toasts anywhere under src/.
// Fails if any file imports sonner or mounts <Toaster>.
// Run: node scripts/check-no-toasts.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const failures = [];

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(e)) continue;
    const src = readFileSync(p, 'utf8');
    if (/from\s+['"]sonner['"]/.test(src)) failures.push(`${p}: imports sonner`);
    if (/<Toaster[\s>]/.test(src)) failures.push(`${p}: mounts <Toaster>`);
  }
}
walk(root);

if (failures.length) {
  console.error(`FAIL  ${failures.length} toast violation(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('PASS  no sonner imports or <Toaster> mounts under src/');
