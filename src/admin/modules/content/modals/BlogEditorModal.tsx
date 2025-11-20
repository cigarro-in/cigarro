import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Switch } from '../../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Separator } from '../../../../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../../../../lib/supabase/client';
import { BlogPost, BlogCategory, BlogTag } from '../../../../types/blog';

interface BlogEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: BlogPost | null;
  categories: BlogCategory[];
  tags: BlogTag[];
  onSave: () => void;
}

export function BlogEditorModal({
  open,
  onOpenChange,
  post,
  categories,
  tags,
  onSave
}: BlogEditorModalProps) {
  const [formData, setFormData] = useState({
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
    published_at: '',
    reading_time: 0,
    view_count: 0
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || '',
        content: post.content || '',
        featured_image: post.featured_image || '',
        status: post.status as 'draft' | 'published' | 'archived',
        is_featured: post.is_featured,
        is_pinned: post.is_pinned,
        category_id: post.category_id || 'none',
        meta_title: post.meta_title || '',
        meta_description: post.meta_description || '',
        published_at: post.published_at || '',
        reading_time: post.reading_time || 0,
        view_count: post.view_count || 0
      });
      setSelectedTags(post.tags?.map(tag => tag.id) || []);
    } else {
      setFormData({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        featured_image: '',
        status: 'draft',
        is_featured: false,
        is_pinned: false,
        category_id: 'none',
        meta_title: '',
        meta_description: '',
        published_at: '',
        reading_time: 0,
        view_count: 0
      });
      setSelectedTags([]);
    }
  }, [post]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title)
    }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsLoading(true);
    try {
      const blogData = {
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt,
        content: formData.content,
        featured_image: formData.featured_image,
        status: formData.status,
        is_featured: formData.is_featured,
        is_pinned: formData.is_pinned,
        category_id: formData.category_id === 'none' ? null : formData.category_id || null,
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
        published_at: formData.status === 'published' && !formData.published_at
          ? new Date().toISOString()
          : formData.published_at,
        reading_time: formData.reading_time,
        view_count: formData.view_count
      };

      if (post) {
        // Update existing post
        const { error } = await supabase
          .from('blog_posts')
          .update(blogData)
          .eq('id', post.id);

        if (error) throw error;

        // Update tags
        await supabase
          .from('blog_post_tags')
          .delete()
          .eq('post_id', post.id);

        if (selectedTags.length > 0) {
          const tagData = selectedTags.map(tagId => ({
            post_id: post.id,
            tag_id: tagId
          }));
          await supabase
            .from('blog_post_tags')
            .insert(tagData);
        }

        toast.success('Blog post updated successfully');
      } else {
        // Create new post
        const { data: newPost, error } = await supabase
          .from('blog_posts')
          .insert([blogData])
          .select()
          .single();

        if (error) throw error;

        // Insert tags
        if (selectedTags.length > 0) {
          const tagData = selectedTags.map(tagId => ({
            post_id: newPost.id,
            tag_id: tagId
          }));
          await supabase
            .from('blog_post_tags')
            .insert(tagData);
        }

        toast.success('Blog post created successfully');
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving blog post:', error);
      toast.error('Failed to save blog post');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {post ? 'Edit Blog Post' : 'Create New Blog Post'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Tabs defaultValue="content" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter blog post title"
                />
              </div>

              <div>
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="post-url-slug"
                />
              </div>

              <div>
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Brief description of the post"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your blog post content here..."
                  rows={10}
                />
              </div>

              <div>
                <Label htmlFor="featured_image">Featured Image URL</Label>
                <Input
                  id="featured_image"
                  value={formData.featured_image}
                  onChange={(e) => setFormData(prev => ({ ...prev, featured_image: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div>
                <Label>Tags</Label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tagId => {
                      const tag = tags.find(t => t.id === tagId);
                      return tag ? (
                        <Badge key={tagId} variant="secondary" className="flex items-center gap-1">
                          {tag.name}
                          <button
                            onClick={() => setSelectedTags(prev => prev.filter(id => id !== tagId))}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                  <Select onValueChange={(value: string) => {
                    if (!selectedTags.includes(value)) {
                      setSelectedTags(prev => [...prev, value]);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tags" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags
                        .filter(tag => !selectedTags.includes(tag.id))
                        .map(tag => (
                          <SelectItem key={tag.id} value={tag.id}>
                            {tag.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                  placeholder="SEO title for search engines"
                />
              </div>

              <div>
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                  placeholder="SEO description for search engines"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Post Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'draft' | 'published') => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label>Featured Post</Label>
                  <Switch
                    checked={formData.is_featured}
                    onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Pinned Post</Label>
                  <Switch
                    checked={formData.is_pinned}
                    onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_pinned: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : post ? 'Update Post' : 'Create Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

