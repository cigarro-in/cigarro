// Guard for R2 library deletes (admin only). A library image can still be
// referenced by catalogVariants.images — deleting it orphans product cards
// (storefront falls back to the "No Image" placeholder). Call this INSTEAD
// of window.confirm before deleteR2Image; it returns false to abort.

import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";

export async function confirmImageDelete(
  convex: ConvexReactClient,
  opts: { key: string; url?: string; name?: string },
): Promise<boolean> {
  const label = opts.name || opts.key;
  let usage: { usedBy: Array<{ productName: string; variantName: string }>; total: number };
  try {
    usage = await convex.query(api.adminCatalog.imageUsage, {
      key: opts.key,
      url: opts.url,
    });
  } catch {
    // Usage check unavailable — fail open with an explicit warning.
    return window.confirm(`Could not check usage for "${label}". Delete anyway?`);
  }
  if (usage.total === 0) return window.confirm(`Delete "${label}"?`);
  const names = usage.usedBy
    .slice(0, 5)
    .map((u) => `• ${u.productName} (${u.variantName})`)
    .join("\n");
  const more = usage.total > 5 ? `\n…+${usage.total - 5} more` : "";
  return window.confirm(
    `"${label}" is still used by ${usage.total} variant(s):\n${names}${more}\n\nDeleting will break those product cards. Delete anyway?`,
  );
}
