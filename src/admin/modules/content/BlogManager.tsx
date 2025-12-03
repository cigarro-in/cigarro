import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, Trash2, BookOpen, Save, Eye, EyeOff, Star, Pin } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Database-aligned interfaces
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
  author_id: string | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
  reading_time: number | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; color: string } | null;
  author?: { name: string; email: string } | null;
}

interface BlogCategory {
  id: string;
  name: string;
  color: string;
}

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
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
    meta_description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPosts(), loadCategories()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles(name, email),
        category:blog_categories(id, name, color)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPosts(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('blog_categories')
      .select('id, name, color')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    setCategories(data || []);
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const calculateReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  };

  const resetForm = () => {
    setForm({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      featured_image: '',
      status: 'draft',
      is_featured: false,
      is_pinned: false,
      category_id: '',
      meta_title: '',
      meta_description: ''
    });
  };

  const openCreate = () => {
    resetForm();
    setSelectedPost(null);
    setIsCreating(true);
  };

  const openEdit = (post: BlogPost) => {
    setForm({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      featured_image: post.featured_image || '',
      status: post.status || 'draft',
      is_featured: post.is_featured ?? false,
      is_pinned: post.is_pinned ?? false,
      category_id: post.category_id || '',
      meta_title: post.meta_title || '',
      meta_description: post.meta_description || ''
    });
    setSelectedPost(post);
    setIsCreating(false);
  };

  const closeEditor = () => {
    setSelectedPost(null);
    setIsCreating(false);
    resetForm();
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
        published_at: form.status === 'published' && !selectedPost?.published_at 
          ? new Date().toISOString() 
          : selectedPost?.published_at || null
      };

      if (selectedPost) {
        const { error } = await supabase
          .from('blog_posts')
          .update(data)
          .eq('id', selectedPost.id);
        if (error) throw error;
        toast.success('Post updated');
      } else {
        const { error } = await supabase
          .from('blog_posts')
          .insert({ ...data, view_count: 0 });
        if (error) throw error;
        toast.success('Post created');
      }

      closeEditor();
      loadPosts();
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
    if (!selectedPost) return;
    if (!confirm(`Delete "${selectedPost.title}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', selectedPost.id);
      if (error) throw error;
      toast.success('Post deleted');
      closeEditor();
      loadPosts();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error(error?.message || 'Failed to delete post');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  };

  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.excerpt?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Show editor view
  if (selectedPost || isCreating) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">
              {isCreating ? 'New Post' : `Edit: ${selectedPost?.title}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedPost && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Post'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Post Content</h2>
              
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={e => {
                    setForm(f => ({ 
                      ...f, 
                      title: e.target.value,
                      slug: f.slug || generateSlug(e.target.value)
                    }));
                  }}
                  placeholder="Enter post title"
                />
              </div>

              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="post-url-slug"
                />
              </div>

              <div>
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={form.excerpt}
                  onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                  placeholder="Brief summary of the post"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Write your post content here..."
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  ~{calculateReadingTime(form.content)} min read
                </p>
              </div>
            </div>

            {/* SEO */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">SEO Settings</h2>
              
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={form.meta_title}
                  onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                  placeholder="SEO title"
                />
              </div>

              <div>
                <Label htmlFor="meta_desc">Meta Description</Label>
                <Textarea
                  id="meta_desc"
                  value={form.meta_description}
                  onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                  placeholder="SEO description"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Featured Image */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Featured Image</h2>
              <ImageUpload
                imageUrl={form.featured_image || null}
                onImageUrlChange={(url) => setForm(f => ({ ...f, featured_image: url || '' }))}
                showSelector={true}
              />
            </div>

            {/* Status & Settings */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Settings</h2>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: 'draft' | 'published' | 'archived') => 
                    setForm(f => ({ ...f, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category_id || 'none'}
                  onValueChange={(value) => 
                    setForm(f => ({ ...f, category_id: value === 'none' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Featured</Label>
                  <p className="text-sm text-gray-500">Show in featured section</p>
                </div>
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_featured: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Pinned</Label>
                  <p className="text-sm text-gray-500">Pin to top of list</p>
                </div>
                <Switch
                  checked={form.is_pinned}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_pinned: checked }))}
                />
              </div>
            </div>

            {/* Info */}
            {selectedPost && (
              <div className="bg-white rounded-lg border p-6 space-y-2 text-sm text-gray-500">
                <p>Created: {format(new Date(selectedPost.created_at), 'MMM dd, yyyy')}</p>
                <p>Updated: {format(new Date(selectedPost.updated_at), 'MMM dd, yyyy')}</p>
                {selectedPost.published_at && (
                  <p>Published: {format(new Date(selectedPost.published_at), 'MMM dd, yyyy')}</p>
                )}
                <p>Views: {selectedPost.view_count}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog Posts</h1>
          <p className="text-gray-500">{posts.length} posts total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search posts..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm || statusFilter !== 'all' 
            ? 'No posts match your filters' 
            : 'No posts yet. Create your first post!'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredPosts.map(post => (
            <div
              key={post.id}
              onClick={() => openEdit(post)}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {/* Image */}
              <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {post.featured_image ? (
                  <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="h-6 w-6 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{post.title}</span>
                  {post.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                  {post.is_pinned && <Pin className="h-4 w-4 text-blue-500" />}
                </div>
                <p className="text-sm text-gray-500 truncate">{post.excerpt || 'No excerpt'}</p>
              </div>

              {/* Category */}
              {post.category && (
                <Badge variant="outline" style={{ borderColor: post.category.color, color: post.category.color }}>
                  {post.category.name}
                </Badge>
              )}

              {/* Date */}
              <div className="text-sm text-gray-500">
                {post.published_at 
                  ? format(new Date(post.published_at), 'MMM dd')
                  : 'Not published'}
              </div>

              {/* Status */}
              <Badge variant={getStatusColor(post.status) as any}>
                {post.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
