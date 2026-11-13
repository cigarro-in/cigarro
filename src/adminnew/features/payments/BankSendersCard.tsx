import { useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { X } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Button, Card, ErrorBanner, useButtonFeedback } from '../../ui';

// Same rules as convex/lib/bankSenders.ts: an address or a bare domain.
const ENTRY_RE = /^(?:[a-z0-9._+-]+@)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const MAX_SENDERS = 25;

const SUGGESTIONS: Array<{ label: string; value: string }> = [
  { label: 'HDFC', value: 'hdfcbank.net' },
  { label: 'ICICI', value: 'icicibank.com' },
  { label: 'Axis', value: 'axisbank.com' },
  { label: 'SBI', value: 'sbi.co.in' },
  { label: 'Kotak', value: 'kotak.com' },
];

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

export function BankSendersCard({ orgId }: { orgId: Id<'organizations'> | undefined }) {
  const data = useQuery(api.organizations.getAllowedBankSenders, orgId ? { orgId } : 'skip');
  const update = useMutation(api.organizations.updateAllowedBankSenders);
  const save = useButtonFeedback();

  // Local draft until saved. null = nothing edited.
  const [draft, setDraft] = useState<string[] | null>(null);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const saved = data?.senders;
  const list = draft ?? saved ?? [];
  const dirty =
    draft !== null && (saved === undefined || draft.length !== saved.length || draft.some((s, i) => s !== saved[i]));

  const addSender = (raw: string) => {
    const value = normalize(raw);
    if (!value) return;
    if (!ENTRY_RE.test(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (list.includes(value) || list.length >= MAX_SENDERS) {
      setText('');
      return;
    }
    setDraft([...list, value]);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSender(text.replace(/,$/, ''));
    } else if (e.key === 'Backspace' && !text && list.length > 0) {
      setDraft(list.slice(0, -1));
    }
  };

  const removeAt = (i: number) => setDraft(list.filter((_, idx) => idx !== i));

  const persist = () => {
    if (!orgId) return;
    save.run(async () => {
      await update({ orgId, senders: list });
      setDraft(null);
    });
  };

  return (
    <Card title="Bank email senders" padding="default">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Only mail from these senders counts. Leave empty to accept all.
        </p>

        <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 focus-within:border-ring">
          {list.map((s, i) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-sm"
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => removeAt(i)}
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-border hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setInvalid(false);
            }}
            onKeyDown={onKey}
            onBlur={() => text && addSender(text)}
            placeholder={list.length ? '' : 'alerts@hdfcbank.net'}
            aria-label="Add sender"
            aria-invalid={invalid}
            autoCapitalize="none"
            autoCorrect="off"
            className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {invalid && (
          <p className="text-xs text-destructive">Enter an address like alerts@hdfcbank.net or a domain like hdfcbank.net</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.filter((s) => !list.includes(s.value)).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => addSender(s.value)}
              className="rounded-full border border-dashed border-input px-2.5 py-1 text-xs text-muted-foreground hover:border-solid hover:bg-accent hover:text-foreground"
            >
              + {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" state={save.state} disabled={!dirty || !orgId} onClick={persist}>
            Save senders
          </Button>
        </div>
        <ErrorBanner error={save.error} />
      </div>
    </Card>
  );
}
