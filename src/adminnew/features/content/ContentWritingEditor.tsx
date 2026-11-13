import { useLayoutEffect, useRef, useState } from 'react';
import { Bold, Heading2, Heading3, Italic, Link2, List, Pilcrow, Quote } from 'lucide-react';
import { Button, Tabs } from '../../ui';
import { SingleImagePicker } from '../../components/shared/ImagePicker';
import { sanitizeBlogBody } from '../../../lib/blog/blogRender';
import { applyFormat, readingMinutes, wordCount, type FormatKind } from './contentForm';

const TOOLS: { kind: FormatKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'paragraph', label: 'Paragraph', icon: <Pilcrow aria-hidden /> },
  { kind: 'h2', label: 'Heading', icon: <Heading2 aria-hidden /> },
  { kind: 'h3', label: 'Subheading', icon: <Heading3 aria-hidden /> },
  { kind: 'bold', label: 'Bold', icon: <Bold aria-hidden /> },
  { kind: 'italic', label: 'Italic', icon: <Italic aria-hidden /> },
  { kind: 'link', label: 'Link', icon: <Link2 aria-hidden /> },
  { kind: 'list', label: 'Bulleted list', icon: <List aria-hidden /> },
  { kind: 'quote', label: 'Quote', icon: <Quote aria-hidden /> },
];

/**
 * The writing column: cover image, large title, and a body editor with a
 * formatting toolbar. The body is HTML (the same sanitised subset the
 * storefront renders), so Write and Preview show what readers will see.
 */
export function ContentWritingEditor({
  title,
  onTitleChange,
  titleError,
  titlePlaceholder = 'Title',
  body,
  onBodyChange,
  bodyPlaceholder = 'Start writing. Use the toolbar for headings, bold, links and lists.',
  cover,
  onCoverChange,
  coverHint,
  showCover = true,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  titleError?: string | null;
  titlePlaceholder?: string;
  body: string;
  onBodyChange: (value: string) => void;
  bodyPlaceholder?: string;
  cover?: string | null;
  onCoverChange?: (url: string | null) => void;
  coverHint?: string;
  showCover?: boolean;
}) {
  const [view, setView] = useState<'write' | 'preview'>('write');
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  // Selection to restore after a toolbar edit (the value changes first).
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    const el = areaRef.current;
    if (!pending || !el) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(pending.start, pending.end);
  }, [body]);

  const apply = (kind: FormatKind) => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = applyFormat(body, start, end, kind);
    pendingSelection.current = { start: next.selStart, end: next.selEnd };
    onBodyChange(next.value);
  };

  const words = wordCount(body);

  return (
    <div className="rounded-xl border border-border bg-card">
      {showCover && onCoverChange && (
        <div className="border-b border-border p-4 sm:p-6">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Cover image</p>
          <SingleImagePicker value={cover ?? null} onChange={(url) => onCoverChange(url)} searchHint={coverHint} />
        </div>
      )}

      <div className="px-4 pt-5 sm:px-8 sm:pt-8">
        <input
          aria-label="Title"
          aria-invalid={!!titleError}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={titlePlaceholder}
          className="w-full bg-transparent text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground sm:text-4xl"
        />
        {titleError && <p className="mt-2 text-sm text-destructive">{titleError}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-border px-3 py-1.5 sm:px-6">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { id: 'write', label: 'Write' },
            { id: 'preview', label: 'Preview' },
          ]}
        />
        {view === 'write' && (
          <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatting">
            {TOOLS.map((tool) => (
              <Button
                key={tool.kind}
                variant="plain"
                size="icon"
                className="size-8"
                aria-label={tool.label}
                title={tool.label}
                onClick={() => apply(tool.kind)}
              >
                {tool.icon}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-4 sm:px-8 sm:pb-8">
        {view === 'write' ? (
          <textarea
            ref={areaRef}
            aria-label="Body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder={bodyPlaceholder}
            spellCheck
            className="block min-h-96 w-full resize-y bg-transparent font-mono text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
        ) : body.trim() ? (
          <div
            className="min-h-96 space-y-4 text-base leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-input [&_blockquote]:pl-4 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: sanitizeBlogBody(body) }}
          />
        ) : (
          <p className="min-h-96 text-muted-foreground">Nothing to preview yet.</p>
        )}
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          {words} {words === 1 ? 'word' : 'words'} · {readingMinutes(body)} min read
        </p>
      </div>
    </div>
  );
}

