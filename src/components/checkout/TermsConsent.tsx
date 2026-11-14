import { Checkbox } from '../ui/checkbox';

interface Props {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  minAge: number;
}

// Required before an order is placed. The server enforces it (CONSENT_REQUIRED).
export function TermsConsent({ id, checked, onCheckedChange, minAge }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/40 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <label htmlFor={id} className="text-sm leading-relaxed text-foreground cursor-pointer">
        I am {minAge} or older, and I accept the{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Terms &amp; Conditions
        </a>{' '}
        and{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Privacy Policy
        </a>
        .
      </label>
    </div>
  );
}
