import React, { useState, useEffect } from 'react';
import { 
  Save, 
  X, 
  Eye, 
  EyeOff, 
  Star, 
  Pin, 
  Calendar,
  Tag,
  Image as ImageIcon,
  Link,
  Search,
  FileText,
  Settings,
  Globe,
  Hash,
  AlignLeft,
  Type,
  Palette,
  Upload
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../../../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../../../components/ui/card';
import {
  Badge
} from '../../../components/ui/badge';
import {
  Switch
} from '../../../components/ui/switch';
import {
  Separator
} from '../../../components/ui/separator';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { MultipleImageUpload } from '../../../components/ui/MultipleImageUpload';
import { BlogPost, BlogCategory, BlogTag } from '../../../types/blog';


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
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  
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
    meta_keywords: '',
    canonical_url: '',
    og_title: '',
    og_description: '',
    og_image: '',
    social_title: '',
    social_description: '',
    social_image: '',
    gallery_images: [] as string[],
    selected_tags: [] as string[]
  });

  const [availableTags, setAvailableTags] = useState<BlogTag[]>([]);
  const [tagSearchTerm, setTagSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      if (post) {
        loadPostData();
      } else {
        resetForm();
      }
      loadAvailableTags();
    }
  }, [open, post]);

  const loadPostData = async () => {
    if (!post) return;
    
    setIsLoading(true);
    try {
      // Load post tags
      const { data: postTags, error: tagsError } = await supabase
        .from('blog_post_tags')
        .select('tag:blog_tags(id, name)')
        .eq('post_id', post.id);

      if (tagsError) throw tagsError;

      setFormData({
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        featured_image: post.featured_image || '',
        status: post.status || 'draft',
        is_featured: post.is_featured || false,
        is_pinned: post.is_pinned || false,
        category_id: post.category_id || '',
        meta_title: post.meta_title || '',
        meta_description: post.meta_description || '',
        meta_keywords: post.meta_keywords || '',
        canonical_url: post.canonical_url || '',
        og_title: post.og_title || '',
        og_description: post.og_description || '',
        og_image: post.og_image || '',
        social_title: post.social_title || '',
        social_description: post.social_description || '',
        social_image: post.social_image || '',
        gallery_images: post.gallery_images || [],
        selected_tags: postTags?.map((t: any) => t.tag.id) || []
      });
    } catch (error) {
      console.error('Error loading post data:', error);
      toast.error('Failed to load post data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_tags')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const resetForm = () => {
    setFormData({
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
      meta_description: '',
      meta_keywords: '',
      canonical_url: '',
      og_title: '',
      og_description: '',
      og_image: '',
      social_title: '',
      social_description: '',
      social_image: '',
      gallery_images: [],
      selected_tags: []
    });
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const postData = {
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt,
        content: formData.content,
        featured_image: formData.featured_image || null,
        status: formData.status,
        is_featured: formData.is_featured,
        is_pinned: formData.is_pinned,
        category_id: formData.category_id || null,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        meta_keywords: formData.meta_keywords || null,
        canonical_url: formData.canonical_url || null,
        og_title: formData.og_title || null,
        og_description: formData.og_description || null,
        og_image: formData.og_image || null,
        social_title: formData.social_title || null,
        social_description: formData.social_description || null,
        social_image: formData.social_image || null,
        gallery_images: formData.gallery_images,
        published_at: formData.status === 'published' && !post?.published_at 
          ? new Date().toISOString() 
          : post?.published_at
      };

      let result;
      if (post) {
        // Update existing post
        const { data, error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', post.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new post
        const { data, error } = await supabase
          .from('blog_posts')
          .insert([{
            ...postData,
            author_id: (await supabase.auth.getUser()).data.user?.id
          }])
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Update tags
      if (result) {
        // Remove existing tags
        await supabase
          .from('blog_post_tags')
          .delete()
          .eq('post_id', result.id);

        // Add new tags
        if (formData.selected_tags.length > 0) {
          const tagInserts = formData.selected_tags.map(tagId => ({
            post_id: result.id,
            tag_id: tagId
          }));

          const { error: tagsError } = await supabase
            .from('blog_post_tags')
            .insert(tagInserts);

          if (tagsError) throw tagsError;
        }
      }

      toast.success(`Blog post ${post ? 'updated' : 'created'} successfully`);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving blog post:', error);
      toast.error(`Failed to ${post ? 'update' : 'create'} blog post`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_tags: prev.selected_tags.includes(tagId)
        ? prev.selected_tags.filter(id => id !== tagId)
        : [...prev.selected_tags, tagId]
    }));
  };

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) &&
    !formData.selected_tags.includes(tag.id)
  );

  const selectedTags = availableTags.filter(tag =>
    formData.selected_tags.includes(tag.id)
  );

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading post data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {post ? 'Edit Blog Post' : 'Create New Blog Post'}
          </DialogTitle>
          <DialogDescription>
            {post ? 'Update your blog post content and settings' : 'Create a new blog post with rich content and SEO optimization'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="content" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Media
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="seo" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Social
            </TabsTrigger>
            <TabsTrigger value="tags" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            {/* Content Tab */}
            <TabsContent value="content" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Enter blog post title"
                      className="text-lg"
                    />
                  </div>

                  <div>
                    <Label htmlFor="slug">URL Slug</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="url-friendly-slug"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be used in the URL: /blog/{formData.slug}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="excerpt">Excerpt</Label>
                    <Textarea
                      id="excerpt"
                      value={formData.excerpt}
                      onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                      placeholder="Brief description of the post (used in previews)"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Content *</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Write your blog post content here..."
                      rows={15}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.content.length} characters
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Publish Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
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

                      <div className="flex items-center justify-between">
                        <Label htmlFor="featured">Featured Post</Label>
                        <Switch
                          id="featured"
                          checked={formData.is_featured}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="pinned">Pinned Post</Label>
                        <Switch
                          id="pinned"
                          checked={formData.is_pinned}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_pinned: checked }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: category.color }}
                                  />
                                  {category.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Media Tab */}
            <TabsContent value="media" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Featured Image</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageUpload
                      imageUrl={formData.featured_image}
                      onImageUrlChange={(url) => setFormData(prev => ({ ...prev, featured_image: url || '' }))}
                      showSelector={true}
                      title="Select Featured Image"
                      description="Choose the main image for this blog post"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Gallery Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MultipleImageUpload
                      imageUrls={formData.gallery_images}
                      onImageUrlsChange={(urls) => setFormData(prev => ({ ...prev, gallery_images: urls }))}
                      showSelector={true}
                      title="Select Gallery Images"
                      description="Add multiple images to create a gallery"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Post Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="featured">Featured Post</Label>
                      <Switch
                        id="featured"
                        checked={formData.is_featured}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="pinned">Pinned Post</Label>
                      <Switch
                        id="pinned"
                        checked={formData.is_pinned}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_pinned: checked }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="canonical_url">Canonical URL</Label>
                    <Input
                      id="canonical_url"
                      value={formData.canonical_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, canonical_url: e.target.value }))}
                      placeholder="https://example.com/canonical-url"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The canonical URL for this post (for SEO)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEO Tab */}
            <TabsContent value="seo" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Meta Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="meta_title">Meta Title</Label>
                      <Input
                        id="meta_title"
                        value={formData.meta_title}
                        onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                        placeholder="SEO title for search engines"
                        maxLength={60}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.meta_title.length}/60 characters
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="meta_description">Meta Description</Label>
                      <Textarea
                        id="meta_description"
                        value={formData.meta_description}
                        onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                        placeholder="Brief description for search engines"
                        rows={3}
                        maxLength={160}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.meta_description.length}/160 characters
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="meta_keywords">Meta Keywords</Label>
                      <Input
                        id="meta_keywords"
                        value={formData.meta_keywords}
                        onChange={(e) => setFormData(prev => ({ ...prev, meta_keywords: e.target.value }))}
                        placeholder="keyword1, keyword2, keyword3"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Open Graph</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="og_title">OG Title</Label>
                      <Input
                        id="og_title"
                        value={formData.og_title}
                        onChange={(e) => setFormData(prev => ({ ...prev, og_title: e.target.value }))}
                        placeholder="Title for social media sharing"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <Label htmlFor="og_description">OG Description</Label>
                      <Textarea
                        id="og_description"
                        value={formData.og_description}
                        onChange={(e) => setFormData(prev => ({ ...prev, og_description: e.target.value }))}
                        placeholder="Description for social media sharing"
                        rows={3}
                        maxLength={200}
                      />
                    </div>

                    <div>
                      <Label htmlFor="og_image">OG Image</Label>
                      <ImageUpload
                        imageUrl={formData.og_image}
                        onImageUrlChange={(url) => setFormData(prev => ({ ...prev, og_image: url || '' }))}
                        showSelector={true}
                        title="Select OG Image"
                        description="Image for social media sharing"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Social Tab */}
            <TabsContent value="social" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Social Media Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="social_title">Social Title</Label>
                      <Input
                        id="social_title"
                        value={formData.social_title}
                        onChange={(e) => setFormData(prev => ({ ...prev, social_title: e.target.value }))}
                        placeholder="Custom title for social sharing"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <Label htmlFor="social_description">Social Description</Label>
                      <Input
                        id="social_description"
                        value={formData.social_description}
                        onChange={(e) => setFormData(prev => ({ ...prev, social_description: e.target.value }))}
                        placeholder="Custom description for social sharing"
                        maxLength={200}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="social_image">Social Image</Label>
                    <ImageUpload
                      imageUrl={formData.social_image}
                      onImageUrlChange={(url) => setFormData(prev => ({ ...prev, social_image: url || '' }))}
                      showSelector={true}
                      title="Select Social Image"
                      description="Custom image for social media sharing"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tags Tab */}
            <TabsContent value="tags" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Selected Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedTags.map(tag => (
                          <Badge 
                            key={tag.id} 
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => handleTagToggle(tag.id)}
                            style={{ backgroundColor: tag.color + '20', color: tag.color }}
                          >
                            {tag.name} ×
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No tags selected</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Available Tags</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search tags..."
                        value={tagSearchTerm}
                        onChange={(e) => setTagSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                      {filteredTags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {filteredTags.map(tag => (
                            <Badge 
                              key={tag.id} 
                              variant="outline"
                              className="cursor-pointer hover:bg-primary/10"
                              onClick={() => handleTagToggle(tag.id)}
                              style={{ borderColor: tag.color, color: tag.color }}
                            >
                              + {tag.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          {tagSearchTerm ? 'No tags found matching your search' : 'All available tags are selected'}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {formData.title && (
              <span>Preview: /blog/{formData.slug || generateSlug(formData.title)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.title || !formData.content}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {post ? 'Update Post' : 'Create Post'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
