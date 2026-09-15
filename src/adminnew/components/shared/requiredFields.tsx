// Shared required-field affordances for every admin form.
// Pattern: each form keeps a `saveAttempted` flag, sets it at the top of its
// save handler, and passes `aria-invalid` + <ReqError> for its required
// fields. The shadcn Input/Textarea already render a red border on
// aria-invalid, so no class wars. Nothing here changes save behavior.

export function Req() {
  return (
    <span className="text-red-500" aria-hidden="true">
      {' *'}
    </span>
  );
}

export function ReqError({ show, children }: { show: boolean; children?: React.ReactNode }) {
  if (!show) return null;
  return (
    <p className="text-red-500 text-xs mt-1" role="alert">
      {children ?? 'This field is required'}
    </p>
  );
}

export const isBlank = (v: unknown) => String(v ?? '').trim() === '';
