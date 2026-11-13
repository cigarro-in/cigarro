import type { ReactNode } from 'react';
import { cn } from '../../components/ui/utils';
import {
  deriveOrderStage,
  STAGE_LABEL,
  STAGE_TONE,
  type OrderStage,
  type OrderStageInput,
  type StageTone,
} from '../../lib/orders/orderStage';

export type BadgeTone = StageTone;

const TONE: Record<BadgeTone, { box: string; dot: string }> = {
  neutral: { box: 'bg-[var(--admin-neutral-soft)] text-[var(--admin-text-muted)]', dot: 'bg-[var(--admin-text-subtle)]' },
  info: { box: 'bg-[var(--admin-info-soft)] text-[var(--admin-info)]', dot: 'bg-[var(--admin-info)]' },
  success: { box: 'bg-[var(--admin-success-soft)] text-[var(--admin-success)]', dot: 'bg-[var(--admin-success)]' },
  warning: { box: 'bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]', dot: 'bg-[var(--admin-warning)]' },
  critical: { box: 'bg-[var(--admin-critical-soft)] text-[var(--admin-critical)]', dot: 'bg-[var(--admin-critical)]' },
  attention: { box: 'bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]', dot: 'bg-[var(--admin-primary)]' },
};

/** Small status pill. Tones are semantic, never decorative. */
export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium leading-none',
        t.box,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Order status badge. Pass either a derived `stage` or the raw `order`
 * ({ status | paymentStatus, shippingStatus }); the label and tone come from
 * src/lib/orders/orderStage.ts so every screen shows the same wording.
 */
export function StatusBadge({
  stage,
  order,
  label,
  className,
}: {
  stage?: OrderStage;
  order?: OrderStageInput;
  label?: string;
  className?: string;
}) {
  const s: OrderStage = stage ?? deriveOrderStage(order ?? {});
  return (
    <Badge tone={STAGE_TONE[s]} dot className={className}>
      {label ?? STAGE_LABEL[s]}
    </Badge>
  );
}
