import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import {
  Bold,
  Columns3,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Table as TableIcon,
  Trash2,
  Undo2,
  Unlink,
} from 'lucide-react';
import { cn } from '../../components/ui/utils';
import { sanitizeBlogBody } from '../../lib/blog/blogRender';
import { CDN_IMG_PREFIX, plainTextToHtml } from '../../lib/content/richText';
import { MediaLibraryDialog } from '../features/products/MediaLibraryDialog';
import { Button } from './Button';

export interface RichTextEditorProps {
  /** Stored HTML (or legacy plain text). */
  value: string;
  /** Sanitized HTML. An empty editor reports ''. */
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** compact: descriptions in a form. full: blog and page bodies, sticky toolbar, tables, reading width. */
  variant?: 'compact' | 'full';
  id?: string;
  /** Accessible name of the writing area. */
  ariaLabel?: string;
  /** Limits pasted and saved <img> to this origin. Default: the CDN for compact, any https for full. */
  imgPrefix?: string;
  /** SEO filename stem for image uploads. */
  uploadSlug?: string;
}

type ToolState = {
  paragraph: boolean;
  h2: boolean;
  h3: boolean;
  bold: boolean;
  italic: boolean;
  bullet: boolean;
  ordered: boolean;
  quote: boolean;
  link: boolean;
  inTable: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

const NO_TOOLS: ToolState = {
  paragraph: false, h2: false, h3: false, bold: false, italic: false, bullet: false,
  ordered: false, quote: false, link: false, inTable: false, canUndo: false, canRedo: false,
};

// Accepts http(s), mailto and site-relative paths. A bare domain gets https://.
function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return /^https?:\/\/[^/]+/i.test(value) ? value : null;
  if (/^(mailto:|\/|#)/i.test(value)) return value;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) return `https://${value}`;
  return null;
}

// Images pasted from other origins are dropped before they reach the document.
function stripForeignImages(html: string, prefix: string | undefined): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    const ok = prefix ? src.startsWith(prefix) : /^https:\/\//i.test(src);
    if (!ok) img.remove();
  });
  return doc.body.innerHTML;
}

/**
 * TipTap editor for HTML fields. Saved output goes through sanitizeBlogBody, so
 * the stored markup is the subset the storefront renders. Loaded through
 * LazyRichTextEditor so TipTap stays out of the admin entry bundle.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  minHeight,
  variant = 'compact',
  id,
  ariaLabel,
  imgPrefix: imgPrefixProp,
  uploadSlug,
}: RichTextEditorProps) {
  const full = variant === 'full';
  const imgPrefix = imgPrefixProp ?? (full ? undefined : CDN_IMG_PREFIX);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [imagePos, setImagePos] = useState<number | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        underline: false,
        strike: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Image.configure({ allowBase64: false, HTMLAttributes: { loading: 'lazy' } }),
      Placeholder.configure({ placeholder, emptyEditorClass: 'is-editor-empty' }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: sanitizeBlogBody(plainTextToHtml(value), { imgPrefix }),
    editorProps: {
      attributes: {
        class: cn('rich-text rich-text-editor outline-none', full && 'mx-auto max-w-2xl'),
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel ?? placeholder,
      },
      transformPastedHTML: (html) => stripForeignImages(html, imgPrefix),
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.isEmpty ? '' : sanitizeBlogBody(e.getHTML(), { imgPrefix }));
    },
  });

  // Follow external value changes (a loaded record, a reset). Typed content
  // already equals `value`, so the cursor is not reset while typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = sanitizeBlogBody(plainTextToHtml(value), { imgPrefix });
    const current = editor.isEmpty ? '' : sanitizeBlogBody(editor.getHTML(), { imgPrefix });
    if (incoming !== current) editor.commands.setContent(incoming, { emitUpdate: false });
  }, [value, editor, imgPrefix]);

  const tools: ToolState = useEditorState({
    editor,
    selector: ({ editor: e }): ToolState => {
      if (!e) return NO_TOOLS;
      return {
        paragraph: e.isActive('paragraph'),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        quote: e.isActive('blockquote'),
        link: e.isActive('link'),
        inTable: e.isActive('table'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  }) ?? NO_TOOLS;

  // Each toolbar action focuses the editor, runs one command, and keeps the selection.
  const run = (fn: (e: Editor) => void) => {
    if (!editor) return;
    editor.chain().focus().run();
    fn(editor);
  };

  const openLink = () => {
    if (!editor) return;
    setLinkDraft(editor.getAttributes('link').href ?? '');
    setLinkError(null);
    setLinkOpen((open) => !open);
  };

  const applyLink = (e: FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const href = normalizeHref(linkDraft);
    if (!href) {
      setLinkError('Use an address that starts with https://, mailto: or /.');
      return;
    }
    if (editor.state.selection.empty && !editor.isActive('link')) {
      editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    run((e) => e.chain().focus().extendMarkRange('link').unsetLink().run());
    setLinkOpen(false);
  };

  const openImages = () => {
    if (!editor) return;
    setImagePos(editor.state.selection.from);
    setImageOpen(true);
  };

  const insertImages = (urls: string[]) => {
    if (!editor) return;
    const picks = urls.filter((src) => (imgPrefix ? src.startsWith(imgPrefix) : /^https:\/\//.test(src)));
    if (picks.length === 0) return;
    const at = imagePos ?? editor.state.selection.from;
    editor
      .chain()
      .focus()
      .setTextSelection(at)
      .insertContent(picks.map((src) => ({ type: 'image', attrs: { src } })))
      .run();
  };

  const insertTable = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const tool = (label: string, active: boolean, onClick: () => void, icon: ReactNode, disabled = false) => (
    <Button
      variant="plain"
      size="icon"
      className={cn('size-8', active && 'bg-muted text-foreground')}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled || !editor}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  const divider = <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

  return (
    <div className="rounded-md border border-input bg-background">
      <div
        role="toolbar"
        aria-label="Formatting"
        className={cn(
          'flex flex-wrap items-center gap-0.5 border-b border-border bg-background p-1',
          full && 'sticky top-18 z-10 rounded-t-md supports-[backdrop-filter]:bg-background/90 supports-[backdrop-filter]:backdrop-blur',
        )}
      >
        {tool('Paragraph', tools.paragraph, () => run((e) => e.chain().focus().setParagraph().run()), <Pilcrow aria-hidden />)}
        {tool('Heading', tools.h2, () => run((e) => e.chain().focus().toggleHeading({ level: 2 }).run()), <Heading2 aria-hidden />)}
        {tool('Subheading', tools.h3, () => run((e) => e.chain().focus().toggleHeading({ level: 3 }).run()), <Heading3 aria-hidden />)}
        {divider}
        {tool('Bold', tools.bold, () => run((e) => e.chain().focus().toggleBold().run()), <Bold aria-hidden />)}
        {tool('Italic', tools.italic, () => run((e) => e.chain().focus().toggleItalic().run()), <Italic aria-hidden />)}
        {tool('Link', tools.link || linkOpen, openLink, <Link2 aria-hidden />)}
        {divider}
        {tool('Bulleted list', tools.bullet, () => run((e) => e.chain().focus().toggleBulletList().run()), <List aria-hidden />)}
        {tool('Numbered list', tools.ordered, () => run((e) => e.chain().focus().toggleOrderedList().run()), <ListOrdered aria-hidden />)}
        {tool('Quote', tools.quote, () => run((e) => e.chain().focus().toggleBlockquote().run()), <Quote aria-hidden />)}
        {tool('Image', false, openImages, <ImagePlus aria-hidden />)}
        {full && tool('Table', tools.inTable, insertTable, <TableIcon aria-hidden />)}
        {divider}
        {tool('Undo', false, () => run((e) => e.chain().focus().undo().run()), <Undo2 aria-hidden />, !tools.canUndo)}
        {tool('Redo', false, () => run((e) => e.chain().focus().redo().run()), <Redo2 aria-hidden />, !tools.canRedo)}
      </div>

      {full && tools.inTable && (
        <div role="toolbar" aria-label="Table" className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1">
          {tool('Add row below', false, () => run((e) => e.chain().focus().addRowAfter().run()), <Rows3 aria-hidden />)}
          {tool('Add column after', false, () => run((e) => e.chain().focus().addColumnAfter().run()), <Columns3 aria-hidden />)}
          {tool('Delete row', false, () => run((e) => e.chain().focus().deleteRow().run()), <Trash2 aria-hidden />)}
          <Button variant="plain" size="sm" onClick={() => run((e) => e.chain().focus().toggleHeaderRow().run())}>
            Header row
          </Button>
          <Button variant="plain" size="sm" onClick={() => run((e) => e.chain().focus().deleteColumn().run())}>
            Delete column
          </Button>
          <Button variant="plain" size="sm" onClick={() => run((e) => e.chain().focus().deleteTable().run())}>
            Delete table
          </Button>
        </div>
      )}

      {linkOpen && (
        <form onSubmit={applyLink} className="flex flex-wrap items-start gap-2 border-b border-border p-2" aria-label="Link">
          <label className="sr-only" htmlFor={`${id ?? 'rte'}-link`}>Link address</label>
          <input
            id={`${id ?? 'rte'}-link`}
            autoFocus
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder="https://"
            aria-invalid={!!linkError}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="sm" variant="secondary" type="submit">Apply</Button>
          {tools.link && (
            <Button size="sm" variant="plain" type="button" onClick={removeLink} icon={<Unlink aria-hidden />}>
              Remove
            </Button>
          )}
          {linkError && <p role="alert" className="w-full text-xs text-destructive">{linkError}</p>}
        </form>
      )}

      <div className="px-4 py-3 sm:px-5" style={minHeight ? { minHeight } : undefined}>
        <EditorContent editor={editor} className="text-foreground" />
      </div>

      <MediaLibraryDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        onConfirm={insertImages}
        cropRatio="original"
        uploadSlug={uploadSlug}
        title="Insert image"
      />
    </div>
  );
}
