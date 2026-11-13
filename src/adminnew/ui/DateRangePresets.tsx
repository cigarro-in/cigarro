import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '../../components/ui/utils';
import { Menu } from './Menu';

export type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'all';

/** Millisecond timestamps, local time. `from` inclusive, `to` exclusive. null = unbounded. */
export interface DateRange {
  from: number | null;
  to: number | null;
}

export const DATE_RANGE_LABEL: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  this_month: 'This month',
  last_month: 'Last month',
  all: 'All time',
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = ['today', 'yesterday', 'last7', 'this_month', 'last_month', 'all'];

/** Range for a preset, relative to `now` (local timezone). */
export function getDateRange(preset: DateRangePreset, now: Date = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = (offset: number) => new Date(y, m, d + offset).getTime();
  switch (preset) {
    case 'today':
      return { from: day(0), to: day(1) };
    case 'yesterday':
      return { from: day(-1), to: day(0) };
    case 'last7':
      return { from: day(-6), to: day(1) };
    case 'this_month':
      return { from: new Date(y, m, 1).getTime(), to: new Date(y, m + 1, 1).getTime() };
    case 'last_month':
      return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 1).getTime() };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

/** True when `ts` falls inside the range. */
export function inDateRange(ts: number, range: DateRange): boolean {
  return (range.from === null || ts >= range.from) && (range.to === null || ts < range.to);
}

/**
 * Date filter chip with the standard presets. Controlled by preset id;
 * onChange also hands back the computed { from, to }.
 *
 *   const [preset, setPreset] = useState<DateRangePreset>('all');
 *   <DateRangePresets value={preset} onChange={(p) => setPreset(p)} />
 *   const range = getDateRange(preset);
 */
export function DateRangePresets({
  value,
  onChange,
  presets = DATE_RANGE_PRESETS,
  className,
}: {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset, range: DateRange) => void;
  presets?: DateRangePreset[];
  className?: string;
}) {
  const active = value !== 'all';
  return (
    <Menu
      align="start"
      width="w-44"
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
            active
              ? 'border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]'
              : 'border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]',
            className,
          )}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          {DATE_RANGE_LABEL[value]}
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </button>
      }
      items={presets.map((p) => ({
        label: DATE_RANGE_LABEL[p],
        suffix: p === value ? 'Selected' : undefined,
        onSelect: () => onChange(p, getDateRange(p)),
      }))}
    />
  );
}
