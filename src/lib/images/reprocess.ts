// Bulk reprocess: convert, repoint every reference, then delete the original.
import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ORG_SLUG } from "../convex/org";
import {
  fetchRemoteBytes,
  listR2Images,
  deleteR2Image,
  uploadImageToR2,
  type R2Image,
} from "./upload";
import { type AssetUsage } from "./usage";
import { slugFromContexts, isBannerContext, isLegacyPipelineOutput } from "../../../convex/lib/imageRefs";

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
  deletedOriginal?: boolean;
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
  return [...new Map(all.map((asset) => [asset.id, asset])).values()];
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
  if (usage.total === 0)
    return { asset, status: "skipped", reason: "Unused; remove with bulk cleanup" };
  const contexts = usage?.contexts ?? [];
  try {
    let newUrl = existingUrl;
    if (!newUrl) {
      const bytes = await fetchRemoteBytes(asset.url);
      const banner = isBannerContext(contexts);
      const tenantPrefix = `asset_images/orgs/${ORG_SLUG}/`;
      const folder = asset.path.startsWith(tenantPrefix)
        ? asset.path.slice(tenantPrefix.length).split("/").slice(0, -1).join("/")
        : asset.path.slice("asset_images/".length).split("/").slice(0, -1).join("/");
      const stem = slugFromContexts(contexts.filter((c) => c.mutable), asset.name).slice(0, 30);
      const uploaded = await uploadImageToR2(bytes, {
        folder: folder || undefined,
        slug: stem,
        alt: contexts[0]?.label || asset.name,
        filename: asset.name,
        pipelineSource: marker,
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
      orgSlug: ORG_SLUG,
    });
    const n = Object.values(patched as Record<string, number>).reduce((a, b) => a + b, 0);
    // R2 rechecks usage server-side before deletion. If any reference was
    // missed or changed concurrently, deletion fails and the original stays.
    await deleteR2Image(asset.path);
    return {
      asset,
      status: existingUrl && n === 0 ? "skipped" : "repointed",
      reason: existingUrl && n === 0 ? "Reused output; removed old original" : undefined,
      newUrl,
      patchedRefs: n,
      deletedOriginal: true,
    };
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
  const processed = assets.filter((a) => Boolean(a.metadata?.pipelineSource));
  const legacyOutputs = assets.filter(
    (a) => !a.metadata?.pipelineSource && isLegacyPipelineOutput(a.path),
  );
  const targets = assets.filter(
    (a) => !a.metadata?.pipelineSource && !isLegacyPipelineOutput(a.path),
  );
  const work = [...targets, ...legacyOutputs];
  for (let i = 0; i < work.length; i++) {
    const asset = work[i];
    onProgress({ done: i, total: work.length, current: asset.name });
    const marker = await sourceMarker(asset.path);
    // Match old hash-suffixed outputs or metadata-tagged outputs from an
    // interrupted earlier run, without putting the hash in the visible name.
    const markerRe = new RegExp(`-r-${marker}(?:-[a-z0-9]+)?\\.webp$`, "i");
    const existing = assets.find(
      (a) => a.id !== asset.id &&
        (a.metadata?.pipelineSource === marker || markerRe.test(a.path)),
    );
    results.push(await reprocessOne(convex, asset, usage.get(asset.path), marker, existing?.url));
  }
  onProgress({ done: work.length, total: work.length, current: "" });
  for (const asset of processed)
    results.push({ asset, status: "skipped", reason: "bulk output" });
  return results;
}
