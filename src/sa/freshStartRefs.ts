// Typed references for convex/storeReset.ts (super-admin "Fresh start").
import { makeFunctionReference } from 'convex/server';
import type { Id } from '../../convex/_generated/dataModel';

export type ResetTableName = string;

export interface ResetPreviewTable {
  table: ResetTableName;
  count: number | string;
}

export interface ResetPreviewGroup {
  id: number;
  label: string;
  tables: ResetPreviewTable[];
  total: number | string;
}

export interface ResetPreview {
  slug: string;
  name: string;
  groups: ResetPreviewGroup[];
}

export const previewResetRef = makeFunctionReference<
  'query',
  { saToken: string; orgId: Id<'organizations'> },
  ResetPreview
>('storeReset:previewReset');

export const checkSaWriteRef = makeFunctionReference<'query', { saToken: string }, { ok: boolean }>(
  'storeReset:checkSaWrite',
);

export const clearBatchRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; table: ResetTableName },
  { deleted: number; done: boolean }
>('storeReset:clearBatch');

export const logResetRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; group: number; deleted: Record<string, number> },
  { ok: boolean }
>('storeReset:logReset');
