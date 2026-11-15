// Order number and date formatting shared by admin and customer views.
// formatOrderNumber lives in ./orderNumber (re-exported here for existing imports).

export { formatOrderNumber } from './orderNumber';

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatTime(d: Date): string {
  return d
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?(AM|PM)$/i, (m) => ` ${m.trim().toLowerCase()}`);
}

/**
 * 'Today, 4:10 pm' | 'Yesterday' | '10 Nov' | '10 Nov 2024' (year only when not
 * the current year). Pass `{ withTime: true }` to append the time to older dates too.
 */
export function formatOrderDate(
  ts: number | Date | null | undefined,
  opts: { withTime?: boolean; now?: Date } = {},
): string {
  if (ts == null) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const now = opts.now ?? new Date();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (dayDiff === 0) return `Today, ${formatTime(d)}`;
  if (dayDiff === 1) return opts.withTime ? `Yesterday, ${formatTime(d)}` : 'Yesterday';
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return opts.withTime ? `${date}, ${formatTime(d)}` : date;
}
