import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Star, Pin } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ORG_SLUG } from '../../lib/convex/org';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Label,
  Page,
  PageLayout,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Card,
  CardSection,
  toActionError,
  useButtonFeedback,
} from '../ui';
import { ContentWritingEditor } from '../features/content/ContentWritingEditor';
import { ContentSidebar } from '../features/content/ContentSidebar';
import { parseTags, readingMinutes, slugify, snapshot } from '../features/content/contentForm';

interface BlogForm {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: string;
  status: string;
  categorySlug: string;
  isFeatured: boolean;
  isPinned: boolean;
  tagsText: string;
  metaTitle: string;
  metaDescription: string;
}

const EMPTY_FORM: BlogForm = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  cover: '',
  status: 'draft',
  categorySlug: '',
  isFeatured: false,
  isPinned: false,
  tagsText: '',
  metaTitle: '',
  metaDescription: '',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft (hidden from readers)' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export function BlogFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id && id !== 'new';

  const rows = useQuery(api.adminCatalog.listBlogPostsForAdmin, { orgSlug: ORG_SLUG });
  const categoryRows = useQuery(api.content.listBlogCategories, { orgSlug: ORG_SLUG });
  const savePost = useMutation(api.adminCatalog.saveBlogPost);
  const removePost = useMutation(api.adminCatalog.deleteBlogPost);

  const [form, setForm] = useState<BlogForm>(EMPTY_FORM);
  // Snapshot of the last saved form; '' for a new post, so it starts unsaved.
  const [saved, setSaved] = useState('');
  // Existing posts keep their URL. New posts follow the title until the slug is edited.
  const [slugLocked, setSlugLocked] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);
  const [missing, setMissing] = useState(false);
  const [showTitleError, setShowTitleError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const save = useButtonFeedback();

  const postId = isEditing ? (id as Id<'blogPosts'>) : null;

  // Populate once from the admin list (the route id is the Convex _id).
  useEffect(() => {
    if (!isEditing || loaded || rows === undefined) return;
    const row = rows.find((p) => p._id === id);
    if (!row) {
      setMissing(true);
      setLoaded(true);
      return;
    }
    const next: BlogForm = {
      title: row.title ?? '',
      slug: row.slug ?? '',
      excerpt: row.excerpt ?? '',
      body: row.content ?? '',
      cover: row.featuredImage ?? '',
      status: row.status ?? 'draft',
      categorySlug: row.categorySlug ?? '',
      isFeatured: row.isFeatured ?? false,
      isPinned: row.isPinned ?? false,
      tagsText: (row.tags ?? []).join(', '),
      metaTitle: row.metaTitle ?? '',
      metaDescription: row.metaDescription ?? '',
    };
    setForm(next);
    setSaved(snapshot(next));
    setSlugLocked(true);
    setLoaded(true);
  }, [rows, loaded, isEditing, id]);

  const dirty = saved !== snapshot(form);

  const update = <K extends keyof BlogForm>(key: K, value: BlogForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onTitleChange = (title: string) =>
    setForm((prev) => ({ ...prev, title, slug: slugLocked ? prev.slug : slugify(title) }));

  const onSlugChange = (value: string) => {
    setSlugLocked(true);
    update('slug', value);
  };

  const onSave = () => {
    if (!form.title.trim()) {
      setShowTitleError(true);
      return;
    }
    const current = form;
    save.run(async () => {
      const slug = current.slug.trim() || slugify(current.title);
      const post = {
        slug,
        title: current.title.trim(),
        excerpt: current.excerpt.trim() || undefined,
        content: current.body,
        featuredImage: current.cover || undefined,
        status: current.status,
        isFeatured: current.isFeatured,
        isPinned: current.isPinned,
        categorySlug: current.categorySlug || undefined,
        tags: parseTags(current.tagsText),
        readingTime: readingMinutes(current.body),
        metaTitle: current.metaTitle.trim() || undefined,
        metaDescription: current.metaDescription.trim() || undefined,
      };
      try {
        if (postId) {
          await savePost({ orgSlug: ORG_SLUG, id: postId, post });
          setSaved(snapshot(current));
          setForm((prev) => ({ ...prev, slug }));
          setSlugLocked(true);
        } else {
          const res = await savePost({ orgSlug: ORG_SLUG, post });
          navigate(`/blogs/${res.id}`, { replace: true });
        }
      } catch (err) {
        if ((err as { data?: { code?: string } })?.data?.code === 'SLUG_TAKEN') {
          throw { message: 'Another post already uses this URL slug. Change the slug and save again.', code: 'SLUG_TAKEN' };
        }
        throw toActionError(err, 'Could not save the post. Try again.');
      }
    });
  };

  const onDelete = async () => {
    if (!postId) return;
    await removePost({ id: postId, orgSlug: ORG_SLUG });
    navigate('/blogs', { replace: true });
  };

  if (!loaded) {
    return (
      <Page title="Loading post" backTo="/blogs">
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Page>
    );
  }

  if (missing) {
    return (
      <Page title="Post not found" backTo="/blogs">
        <Card>
          <EmptyState
            title="This post no longer exists"
            description="It may have been deleted. Go back to the list to find another post."
            action={<Button variant="secondary" onClick={() => navigate('/blogs')}>Back to blogs</Button>}
          />
        </Card>
      </Page>
    );
  }

  const categories = categoryRows ?? [];
  const titleError = showTitleError && !form.title.trim() ? 'Add a title before saving.' : null;

  return (
    <Page
      title={isEditing ? form.title.trim() || 'Untitled post' : 'New post'}
      backTo="/blogs"
      titleMeta={
        <Badge tone={dirty ? 'attention' : 'success'}>
          {dirty ? (isEditing ? 'Unsaved changes' : 'Not saved') : 'Saved'}
        </Badge>
      }
      primaryAction={{ label: 'Save', onClick: onSave, state: save.state }}
      secondaryActions={
        isEditing
          ? [{ label: 'Delete', critical: true, onClick: () => setDeleteOpen(true) }]
          : []
      }
    >
      <ErrorBanner error={save.error} />
      <PageLayout
        main={
          <ContentWritingEditor
            title={form.title}
            onTitleChange={onTitleChange}
            titleError={titleError}
            titlePlaceholder="Post title"
            body={form.body}
            onBodyChange={(v) => update('body', v)}
            cover={form.cover || null}
            onCoverChange={(url) => update('cover', url ?? '')}
            coverHint={form.title ? `${form.title} blog` : undefined}
          />
        }
        aside={
          <ContentSidebar
            status={form.status}
            onStatusChange={(v) => update('status', v)}
            statusOptions={STATUS_OPTIONS}
            statusHint={
              form.status === 'published' ? `Live at /blog/${form.slug || '…'}` : 'Only published posts appear on the storefront.'
            }
            slug={form.slug}
            onSlugChange={onSlugChange}
            slugPrefix="/blog/"
            slugLocked={slugLocked}
            onResetSlug={() => {
              setSlugLocked(false);
              update('slug', slugify(form.title));
            }}
            excerpt={form.excerpt}
            onExcerptChange={(v) => update('excerpt', v)}
            tagsText={form.tagsText}
            onTagsChange={(v) => update('tagsText', v)}
            metaTitle={form.metaTitle}
            onMetaTitleChange={(v) => update('metaTitle', v)}
            metaTitlePlaceholder={form.title || 'Defaults to the post title'}
            metaDescription={form.metaDescription}
            onMetaDescriptionChange={(v) => update('metaDescription', v)}
            metaDescriptionPlaceholder={form.excerpt || 'Defaults to the excerpt'}
          >
            <Card title="Organise">
              <CardSection>
                <div className="space-y-1.5">
                  <Label htmlFor="blog-category">Category</Label>
                  <Select
                    value={form.categorySlug || 'none'}
                    onValueChange={(v) => update('categorySlug', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger id="blog-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardSection>
              <CardSection>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="blog-featured" className="flex items-center gap-2">
                      <Star className="size-4 text-muted-foreground" aria-hidden /> Featured
                    </Label>
                    <p className="text-xs text-muted-foreground">Show in the featured section</p>
                  </div>
                  <Switch id="blog-featured" checked={form.isFeatured} onCheckedChange={(v) => update('isFeatured', v)} />
                </div>
              </CardSection>
              <CardSection>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="blog-pinned" className="flex items-center gap-2">
                      <Pin className="size-4 text-muted-foreground" aria-hidden /> Pinned
                    </Label>
                    <p className="text-xs text-muted-foreground">Keep at the top of the list</p>
                  </div>
                  <Switch id="blog-pinned" checked={form.isPinned} onCheckedChange={(v) => update('isPinned', v)} />
                </div>
              </CardSection>
            </Card>
          </ContentSidebar>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${form.title.trim() || 'this post'}"?`}
        description="This cannot be undone. The post URL stops working."
        confirmLabel="Delete post"
        critical
        onConfirm={onDelete}
      />
    </Page>
  );
}
