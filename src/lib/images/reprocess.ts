// Bulk reprocess: every R2 image → browser WebP pipeline → repoint refs.
// Old originals stay in R2 (rollback/cleanup); nothing is deleted here.
import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  fetchRemoteBytes,
  listR2Images,
  uploadImageToR2,
  type R2Image,
} from "./upload";
import { type AssetUsage } from "./usage";
import { slugFromContexts, isBannerContext, isPipelineOutput } from "../../../convex/lib/imageRefs";

export interface ReprocessProgress {
  done: number;
  total: number;
  current: string;
}

export interface ReprocessResult {
  asset: R2Image;
  status: "repointed" | "skipped" | "failed";
  newUrl?: string;
  patchedRefs?: number;
  reason?: string;
}

/** Walk the whole library (root + subfolders, all pages). */
export async function collectAllR2Images(): Promise<R2Image[]> {
  const all: R2Image[] = [];
  const queue = ["asset_images/"];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const prefix = queue.shift()!;
    let cursor: string | undefined;
    do {
      const page = await listR2Images(prefix, cursor);
      all.push(...page.images);
      for (const f of page.folders) {
        const sub = f.path.startsWith("asset_images/") ? f.path : `asset_images/${f.path}`;
        if (!seen.has(sub)) {
          seen.add(sub);
          queue.push(sub);
        }
      }
      cursor = page.cursor;
    } while (cursor);
  }
  return all;
}

async function sourceMarker(key: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reprocess one asset. Shared assets are handled by the caller dedup map:
 *  the same old key is fetched/converted once, repointed everywhere. */
export async function reprocessOne(
  convex: ConvexReactClient,
  asset: R2Image,
  usage: AssetUsage | undefined,
  marker: string,
  existingUrl?: string,
): Promise<ReprocessResult> {
  if (!usage || usage.total < 0)
    return { asset, status: "failed", reason: "Usage check unavailable; no references changed" };
  const contexts = usage?.contexts ?? [];
  try {
    let newUrl = existingUrl;
    if (!newUrl) {
      const bytes = await fetchRemoteBytes(asset.url);
      const banner = isBannerContext(contexts);
      const folder = asset.path.slice("asset_images/".length).split("/").slice(0, -1).join("/");
      const stem = slugFromContexts(contexts.filter((c) => c.mutable), asset.name).slice(0, 30);
      const uploaded = await uploadImageToR2(bytes, {
        folder: folder || undefined,
        slug: `${stem}-r-${marker}`,
        alt: contexts[0]?.label || asset.name,
        filename: asset.name,
        keepOriginalResolution: banner,
      });
      newUrl = uploaded.url;
    }
    // Old-value compare server-side: concurrent edits that moved a field off
    // the old URL are left untouched.
    const { patched } = await convex.mutation(api.adminCatalog.repointImageRefs, {
      oldKey: asset.path,
      oldUrl: asset.url,
      newUrl,
    });
    const n = Object.values(patched as Record<string, number>).reduce((a, b) => a + b, 0);
    if (existingUrl && n === 0)
      return { asset, status: "skipped", reason: "already reprocessed", newUrl };
    return { asset, status: "repointed", newUrl, patchedRefs: n };
  } catch (e) {
    return { asset, status: "failed", reason: e instanceof Error ? e.message : "Reprocess failed" };
  }
}

export async function reprocessAll(
  convex: ConvexReactClient,
  assets: R2Image[],
  usage: Map<string, AssetUsage>,
  onProgress: (p: ReprocessProgress) => void,
): Promise<ReprocessResult[]> {
  const results: ReprocessResult[] = [];
  const outputs = assets.filter((a) => isPipelineOutput(a.path));
  const targets = assets.filter((a) => !isPipelineOutput(a.path));
  for (let i = 0; i < targets.length; i++) {
    const asset = targets[i];
    onProgress({ done: i, total: targets.length, current: asset.name });
    const marker = await sourceMarker(asset.path);
    const existing = outputs.find((a) => a.name.includes(`-r-${marker}-`));
    results.push(await reprocessOne(convex, asset, usage.get(asset.path), marker, existing?.url));
  }
  onProgress({ done: targets.length, total: targets.length, current: "" });
  for (const asset of outputs)
    results.push({ asset, status: "skipped", reason: "bulk output" });
  return results;
}
