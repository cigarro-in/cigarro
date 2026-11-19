// Storage key layout (CLAUDE.md "Images"). Pure helpers, no Convex or Node imports:
// used by the copy endpoint (functions/api/sa/storage-copy.js), the one-off
// migration (convex/migrations.ts) and scripts/check-storage-keys.ts.
//
// Pre-restructure keys:  asset_images/orgs/<slug>/<folder>/<stem>.<ext>
//                        asset_images/<stem>.<ext>   (bare: the legacy store only)
// New keys:              <slug>/images/<stem>.<ext>  (flat, every image of a store)
//                        <slug>/documents/<name>.<ext>
// Old objects are copied, never moved or deleted: the old URLs keep working.

export const CDN_ORIGIN = "https://cdn.cigarro.in";
export const LEGACY_PREFIX = "asset_images/";
export const IMAGE_RE = /\.(webp|jpe?g|png|gif|avif)$/i;
const REF_RE = /(?:https:\/\/cdn\.cigarro\.in\/)?asset_images\/[A-Za-z0-9._/-]+/g;
const BARE_RE = /^[A-Za-z0-9._-]+\.(webp|jpe?g|png|gif|avif)$/i;

export type KeyMap = Record<string, string>;

/** SEO stem: "Camel Yellow Packet!" → "camel-yellow-packet". Same rule as the upload endpoint. */
export function slugifyStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/**
 * Store that owns a pre-restructure key, or null when the key is not one.
 * `asset_images/orgs/<slug>/…` belongs to <slug>; a bare `asset_images/…` key
 * belongs to the legacy store.
 */
export function legacyOwner(oldKey: string, legacySlug: string): string | null {
  if (!oldKey.startsWith(LEGACY_PREFIX)) return null;
  const m = /^asset_images\/orgs\/([a-z0-9-]+)\//.exec(oldKey);
  return m ? m[1] : legacySlug;
}

/**
 * Plan the new key for every image in `oldKeys`. Deterministic: keys are visited
 * in sorted order, a stem that is already taken gets `-2`, `-3`, … and every
 * assignment already in `existing` is kept as it is, so re-running the planner
 * never moves an object that was already copied. `reserved` lists targets that
 * are off limits too (e.g. a name an unrelated R2 object already holds).
 */
export function planNewKeys(
  oldKeys: readonly string[],
  legacySlug: string,
  existing: KeyMap,
  reserved: Iterable<string> = [],
): KeyMap {
  const out: KeyMap = { ...existing };
  const taken = new Set([...Object.values(existing), ...reserved]);
  const todo = [...new Set(oldKeys)].filter((k) => IMAGE_RE.test(k) && !(k in existing)).sort();
  for (const from of todo) {
    const slug = legacyOwner(from, legacySlug);
    if (!slug) continue;
    const file = from.slice(from.lastIndexOf("/") + 1);
    const ext = (file.match(IMAGE_RE)?.[0] ?? ".webp").toLowerCase();
    const stem = slugifyStem(file.slice(0, file.length - ext.length)) || "image";
    let to = "";
    for (let n = 1; n <= 1000 && !to; n++) {
      const candidate = `${slug}/images/${n === 1 ? stem : `${stem}-${n}`}${ext}`;
      if (!taken.has(candidate)) to = candidate;
    }
    if (!to) throw new Error(`no free name for ${from}`);
    taken.add(to);
    out[from] = to;
  }
  return out;
}

/**
 * Rewrite every pre-restructure image reference inside one string. A reference is
 * a full CDN URL or a `asset_images/…` key. Mapped keys become full CDN URLs of the
 * new key; anything unmapped is left exactly as it was. A bare file name (the
 * legacy default of src/lib/images/urls.ts) rewrites only when it is mapped.
 */
export function rewriteStorageString(value: string, map: KeyMap): string {
  if (BARE_RE.test(value)) {
    const to = map[`${LEGACY_PREFIX}${value}`];
    return to ? `${CDN_ORIGIN}/${to}` : value;
  }
  if (!value.includes(LEGACY_PREFIX)) return value;
  return value.replace(REF_RE, (whole) => {
    // A key read from prose may end in "." or "/": keep that punctuation.
    const trail = (whole.match(/[./]+$/) ?? [""])[0];
    const core = whole.slice(0, whole.length - trail.length);
    const to = map[core.replace(/^https:\/\/cdn\.cigarro\.in\//, "")];
    return to ? `${CDN_ORIGIN}/${to}${trail}` : whole;
  });
}

/** Deep rewrite of a stored value (strings, arrays, plain objects). */
export function rewriteStorageDeep(value: unknown, map: KeyMap): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    const next = rewriteStorageString(value, map);
    return { value: next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const r = rewriteStorageDeep(item, map);
      changed ||= r.changed;
      return r.value;
    });
    return { value: changed ? out : value, changed };
  }
  if (value && typeof value === "object" && !(value instanceof ArrayBuffer)) {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = rewriteStorageDeep(v, map);
      changed ||= r.changed;
      out[k] = r.value;
    }
    return { value: changed ? out : value, changed };
  }
  return { value, changed: false };
}
