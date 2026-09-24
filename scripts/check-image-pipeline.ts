import assert from 'node:assert/strict';
import { convertToWebp } from '../src/lib/images/upload';
import { blockedTarget, onRequest as fetchImage } from '../functions/api/images/fetch.js';
import { onRequest as uploadImage } from '../functions/api/images/upload.js';

async function main() {
const canvas = { width: 0, height: 0, toBlob: (done: (blob: Blob) => void) => done(new Blob(['webp'], { type: 'image/webp' })) };
let draw: number[] = [];
(canvas as any).getContext = () => ({ drawImage: (...args: unknown[]) => { draw = args.slice(1) as number[]; } });
(globalThis as any).document = { createElement: () => canvas };
(globalThis as any).createImageBitmap = async () => ({ width: 1600, height: 900, close() {} });

await convertToWebp(new Blob(['image']));
assert.equal(canvas.width, 900);
assert.equal(canvas.height, 900);
assert.deepEqual(draw, [350, 0, 900, 900, 0, 0, 900, 900]);

await convertToWebp(new Blob(['image']), Infinity, 0.82, false);
assert.equal(canvas.width, 1600);
assert.equal(canvas.height, 900);
assert.deepEqual(draw, [0, 0, 1600, 900, 0, 0, 1600, 900]);

for (const url of ['http://127.0.0.1/a', 'http://[::1]/a', 'http://localhost/a', 'file:///a']) {
  assert.ok(blockedTarget(url), url);
}
assert.equal(blockedTarget('https://example.com/a.webp'), null);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } });
try {
  const response = await fetchImage({ request: new Request('https://cigarro.in/api/images/fetch?url=https%3A%2F%2Fexample.com%2Fa.jpg'), env: { UPLOAD_REQUIRE_ADMIN: 'false' } });
  assert.equal(response.status, 400);
} finally {
  globalThis.fetch = originalFetch;
}

let storedKey = '';
const bucket = { put: async (key: string) => { storedKey = key; } };
const upload = async (type: string, bytes: Uint8Array) => {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), 'image.webp');
  form.append('slug', 'Camel Yellow Packet.jpg');
  return uploadImage({
    request: new Request('https://cigarro.in/api/images/upload', { method: 'POST', body: form }),
    env: { UPLOAD_REQUIRE_ADMIN: 'false', R2_ASSETS: bucket },
  });
};
assert.equal((await upload('image/webp', new TextEncoder().encode('not a webp'))).status, 400);
assert.equal((await upload('image/jpeg', new TextEncoder().encode('jpeg bytes'))).status, 400);
assert.equal((await upload('image/webp', new TextEncoder().encode('RIFFxxxxWEBPimage'))).status, 200);
assert.match(storedKey, /^asset_images\/camel-yellow-packet-[a-z0-9]+\.webp$/);
console.log('Image crop, original dimensions, and remote URL guards passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
