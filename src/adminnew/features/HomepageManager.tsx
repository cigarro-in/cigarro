import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Image, 
  Layout, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  RefreshCw, 
  Eye,
  EyeOff,
  Trash2,
  Package, 
  BookOpen, 
  Grid3X3,
  Settings
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';

interface HomepageComponent {
  id: string;
  component_name: string;
  section_id: string;
  is_enabled: boolean;
  display_order: number;
  config: any;
  section?: {
    id: string;
    title: string;
    slug: string;
  };
}

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  is_active: boolean;
  sort_order: number;
}

export function HomepageManager() {
  const navigate = useNavigate();
  const [components, setComponents] = useState<HomepageComponent[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHomepageData();
  }, []);

  const loadHomepageData = async () => {
    setIsLoading(true);
    try {
      // Load component configuration
      const { data: componentsData, error: componentsError } = await supabase
        .from('homepage_component_config')
        .select(`
          *,
          section:homepage_sections(id, title, slug)
        `)
        .order('display_order');

      if (componentsError) throw componentsError;
      setComponents(componentsData || []);

      // Load hero slides
      const { data: slidesData, error: slidesError } = await supabase
        .from('hero_slides')
        .select('id, title, subtitle, image_url, is_active, sort_order')
        .order('sort_order');

      if (slidesError) throw slidesError;
      setHeroSlides(slidesData || []);
    } catch (error) {
      console.error('Error loading homepage data:', error);
      toast.error('Failed to load homepage data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComponentToggle = async (componentId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('homepage_component_config')
        .update({ is_enabled: enabled })
        .eq('id', componentId);

      if (error) throw error;

      setComponents(prev => 
        prev.map(comp => 
          comp.id === componentId ? { ...comp, is_enabled: enabled } : comp
        )
      );

      toast.success(`Component ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling component:', error);
      toast.error('Failed to toggle component');
    }
  };

  const handleSlideToggle = async (slideId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('hero_slides')
        .update({ is_active: isActive })
        .eq('id', slideId);

      if (error) throw error;

      setHeroSlides(prev => 
        prev.map(slide => 
          slide.id === slideId ? { ...slide, is_active: isActive } : slide
        )
      );

      toast.success(`Slide ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling slide:', error);
      toast.error('Failed to toggle slide');
    }
  };

  const handleDeleteSlide = async (slideId: string, title: string) => {
    if (!confirm(`Delete slide "${title}"?`)) return;

    try {
      const { error } = await supabase
        .from('hero_slides')
        .delete()
        .eq('id', slideId);

      if (error) throw error;

      setHeroSlides(prev => prev.filter(s => s.id !== slideId));
      toast.success('Slide deleted');
    } catch (error) {
      console.error('Error deleting slide:', error);
      toast.error('Failed to delete slide');
    }
  };

  const handleReorderSlide = async (slideId: string, direction: 'up' | 'down') => {
    const slideIndex = heroSlides.findIndex(s => s.id === slideId);
    if (slideIndex === -1) return;

    const targetIndex = direction === 'up' ? slideIndex - 1 : slideIndex + 1;
    if (targetIndex < 0 || targetIndex >= heroSlides.length) return;

    const newSlides = [...heroSlides];
    [newSlides[slideIndex], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[slideIndex]];

    try {
      // Update sort orders
      for (let i = 0; i < newSlides.length; i++) {
        await supabase
          .from('hero_slides')
          .update({ sort_order: i })
          .eq('id', newSlides[i].id);
      }

      setHeroSlides(newSlides);
      toast.success('Slide order updated');
    } catch (error) {
      console.error('Error reordering slides:', error);
      toast.error('Failed to reorder slides');
    }
  };

  const getComponentIcon = (componentName: string) => {
    switch (componentName) {
      case 'hero_section': return <Image className="h-5 w-5" />;
      case 'featured_products': return <Package className="h-5 w-5" />;
      case 'product_showcase': return <Grid3X3 className="h-5 w-5" />;
      case 'categories_grid': return <Layout className="h-5 w-5" />;
      case 'blog_section': return <BookOpen className="h-5 w-5" />;
      default: return <Settings className="h-5 w-5" />;
    }
  };

  const getComponentTitle = (componentName: string) => {
    switch (componentName) {
      case 'hero_section': return 'Hero Section';
      case 'featured_products': return 'Featured Products';
      case 'product_showcase': return 'Product Showcase';
      case 'categories_grid': return 'Categories Grid';
      case 'blog_section': return 'Blog Section';
      default: return componentName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const activeSlides = heroSlides.filter(s => s.is_active).length;

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader
        title="Homepage Manager"
        description="Manage hero slides and homepage sections"
      >
        <Button onClick={loadHomepageData} disabled={isLoading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Hero Slides Section */}
        <AdminCard>
          <AdminCardHeader className="flex flex-row items-center justify-between">
            <AdminCardTitle className="flex items-center">
              <Image className="mr-2 h-5 w-5" />
              Hero Slides ({activeSlides} active)
            </AdminCardTitle>
            <Button 
              onClick={() => navigate('/admin/hero-slides/new')}
              size="sm"
              className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Slide
            </Button>
          </AdminCardHeader>
          <AdminCardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-canyon)]" />
              </div>
            ) : heroSlides.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Image className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No hero slides yet</p>
                <Button 
                  onClick={() => navigate('/admin/hero-slides/new')}
                  className="mt-4"
                  variant="outline"
                >
                  Add Your First Slide
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {heroSlides.map((slide, index) => (
                  <div 
                    key={slide.id}
                    className="flex items-center gap-4 p-3 border border-[var(--color-coyote)]/30 rounded-lg bg-[var(--color-creme)] hover:bg-[var(--color-creme-light)] transition-colors"
                  >
                    {/* Order Controls */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorderSlide(slide.id, 'up')}
                        disabled={index === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorderSlide(slide.id, 'down')}
                        disabled={index === heroSlides.length - 1}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Image Preview */}
                    <div className="w-24 h-14 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                      {slide.image_url ? (
                        <img
                          src={slide.image_url}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[var(--color-dark)] truncate">
                          {slide.title}
                        </h3>
                        <Badge variant={slide.is_active ? 'default' : 'secondary'} className="text-xs">
                          {slide.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {slide.subtitle && (
                        <p className="text-sm text-[var(--color-dark)]/60 truncate">
                          {slide.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={slide.is_active}
                        onCheckedChange={(checked) => handleSlideToggle(slide.id, checked)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/hero-slides/${slide.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSlide(slide.id, slide.title)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCardContent>
        </AdminCard>

        {/* Homepage Components Section */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Layout className="mr-2 h-5 w-5" />
              Homepage Sections
            </AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
            <p className="text-sm text-[var(--color-dark)]/60 mb-4">
              Toggle sections on/off. Product sections are managed via Collections.
            </p>
            {components.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Layout className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No homepage sections configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {components.map((component) => (
                  <div 
                    key={component.id} 
                    className="flex items-center justify-between p-3 border border-[var(--color-coyote)]/30 rounded-lg bg-[var(--color-creme)]"
                  >
                    <div className="flex items-center gap-3">
                      {getComponentIcon(component.component_name)}
                      <div>
                        <h3 className="font-medium text-[var(--color-dark)]">
                          {getComponentTitle(component.component_name)}
                        </h3>
                        {component.section && (
                          <p className="text-sm text-[var(--color-dark)]/60">
                            Collection: {component.section.title}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={component.is_enabled ? 'default' : 'secondary'}>
                        {component.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Switch
                        checked={component.is_enabled}
                        onCheckedChange={(checked) => handleComponentToggle(component.id, checked)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCardContent>
        </AdminCard>
      </div>
    </div>
  );
}
