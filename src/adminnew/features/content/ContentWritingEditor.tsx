import { SingleImagePicker } from '../../components/shared/ImagePicker';
import { LazyRichTextEditor } from '../../ui/LazyRichTextEditor';
import { readingMinutes, wordCount } from './contentForm';

/**
 * The writing column: cover image, large title, and a rich-text body. The body
 * is stored as HTML (the same sanitised subset the storefront renders), so what
 * the author sees while writing is what readers get.
 */
export function ContentWritingEditor({
  title,
  onTitleChange,
  titleError,
  titlePlaceholder = 'Title',
  body,
  onBodyChange,
  bodyPlaceholder = 'Start writing. Use the toolbar for headings, lists, links, images and tables.',
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

      <div className="px-3 pb-6 pt-4 sm:px-6 sm:pb-8">
        <LazyRichTextEditor
          variant="full"
          value={body}
          onChange={onBodyChange}
          placeholder={bodyPlaceholder}
          ariaLabel="Body"
          minHeight={420}
        />
        <p className="mt-3 px-1 text-xs tabular-nums text-muted-foreground">
          {words} {words === 1 ? 'word' : 'words'} · {readingMinutes(body)} min read
        </p>
      </div>
    </div>
  );
}
