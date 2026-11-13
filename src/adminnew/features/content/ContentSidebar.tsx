import type { ReactNode } from 'react';
import { Card, CardSection, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '../../ui';
import { META_DESCRIPTION_MAX, META_TITLE_MAX } from './contentForm';

export interface ContentStatusOption {
  value: string;
  label: string;
}

/**
 * Aside for the content editors: publishing, slug, summary, tags and SEO.
 * Blog-only fields (category, featured, pinned) go in `children`, above Publishing.
 */
export function ContentSidebar({
  status,
  onStatusChange,
  statusOptions,
  statusHint,
  slug,
  onSlugChange,
  slugPrefix,
  slugLocked,
  slugReadOnly,
  onResetSlug,
  excerpt,
  onExcerptChange,
  tagsText,
  onTagsChange,
  metaTitle,
  onMetaTitleChange,
  metaTitlePlaceholder,
  metaDescription,
  onMetaDescriptionChange,
  metaDescriptionPlaceholder,
  children,
  footer,
}: {
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: ContentStatusOption[];
  statusHint?: ReactNode;
  slug: string;
  onSlugChange: (value: string) => void;
  slugPrefix: string;
  /** Existing content keeps its URL: the slug only follows the title for new items. */
  slugLocked?: boolean;
  /** Fixed URLs (store pages): the slug is shown but cannot change. */
  slugReadOnly?: boolean;
  onResetSlug?: () => void;
  excerpt?: string;
  onExcerptChange?: (value: string) => void;
  tagsText?: string;
  onTagsChange?: (value: string) => void;
  metaTitle: string;
  onMetaTitleChange: (value: string) => void;
  metaTitlePlaceholder?: string;
  metaDescription: string;
  onMetaDescriptionChange: (value: string) => void;
  metaDescriptionPlaceholder?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {children}

      <Card title="Publishing" footer={footer}>
        <CardSection>
          <div className="space-y-1.5">
            <Label htmlFor="content-status">Status</Label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger id="content-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusHint && <p className="text-xs text-muted-foreground">{statusHint}</p>}
          </div>
        </CardSection>
        <CardSection>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="content-slug">URL slug</Label>
              {slugLocked && onResetSlug && (
                <button type="button" onClick={onResetSlug} className="text-xs text-primary hover:underline">
                  Reset from title
                </button>
              )}
            </div>
            <Input
              id="content-slug"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              placeholder="derived-from-title"
              spellCheck={false}
              disabled={slugReadOnly}
            />
            <p className="break-all text-xs text-muted-foreground">
              {slugPrefix}
              {slug || '…'}
            </p>
          </div>
        </CardSection>
      </Card>

      {(onExcerptChange || onTagsChange) && (
        <Card title="Summary">
          {onExcerptChange && (
            <CardSection>
              <div className="space-y-1.5">
                <Label htmlFor="content-excerpt">Excerpt</Label>
                <Textarea
                  id="content-excerpt"
                  rows={3}
                  value={excerpt ?? ''}
                  onChange={(e) => onExcerptChange(e.target.value)}
                  placeholder="A line or two shown in listings and search results"
                />
              </div>
            </CardSection>
          )}
          {onTagsChange && (
            <CardSection>
              <div className="space-y-1.5">
                <Label htmlFor="content-tags">Tags</Label>
                <Input
                  id="content-tags"
                  value={tagsText ?? ''}
                  onChange={(e) => onTagsChange(e.target.value)}
                  placeholder="comma, separated, tags"
                />
              </div>
            </CardSection>
          )}
        </Card>
      )}

      <Card title="SEO">
        <CardSection>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="content-meta-title">Meta title</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {metaTitle.length}/{META_TITLE_MAX}
              </span>
            </div>
            <Input
              id="content-meta-title"
              value={metaTitle}
              onChange={(e) => onMetaTitleChange(e.target.value)}
              placeholder={metaTitlePlaceholder}
            />
          </div>
        </CardSection>
        <CardSection>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="content-meta-description">Meta description</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {metaDescription.length}/{META_DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="content-meta-description"
              rows={3}
              value={metaDescription}
              onChange={(e) => onMetaDescriptionChange(e.target.value)}
              placeholder={metaDescriptionPlaceholder}
            />
          </div>
        </CardSection>
      </Card>
    </div>
  );
}
