import { createContext, useContext } from 'react';

// Per-render HTTP status cell. The server entry provides one per request; a
// route that resolves to "not found" sets it to 404 during render. On the
// client there is no provider and the setter is a no-op.
export interface RenderStatusCell {
  status: number;
}

export const RenderStatusContext = createContext<RenderStatusCell | null>(null);

export function useSetRenderStatus(): (code: number) => void {
  const cell = useContext(RenderStatusContext);
  return (code: number) => {
    if (cell) cell.status = code;
  };
}
