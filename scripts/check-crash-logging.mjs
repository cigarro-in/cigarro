import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { v } from 'convex/values';

function load(file, imports = {}, globals = {}) {
  let source = readFileSync(new URL(file, import.meta.url), 'utf8');
  source = source.replaceAll('import.meta.env.PROD', 'true').replaceAll('import.meta.url', "'https://cigarro.in/assets/index-test.js'");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, Error, RangeError, Request, Response, TextEncoder, TextDecoder,
    Uint8Array, AbortSignal, console, crypto: webcrypto,
    require: name => { assert.ok(name in imports, name); return imports[name]; }, ...globals });
  return exports;
}

const sanitize = load('../convex/lib/crashLog.ts', { 'convex/values': { v } });
const dirty = 'Failed token=secret otp=123456 Bearer abc.def +919876543210 user@example.com https://cigarro.in/cart?token=secret#otp';
const clean = sanitize.redactCrashText(dirty);
for (const secret of ['secret', '123456', 'abc.def', '9876543210', 'user@example.com', '?token', '#otp']) assert.ok(!clean.includes(secret), secret);
assert.equal(sanitize.crashPath('/cart?phone=123#otp'), '/cart');
assert.equal(sanitize.redactCrashText('Argument error {"name":"Customer","address":"private"}\n at app.ts:1'), 'Argument error [details redacted]\n at app.ts:1');
assert.equal(sanitize.redactCrashText('x'.repeat(20000)).length, 8000);

const saved = [];
let authorized = false;
const backend = load('../convex/crashLogs.ts', {
  './_generated/server': { internalMutation: config => config, query: config => config },
  './_generated/api': { internal: { crashLogs: { prune: 'prune' } } },
  'convex/values': { v }, './lib/crashLog': sanitize,
  './lib/auth': { requireOrgAdmin: async () => { if (!authorized) throw new Error('FORBIDDEN'); } },
});
const ctx = { db: {
  query: table => ({ withIndex() { return this; }, unique: async () => ({ _id: 'org' }),
    take: async () => table === 'crashLogs' ? saved : [], order() { return this; } }),
  insert: async (table, data) => { assert.equal(table, 'crashLogs'); saved.push(data); return 'id'; },
} };
assert.equal((await backend.record.handler(ctx, { orgSlug: 'oldsmokeshop', reporter: 'hashed', report: { source: 'app', message: dirty, path: '/cart?token=secret' } })).accepted, true);
assert.equal(saved[0].orgId, 'org');
assert.equal(saved[0].path, '/cart');
assert.equal(saved[0].message, clean);
saved.length = 20;
assert.equal((await backend.record.handler(ctx, { orgSlug: 'oldsmokeshop', reporter: 'hashed', report: { source: 'app', message: 'flood' } })).accepted, false);
await assert.rejects(backend.list.handler(ctx, { orgId: 'org' }), /FORBIDDEN/);
authorized = true;
assert.equal((await backend.list.handler(ctx, { orgId: 'org' })).length, 20);

let sent;
const transport = load('../functions/lib/crash-logs.js', {
  './env.js': { requiredConvexUrl: env => env.VITE_CONVEX_URL },
}, { fetch: async (url, options) => { sent = { url, options }; return new Response('{}'); } });
const context = {
  env: { EDGE_SHARED_SECRET: 'server-secret', VITE_CONVEX_URL: 'https://example.convex.cloud' },
  request: new Request('https://cigarro.in/api/crash-logs', { headers: { 'cf-connecting-ip': '1.2.3.4', 'cf-ray': 'ray-id' } }),
};
assert.equal(await transport.persistCrash(context, { message: 'error', source: 'cloudflare' }, 'app'), true);
assert.equal(sent.url, 'https://example.convex.site/crashLogs');
assert.equal(sent.options.headers.authorization, 'Bearer server-secret');
const payload = JSON.parse(sent.options.body);
assert.equal(payload.report.source, 'app');
assert.equal(payload.report.requestId, 'ray-id');
assert.equal(payload.reporter.length, 64);
assert.ok(!sent.options.body.includes('1.2.3.4'));
assert.ok(!sent.options.body.includes('server-secret'));

const endpoint = load('../functions/api/crash-logs.js', { '../lib/crash-logs.js': transport });
const request = (body, origin = 'https://cigarro.in') => new Request('https://cigarro.in/api/crash-logs', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body,
});
assert.equal((await endpoint.onRequestPost({ ...context, request: request('{') })).status, 400);
assert.equal((await endpoint.onRequestPost({ ...context, request: request('{}', 'https://evil.test') })).status, 403);
assert.equal((await endpoint.onRequestPost({ ...context, request: request('x'.repeat(20001)) })).status, 413);
assert.equal((await endpoint.onRequestPost({ ...context, request: request('{"message":"crash","source":"cloudflare"}') })).status, 204);
assert.equal(JSON.parse(sent.options.body).report.source, 'app');

const edgeReports = [];
const middleware = load('../functions/_middleware.js', {
  './ssr-middleware.js': { onRequest: async () => new Response('SSR') },
  './lib/crash-logs.js': { persistCrash: async (_context, report) => edgeReports.push(report) },
});
const pending = [];
const edgeContext = {
  request: new Request('https://cigarro.in/api/products'),
  next: async () => new Response('{"error":"Catalog failed","details":"Convex catalog:fullCatalog failed"}', { status: 500, headers: { 'content-type': 'application/json' } }),
  waitUntil: promise => pending.push(promise),
};
const failedResponse = await middleware.onRequest(edgeContext);
assert.equal(failedResponse.status, 500);
await Promise.all(pending);
assert.ok(edgeReports[0].message.includes('Convex catalog:fullCatalog failed'));
const original = new Error('Edge exception');
await assert.rejects(middleware.onRequest({ ...edgeContext, next: async () => { throw original; } }), error => error === original);
await Promise.all(pending);
assert.ok(edgeReports[1].stack.includes('Edge exception'));
const count = edgeReports.length;
await middleware.onRequest({ ...edgeContext, next: async () => new Response('OK') });
assert.equal(edgeReports.length, count);
await middleware.onRequest({ ...edgeContext, request: new Request('https://cigarro.in/api/crash-logs') });
assert.equal(edgeReports.length, count);

const reports = [];
const browser = load('../src/lib/crashReporting.ts', {}, {
  window: { location: { pathname: '/cart' } },
  fetch: async (url, options) => { reports.push({ url, ...options }); },
});
browser.reportCrash(new Error('render failure'), { componentStack: 'at Cart', operation: 'ErrorBoundary:page' });
browser.reportCrash(new Error('render failure'));
assert.equal(reports.length, 1);
assert.equal(reports[0].credentials, 'omit');
assert.equal(JSON.parse(reports[0].body).componentStack, 'at Cart');
for (let i = 0; i < 40; i++) browser.reportCrash(new Error(`crash ${i}`));
assert.equal(reports.length, 20);
const broken = load('../src/lib/crashReporting.ts', {}, { window: { location: { pathname: '/' } }, fetch: () => Promise.reject(new Error('offline')) });
assert.doesNotThrow(() => broken.reportCrash(new Error('crash')));
console.log('Crash logging checks passed: redaction, org scope, admin access, rate limits, secret transport, bounded intake, edge 500s/exceptions, deduplication and offline safety.');
