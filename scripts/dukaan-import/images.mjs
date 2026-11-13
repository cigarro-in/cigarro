// Image step for the Dukaan import, matching the platform upload pipeline
// (src/lib/images/upload.ts + functions/api/images/upload.js):
//   - WebP quality 82, longest side capped at 1600px, metadata stripped
//   - catalog images (products, variants, categories, logo) center-cropped to a square
//   - banners and blog covers keep their aspect ratio
//   - key: asset_images/orgs/<store>/<folder>/<stem>.webp, stem = slug, -2, -3 for more
//
//   node scripts/dukaan-import/images.mjs download <normalized.json> <originalsDir> <outDir>
//       Downloads each unique source image (polite delay), converts it, writes
//       <outDir>/<file>.webp and <outDir>/image-manifest.json (bytes before/after, folder, stem).
//   STORE_ORIGIN=https://smokeshop.cigarro.in IMPORT_TOKEN=<store admin cigarro_token> \
//   node scripts/dukaan-import/images.mjs upload <outDir> <image-map.json>
//       Posts each WebP to the store's admin upload endpoint and writes old URL -> CDN URL.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DELAY_MS = 1000;
const MAX_DIM = 1600;
const QUALITY = 82;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Folder per image role (existing folder names where the code has them).
const FOLDER = {
  product: 'product_images',
  category: 'category_images',
  logo: 'branding',
  hero: 'hero_images',
  blog: 'blog_images',
};

// Every unique source image with its role and stem (slug-based, no IDs or hashes).
function collect(norm) {
  const items = new Map(); // url -> { role, stem, square }
  const add = (url, role, stem, square) => {
    if (!url || !/^https:\/\/dms\.mydukaan\.io\//.test(url)) return;
    if (!items.has(url)) items.set(url, { role, stem, square });
  };
  add(norm.store.logoUrl, 'logo', 'store-logo', true);
  norm.homepage.hero?.images?.forEach((u, i) => add(u, 'hero', `hero-${i + 1}`, false));
  for (const c of norm.collections) add(c.ogImage, 'category', `${c.slug}-1`, true);
  for (const p of norm.products) {
    p.images.forEach((img, i) => add(img.sourceUrl, 'product', `${p.slug}-${i + 1}`, true));
    p.variants.forEach((v, i) => add(v.imageUrl, 'product', `${p.slug}-variant-${i + 1}`, true));
  }
  for (const b of norm.blogs) add(b.coverImage ?? b.ogImage, 'blog', `${b.slug}-cover`, false);
  (norm.homepage.imageUrls || []).forEach((u, i) => add(u, 'hero', `home-${i + 1}`, false));
  return items;
}

async function convert(buf, square) {
  let img = sharp(buf, { failOn: 'none' }).rotate();
  if (square) {
    const meta = await img.metadata();
    const side = Math.min(meta.width ?? 0, meta.height ?? 0);
    if (side > 0) {
      img = img.extract({
        left: Math.floor(((meta.width ?? side) - side) / 2),
        top: Math.floor(((meta.height ?? side) - side) / 2),
        width: side,
        height: side,
      });
    }
  }
  // Longest side capped; never enlarge. No withMetadata(): metadata is stripped.
  const out = await img
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });
  return out;
}

async function download(normPath, originalsDir, outDir) {
  const norm = JSON.parse(fs.readFileSync(normPath, 'utf8'));
  fs.mkdirSync(originalsDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const items = collect(norm);
  const manifest = [];
  let i = 0;
  for (const [url, it] of items) {
    i++;
    const folder = FOLDER[it.role];
    const file = `${folder}/${it.stem}.webp`;
    const outPath = path.join(outDir, file);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await sleep(DELAY_MS);
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) {
      manifest.push({ sourceUrl: url, folder, stem: it.stem, error: `HTTP ${res.status}` });
      console.log(`[${i}/${items.size}] FAIL ${res.status} ${url}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const { data, info } = await convert(buf, it.square);
    fs.writeFileSync(outPath, data);
    manifest.push({
      sourceUrl: url,
      folder,
      stem: it.stem,
      file,
      bytesBefore: buf.length,
      bytesAfter: data.length,
      width: info.width,
      height: info.height,
    });
    console.log(`[${i}/${items.size}] ok ${file} ${info.width}x${info.height} ${buf.length}B -> ${data.length}B`);
  }
  fs.writeFileSync(path.join(outDir, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  const ok = manifest.filter((m) => m.file);
  const before = ok.reduce((n, m) => n + m.bytesBefore, 0);
  const after = ok.reduce((n, m) => n + m.bytesAfter, 0);
  console.log(`done: ${ok.length} converted, ${manifest.length - ok.length} failed; ${before} B -> ${after} B`);
}

async function upload(imagesDir, mapPath) {
  const origin = process.env.STORE_ORIGIN;
  const token = process.env.IMPORT_TOKEN;
  if (!origin || !token) throw new Error('STORE_ORIGIN and IMPORT_TOKEN are required');
  const manifest = JSON.parse(fs.readFileSync(path.join(imagesDir, 'image-manifest.json'), 'utf8'));
  const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};
  for (const m of manifest) {
    if (m.error || !m.file) continue;
    if (map[m.sourceUrl]) continue; // idempotent
    const bytes = fs.readFileSync(path.join(imagesDir, m.file));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/webp' }), `${m.stem}.webp`);
    form.append('folder', m.folder);
    form.append('slug', m.stem);
    const res = await fetch(`${origin}/api/images/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      console.log(`FAIL ${res.status} ${m.file}: ${body.error || 'no url'}`);
      continue;
    }
    map[m.sourceUrl] = body.url;
    fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
    await sleep(300);
    console.log(`ok ${m.file} -> ${body.url}`);
  }
  console.log(`image map entries: ${Object.keys(map).length}`);
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'download') await download(a, b, c);
else if (cmd === 'upload') await upload(a, b);
else {
  console.error('usage: images.mjs download <normalized.json> <originalsDir> <outDir> | upload <outDir> <image-map.json>');
  process.exit(1);
}
