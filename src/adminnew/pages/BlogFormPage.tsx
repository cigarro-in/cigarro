import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Eye, EyeOff, Star, Pin, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import {
  AdminCard,
  AdminCardContent,
  AdminCardHeader,
  AdminCardTitle,
  AdminCardDescription,
} from '../components/shared/AdminCard';
import { format } from 'date-fns';

interface BlogCategory {
  id: string;
  name: string;
  color: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image: string | null;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  is_pinned: boolean;
  category_id: string | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
  reading_time: number | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export function BlogFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = id && id !== 'new';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [post, setPost] = useState<BlogPost | null>(null);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featured_image: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    is_featured: false,
    is_pinned: false,
    category_id: '',
    meta_title: '',
    meta_description: '',
  });

  useEffect(() => {
    loadCategories();
    if (isEditing) {
      loadPost();
    }
  }, [id]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('id, name, color')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPost = async () => {
    if (!id || id === 'new') return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setPost(data);
        setForm({
          title: data.title || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          content: data.content || '',
          featured_image: data.featured_image || '',
          status: data.status || 'draft',
          is_featured: data.is_featured ?? false,
          is_pinned: data.is_pinned ?? false,
          category_id: data.category_id || '',
          meta_title: data.meta_title || '',
          meta_description: data.meta_description || '',
        });
      }
    } catch (error) {
      console.error('Error loading post:', error);
      toast.error('Failed to load post');
      navigate('/admin/blogs');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const calculateReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  };

  const handleTitleChange = (title: string) => {
    setForm(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Post title is required');
      return;
    }

    setSaving(true);
    try {
      const slug = form.slug || generateSlug(form.title);
      const readingTime = calculateReadingTime(form.content);

      const data = {
        title: form.title.trim(),
        slug,
        excerpt: form.excerpt.trim() || null,
        content: form.content || null,
        featured_image: form.featured_image || null,
        status: form.status,
        is_featured: form.is_featured,
        is_pinned: form.is_pinned,
        category_id: form.category_id || null,
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null,
        reading_time: readingTime,
        published_at: form.status === 'published' && !post?.published_at
          ? new Date().toISOString()
          : post?.published_at || null,
      };

      if (isEditing && post) {
        const { error } = await supabase
          .from('blog_posts')
          .update(data)
          .eq('id', post.id);
        if (error) throw error;
        toast.success('Post updated successfully');
      } else {
        const { error } = await supabase
          .from('blog_posts')
          .insert({ ...data, view_count: 0 });
        if (error) throw error;
        toast.success('Post created successfully');
      }

      navigate('/admin/blogs');
    } catch (error: any) {
      console.error('Error saving post:', error);
      if (error?.code === '23505') {
        toast.error('A post with this slug already exists');
      } else {
        toast.error(error?.message || 'Failed to save post');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', post.id);
      if (error) throw error;
      toast.success('Post deleted');
      navigate('/admin/blogs');
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error(error?.message || 'Failed to delete post');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-creme)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-canyon)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-creme)] pb-20">
      <PageHeader
        title={isEditing ? `Edit: ${post?.title || 'Post'}` : 'New Blog Post'}
        description={isEditing ? 'Update blog post details' : 'Create a new blog post'}
        backUrl="/admin/blogs"
      >
        {isEditing && (
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Post'}
        </Button>
      </PageHeader>

      <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-[1fr_300px] gap-4 mt-4">
        {/* Left Column - Main Content */}
        <div className="space-y-4">
          {/* Post Content */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Post Content</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter post title"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="post-url-slug"
                />
                <p className="text-xs text-[var(--color-dark)]/50">
                  URL: /blog/{form.slug || 'your-post-slug'}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={form.excerpt}
                  onChange={(e) => setForm(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Brief summary of the post"
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={form.content}
                  onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your post content here..."
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-[var(--color-dark)]/50">
                  ~{calculateReadingTime(form.content)} min read
                </p>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* SEO Settings */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>SEO Settings</AdminCardTitle>
              <AdminCardDescription>
                Optimize your post for search engines
              </AdminCardDescription>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={form.meta_title}
                  onChange={(e) => setForm(prev => ({ ...prev, meta_title: e.target.value }))}
                  placeholder="SEO title (defaults to post title)"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={form.meta_description}
                  onChange={(e) => setForm(prev => ({ ...prev, meta_description: e.target.value }))}
                  placeholder="SEO description (defaults to excerpt)"
                  rows={2}
                />
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-4">
          {/* Featured Image */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Featured Image</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <SingleImagePicker
                value={form.featured_image || null}
                onChange={(url) => setForm(prev => ({ ...prev, featured_image: url || '' }))}
              />
            </AdminCardContent>
          </AdminCard>

          {/* Status & Settings */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Settings</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: 'draft' | 'published' | 'archived') =>
                    setForm(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4" />
                        Draft
                      </div>
                    </SelectItem>
                    <SelectItem value="published">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Published
                      </div>
                    </SelectItem>
                    <SelectItem value="archived">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4 text-gray-400" />
                        Archived
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category_id || 'none'}
                  onValueChange={(value) =>
                    setForm(prev => ({ ...prev, category_id: value === 'none' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Featured
                  </Label>
                  <p className="text-xs text-[var(--color-dark)]/50">Show in featured section</p>
                </div>
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_featured: checked }))}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="flex items-center gap-2">
                    <Pin className="h-4 w-4 text-blue-500" />
                    Pinned
                  </Label>
                  <p className="text-xs text-[var(--color-dark)]/50">Pin to top of list</p>
                </div>
                <Switch
                  checked={form.is_pinned}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_pinned: checked }))}
                />
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Post Info (for existing posts) */}
          {post && (
            <AdminCard>
              <AdminCardHeader>
                <AdminCardTitle>Post Info</AdminCardTitle>
              </AdminCardHeader>
              <AdminCardContent className="space-y-2 text-sm text-[var(--color-dark)]/60">
                <p>Created: {format(new Date(post.created_at), 'MMM dd, yyyy')}</p>
                <p>Updated: {format(new Date(post.updated_at), 'MMM dd, yyyy')}</p>
                {post.published_at && (
                  <p>Published: {format(new Date(post.published_at), 'MMM dd, yyyy')}</p>
                )}
                <p>Views: {post.view_count}</p>
                {post.status === 'published' && (
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    View Post <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </AdminCardContent>
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  );
}
