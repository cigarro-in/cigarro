import { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Filter, FolderOpen, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { Badge } from '../../../components/ui/badge';
import { supabase } from '../../../lib/supabase/client';
import { Collection } from '../../../types/product';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CollectionEditor } from './CollectionEditor';

// Component for listing and managing collections
export function CollectionsList() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | undefined>(undefined);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error('Error loading collections:', error);
      toast.error('Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Collection deleted successfully');
      loadCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
    }
  };

  const handleEdit = (collection: Collection) => {
    setSelectedCollection(collection);
    setShowForm(true);
  };

  const handleCreate = () => {
    setSelectedCollection(undefined);
    setShowForm(true);
  };

  const filteredCollections = collections.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showForm) {
    return (
      <CollectionEditor 
        initialData={selectedCollection}
        onSave={() => {
          setShowForm(false);
          loadCollections();
        }}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            Collections
          </h2>
          <p className="text-muted-foreground">Manage your product collections and groups</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Collection
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>All Collections</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading collections...
                  </TableCell>
                </TableRow>
              ) : filteredCollections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No collections found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCollections.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        {collection.title}
                      </div>
                      <span className="text-xs text-muted-foreground ml-6">/{collection.slug}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {collection.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={collection.is_active ? 'default' : 'secondary'}>
                        {collection.is_active ? 'Active' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(collection.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(collection)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDelete(collection.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
