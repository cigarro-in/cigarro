// Guard for R2 library deletes (admin only). A library image can still be
// referenced by variants, brands, categories, collections, combos, blogs,
// hero slides, homepage sections, site settings, carts, or order item
// snapshots — deleting it orphans those surfaces. Call this INSTEAD of
// window.confirm before deleteR2Image;
// it returns false to abort. FAIL-CLOSED: a failed usage check blocks the
// delete (never ask "delete anyway?").

import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ORG_SLUG } from "../convex/org";
import type { AssetUsage } from "./usage";

export function describeUsage(u: {
  total: number;
  contexts?: Array<{ kind: string; label: string; detail?: string }>;
}): string {
  const names = (u.contexts ?? [])
    .slice(0, 5)
    .map((c) => `• [${c.kind}] ${c.label}${c.detail ? ` (${c.detail})` : ""}`)
    .join("\n");
  const more = u.total > 5 ? `\n…+${u.total - 5} more` : "";
  return `${names}${more}`;
}

export async function confirmImageDelete(
  convex: ConvexReactClient,
  opts: { key: string; url?: string; name?: string },
): Promise<boolean> {
  const label = opts.name || opts.key;
  let usage: { total: number; contexts?: AssetUsage["contexts"] };
  try {
    usage = await convex.query(api.adminCatalog.imageUsage, {
      key: opts.key,
      url: opts.url,
      orgSlug: ORG_SLUG,
    });
  } catch {
    // Usage check unavailable — fail closed.
    window.alert(`Could not check usage for "${label}". Delete blocked — try again.`);
    return false;
  }
  if (usage.total === -1) {
    window.alert(`Usage unknown for "${label}". Delete blocked — try again.`);
    return false;
  }
  if (usage.total === 0) return window.confirm(`Delete "${label}"? This cannot be undone.`);
  // Referenced anywhere → hard block (single delete never force-deletes).
  window.alert(
    `"${label}" is still used by ${usage.total} reference(s):\n${describeUsage(usage)}\n\nDelete blocked — repoint or remove those references first.`,
  );
  return false;
}
