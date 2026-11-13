import { ArrowRight, CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../ui';
import { CountUp } from './CountUp';

export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  /** Shown as "100+" when the count is capped. */
  capped?: boolean;
  /** Router-relative link to the filtered list. */
  to: string;
}

/** Only items with work to do are shown. Each links to the list filtered to them. */
export function AttentionRow({ items }: { items: AttentionItem[] }) {
  const pending = items.filter((i) => i.count > 0);
  return (
    <Card title="Needs attention">
      {pending.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-primary" aria-hidden />
          All clear. Nothing needs attention right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pending.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="group flex items-center justify-between gap-3 rounded-md border border-border px-3.5 py-3 transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-colors"
            >
              <span className="flex flex-col">
                <span className="text-xl font-semibold tabular-nums text-foreground">
                  <CountUp value={item.count} />
                  {item.capped ? '+' : ''}
                </span>
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
