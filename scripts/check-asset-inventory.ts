// Targeted check: image-ref match/slug/banner/skip/repoint pure logic.
// Run: npx tsx scripts/check-asset-inventory.ts (no Convex, no R2, no deploy).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  matchesRef,
  slugFromContexts,
  isBannerContext,
  isPipelineOutput,
  repointArray,
  repointScalar,
  replaceDeepRefs,
  replaceEmbeddedRef,
} from "../convex/lib/imageRefs";
import { usageSummary } from "../src/lib/images/usage";

async function main() {
  // Matches require the complete key; another folder's basename is unrelated.
  assert.equal(matchesRef("asset_images/foo/a.jpg", "asset_images/foo/a.jpg"), true);
  assert.equal(
    matchesRef(
      "https://cdn.cigarro.in/asset_images/foo/a.jpg",
      "asset_images/foo/a.jpg",
      "https://cdn.cigarro.in/asset_images/foo/a.jpg",
    ),
    true,
  );
  assert.equal(matchesRef("https://cdn.cigarro.in/other/a.jpg", "asset_images/foo/a.jpg"), false);
  assert.equal(matchesRef("https://cdn.cigarro.in/other/b.jpg", "asset_images/foo/a.jpg"), false);
  assert.equal(matchesRef(undefined, "k"), false);
  assert.equal(matchesRef("asset_images/foo/a.jpg ", "asset_images/foo/a.jpg"), false);

  // Slug derives from entity context, falls back to filename.
  assert.equal(slugFromContexts([{ label: "Camel Yellow Packet" }], "f"), "camel-yellow-packet");
  assert.equal(slugFromContexts([], "my pic.PNG"), "my-pic");

  // Banners preserve aspect; product shots go square.
  assert.equal(isBannerContext([{ kind: "hero" }]), true);
  assert.equal(isBannerContext([{ kind: "section" }]), true);
  assert.equal(isBannerContext([{ kind: "homepage-config" }]), true);
  assert.equal(isBannerContext([{ kind: "variant" }]), false);

  // Existing WebP sources still get a pass; only bulk outputs are skipped.
  assert.equal(isPipelineOutput("asset_images/a-b123.webp"), false);
  assert.equal(isPipelineOutput("asset_images/a-r-0123456789abcdef01234567-abc123.webp"), true);
  assert.equal(isPipelineOutput("asset_images/a.jpg"), false);

  // Repoint helpers: old-value compare, null/undefined = no patch.
  assert.deepEqual(
    repointArray(
      ["https://cdn.cigarro.in/asset_images/foo/a.jpg", "b.jpg"],
      "asset_images/foo/a.jpg",
      undefined,
      "n.webp",
    ),
    ["n.webp", "b.jpg"],
  );
  assert.equal(repointArray(["b.jpg"], "x/a.jpg", undefined, "n.webp"), null);
  assert.equal(repointScalar("https://cdn.cigarro.in/lib/a.jpg", "lib/a.jpg", "https://cdn.cigarro.in/lib/a.jpg", "n"), "n");
  assert.equal(repointScalar("other.jpg", "lib/a.jpg", undefined, "n"), undefined);
  assert.equal(replaceEmbeddedRef('<img src="https://cdn.cigarro.in/asset_images/foo/a.jpg">', "asset_images/foo/a.jpg", "https://cdn.cigarro.in/asset_images/foo/a.jpg", "new.webp"), '<img src="new.webp">');
  assert.equal(replaceEmbeddedRef('<img src="https://cdn.cigarro.in/asset_images/foo/a.jpg-extra">', "asset_images/foo/a.jpg", "https://cdn.cigarro.in/asset_images/foo/a.jpg", "new.webp"), null);
  assert.deepEqual(replaceDeepRefs({ hero: ["https://cdn.cigarro.in/asset_images/foo/a.jpg", "other"] }, "asset_images/foo/a.jpg", "https://cdn.cigarro.in/asset_images/foo/a.jpg", "new.webp"), { hero: ["new.webp", "other"] });

  // Order item snapshots (orderItemV.image) are inventoried: any hit counts
  // (deletes stay fail-closed) and repoint moves them with exact matching.
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const catalog = readFileSync(join(root, "convex/adminCatalog.ts"), "utf8");
  assert.match(catalog, /ctx\.db\.query\("orders"\)\.collect\(\)/, "inventory scans orders");
  assert.match(
    catalog,
    /kind: "order"[\s\S]*?mutable: false/,
    "order snapshots count as history (still block deletes via total)",
  );
  assert.match(
    catalog,
    /items\.map\(\(it: any\) => \(hits\(it\?\.image\) \? \{ \.\.\.it, image: newUrl \} : it\)\)/,
    "repoint moves order snapshots with exact old-value match",
  );
  const guard = readFileSync(join(root, "src/lib/images/guard.ts"), "utf8");
  assert.match(
    guard,
    /usage\.total === 0/,
    "single delete allowed only at zero references (fail-closed)",
  );

  // Badge copy: unknown / unused / in-use with context.
  assert.equal(usageSummary(undefined), "Checking…");
  assert.equal(
    usageSummary({ key: "k", total: -1, mutableTotal: -1, historicalTotal: 0, contexts: [] }),
    "Usage unknown",
  );
  assert.equal(
    usageSummary({ key: "k", total: 0, mutableTotal: 0, historicalTotal: 0, contexts: [] }),
    "Unused",
  );
  assert.match(
    usageSummary({
      key: "k",
      total: 2,
      mutableTotal: 1,
      historicalTotal: 1,
      contexts: [{ kind: "variant", label: "Camel", detail: "12g", mutable: true }],
    }),
    /In use · 2 — Camel \(12g\)/,
  );
  console.log("Asset inventory, repoint, and badge checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
