// Batch usage inventory for the R2 asset grid (single query per ~100 assets).
import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ORG_SLUG } from "../convex/org";

export interface UsageContext {
  kind: string;
  label: string;
  detail?: string;
  mutable: boolean;
}

export interface AssetUsage {
  key: string;
  total: number;
  mutableTotal: number;
  historicalTotal: number;
  contexts: UsageContext[];
}

/** One round trip per chunk (server caps batches at 200). Fail-closed:
 *  on error every asset reports total = -1 (unknown → block deletes). */
export async function fetchUsageBatch(
  convex: ConvexReactClient,
  refs: Array<{ key: string; url?: string }>,
): Promise<Map<string, AssetUsage>> {
  const out = new Map<string, AssetUsage>();
  for (let i = 0; i < refs.length; i += 100) {
    const chunk = refs.slice(i, i + 100);
    try {
      const rows = await convex.query(api.adminCatalog.imageUsageBatch, {
        refs: chunk.map((r) => ({ key: r.key, url: r.url })),
        orgSlug: ORG_SLUG,
      });
      for (const r of rows) out.set(r.key, r as AssetUsage);
    } catch {
      for (const r of chunk)
        out.set(r.key, {
          key: r.key,
          total: -1,
          mutableTotal: -1,
          historicalTotal: 0,
          contexts: [],
        });
    }
  }
  return out;
}

/** "variant · Camel Yellow (12g)" — grid/list badge sublabel (max 2 contexts). */
export function usageSummary(u: AssetUsage | undefined): string {
  if (!u) return "Checking…";
  if (u.total === -1) return "Usage unknown";
  if (u.total === 0) return "Unused";
  const names = u.contexts
    .slice(0, 2)
    .map((c) => (c.detail ? `${c.label} (${c.detail})` : c.label))
    .join(" · ");
  const more = u.total > Math.min(2, u.contexts.length) ? ` +${u.total - Math.min(2, u.contexts.length)} more` : "";
  return `In use · ${u.total}${names ? ` — ${names}${more}` : ""}`;
}
