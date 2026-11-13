// Image step for the Dukaan import.
//   node scripts/dukaan-import/images.mjs download <normalized.json> <imagesDir>
//       Downloads each unique source image sequentially (polite delay, normal UA),
//       converts it to WebP (sharp), writes <imagesDir>/image-manifest.json.
//   STORE_ORIGIN=https://smokeshop.cigarro.in IMPORT_TOKEN=<store admin cigarro_token> \
//   node scripts/dukaan-import/images.mjs upload <imagesDir> <image-map.json>
//       Uploads each WebP through the store's own admin upload endpoint
//       (functions/api/images/upload.js) and writes old URL -> new CDN URL.
// The upload endpoint only accepts WebP and checks that the caller is an admin of the
// store on that host, so run it after the store exists and a store admin token is at hand.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DELAY_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function collect(norm) {
  const items = new Map(); // url -> hint
  const add = (url, hint) => {
    if (!url || !/^https:\/\/dms\.mydukaan\.io\//.test(url)) return;
    if (!items.has(url)) items.set(url, hint);
  };
  add(norm.store.logoUrl, 'store-logo');
  norm.homepage.hero?.images?.forEach((u, i) => add(u, `hero-${i + 1}`));
  for (const c of norm.collections) add(c.ogImage, `${c.slug}-category`);
  for (const p of norm.products) {
    p.images.forEach((img, i) => add(img.sourceUrl, `${p.slug}${i ? `-${i + 1}` : ''}`));
    for (const v of p.variants) add(v.imageUrl, `${p.slug}-variant`);
  }
  for (const b of norm.blogs) {
    add(b.ogImage, `${b.slug}-cover`);
  }
  (norm.homepage.imageUrls || []).forEach((u, i) => add(u, `home-${i + 1}`));
  return items;
}

async function download(normPath, outDir) {
  const norm = JSON.parse(fs.readFileSync(normPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  const items = collect(norm);
  const manifest = [];
  let i = 0;
  for (const [url, hint] of items) {
    i++;
    await sleep(DELAY_MS);
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) {
      manifest.push({ sourceUrl: url, hint, error: `HTTP ${res.status}` });
      console.log(`[${i}/${items.size}] FAIL ${res.status} ${url}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(buf, { animated: false }).webp({ quality: 84 }).toBuffer();
    const meta = await sharp(webp).metadata();
    const file = `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}.webp`;
    fs.writeFileSync(path.join(outDir, file), webp);
    manifest.push({ sourceUrl: url, hint, file, bytes: webp.length, width: meta.width, height: meta.height });
    console.log(`[${i}/${items.size}] ok ${hint} ${meta.width}x${meta.height} ${webp.length}B`);
  }
  fs.writeFileSync(path.join(outDir, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  const failed = manifest.filter((m) => m.error).length;
  console.log(`done: ${manifest.length - failed} converted, ${failed} failed`);
}

async function upload(imagesDir, mapPath) {
  const origin = process.env.STORE_ORIGIN;
  const token = process.env.IMPORT_TOKEN;
  if (!origin || !token) throw new Error('STORE_ORIGIN and IMPORT_TOKEN are required');
  const manifest = JSON.parse(fs.readFileSync(path.join(imagesDir, 'image-manifest.json'), 'utf8'));
  const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};
  for (const m of manifest) {
    if (m.error || !m.file) continue;
    if (map[m.sourceUrl]) continue; // idempotent: already uploaded
    const bytes = fs.readFileSync(path.join(imagesDir, m.file));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/webp' }), `${m.hint}.webp`);
    form.append('folder', 'the2935');
    form.append('slug', m.hint);
    form.append('alt', m.hint.replace(/-/g, ' '));
    const res = await fetch(`${origin}/api/images/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      console.log(`FAIL ${res.status} ${m.hint}: ${body.error || 'no url'}`);
      continue;
    }
    map[m.sourceUrl] = body.url;
    fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
    await sleep(300);
    console.log(`ok ${m.hint} -> ${body.url}`);
  }
  console.log(`image map entries: ${Object.keys(map).length}`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'download') await download(a, b);
else if (cmd === 'upload') await upload(a, b);
else {
  console.error('usage: images.mjs download <normalized.json> <imagesDir> | upload <imagesDir> <image-map.json>');
  process.exit(1);
}
