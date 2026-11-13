import type { ReactNode } from 'react';

/** Two-column form grid that stacks on phones. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
