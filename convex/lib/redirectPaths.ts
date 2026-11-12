// Pure path helpers for org redirects. No Convex imports: safe to unit test
// and to mirror in the edge (functions/lib/redirects.js keeps a copy of
// normalizeLookupPath; keep the two in sync).

export type RedirectStatus = 301 | 302 | 410;

export type PathResult = { ok: true; path: string } | { ok: false; error: string };
export type TargetResult =
  | { ok: true; toPath: string; status: RedirectStatus }
  | { ok: false; error: string };

const MAX_HOPS = 25;

// Lowercase, no query/hash, no duplicate slashes, no trailing slash (except "/").
export function normalizePath(raw: string): PathResult {
  let s = raw.trim();
  if (!s) return { ok: false, error: "Path is empty" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//"))
    return { ok: false, error: "Path must not be a URL" };
  const q = s.search(/[?#]/);
  if (q >= 0) s = s.slice(0, q);
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/{2,}/g, "/").toLowerCase();
  if (s.length > 1) s = s.replace(/\/+$/, "");
  if (/\s/.test(s)) return { ok: false, error: "Path must not contain spaces" };
  if (s.length > 512) return { ok: false, error: "Path is too long" };
  return { ok: true, path: s };
}

// fromPath: always a path.
export function normalizeFromPath(raw: string): PathResult {
  return normalizePath(raw);
}

export function parseStatus(raw: unknown): { ok: true; status: RedirectStatus } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, status: 301 };
  const n = Number(String(raw).trim());
  if (n === 301 || n === 302 || n === 410) return { ok: true, status: n };
  return { ok: false, error: "Status must be 301, 302 or 410" };
}

// toPath: a normalized path, or an https absolute URL. 410 rows store "".
export function normalizeTarget(raw: string, status: RedirectStatus): TargetResult {
  if (status === 410) return { ok: true, toPath: "", status };
  const s = raw.trim();
  if (!s) return { ok: false, error: "Target is required for 301/302" };
  if (/^https:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (!u.hostname) return { ok: false, error: "Target URL has no host" };
      return { ok: true, toPath: s, status };
    } catch {
      return { ok: false, error: "Target URL is invalid" };
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//"))
    return { ok: false, error: "Target must be a path or an https URL" };
  const p = normalizePath(s);
  if (!p.ok) return p;
  return { ok: true, toPath: p.path, status };
}

export function isRelativeTarget(toPath: string): boolean {
  return toPath.startsWith("/");
}

export type RedirectEdge = { toPath: string; status: RedirectStatus };

// Follows a target through the redirect map until it reaches a non-redirected
// URL (or an absolute URL, or a 410). Returns the final target; the caller
// stores that instead of the chain. `from` is treated as already visited, so
// any walk that comes back to it (or to any other node) is a loop.
export function resolveFinalTarget(
  from: string,
  toPath: string,
  status: RedirectStatus,
  lookup: (path: string) => RedirectEdge | undefined,
): TargetResult & { loop?: boolean } {
  const seen = new Set<string>([from]);
  let cur = toPath;
  let hops = 0;
  while (isRelativeTarget(cur)) {
    if (seen.has(cur)) return { ok: false, error: "Redirect loop detected", loop: true };
    const edge = lookup(cur);
    if (!edge) break;
    seen.add(cur);
    if (edge.status === 410) return { ok: true, toPath: "", status: 410 };
    cur = edge.toPath;
    if (++hops > MAX_HOPS) return { ok: false, error: "Redirect chain is too long" };
  }
  return { ok: true, toPath: cur, status };
}
