import { useMemo } from 'react';
import { cn } from './ui/utils';
import { CDN_IMG_PREFIX, renderRichText } from '../lib/content/richText';

/**
 * Renders a stored rich-text field (HTML, or legacy plain text) through the
 * shared sanitizer. Images are limited to the R2 CDN. Typography comes from
 * `.rich-text` in src/index.css, so both themes look the same.
 */
export function RichText({
  html,
  className,
  imgPrefix = CDN_IMG_PREFIX,
}: {
  html: string | null | undefined;
  className?: string;
  imgPrefix?: string;
}) {
  const body = useMemo(() => renderRichText(html, { imgPrefix }), [html, imgPrefix]);
  if (!body) return null;
  return <div className={cn('rich-text', className)} dangerouslySetInnerHTML={{ __html: body }} />;
}
