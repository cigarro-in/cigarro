import { useState } from 'react';
import { useButtonFeedback, type ButtonState } from '../../ui';

/**
 * Runs several async actions on one page with one feedback channel. The button
 * that was pressed shows loading/success/error; the others stay idle but are
 * disabled while anything is busy. Errors come back with the Convex code.
 */
export function useActionRunner() {
  const fb = useButtonFeedback();
  const [activeId, setActiveId] = useState<string | null>(null);

  const run = <T,>(id: string, fn: () => Promise<T>) => {
    setActiveId(id);
    return fb.run(fn);
  };

  return {
    run,
    error: fb.error,
    busy: fb.busy,
    reset: fb.reset,
    stateFor: (id: string): ButtonState => (activeId === id ? fb.state : 'idle'),
  };
}
