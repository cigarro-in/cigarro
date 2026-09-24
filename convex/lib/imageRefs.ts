// Pure helpers for R2 image reference inventory + repointing (no ctx).
// Server (adminCatalog.ts) and scripts import these; keep dependency-free.

export interface UsageContext {
  kind: string; // e.g. "variant" | "brand" | "order(history)"
  label: string; // human entity name
  detail?: string; // field or extra context
  mutable: boolean; // false = historical/read-only, never auto-patched
}

/** Match a complete R2 key or URL path. Basenames alone can collide across folders. */
export function matchesRef(value: unknown, key: string, url?: string): boolean {
  if (typeof value !== "string" || !value) return false;
  if (value === key) return true;
  if (url && value === url) return true;
  try {
    const candidate = new URL(value);
    const cdn = url ? new URL(url) : null;
    return (candidate.protocol === "https:" &&
      (candidate.hostname === "cdn.cigarro.in" || candidate.hostname === cdn?.hostname || candidate.hostname.endsWith(".r2.dev")) &&
      decodeURIComponent(candidate.pathname) === `/${key}`);
  } catch { return false; }
}

/** Embedded HTML/CSS may contain a complete URL rather than being one. */
export function replaceEmbeddedRef(value: string, key: string, url: string | undefined, next: string): string | null {
  if (matchesRef(value, key, url)) return next;
  let changed = false;
  const replaced = value.replace(/https?:\/\/[^\s"'<>(),;]+/g, (candidate) => {
    if (!matchesRef(candidate, key, url)) return candidate;
    changed = true;
    return next;
  });
  return changed ? replaced : null;
}

/** Traverse content configuration values without rewriting unrelated text. */
export function replaceDeepRefs(value: unknown, key: string, url: string | undefined, next: string): unknown | null {
  if (typeof value === "string") return replaceEmbeddedRef(value, key, url, next);
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const replaced = replaceDeepRefs(item, key, url, next);
      if (replaced === null) return item;
      changed = true;
      return replaced;
    });
    return changed ? out : null;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const [field, item] of Object.entries(out)) {
      const replaced = replaceDeepRefs(item, key, url, next);
      if (replaced === null) continue;
      out[field] = replaced;
      changed = true;
    }
    return changed ? out : null;
  }
  return null;
}

/** SEO stem from the first mutable usage context, else fallback filename. */
export function slugFromContexts(
  contexts: Array<Pick<UsageContext, "label">>,
  fallback: string,
): string {
  const label = contexts.find((c) => c.label)?.label?.trim() || fallback;
  const stem = label
    .toLowerCase()
    .replace(/\.(webp|jpe?g|png|gif|avif)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
  return stem || "image";
}

/** Banner-like contexts keep source aspect (no square crop). */
const BANNER_KINDS = new Set(["hero", "section", "homepage-config"]);
export function isBannerContext(
  contexts: Array<Pick<UsageContext, "kind">>,
): boolean {
  return contexts.some((c) => BANNER_KINDS.has(c.kind));
}

/** Only outputs from this bulk action are skipped on repeat runs.
 *  Old keys carry a random tail (`-r-<24hex>-<rand>.webp`), new keys drop
 *  it (`-r-<24hex>.webp`); the optional group keeps both recognized. */
export function isPipelineOutput(pathOrKey: string): boolean {
  return /-r-[a-f0-9]{24}(?:-[a-z0-9]+)?\.webp$/i.test(pathOrKey || "");
}

/** Replace matching entries in a string array (old-value compare). Returns
 *  the new array, or null when nothing matched (caller skips the patch). */
export function repointArray(
  current: string[] | undefined,
  key: string,
  url: string | undefined,
  next: string,
): string[] | null {
  if (!current) return null;
  let changed = false;
  const out = current.map((s) => {
    if (matchesRef(s, key, url)) {
      changed = true;
      return next;
    }
    return s;
  });
  return changed ? out : null;
}

/** Scalar field: new value when it matches old ref, else undefined (skip). */
export function repointScalar(
  current: unknown,
  key: string,
  url: string | undefined,
  next: string,
): string | undefined {
  return matchesRef(current, key, url) ? next : undefined;
}
