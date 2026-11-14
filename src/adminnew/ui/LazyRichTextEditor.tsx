import { lazy, Suspense } from 'react';
import type { RichTextEditorProps } from './RichTextEditor';

// TipTap is its own chunk, loaded when a form that uses the editor renders.
const RichTextEditor = lazy(() => import('./RichTextEditor'));

export function LazyRichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          aria-busy="true"
          aria-label="Loading editor"
          className="rounded-md border border-input bg-background"
          style={{ minHeight: props.minHeight ?? (props.variant === 'full' ? 420 : 160) }}
        />
      }
    >
      <RichTextEditor {...props} />
    </Suspense>
  );
}
