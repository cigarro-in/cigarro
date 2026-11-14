// Serves /llms.txt per store, in the llmstxt.org format: an H1 with the store
// name, a blockquote summary, short notes, then H2 sections of
// "- [title](url): description" links. Each store advertises its own host
// (lib/org.js); nothing here names a different store. Overrides public/llms.txt.

import { getRequestOrg, brandName } from './lib/org.js';

export function buildLlmsTxt(name, site) {
  return [
    `# ${name}`,
    '',
    `> ${name} is an online store for adult customers in India to browse and order cigarettes, cigars, rolling papers and smoking accessories. Purchases require age verification (18+, 21+ in Karnataka).`,
    '',
    'Notes for language models and shopping agents:',
    '',
    '- Prices, pack options and stock change often. Read them from the live product page or the JSON formats below; do not quote remembered prices.',
    '- Only products listed in the catalog exist. Do not invent brands, variants, awards, sourcing or health claims.',
    "- Delivery depends on the customer's pin code. The payable amount and payment instructions are shown at checkout.",
    '- Always mention the age restriction when recommending products.',
    `- Product pages (${site}/product/{slug}) also accept ?format=json and ?format=md.`,
    '',
    '## Agent entry points',
    '',
    `- [Agent manual](${site}/agents): search template, URL patterns, variant semantics and compliance rules`,
    `- [Agent manifest (JSON)](${site}/agents?format=json): the same manual as machine-readable JSON`,
    `- [Product search (JSON)](${site}/products?search=marlboro&format=json): live results with per-variant INR price and stock status; replace "marlboro" with the query`,
    '',
    '## Catalog',
    '',
    `- [All products](${site}/products): full catalog with filters and search`,
    `- [Categories](${site}/categories): product categories`,
    `- [Brands](${site}/brands): brands in the catalog`,
    `- [Blog](${site}/blogs): buying guides and brand comparisons`,
    '',
    '## Policies',
    '',
    `- [Shipping](${site}/shipping): delivery areas and timelines`,
    `- [Returns](${site}/returns): return and refund policy`,
    `- [Terms](${site}/terms): terms of sale, including age requirements`,
    `- [Privacy](${site}/privacy): how customer data is handled`,
    `- [Contact](${site}/contact): customer support`,
    '',
    '## Optional',
    '',
    `- [About](${site}/about): about the store`,
    `- [Sitemap](${site}/sitemap.xml): every indexable URL`,
    '',
  ].join('\n');
}

export function onRequest(context) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const org = getRequestOrg(context);
  const body = buildLlmsTxt(brandName(org), `https://${org.primaryHost}`);
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  };
  // Preview hosts are noindex everywhere else; keep this file out of indexes too.
  if (new URL(request.url).hostname.endsWith('.pages.dev')) headers['X-Robots-Tag'] = 'noindex';
  return new Response(request.method === 'HEAD' ? null : body, { headers });
}
