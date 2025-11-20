import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Star, 
  Pin, 
  Calendar,
  User,
  Tag,
  MoreHorizontal,
  BookOpen
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../../../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback';
import { BlogEditorModal } from './modals/BlogEditorModal';
import { BlogPost, BlogCategory, BlogTag } from '../../../types/blog';


export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadPosts(),
        loadCategories(),
        loadTags()
      ]);
    } catch (error) {
      console.error('Error loading blog data:', error);
      toast.error('Failed to load blog data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles(name, email),
        category:blog_categories(id, name, color),
        tags:blog_post_tags(
          tag:blog_tags(name, color)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedPosts = data?.map(post => ({
      ...post,
      tags: post.tags?.map((t: any) => t.tag) || []
    })) || [];

    setPosts(formattedPosts);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('blog_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    setCategories(data || []);
  };

  const loadTags = async () => {
    const { data, error } = await supabase
      .from('blog_tags')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setTags(data || []);
  };

  const handleCreatePost = () => {
    setEditingPost(null);
    setIsEditorOpen(true);
  };

  const handleEditPost = (post: BlogPost) => {
    setEditingPost(post);
    setIsEditorOpen(true);
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast.success('Blog post deleted successfully');
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete blog post');
    } finally {
      setDeletePostId(null);
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ 
          status: newStatus,
          published_at: newStatus === 'published' ? new Date().toISOString() : null
        })
        .eq('id', post.id);

      if (error) throw error;

      toast.success(`Post ${newStatus === 'published' ? 'published' : 'unpublished'} successfully`);
      loadPosts();
    } catch (error) {
      console.error('Error updating post status:', error);
      toast.error('Failed to update post status');
    }
  };

  const handleToggleFeatured = async (post: BlogPost) => {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ is_featured: !post.is_featured })
        .eq('id', post.id);

      if (error) throw error;

      toast.success(`Post ${post.is_featured ? 'removed from' : 'added to'} featured`);
      loadPosts();
    } catch (error) {
      console.error('Error updating featured status:', error);
      toast.error('Failed to update featured status');
    }
  };

  const handleTogglePinned = async (post: BlogPost) => {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ is_pinned: !post.is_pinned })
        .eq('id', post.id);

      if (error) throw error;

      toast.success(`Post ${post.is_pinned ? 'unpinned' : 'pinned'} successfully`);
      loadPosts();
    } catch (error) {
      console.error('Error updating pinned status:', error);
      toast.error('Failed to update pinned status');
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                         (post.author?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || post.category?.id === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    let aValue = a[sortBy as keyof BlogPost];
    let bValue = b[sortBy as keyof BlogPost];

    if (sortBy === 'published_at' || sortBy === 'created_at' || sortBy === 'updated_at') {
      aValue = aValue ? new Date(aValue as string).getTime() : 0;
      bValue = bValue ? new Date(bValue as string).getTime() : 0;
    }

    // Handle null values
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Blog Management</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading blog posts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Blog Management
          </h2>
          <p className="text-muted-foreground">Manage your blog posts, categories, and content</p>
        </div>
        <Button type="button" onClick={handleCreatePost} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Post
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Posts</p>
                <p className="text-2xl font-bold">{posts.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Published</p>
                <p className="text-2xl font-bold text-green-600">
                  {posts.filter(p => p.status === 'published').length}
                </p>
              </div>
              <Eye className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {posts.filter(p => p.status === 'draft').length}
                </p>
              </div>
              <EyeOff className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Featured</p>
                <p className="text-2xl font-bold text-blue-600">
                  {posts.filter(p => p.is_featured).length}
                </p>
              </div>
              <Star className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
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
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created Date</SelectItem>
                <SelectItem value="published_at">Published Date</SelectItem>
                <SelectItem value="updated_at">Updated Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="view_count">Views</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Views</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      {post.featured_image && (
                        <div className="w-16 h-12 rounded-md overflow-hidden flex-shrink-0">
                          <ImageWithFallback
                            src={post.featured_image}
                            alt={post.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{post.title}</h3>
                          {post.is_featured && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                          {post.is_pinned && (
                            <Pin className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {post.excerpt || 'No excerpt available'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {post.tags?.slice(0, 2).map((tag: { id: string; name: string; slug: string; color: string }, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag.name}
                            </Badge>
                          ))}
                          {post.tags && post.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{post.tags.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{post.author?.name || 'Unknown'}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {post.category ? (
                      <Badge 
                        variant="outline" 
                        style={{ borderColor: post.category.color, color: post.category.color }}
                      >
                        {post.category.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No category</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <Badge className={getStatusColor(post.status)}>
                      {post.status}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {post.published_at ? format(new Date(post.published_at), 'MMM dd, yyyy') : 'Not published'}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{post.view_count}</div>
                      {post.reading_time && (
                        <div className="text-muted-foreground">{post.reading_time} min read</div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPost(post)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(post)}>
                          {post.status === 'published' ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Publish
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleFeatured(post)}>
                          <Star className="h-4 w-4 mr-2" />
                          {post.is_featured ? 'Remove from Featured' : 'Add to Featured'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePinned(post)}>
                          <Pin className="h-4 w-4 mr-2" />
                          {post.is_pinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeletePostId(post.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {sortedPosts.length === 0 && (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No blog posts found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your filters to see more posts.'
                  : 'Get started by creating your first blog post.'
                }
              </p>
              <Button onClick={handleCreatePost}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Post
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blog Editor Modal */}
      <BlogEditorModal
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        post={editingPost}
        categories={categories}
        tags={tags}
        onSave={loadPosts}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blog Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this blog post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePostId && handleDeletePost(deletePostId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}