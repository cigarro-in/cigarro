import { useEffect, useRef, useState } from 'react';

/**
 * Eases a number from its previous value to `value` (first mount counts up
 * from 0). Interrupted animations continue from where they are. Under
 * prefers-reduced-motion the number jumps straight to the new value.
 */
export function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 600,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    const from = shown.current;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === value || !Number.isFinite(value)) {
      shown.current = value;
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      shown.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else shown.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{format(display)}</span>;
}
