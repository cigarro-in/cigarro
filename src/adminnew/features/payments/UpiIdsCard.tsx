import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Input,
  toActionError,
  useButtonFeedback,
  type ActionError,
} from '../../ui';

const UPI_RE = /^[A-Za-z0-9._\-]+@[A-Za-z0-9.\-]+$/;

/** Customers pay the first UPI ID in this list. Reorder to change the primary. */
export function UpiIdsCard({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const vpas = useQuery(api.email.listVpas, orgId ? { orgId } : 'skip');
  const upsert = useMutation(api.email.upsertVpa);
  const remove = useMutation(api.email.deleteVpa);
  const add = useButtonFeedback();
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [rowError, setRowError] = useState<ActionError | null>(null);

  const sorted = [...(vpas ?? [])].sort((a, b) => a.priority - b.priority);

  const addVpa = () => {
    if (!orgId) return;
    const vpa = draft.trim();
    if (!UPI_RE.test(vpa)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    add.run(async () => {
      const priority = sorted.length ? sorted[sorted.length - 1].priority + 1 : 0;
      await upsert({ orgId, vpa, active: true, priority });
      setDraft('');
    });
  };

  // Rewrite priorities to match the new order (0 = primary).
  const move = async (index: number, delta: -1 | 1) => {
    if (!orgId) return;
    const next = [...sorted];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRowError(null);
    try {
      await Promise.all(
        next.map((v, i) =>
          v.priority === i
            ? null
            : upsert({
                orgId,
                vpaId: v._id,
                vpa: v.vpa,
                label: v.label,
                active: v.active,
                priority: i,
              }),
        ),
      );
    } catch (e) {
      setRowError(toActionError(e, 'Could not reorder'));
    }
  };

  const removeVpa = async (vpaId: Id<'paymentVpas'>) => {
    if (!orgId) return;
    setRowError(null);
    try {
      await remove({ orgId, vpaId });
    } catch (e) {
      setRowError(toActionError(e, 'Could not remove'));
    }
  };

  return (
    <Card title="UPI IDs" padding="default">
      <div className="flex flex-col gap-3">
        {vpas === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No UPI IDs yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {sorted.map((v, i) => (
              <li key={v._id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{v.vpa}</span>
                {i === 0 && <Badge tone="info">Primary</Badge>}
                <Button
                  variant="plain"
                  size="icon"
                  className="size-8"
                  aria-label={`Move ${v.vpa} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="plain"
                  size="icon"
                  className="size-8"
                  aria-label={`Move ${v.vpa} down`}
                  disabled={i === sorted.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="plain"
                  size="icon"
                  className="size-8"
                  aria-label={`Remove ${v.vpa}`}
                  onClick={() => removeVpa(v._id)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <ErrorBanner error={rowError} />

        <form
          className="flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addVpa();
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setInvalid(false);
              }}
              placeholder="store@ybl"
              aria-label="UPI ID"
              aria-invalid={invalid}
              autoCapitalize="none"
              autoCorrect="off"
            />
            {invalid && <p className="mt-1 text-xs text-destructive">Enter a UPI ID like store@ybl</p>}
          </div>
          <Button
            type="submit"
            variant="secondary"
            icon={<Plus aria-hidden />}
            state={add.state}
            disabled={!draft.trim()}
          >
            Add
          </Button>
        </form>
        <ErrorBanner error={add.error} />
      </div>
    </Card>
  );
}
