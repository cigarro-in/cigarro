/**
 * Create-only copy of one R2 object to a new key. Shared by the admin upload
 * endpoint (functions/api/images/upload.js, action=copy) and the super-admin batch
 * endpoint (functions/api/sa/storage-copy.js). Never overwrites, never deletes.
 *
 * Returns { httpStatus, body }:
 * - copied    200  the target was written from the source
 * - exists    200  the target already holds the same bytes (an earlier run)
 * - conflict  409  the target holds different bytes, or appeared during the copy
 * - not found 404  the source is missing
 */
export async function copyCreateOnly(bucket, cdn, from, to) {
  const sourceHead = await bucket.head(from);
  if (!sourceHead) return { httpStatus: 404, body: { error: 'Source not found', key: from } };
  // Target already there: fine when it holds the same bytes (an earlier run),
  // a conflict otherwise. Never overwritten either way.
  const existing = await bucket.head(to);
  if (existing) {
    const same = existing.etag === sourceHead.etag;
    return {
      httpStatus: same ? 200 : 409,
      body: { status: same ? 'exists' : 'conflict', key: to, url: `${cdn}/${to}` },
    };
  }
  const source = await bucket.get(from);
  if (!source) return { httpStatus: 404, body: { error: 'Source not found', key: from } };
  const stored = await bucket.put(to, source.body, {
    httpMetadata: source.httpMetadata,
    customMetadata: source.customMetadata,
    // Create-only: null means the target key appeared meanwhile (race-safe).
    onlyIf: { etagDoesNotMatch: '*' },
  });
  if (stored === null) {
    return { httpStatus: 409, body: { status: 'conflict', key: to, error: 'Target appeared during copy' } };
  }
  return { httpStatus: 200, body: { status: 'copied', key: to, url: `${cdn}/${to}`, size: stored.size } };
}
