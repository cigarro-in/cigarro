# Image and file storage: audit and proposed layout

Status: investigation only. Nothing in R2, Convex or the code was changed. Counts come from `wrangler r2 bucket info` and the Dukaan import files; per-prefix counts are estimates where noted.

## 1. Current structure

### Bucket

- Bucket `cigarro-assets` (R2), public through `https://cdn.cigarro.in`. Created 2026-09-11.
- `wrangler r2 bucket info cigarro-assets`: **420 objects, 28.5 MB**.
- Wrangler has no prefix listing command (`r2 object` only has get/put/delete). A per-prefix count needs the S3 API or the admin endpoint `GET /api/images/upload?prefix=…`, which needs an admin session. I did not have either, so the per-prefix numbers below are inferred from the importer's file lists and the migration lists, not from a live listing.

### Prefixes and folders

| Key pattern | Store | What it holds | Estimated objects | Written by |
|---|---|---|---|---|
| `asset_images/orgs/smokeshop/product_images/` | smokeshop | Dukaan product photos | 268 | Dukaan importer (`scripts/dukaan-import/images.mjs`), `ProductImageSearchModal` |
| `asset_images/orgs/smokeshop/category_images/` | smokeshop | Category images | 20 | Dukaan importer |
| `asset_images/orgs/smokeshop/hero_images/` | smokeshop | Hero banners | 11 | Dukaan importer; `productOffer.ts` excludes `/hero_images/` from product image lists |
| `asset_images/orgs/smokeshop/page_images/` | smokeshop | Static page images | 4 | Dukaan importer |
| `asset_images/orgs/smokeshop/blog_images/` | smokeshop | Blog covers | 4 | Dukaan importer |
| `asset_images/orgs/smokeshop/branding/` | smokeshop | Store logo | 1 | Dukaan importer |
| `asset_images/orgs/smokeshop/` (total) | smokeshop | `image-keys.json` plan | **308** | Importer; `image-map.json` has 308 entries |
| `asset_images/orgs/oldsmokeshop/` (including `blogs/` subfolder) | oldsmokeshop | Original store uploads, copied by hand from the old `smokeshop` path | about 98 listed in `convex/lib/oldsmokeshopMovedImages.ts` | Hand copy; `moveOldsmokeshopImages-v2` rewrites rows |
| `asset_images/orgs/oldsmokeshop/app_icons/` | oldsmokeshop | PWA and push icons, versioned (`icon-192-<ver>.png` etc.) | unknown, 4 per generation | `src/lib/images/appIcons.ts` (`app_icons` folder) |
| `asset_images/<stem>.webp` (bare, no `orgs/`) | oldsmokeshop by convention | Pre-tenant uploads: product, brand, blog, site-settings images | unknown; the remainder of 420 minus the above, roughly 0 to 20 | Pre-`orgs/` code path; `urls.ts` still resolves bare keys here |

Rough reconciliation: 420 total − 308 (smokeshop) − about 98 (oldsmokeshop moved list) ≈ 14 objects, which covers oldsmokeshop app icons, bare `asset_images/` leftovers and any others. This is an inference. A real listing is needed to confirm it.

Not found in code or data: `hero_images/` or `branding/` at the bucket root (not under a store), `blogs/` at the root (the `blogs/` subfolder exists only under the oldsmokeshop tree), and `documents/` (no document upload path exists yet; `raw=true` uploads of video/pdf/zip go to the same `asset_images/orgs/<slug>/<folder>/` tree).

### Where the folder names are hard-coded

- `scripts/dukaan-import/images.mjs` lines 19–26: `FOLDER` map (`product`→`product_images`, `category`→`category_images`, `logo`→`branding`, `hero`→`hero_images`, `blog`→`blog_images`, `page`→`page_images`).
- `src/lib/images/appIcons.ts` line 76: `app_icons`.
- `src/adminnew/components/shared/ProductImageSearchModal.tsx` line 105: `product_images`.
- `functions/api/images/upload.js` line 20: `LIB_PREFIX = 'asset_images/'`. Line 116: tenant prefix `asset_images/orgs/<slug>/`. Line 21: legacy bare keys belong to `oldsmokeshop` only.
- `functions/api/sa/store-files.js` line 101: `asset_images/orgs/<slug>/` (the Fresh start cleanup).
- `convex/storeReset.ts` line 256: regex `asset_images/orgs/<slug>/[A-Za-z0-9._/-]+`.
- `convex/adminCatalog.ts` line 571: requires `oldKey` to start with `asset_images/` and the new URL to start with `https://cdn.cigarro.in/asset_images/`.
- `convex/migrations.ts` lines 380–383: `OLD_IMG_PREFIX = asset_images/orgs/smokeshop/`, `NEW_IMG_PREFIX = asset_images/orgs/oldsmokeshop/`, and `IMG_KEY_RE`.
- `src/lib/images/urls.ts` line 41: a relative key with no `/` resolves to `${CDN}/asset_images/${key}`. A key with a `/` is used as-is.
- `src/lib/images/upload.ts` line 219: `listR2Images` defaults to `asset_images/`.
- `scripts/check-*.ts` and `check-asset-inventory.ts`: assertions on `asset_images/` paths.
- `scripts/check-clean-description.ts` and `convex/lib/cleanDescription.ts`: test fixtures with `asset_images/orgs/smokeshop/`.

### Does the database store folder or category info?

No. There is no folder or category column for files anywhere in `convex/schema.ts`. Images are stored as **full URL strings or relative keys** in content fields (`imageUrl`, `images[]`, `appIcons`, `heroSlides`, `storePages`, `sectionConfigurations`, `homepageComponentConfig`, catalog rows, blog posts, site settings). A file's "use" is therefore found only by scanning those strings:

- `convex/lib/imageRefs.ts`: `matchesRef` / `replaceDeepRefs` match a complete key or URL.
- `convex/adminCatalog.ts` `imageUsage` (line 526) and `collectImageUsage` (line 436): scan every referencing table to produce usage counts. The delete endpoint `DELETE /api/images/upload` calls it and blocks if usage is above 0.
- `convex/storeReset.ts` `referencedFileKeys` (line 250): JSON-stringifies every store row and regex-matches the store prefix.

So the database knows **which files are used, by URL**, but not **which folder** they sit in. The folder exists only in the object key.

## 2. What depends on the path

1. **URL parsing.** `matchesRef` accepts `cdn.cigarro.in`, the configured CDN host and `*.r2.dev`, and compares `pathname === /<key>` exactly. Changing the key changes every stored URL. This is the core migration cost.
2. **Deletes.** The image delete endpoint checks that the key starts with `asset_images/orgs/<slug>/` or is a legacy bare key. Anything outside is rejected. A new layout needs this guard rewritten.
3. **Fresh start cleanup** (`store-files.js`). Lists `asset_images/orgs/<slug>/` and deletes the unreferenced part. A key outside the prefix is never touched, so the new layout needs a new prefix here and in `storeReset`. Risk: "unused" deletes anything the DB scan misses, including references outside Convex (emails, external links, old Google-indexed URLs). It is safe only as long as every key is referenced in the DB.
4. **Migrations.** `moveOldsmokeshopImages-v2` is the existing pattern for rewriting keys. It rewrites only keys in the hand-made allowlist, and only in listed tables (`IMAGE_TABLES`). `orders` is in `ImageTable` but not in `IMAGE_TABLES`, so order history is not rewritten. Keep it that way.
5. **Cache.** Each upload sets `Cache-Control: public, max-age=31536000, immutable`. Clients and CDN edges may keep an old URL for a year, so deleting an old key breaks those clients. `_headers` sets image content types on `/images/*` (static site assets, not R2). There is no cache purge by prefix, and the deferred list says so.
6. **SEO.** Product, category and blog image URLs in the sitemap, structured data and `productOffer.ts` use the CDN URLs. Keys are SEO slugs (`camel-yellow-packet.webp`), so Google may have indexed `cdn.cigarro.in/asset_images/...` URLs. I could not check the index (no Search Console access). Assume they are indexed until checked.
7. **Create-only writes.** The upload endpoint uses `onlyIf: { etagDoesNotMatch: '*' }` and `-n` numeric suffixes. Names are unique without a folder, so the folder is not part of collision safety.

## 3. Problems and leftovers

- **Two layouts coexist.** Bare `asset_images/<stem>` (old) and `asset_images/orgs/<slug>/…` (new). `urls.ts` still defaults bare keys to `asset_images/`, and the list endpoint has a special legacy path for `oldsmokeshop`.
- **Hand-made copy.** The `oldsmokeshop` images were copied, not moved, from `orgs/smokeshop/`. The allowlist (`oldsmokeshopMovedImages.ts`) is generated. Old copies are still in `orgs/smokeshop/` (under the new `smokeshop` store). Deleting them is a manual step.
- **Duplicates.** The Dukaan importer generates new keys with suffixes, so re-uploads duplicate bytes. `image-map.json` avoids repeats within one import. No cross-check for duplicate bytes exists. Estimate: low.
- **Orphans.** Versioned app icons leave older sets behind. Pre-`orgs/` bare keys may be unreferenced. Only a DB-to-bucket diff can confirm, and it has not been run.
- **Mixed PROD/DEV.** Convex PROD and DEV hold separate data, but both point at the same bucket if the DEV deployment is configured with the same R2 binding. Verify before any delete. The R2 binding is in `wrangler.toml` (not read here).

## 4. Target layout

Proposed:

```
cigarro-assets/
  <store-slug>/
    images/      <stem>.webp, <stem>-2.webp, ...      (all images, flat)
    documents/   <stem>.<ext>                         (pdf, zip, video)
```

Example: `cigarro-assets/oldsmokeshop/images/camel-yellow-2.webp`, `cigarro-assets/smokeshop/images/benson-and-hedges.webp`.

### Evaluation of per-type folders

What per-type folders (`product_images/`, `hero_images/`, etc.) would buy:

| Benefit | Real? | Notes |
|---|---|---|
| Bulk delete per type | Weak | Deletes already go through the DB usage check per key. Deleting a whole type is a bad idea anyway, because usage is what matters. |
| Cache purge by prefix | No | No prefix purge exists. Cache is per object, immutable. |
| Lifecycle rules by prefix | Yes, but only for `documents/` | A lifecycle rule for temporary files would need a prefix. Nothing needs it today. |
| Public vs. private split | Yes, for `documents/` | If documents need access control, keep them under a separate prefix or bucket. Images stay public. |
| Name collisions | No | Collisions are handled by the create-only put and the `-n` suffix, so a flat folder is safe. |
| Admin grouping | No | Grouping should come from DB references (product, site, blog, brand, category), not from folders. Folders were a weak proxy for that. |
| Listing performance | No | R2 pages 1000 per call. A store with a few thousand images is fine flat. |

Conclusion: **the only real loss is an easy prefix split between images and documents, and the proposed layout keeps that.** Per-type image folders have no benefit we would lose. Keep the user's flat layout.

### Filename rules for the flat folder

- Keep the SEO stem (`slugify(name)`, max 60 characters) and the numeric suffix on collision (`-2`, `-3`). This matches the current endpoint and keeps URLs readable and stable.
- Do not switch to a content hash. It would break SEO, and the existing names would all change.
- Keep create-only writes. Verify the endpoint's conditional put (`onlyIf etagDoesNotMatch`) in the migration copy step.
- Drop the `-r-<hash>` pattern from new uploads. `isLegacyPipelineOutput` already flags those for renaming.

### Keep `asset_images/` and `orgs/`?

Drop both. `orgs/` is redundant once the store is the first path segment. `asset_images/` is a leftover from when the bucket held one store. The bucket is now multi-store, so the store slug should be at the top. Keeping the old prefixes forever costs nothing but adds a second rule everywhere.

Caveat: a top-level store folder can collide with a non-store top-level folder. Keep the rule that the top level is only ever a store slug, or a reserved name such as `_platform/` for app icons, `_shared/` for logos. Slugs cannot start with `_`, so there is no collision.

Recommended final layout:

```
cigarro-assets/
  oldsmokeshop/images/...      oldsmokeshop/documents/...
  smokeshop/images/...         smokeshop/documents/...
  _platform/images/...         (platform-level assets, if any)
```

App icons go under `<store>/images/app-icon-<ver>.png`. The importer's `branding/` folder goes to `images/` too.

## 5. Migration plan

### 5.0 How it runs (as built)

Everything runs from the super-admin UI at `/sa`, Platform config. No local script, no token in a terminal, nothing generated to commit.

1. **Copy images.** On the Storage restructure card, pick the stores (all by default) and press Copy images. The page calls `POST /api/sa/storage-copy` batch by batch until every store is done. Each batch copies up to 25 old keys with the create-only copy in `functions/lib/r2Copy.js` (the same helper as the admin upload's `action=copy`), and records each result in the `storageKeyMoves` table (`convex/storageKeyMoves.ts`). Names come from `planNewKeys` (`convex/lib/storageKeys.ts`): a name taken by a recorded move, or held by an unrelated R2 object (a conflict), moves on to `-2`, `-3`, and so on.
2. **Check the card.** It shows copied, conflict and failed counts per store. Conflicts and failures keep their old links. Press Copy images again to retry them; finished copies are skipped.
3. **Run pending migrations.** The Data updates card runs `restructureStorageKeys-v1`. It loads the copied moves from `storageKeyMoves` and rewrites stored image references in `IMAGE_TABLES`, `organizations` and `carts`. It refuses to run when no moves are recorded.

Copy only, always: no object is moved, overwritten or deleted, and the old URLs keep working. Re-running either step is safe.

### 5.1 Original plan (for review)

Each step is for review. Do not run any of these without a separate approval.

1. **Inventory first.** Build a full key listing for `cigarro-assets` (S3 API or a one-off script with R2 credentials). Compare it with all URL references in PROD Convex (the same scan as `referencedFileKeys` for every store, plus the bare-key case). Output: referenced, unreferenced, and missing-object lists. Missing objects are a bug to fix before any move. Run on PROD, not DEV (CLAUDE.md: PROD and DEV data differ).
2. **Copy, do not move.** Done as in 5.0 (the `/sa` Copy images button). Create-only writes, and each old to new move is recorded in the `storageKeyMoves` table. Do not delete anything.
3. **Migrate references in Convex.** `restructureStorageKeys-v1` in `convex/migrations.ts` (one-off, run once, recorded in the `migrations` table), run from the super-admin "Run pending migrations" button. It reads the `storageKeyMoves` table, rewrites string values in `IMAGE_TABLES`, `organizations` and `carts`, and skips `orders` (history stays as it was). It rewrites both bare keys and full CDN URLs. Do not add a cron.
4. **Keep old URLs working.** Two options:
   - a. **301 at the CDN** (Cloudflare redirect rule on `cdn.cigarro.in`, mapping `/asset_images/orgs/<slug>/...` to the new path). Verify how `cdn.cigarro.in` is served first (R2 custom domain or Pages). I did not check this.
   - b. **Keep old objects** for at least a year, so cached copies and Google's index still resolve. Costs about 28.5 MB, which is negligible.
   Recommendation: keep the old objects (option b) and add the 301 (option a) for SEO. Do not delete old keys until the redirect has run for a while and Search Console shows the new URLs.
5. **Update the code.** `urls.ts` (default folder), `upload.js` (prefix, folder argument), `store-files.js` and `storeReset.ts` (prefix regex), delete guard, `listR2Images` default, importer `FOLDER` map, `appIcons.ts`, and the check scripts. Ship behind a flag or in one deploy with step 3, so new uploads and old references are never out of step.
6. **Verify on PROD.** Run `store-files` in `dryRun` mode for each store. Check that used + unused equals the listed count, and that `referencedFileKeys` finds no key outside the store prefix. Check a product page, a blog post and the admin library against `cdn.cigarro.in`.
7. **Delete old keys (last, optional).** Only after step 6, and only for keys that the PROD scan shows unreferenced and that the redirect covers. Use the existing `store-files` "unused" mode, and only after a dry run. Confirm DEV does not point at the same bucket, or that DEV references were checked too.

### Risks

- **Shared bucket, separate data.** PROD and DEV Convex have separate data but may share the R2 bucket. A delete driven by DEV references can remove PROD images. Confirm the bindings. Until confirmed, do not delete from a DEV-driven scan.
- **Order history.** `orders` may hold image URLs in snapshots (receipts, invoices). Rewriting them would change history. The plan leaves them as they are, and the old keys must stay alive for them.
- **Cached and indexed URLs.** `immutable` plus a one-year max age means old URLs stay cached. Deleting an old key early causes broken images on cached pages and in search results.
- **Unscanned references.** Emails, external sites linking to a CDN image, and any URL in a JSON blob not in the scanned tables. The DB scan is the only usage check, so a missed reference makes "unused" wrong.
- **Partial copy.** A copy that fails halfway leaves the DB pointing at a key that does not exist. Run the copy before the migration, and check for missing objects after.
- **Concurrent uploads.** A new upload during migration is written under the new layout. The migration must read the mapping once and not rewrite references it did not map.
- **Size.** The bucket is small (28.5 MB). Cost and time are not the concern. Correctness of references is.

## 6. Open items

- Confirm per-prefix counts with an admin listing (`GET /api/images/upload?prefix=asset_images/` as an admin, paging with the cursor) or an S3-compatible listing with R2 credentials.
- Confirm how `cdn.cigarro.in` is served (R2 custom domain vs. Pages) before choosing the redirect mechanism.
- Check Google Search Console for indexed `/asset_images/` URLs. Not checked.
- Confirm whether PROD and DEV share the R2 binding (`wrangler.toml`), not read in this pass.
- Confirm no emails, external pages or the Dukaan redirects reference bucket keys directly.
