import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

// Full consent log for one store as CSV, read page by page (oldest first).
// Contains IP addresses and phone numbers: treat the file as personal data.
const COLUMNS = [
  'recorded_at',
  'kind',
  'granted',
  'text_version',
  'source',
  'user_id',
  'phone',
  'anonymous_id',
  'page_path',
  'ip',
  'user_agent',
  'linked_from_id',
  'row_id',
] as const;

const PAGE_SIZE = 1000;

interface ExportPage {
  rows: Array<{
    _id: string;
    at: number;
    kind: string;
    granted: boolean;
    textVersion: string;
    source: string;
    userId: string | null;
    phone: string | null;
    anonymousId: string | null;
    pagePath: string | null;
    ip: string | null;
    userAgent: string | null;
    linkedFrom: string | null;
  }>;
  continueCursor: string;
  isDone: boolean;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Spreadsheet formula guard: a leading = + - @ or tab/CR would be evaluated.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function downloadConsentCsv(
  client: ConvexReactClient,
  saToken: string,
  orgId: Id<'organizations'>,
  slug: string,
): Promise<number> {
  const lines: string[] = [COLUMNS.join(',')];
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    const page: ExportPage = await client.query(api.consent.exportForStore, {
      saToken,
      orgId,
      cursor,
      numItems: PAGE_SIZE,
    });
    for (const r of page.rows) {
      lines.push(
        [
          new Date(r.at).toISOString(),
          r.kind,
          r.granted,
          r.textVersion,
          r.source,
          r.userId,
          r.phone,
          r.anonymousId,
          r.pagePath,
          r.ip,
          r.userAgent,
          r.linkedFrom,
          r._id,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    cursor = page.continueCursor;
    isDone = page.isDone;
  }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug}-consent-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return lines.length - 1;
}
