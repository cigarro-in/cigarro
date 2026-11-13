// Builds the 301 map from every old Dukaan URL the crawl fetched to this platform's path.
//   node scripts/dukaan-import/redirects.mjs <normalized.json> <outDir> <customHost>
// Writes:
//   <outDir>/redirects.csv                 from,to,status  (paths on the custom domain; importable via SEO → Redirects)
//   <outDir>/redirects-mydukaan.csv        from,to,status  (full mydukaan.io URLs; reference only, we cannot serve them)
// Uses the same path mapping as the importer (src/lib/storeImport/dukaan.ts), so CTA links and redirects agree.
import fs from 'node:fs';
import path from 'node:path';
import { mapSourcePath } from '../../src/lib/storeImport/dukaan.ts';

const [normPath, outDir, customHost = 'smokeshop.co.in'] = process.argv.slice(2);
if (!normPath || !outDir) {
  console.error('usage: node redirects.mjs <normalized.json> <outDir> [customHost]');
  process.exit(1);
}
const norm = JSON.parse(fs.readFileSync(normPath, 'utf8'));
const SOURCE = norm.source.storeSlug; // "the2935"
const PREFIX = `/${SOURCE}`;

const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const toCsv = (rows) => ['from,to,status', ...rows.map((r) => [r.from, r.to, r.status].map(csv).join(','))].join('\n') + '\n';

// Every URL the crawl requested (sitemap + discovered), keyed by path.
const urls = [...new Set(norm.fetchLog.map((f) => f.url))];
const rowsCustom = new Map();
const rowsMydukaan = [];

for (const url of urls) {
  const u = new URL(url);
  if (!u.pathname.startsWith(PREFIX)) continue;
  const rel = u.pathname.slice(PREFIX.length) || '/'; // e.g. /products/x, /collections/x
  if (rel === '/' ) continue; // home stays home

  let target = mapSourcePath(u.pathname, SOURCE);
  // Dead source URLs (Dukaan 404s them, but they are still in its sitemap) go to the
  // listing above them, not to a page that does not exist here.
  const fetched = norm.fetchLog.find((f) => f.url === url);
  if (fetched && fetched.status !== 200) target = rel.startsWith('/blogs') ? '/blogs' : '/';
  if (target === rel) continue;

  if (!rowsCustom.has(rel)) rowsCustom.set(rel, { from: rel, to: target, status: 301 });
  rowsMydukaan.push({ from: url, to: `https://${customHost}${target}`, status: 301 });
}

// Things the crawl did not request but Dukaan serves: the shop listing and the
// collections index are reached by slugs listed in the store, so cover them explicitly.
for (const extra of ['/shop', '/collections', '/collections/all', '/account', '/search']) {
  const target = mapSourcePath(extra, SOURCE);
  if (target !== extra && !rowsCustom.has(extra)) {
    rowsCustom.set(extra, { from: extra, to: target, status: 301 });
    rowsMydukaan.push({ from: `https://mydukaan.io${PREFIX}${extra}`, to: `https://${customHost}${target}`, status: 301 });
  }
}

const rows = [...rowsCustom.values()].sort((a, b) => a.from.localeCompare(b.from));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'redirects.csv'), toCsv(rows));
fs.writeFileSync(path.join(outDir, 'redirects-mydukaan.csv'), toCsv(rowsMydukaan));
console.log(`redirects: ${rows.length} custom-domain paths, ${rowsMydukaan.length} mydukaan URLs`);
