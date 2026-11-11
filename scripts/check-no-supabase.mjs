// Supabase removal gate: no Supabase SDK imports or env references left in app code.
// Fails if any file under src/, convex/ or functions/ imports '@supabase/' or
// references VITE_SUPABASE_ / SUPABASE_URL.
// Run: node scripts/check-no-supabase.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['src', 'convex', 'functions'].map((d) => join(repoRoot, d));
const failures = [];

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(e)) continue;
    const src = readFileSync(p, 'utf8');
    if (/['"]@supabase\//.test(src)) failures.push(`${p}: imports @supabase/*`);
    if (/VITE_SUPABASE_|SUPABASE_URL/.test(src)) failures.push(`${p}: references VITE_SUPABASE_ / SUPABASE_URL`);
  }
}
for (const root of roots) walk(root);

if (failures.length) {
  console.error(`FAIL  ${failures.length} Supabase violation(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('PASS  no @supabase imports or SUPABASE_* env references under src/, convex/, functions/');
