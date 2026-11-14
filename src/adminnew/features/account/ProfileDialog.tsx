import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Button, Dialog, ErrorBanner, Input, Label, useButtonFeedback } from '../../ui';
import { maskPhone } from '../../lib/adminAuth';
import { personNameError } from '../../../lib/profile/personName';
import { roleLabel, type StoreRole } from './useStoreAccount';

const MAX_NAME = 60;

/** "Your profile": edit own display name in this store; shows masked phone and role. */
export function ProfileDialog({
  open,
  onOpenChange,
  orgId,
  name,
  phone,
  role,
  storeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: Id<'organizations'>;
  name: string | null;
  phone: string | null | undefined;
  role: StoreRole | undefined;
  storeName: string;
}) {
  const updateName = useMutation(api.organizations.updateMyName);
  const save = useButtonFeedback();
  const [draft, setDraft] = useState(name ?? '');

  // Reset the field each time the dialog opens, so a cancelled edit is dropped.
  useEffect(() => {
    if (open) {
      setDraft(name ?? '');
      save.reset();
    }
  }, [open, name]);

  const clean = draft.replace(/\s+/g, ' ').trim();
  const unchanged = clean === (name ?? '');
  // A real person name is required (placeholders such as "Customer" are refused).
  const nameProblem = personNameError(clean);
  const invalid = nameProblem !== null;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (unchanged || invalid) return;
    void save.run(() => updateName({ orgId, name: clean }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Your profile" description="How you appear to your team in this store." size="sm">
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="profile-name">Display name</Label>
          <Input
            id="profile-name"
            value={draft}
            maxLength={MAX_NAME + 20}
            autoComplete="name"
            onChange={(e) => {
              setDraft(e.target.value);
              if (save.state !== 'idle') save.reset();
            }}
            aria-invalid={invalid ? true : undefined}
          />
          {invalid ? (
            <p role="alert" className="text-xs text-destructive">{nameProblem}</p>
          ) : (
            <p className="text-xs text-[var(--admin-text-subtle)]">Your full name. Up to {MAX_NAME} characters.</p>
          )}
        </div>

        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-3 text-sm">
          <dt className="text-[var(--admin-text-muted)]">Phone</dt>
          <dd className="tabular-nums">{maskPhone(phone) || 'Not set'}</dd>
          <dt className="text-[var(--admin-text-muted)]">Role</dt>
          <dd>{roleLabel(role)}</dd>
          <dt className="text-[var(--admin-text-muted)]">Store</dt>
          <dd className="truncate">{storeName}</dd>
        </dl>

        {save.error && <ErrorBanner error={save.error} />}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="submit"
            variant="primary"
            state={save.state}
            successLabel="Saved"
            disabled={unchanged || invalid}
          >
            Save name
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
