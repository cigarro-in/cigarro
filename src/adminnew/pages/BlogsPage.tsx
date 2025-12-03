import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, BookOpen, Plus, ChevronDown, Star, Pin, Search } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '../components/shared/DataTable';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { PageHeader } from '../components/shared/PageHeader';
import { format } from 'date-fns';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  is_pinned: boolean;
  category_id: string | null;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; color: string } | null;
}

export function BlogsPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          category:blog_categories(id, name, color)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPost = () => {
    navigate('/admin/blogs/new');
  };

  const handleEditPost = (post: BlogPost) => {
    navigate(`/admin/blogs/${post.id}`);
  };

  const handleBulkDelete = async (postIds: string[]) => {
    if (!confirm(`Delete ${postIds.length} posts? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .in('id', postIds);

      if (error) throw error;
      toast.success(`${postIds.length} posts deleted`);
      setSelectedPosts([]);
      fetchPosts();
    } catch (error) {
      toast.error('Failed to delete posts');
    }
  };

  const handleBulkStatusChange = async (postIds: string[], status: 'draft' | 'published' | 'archived') => {
    try {
      const updateData: any = { status };
      if (status === 'published') {
        updateData.published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('blog_posts')
        .update(updateData)
        .in('id', postIds);

      if (error) throw error;
      toast.success(`${postIds.length} posts updated to ${status}`);
      setSelectedPosts([]);
      fetchPosts();
    } catch (error) {
      toast.error('Failed to update posts');
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

  // Filter posts
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: 'title',
      label: 'Post',
      render: (_: any, post: BlogPost) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
            {post.featured_image ? (
              <ImageWithFallback
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{post.title}</span>
              {post.is_featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
              {post.is_pinned && <Pin className="h-3 w-3 text-blue-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500 truncate max-w-[300px]">
              {post.excerpt || 'No excerpt'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (_: any, post: BlogPost) => (
        post.category ? (
          <Badge 
            variant="outline" 
            style={{ borderColor: post.category.color, color: post.category.color }}
            className="text-xs"
          >
            {post.category.name}
          </Badge>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, post: BlogPost) => (
        <Badge variant={getStatusColor(post.status) as any} className="text-xs capitalize">
          {post.status}
        </Badge>
      ),
    },
    {
      key: 'view_count',
      label: 'Views',
      render: (_: any, post: BlogPost) => (
        <span className="text-sm text-gray-600">{post.view_count || 0}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (_: any, post: BlogPost) => (
        <div className="text-xs text-gray-500">
          {post.published_at 
            ? format(new Date(post.published_at), 'MMM dd, yyyy')
            : format(new Date(post.created_at), 'MMM dd, yyyy')}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader
        title="Blog Posts"
        description={`${posts.length} posts total`}
      >
        <Button 
          onClick={handleAddPost}
          className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Post
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

        {/* Bulk Actions */}
        {selectedPosts.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-[var(--color-creme-light)] border border-[var(--color-coyote)]/20 rounded-lg">
            <span className="text-sm font-medium">
              {selectedPosts.length} selected
            </span>
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Change Status <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkStatusChange(selectedPosts, 'published')}>
                  <Eye className="mr-2 h-4 w-4" />
                  Publish
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange(selectedPosts, 'draft')}>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Set as Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange(selectedPosts, 'archived')}>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleBulkDelete(selectedPosts)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        )}

        {/* Data Table */}
        <DataTable
          data={filteredPosts}
          columns={columns}
          loading={loading}
          onRowClick={handleEditPost}
          selectedItems={selectedPosts}
          onSelectionChange={setSelectedPosts}
          hideToolbar
        />
      </div>
    </div>
  );
}
