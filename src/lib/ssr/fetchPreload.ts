import { preloadKey, type PreloadMap } from './preload';

export interface PreloadRequest {
  // Convex function path, e.g. "catalog:fullCatalog" (getFunctionName output).
  fnName: string;
  // Must equal the args the client hook passes (same orgSlug, same keys).
  args?: Record<string, unknown>;
}

// Server-side (Workers, no Node APIs): runs Convex queries over HTTP and
// returns a registry map. A failed or slow query is omitted, so the client
// falls back to its live query. Never throws.
export async function fetchPreload(
  convexUrl: string,
  requests: PreloadRequest[],
  opts: { timeoutMs?: number } = {},
): Promise<PreloadMap> {
  const base = convexUrl.replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? 2000;
  const map: PreloadMap = {};
  await Promise.all(
    requests.map(async ({ fnName, args }) => {
      try {
        const res = await fetch(`${base}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fnName, args: args ?? {}, format: 'json' }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const body = (await res.json()) as { status?: string; value?: unknown };
        if (body.status !== 'success') return;
        map[preloadKey(fnName, args)] = body.value === undefined ? null : body.value;
      } catch {
        // Omitted: the live query on the client covers it.
      }
    }),
  );
  return map;
}

// Characters that could end the script element or break JS parsing in an
// inline <script>: < > & and the two JS line separators.
const UNSAFE_IN_SCRIPT = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

// Safe inline <script> for the SSR shell. Each unsafe character becomes a
// JSON-neutral unicode escape, so the payload cannot close the script tag.
export function serializePreload(map: PreloadMap): string {
  const bs = String.fromCharCode(92);
  const json = JSON.stringify(map).replace(
    UNSAFE_IN_SCRIPT,
    (c) => bs + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
  return `<script>window.__PRELOAD__=${json};</script>`;
}
