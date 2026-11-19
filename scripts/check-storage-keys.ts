// Checks for the storage key layout: planner, rewriter and owner rules.
// Run: npx tsx scripts/check-storage-keys.ts  (also part of npm run check:guards)
import assert from "node:assert/strict";
import {
  legacyOwner,
  planNewKeys,
  rewriteStorageDeep,
  rewriteStorageString,
  slugifyStem,
  type KeyMap,
} from "../convex/lib/storageKeys";

// --- owner -----------------------------------------------------------------
assert.equal(legacyOwner("asset_images/orgs/smokeshop/product_images/a.webp", "oldsmokeshop"), "smokeshop");
assert.equal(legacyOwner("asset_images/orgs/oldsmokeshop/blogs/a.webp", "oldsmokeshop"), "oldsmokeshop");
assert.equal(legacyOwner("asset_images/camel.webp", "oldsmokeshop"), "oldsmokeshop");
assert.equal(legacyOwner("smokeshop/images/camel.webp", "oldsmokeshop"), null);
assert.equal(legacyOwner("https://example.com/a.webp", "oldsmokeshop"), null);

// --- stems -----------------------------------------------------------------
assert.equal(slugifyStem("Camel Yellow Packet!"), "camel-yellow-packet");
assert.equal(slugifyStem("  --  "), "");

// --- planner ---------------------------------------------------------------
{
  const plan = planNewKeys(
    [
      "asset_images/orgs/smokeshop/product_images/camel.webp",
      "asset_images/orgs/smokeshop/blog_images/camel.webp",
      "asset_images/orgs/smokeshop/hero_images/hero-1.webp",
      "asset_images/orgs/oldsmokeshop/blogs/camel.webp",
      "asset_images/camel.webp",
      "asset_images/orgs/smokeshop/product_images/notes.pdf", // not an image: not planned
    ],
    "oldsmokeshop",
    {},
  );
  // Sorted visit order: "asset_images/camel.webp" < "asset_images/orgs/…" (bare first)
  assert.equal(plan["asset_images/camel.webp"], "oldsmokeshop/images/camel.webp");
  assert.equal(plan["asset_images/orgs/oldsmokeshop/blogs/camel.webp"], "oldsmokeshop/images/camel-2.webp");
  assert.equal(plan["asset_images/orgs/smokeshop/blog_images/camel.webp"], "smokeshop/images/camel.webp");
  assert.equal(plan["asset_images/orgs/smokeshop/product_images/camel.webp"], "smokeshop/images/camel-2.webp");
  assert.equal(plan["asset_images/orgs/smokeshop/hero_images/hero-1.webp"], "smokeshop/images/hero-1.webp");
  assert.equal("asset_images/orgs/smokeshop/product_images/notes.pdf" in plan, false);
  // Every target is unique.
  assert.equal(new Set(Object.values(plan)).size, Object.values(plan).length);
}
{
  // Re-running keeps earlier assignments and only plans new keys.
  const first = planNewKeys(["asset_images/orgs/smokeshop/product_images/a.webp"], "oldsmokeshop", {});
  const second = planNewKeys(
    ["asset_images/orgs/smokeshop/product_images/a.webp", "asset_images/orgs/smokeshop/blog_images/a.webp"],
    "oldsmokeshop",
    first,
  );
  assert.equal(second["asset_images/orgs/smokeshop/product_images/a.webp"], "smokeshop/images/a.webp");
  assert.equal(second["asset_images/orgs/smokeshop/blog_images/a.webp"], "smokeshop/images/a-2.webp");
}

{
  // Reserved targets (an unrelated R2 object holds the name) are skipped: the next suffix is used.
  const plan = planNewKeys(["asset_images/orgs/smokeshop/product_images/camel.webp"], "oldsmokeshop", {}, [
    "smokeshop/images/camel.webp",
  ]);
  assert.equal(plan["asset_images/orgs/smokeshop/product_images/camel.webp"], "smokeshop/images/camel-2.webp");
}

// --- rewriter ----------------------------------------------------------------
const map: KeyMap = {
  "asset_images/orgs/smokeshop/product_images/camel.webp": "smokeshop/images/camel.webp",
  "asset_images/orgs/oldsmokeshop/camel.webp": "oldsmokeshop/images/camel.webp",
  "asset_images/camel.webp": "oldsmokeshop/images/camel-2.webp",
};
// Full URL, relative key, bare name.
assert.equal(
  rewriteStorageString("https://cdn.cigarro.in/asset_images/orgs/smokeshop/product_images/camel.webp", map),
  "https://cdn.cigarro.in/smokeshop/images/camel.webp",
);
assert.equal(
  rewriteStorageString("asset_images/orgs/smokeshop/product_images/camel.webp", map),
  "https://cdn.cigarro.in/smokeshop/images/camel.webp",
);
assert.equal(rewriteStorageString("camel.webp", map), "https://cdn.cigarro.in/oldsmokeshop/images/camel-2.webp");
// Prefix-sharing store names are not confused: smokeshop/ is not in oldsmokeshop/.
assert.equal(
  rewriteStorageString("https://cdn.cigarro.in/asset_images/orgs/oldsmokeshop/camel.webp", map),
  "https://cdn.cigarro.in/oldsmokeshop/images/camel.webp",
);
// Trailing punctuation from prose is kept.
assert.equal(
  rewriteStorageString("See asset_images/orgs/smokeshop/product_images/camel.webp.", map),
  "See https://cdn.cigarro.in/smokeshop/images/camel.webp.",
);
// Unmapped keys and plain text are untouched.
assert.equal(rewriteStorageString("asset_images/orgs/smokeshop/product_images/missing.webp", map), "asset_images/orgs/smokeshop/product_images/missing.webp");
assert.equal(rewriteStorageString("Camel Yellow pack", map), "Camel Yellow pack");
assert.equal(rewriteStorageString("https://cdn.cigarro.in/smokeshop/images/camel.webp", map), "https://cdn.cigarro.in/smokeshop/images/camel.webp");

// Deep: nested config, arrays, unchanged objects keep identity.
{
  const cfg = { hero: ["https://cdn.cigarro.in/asset_images/camel.webp", "other"], nested: { x: "plain" } };
  const r = rewriteStorageDeep(cfg, map);
  assert.equal(r.changed, true);
  assert.deepEqual(r.value, {
    hero: ["https://cdn.cigarro.in/oldsmokeshop/images/camel-2.webp", "other"],
    nested: { x: "plain" },
  });
  const same = { a: "nothing here" };
  const r2 = rewriteStorageDeep(same, map);
  assert.equal(r2.changed, false);
  assert.equal(r2.value, same);
}

// Idempotent: a rewritten value does not match any key again.
{
  const once = rewriteStorageString("asset_images/orgs/smokeshop/product_images/camel.webp", map);
  assert.equal(rewriteStorageString(once, map), once);
}

console.log("check-storage-keys: ok");
