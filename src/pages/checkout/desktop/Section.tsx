import type { ReactNode } from 'react';

// One numbered checkout step in the main column.
export function Section({
  step,
  title,
  action,
  children,
}: {
  step: number;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-base font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {step}
          </span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
