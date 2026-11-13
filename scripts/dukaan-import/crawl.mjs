// One-off crawler for a Dukaan storefront (the user's own store).
// Usage: node scripts/dukaan-import/crawl.mjs <outDir>
// Sequential requests with a delay, normal browser UA. Writes raw JSON per entity
// plus normalized.json (see README.md in the output dir for the schema).
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://mydukaan.io/the2935';
const ORIGIN = 'https://mydukaan.io';
const STORE_PREFIX = '/the2935';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DELAY_MS = 1200;

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node crawl.mjs <outDir>');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---- fetching ---------------------------------------------------------------
const fetchLog = [];
async function get(url) {
  await sleep(DELAY_MS);
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow' });
  const text = await res.text();
  fetchLog.push({ url, status: res.status, bytes: text.length, at: new Date().toISOString() });
  return { status: res.status, text };
}

// ---- RSC flight decoding ----------------------------------------------------
// Next.js embeds the RSC payload as self.__next_f.push([1,"..."]) chunks.
function decodeFlight(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  let out = '';
  while ((m = re.exec(html))) out += JSON.parse('"' + m[1] + '"');
  return out;
}

// Return index of the matching close bracket for the open bracket at i (string-aware).
function matchEnd(s, i) {
  let depth = 0;
  let inStr = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) {
      if (c === '\\') j++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

// Parse the JSON value that starts right after `key` (e.g. '"product":') in flight text.
// Tries every occurrence of the key and returns the first value that parses and
// satisfies `accept` (default: any).
function jsonAfter(flight, key, accept = () => true) {
  let idx = flight.indexOf(key);
  while (idx >= 0) {
    const start = idx + key.length;
    const open = flight[start];
    if (open === '{' || open === '[') {
      const end = matchEnd(flight, start);
      if (end > 0) {
        try {
          const val = JSON.parse(flight.slice(start, end + 1));
          if (accept(val)) return val;
        } catch {
          /* keep scanning */
        }
      }
    }
    idx = flight.indexOf(key, idx + key.length);
  }
  return undefined;
}

// Inner HTML of the first element whose opening tag matches `openRe` (balanced for the same tag name).
function innerOf(html, openRe) {
  const m = html.match(openRe);
  if (!m) return null;
  const tag = m[0].match(/^<([a-z0-9]+)/i)[1].toLowerCase();
  const start = m.index + m[0].length;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 1;
  let x;
  while ((x = re.exec(html))) {
    if (x[1]) depth--;
    else if (!x[0].endsWith('/>')) depth++;
    if (depth === 0) return html.slice(start, x.index).trim();
  }
  return null;
}

// ---- HTML helpers -----------------------------------------------------------
const decode = (s) =>
  (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, 'i');
  const m = html.match(re);
  if (m) return decode(m[1]);
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${name}"`, 'i');
  const m2 = html.match(re2);
  return m2 ? decode(m2[1]) : null;
}
const title = (html) => {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]) : null;
};
const canonical = (html) => {
  const m = html.match(/<link rel="canonical" href="([^"]*)"/i);
  return m ? decode(m[1]) : null;
};
const h1 = (html) => {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? decode(m[1].replace(/<[^>]+>/g, '')) : null;
};
// Inner HTML of <main id="main">…</main> (the page body, without header/footer chrome).
function mainHtml(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1].trim() : null;
}
const textOf = (html) =>
  decode(
    (html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|section|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim()
  );

// Collect internal store links (hrefs) from HTML.
function storeLinks(html) {
  const set = new Set();
  const re = /href="((?:https:\/\/mydukaan\.io)?\/the2935[^"#?]*)/g;
  let m;
  while ((m = re.exec(html))) {
    let p = m[1].replace(ORIGIN, '');
    p = p.replace(/\/$/, '') || STORE_PREFIX;
    set.add(p);
  }
  return set;
}

const slugFromPath = (p) => p.replace(STORE_PREFIX, '').split('/').filter(Boolean);

// ---- main -------------------------------------------------------------------
fs.mkdirSync(path.join(outDir, 'raw', 'products'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'raw', 'collections'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'raw', 'pages'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'raw', 'blogs'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'raw', 'html'), { recursive: true });

const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));

// 1. Home page
log('home');
const home = await get(BASE + '/');
const homeHtml = home.text;
fs.writeFileSync(path.join(outDir, 'raw', 'html', 'home.html'), homeHtml);
const homeFlight = decodeFlight(homeHtml);
fs.writeFileSync(path.join(outDir, 'raw', 'html', 'home.flight.txt'), homeFlight);

// 2. Sitemap (authoritative list of URLs)
log('sitemap');
const sm = await get(BASE + '/sitemap.xml');
const smUrls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
fs.writeFileSync(path.join(outDir, 'raw', 'sitemap.xml'), sm.text);

// 3. Collections index
log('collections index');
const colIndex = await get(BASE + '/collections');
fs.writeFileSync(path.join(outDir, 'raw', 'html', 'collections.html'), colIndex.text);

// Discovery: union of sitemap URLs and links found on the home and collections pages.
const discovered = new Set();
for (const u of smUrls) discovered.add(new URL(u).pathname.replace(/\/$/, '') || STORE_PREFIX);
for (const p of storeLinks(homeHtml)) discovered.add(p);
for (const p of storeLinks(colIndex.text)) discovered.add(p);
discovered.add(STORE_PREFIX + '/collections/all');
discovered.add(STORE_PREFIX + '/blogs');
discovered.add(STORE_PREFIX);

const routeOf = (p) => {
  const parts = slugFromPath(p);
  if (parts.length === 0) return 'home';
  if (parts[0] === 'collections' && parts.length === 1) return 'collections-index';
  if (parts[0] === 'collections' && parts.length === 2) return 'collection';
  if (parts[0] === 'products' && parts.length === 2) return 'product';
  if (parts[0] === 'pages' && parts.length === 2) return 'page';
  if (parts[0] === 'blogs' && parts.length === 1) return 'blog-index';
  if (parts[0] === 'blogs' && parts.length === 2) return 'blog';
  return 'other';
};

const pagesToFetch = [...discovered].sort();
log('discovered', pagesToFetch.length, 'urls');

const products = new Map(); // slug -> normalized product
const collections = new Map(); // slug -> {name,url,...,productSlugs}
const pages = [];
const blogs = [];
const others = [];
const productCategoryLinks = new Map(); // productSlug -> Set(collectionSlug)
let storeObj = null;

for (const p of pagesToFetch) {
  const route = routeOf(p);
  if (route === 'home' || route === 'collections-index') continue; // already fetched
  const url = ORIGIN + p;
  const r = await get(url);
  if (r.status !== 200) {
    log('  !', r.status, p);
    others.push({ url, route, status: r.status });
    continue;
  }
  const html = r.text;
  const name = p.split('/').pop();

  if (route === 'product') {
    const flight = decodeFlight(html);
    const prod = jsonAfter(flight, '"product":');
    const store = jsonAfter(flight, '"store":');
    if (store && !storeObj) storeObj = store;
    if (!prod) {
      log('  ! no product json', p);
      others.push({ url, route, status: 'no-json' });
      continue;
    }
    writeJson(path.join(outDir, 'raw', 'products', `${prod.slug}.json`), { url, product: prod, store });
    fs.writeFileSync(path.join(outDir, 'raw', 'html', `product-${prod.slug}.html`), html);
    products.set(prod.slug, {
      sourceId: prod.id,
      sourceUuid: prod.uuid,
      slug: prod.slug,
      url,
      name: decode(prod.name),
      // Dukaan prices are whole rupees (verified: JSON 4800 renders as ₹4,800).
      priceRupees: prod.price,
      compareAtRupees: prod.compare_at || null,
      priceVaries: !!prod.price_varies,
      inStock: !!prod.in_stock,
      unit: prod.unit || null,
      baseQty: prod.base_qty ?? null,
      gtin: prod.gtin || null,
      rating: prod.rating ?? null,
      reviews: prod.reviews ?? null,
      descriptionHtml: prod.description || '',
      descriptionText: textOf(prod.description || ''),
      images: (prod.images || []).map((u, i) => ({ sourceUrl: u, position: i })),
      options: (prod.options || []).map((o) => ({ name: o.name, values: o.values || [] })),
      variants: (prod.skus || []).map((s) => ({
        sourceId: s.id,
        sourceUuid: s.uuid,
        sku: s.code || null,
        priceRupees: s.price,
        compareAtRupees: s.compare_at || null,
        inStock: !!s.in_stock,
        options: s.options || {},
        imageUrl: s.image || null,
        allImages: s.all_images || [],
        isDefault: s.id === prod.default_sku,
      })),
      categoryCollectionSlugs: prod.collection ? [prod.collection.slug] : [],
      primaryCollection: prod.collection || null,
      seo: {
        title: meta(html, 'og:title') || title(html),
        description: meta(html, 'description'),
        canonical: canonical(html),
        ogImage: meta(html, 'og:image'),
      },
      updatedAt: prod.updated_at || null,
    });
  } else if (route === 'collection') {
    const flight = decodeFlight(html);
    // The listing payload is the first `"products":[{...}]` array with product objects.
    const list = jsonAfter(flight, '"products":', (x) => Array.isArray(x) && x.every((p) => p && p.slug));
    const productsArr = Array.isArray(list) ? list : [];
    const cSlug = decodeURIComponent(name);
    // Intro copy (SEO text above the grid) and subcategory tiles.
    const introHtml = innerOf(html, /<div class="prose muted listing-desc"[^>]*>/i);
    const childBlock = innerOf(html, /<section class="collection-children"[^>]*>/i) || '';
    const childSlugs = [...childBlock.matchAll(/href="\/the2935\/collections\/([^"?#]+)"/g)].map((m) => decodeURIComponent(m[1]));
    const countText = (html.match(/<span class="muted small">(\d+) products<\/span>/) || [])[1];
    writeJson(path.join(outDir, 'raw', 'collections', `${cSlug}.json`), {
      url,
      h1: h1(html),
      title: title(html),
      canonical: canonical(html),
      metaDescription: meta(html, 'description'),
      ogImage: meta(html, 'og:image'),
      introHtml,
      childSlugs,
      countText: countText ? Number(countText) : null,
      productSlugs: productsArr.map((x) => x.slug),
      productsRaw: productsArr,
    });
    fs.writeFileSync(path.join(outDir, 'raw', 'html', `collection-${cSlug}.html`), html);
    for (const x of productsArr) {
      if (!productCategoryLinks.has(x.slug)) productCategoryLinks.set(x.slug, new Set());
      productCategoryLinks.get(x.slug).add(cSlug);
    }
    collections.set(cSlug, {
      slug: cSlug,
      url,
      name: h1(html),
      title: title(html),
      canonical: canonical(html),
      metaDescription: meta(html, 'description'),
      ogImage: meta(html, 'og:image'),
      descriptionHtml: introHtml,
      descriptionText: textOf(introHtml || ''),
      childSlugs,
      parentSlugs: [],
      productSlugs: productsArr.map((x) => x.slug),
      productCount: productsArr.length,
      countText: countText ? Number(countText) : null,
    });
  } else if (route === 'page') {
    const mh = mainHtml(html);
    fs.writeFileSync(path.join(outDir, 'raw', 'pages', `${name}.html`), html);
    pages.push({
      slug: decodeURIComponent(name),
      url,
      title: h1(html) || title(html),
      seoTitle: title(html),
      metaDescription: meta(html, 'description'),
      canonical: canonical(html),
      contentHtml: mh,
      contentText: textOf(mh || ''),
    });
  } else if (route === 'blog') {
    const body = innerOf(html, /<div class="wrap article-body"[^>]*>/i) || mainHtml(html);
    const cover = (html.match(/<div class="wrap article-cover"[\s\S]*?<img src="([^"]+)"/) || [])[1];
    const byline = (html.match(/<p class="muted small">([^<]*·[^<]*)<\/p>/) || [])[1];
    fs.writeFileSync(path.join(outDir, 'raw', 'blogs', `${name}.html`), html);
    blogs.push({
      slug: decodeURIComponent(name),
      url,
      title: h1(html) || title(html),
      seoTitle: title(html),
      metaDescription: meta(html, 'description'),
      canonical: canonical(html),
      ogImage: meta(html, 'og:image'),
      coverImage: cover ? decode(cover) : null,
      byline: byline ? decode(byline) : null,
      contentHtml: body,
      contentText: textOf(body || ''),
    });
  } else {
    others.push({ url, route, status: 200 });
  }
}

// Fill product -> category (collection) links
for (const [slug, prod] of products) {
  const set = productCategoryLinks.get(slug) || new Set();
  if (prod.primaryCollection) set.add(prod.primaryCollection.slug);
  prod.categoryCollectionSlugs = [...set].sort();
}

// Category tree: a collection's subcategory tiles name its children.
for (const c of collections.values()) {
  for (const ch of c.childSlugs) {
    const child = collections.get(ch);
    if (child && !child.parentSlugs.includes(c.slug)) child.parentSlugs.push(c.slug);
  }
}

// Home hero (eyebrow, headline, lead, CTAs, images), from the first `hero` section.
const heroHtml = innerOf(homeHtml, /<section class="hero[^"]*"[^>]*>/i) || '';
const heroText = (re) => decode((heroHtml.match(re) || [])[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '');
const hero = {
  eyebrow: heroText(/<span class="eyebrow">([\s\S]*?)<\/span>/) || null,
  title: heroText(/<h1[^>]*>([\s\S]*?)<\/h1>/) || null,
  lead: heroText(/<p class="lead">([\s\S]*?)<\/p>/) || null,
  ctas: [...heroHtml.matchAll(/<a class="btn[^"]*" href="([^"]+)">([\s\S]*?)<\/a>/g)].map((m) => ({
    href: decode(m[1]),
    text: decode(m[2].replace(/<[^>]+>/g, '').trim()),
  })),
  images: [...heroHtml.matchAll(/<img src="([^"]+)"/g)].map((m) => decode(m[1])),
};

// Store / home information
const storeRaw = storeObj || {};
const cssRoot = (homeHtml.match(/:root\{([^}]*)\}/) || [])[1] || '';
const themeAttrs = (homeHtml.match(/<html([^>]*)>/) || [])[1] || '';
const socialLinks = [...new Set([...homeHtml.matchAll(/href="(https?:\/\/(?:www\.)?(?:facebook|instagram|twitter|x|youtube|linkedin|wa\.me|api\.whatsapp)[^"]*)"/gi)].map((m) => decode(m[1])))];
const fontFamilies = [...new Set([...homeHtml.matchAll(/fonts\.googleapis\.com\/css2\?family=([^"&\\]+)/g)].map((m) => decodeURIComponent(m[1])))];
const logoUrl = storeRaw.logo || null;

// Hero / banners: the home page image URLs from dms.mydukaan.io with an <img> context
const homeImages = [...new Set([...homeHtml.matchAll(/https:\/\/dms\.mydukaan\.io\/[^"'\s)\\]+/g)].map((m) => m[0]))];

// Category tree from the home category tiles: tile href /the2935/collections/<slug>, plus counts.
const homeCategoryTiles = [...homeFlight.matchAll(/"className":"tile","href":"\/the2935\/collections\/([^"]+)"/g)].map((m) => m[1]);

const normalized = {
  source: {
    platform: 'dukaan',
    storeSlug: 'the2935',
    baseUrl: BASE,
    crawledAt: new Date().toISOString(),
    note: 'Prices are whole rupees in the source; convert with rupeesToPaise at import time.',
  },
  store: {
    name: decode(storeRaw.name || 'The Smoke Shop'),
    seoTitle: storeRaw.seo?.title || null,
    seoDescription: storeRaw.seo?.description || null,
    seoImage: storeRaw.seo?.image || null,
    logoUrl,
    currency: storeRaw.currency || { code: 'INR', symbol: '₹', decimals: 2, locale: 'en-IN' },
    address: storeRaw.address || null,
    phone: storeRaw.phone || null,
    email: storeRaw.email || null,
    whatsapp: !!storeRaw.whatsapp,
    deliveryNote: storeRaw.delivery_happens_with_in || null,
    minOrderValue: storeRaw.min_order_value ?? null,
    hours: storeRaw.hours || null,
    socialLinks,
    fontFamilies,
    themeAttributes: themeAttrs.trim(),
    cssRootVariables: cssRoot,
  },
  homepage: {
    url: BASE + '/',
    title: title(homeHtml),
    metaDescription: meta(homeHtml, 'description'),
    h1: h1(homeHtml),
    hero,
    categoryTileSlugs: [...new Set(homeCategoryTiles)],
    imageUrls: homeImages,
  },
  // `all` is Dukaan's virtual "every product" listing, not a category.
  collections: [...collections.values()].filter((c) => c.slug !== 'all').sort((a, b) => a.slug.localeCompare(b.slug)),
  products: [...products.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  pages,
  blogs,
  otherUrls: others,
  fetchLog,
};

writeJson(path.join(outDir, 'normalized.json'), normalized);
writeJson(path.join(outDir, 'fetch-log.json'), fetchLog);
log('done', {
  products: normalized.products.length,
  variants: normalized.products.reduce((n, p) => n + p.variants.length, 0),
  collections: normalized.collections.length,
  pages: pages.length,
  blogs: blogs.length,
  others: others.length,
  requests: fetchLog.length,
});
