import { useState, useEffect } from 'react';
import { 
  Home, 
  Settings, 
  Image, 
  Layout,
  Plus,
  Edit,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  CheckCircle,
  Monitor,
  Smartphone,
  Tablet,
  Package,
  BookOpen,
  Grid3X3
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { HeroSectionManager } from './modals/HeroSectionManager';
import { FeaturedProductsManager } from './modals/FeaturedProductsManager';
import { BrandHeritageManager } from './modals/BrandHeritageManager';
import { ProductShowcaseManager } from './modals/ProductShowcaseManager';
import { CategoriesGridManager } from './modals/CategoriesGridManager';
import { BlogSectionManager } from './modals/BlogSectionManager';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';

interface HomepageComponent {
  id: string;
  component_name: string;
  section_id: string;
  is_enabled: boolean;
  display_order: number;
  config: any;
  created_at: string;
  updated_at: string;
  section?: {
    id: string;
    title: string;
    slug: string;
  };
}

interface HomepageStats {
  totalSlides: number;
  activeSlides: number;
  totalComponents: number;
  enabledComponents: number;
}

export default function HomepageManager() {
  const [components, setComponents] = useState<HomepageComponent[]>([]);
  const [stats, setStats] = useState<HomepageStats>({
    totalSlides: 0,
    activeSlides: 0,
    totalComponents: 0,
    enabledComponents: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Modal states
  const [showHeroManager, setShowHeroManager] = useState(false);
  const [showFeaturedManager, setShowFeaturedManager] = useState(false);
  const [showBrandHeritageManager, setShowBrandHeritageManager] = useState(false);
  const [showProductShowcaseManager, setShowProductShowcaseManager] = useState(false);
  const [showCategoriesGridManager, setShowCategoriesGridManager] = useState(false);
  const [showBlogSectionManager, setShowBlogSectionManager] = useState(false);

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

      // Load hero slides stats
      const { data: slidesData, error: slidesError } = await supabase
        .from('hero_slides')
        .select('id, is_active');

      if (slidesError) throw slidesError;

      const totalSlides = slidesData?.length || 0;
      const activeSlides = slidesData?.filter(s => s.is_active).length || 0;
      const totalComponents = componentsData?.length || 0;
      const enabledComponents = componentsData?.filter(c => c.is_enabled).length || 0;

      setStats({
        totalSlides,
        activeSlides,
        totalComponents,
        enabledComponents
      });
    } catch (error) {
      console.error('Error loading homepage data:', error);
      toast.error('Failed to load homepage data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleComponent = async (componentId: string, enabled: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('homepage_component_config')
        .update({ 
          is_enabled: enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', componentId);

      if (error) throw error;

      setComponents(prev => 
        prev.map(comp => 
          comp.id === componentId 
            ? { ...comp, is_enabled: enabled }
            : comp
        )
      );

      setStats(prev => ({
        ...prev,
        enabledComponents: prev.enabledComponents + (enabled ? 1 : -1)
      }));

      toast.success(`Component ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling component:', error);
      toast.error('Failed to update component');
    } finally {
      setIsSaving(false);
    }
  };

  const reorderComponents = async (fromIndex: number, toIndex: number) => {
    const newComponents = [...components];
    const [movedComponent] = newComponents.splice(fromIndex, 1);
    newComponents.splice(toIndex, 0, movedComponent);

    // Update display_order for all components
    const updates = newComponents.map((comp, index) => ({
      id: comp.id,
      display_order: index + 1
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('homepage_component_config')
          .update({ 
            display_order: update.display_order,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);
      }

      setComponents(newComponents);
      toast.success('Component order updated');
    } catch (error) {
      console.error('Error reordering components:', error);
      toast.error('Failed to reorder components');
    }
  };

  const getComponentIcon = (componentName: string) => {
    switch (componentName) {
      case 'Hero':
        return <Image className="h-5 w-5" />;
      case 'FeaturedProducts':
        return <Package className="h-5 w-5" />;
      case 'BrandHeritage':
        return <Settings className="h-5 w-5" />;
      case 'ProductShowcase':
        return <Monitor className="h-5 w-5" />;
      case 'CategoriesGrid':
        return <Grid3X3 className="h-5 w-5" />;
      case 'BlogSection':
        return <BookOpen className="h-5 w-5" />;
      default:
        return <Layout className="h-5 w-5" />;
    }
  };

  const getComponentDescription = (componentName: string) => {
    switch (componentName) {
      case 'Hero':
        return 'Main hero carousel with rotating slides';
      case 'FeaturedProducts':
        return 'Showcases featured products from your catalog';
      case 'BrandHeritage':
        return 'Brand story and heritage section';
      case 'ProductShowcase':
        return 'Product grid with lifestyle imagery';
      case 'CategoriesGrid':
        return 'Product categories in grid layout';
      case 'BlogSection':
        return 'Latest blog posts and articles';
      default:
        return 'Homepage component';
    }
  };

  const handleEditComponent = (componentName: string) => {
    switch (componentName) {
      case 'Hero':
        setShowHeroManager(true);
        break;
      case 'FeaturedProducts':
        setShowFeaturedManager(true);
        break;
      case 'BrandHeritage':
        setShowBrandHeritageManager(true);
        break;
      case 'ProductShowcase':
        setShowProductShowcaseManager(true);
        break;
      case 'CategoriesGrid':
        setShowCategoriesGridManager(true);
        break;
      case 'BlogSection':
        setShowBlogSectionManager(true);
        break;
      default:
        toast.info(`${componentName} component management coming soon`);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6" />
            Homepage Management
          </h2>
          <p className="text-muted-foreground">
            Manage your homepage components - enable/disable, reorder, and edit each section
          </p>
        </div>
        <Button onClick={loadHomepageData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Hero Slides</p>
                <p className="text-2xl font-bold">{stats.activeSlides}/{stats.totalSlides}</p>
              </div>
              <Image className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Components</p>
                <p className="text-2xl font-bold">{stats.enabledComponents}/{stats.totalComponents}</p>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </div>
              <Layout className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-sm font-bold text-green-600">Active</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Components in One List */}
      <Card>
        <CardHeader>
          <CardTitle>Homepage Components</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enable/disable components, reorder them, and edit each section directly
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {components.map((component, index) => (
              <div key={component.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reorderComponents(index, Math.max(0, index - 1))}
                      disabled={index === 0 || isSaving}
                      className="h-6 w-6 p-0"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reorderComponents(index, Math.min(components.length - 1, index + 1))}
                      disabled={index === components.length - 1 || isSaving}
                      className="h-6 w-6 p-0"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Component Info */}
                  <div className="flex items-center gap-3">
                    {getComponentIcon(component.component_name)}
                    <div>
                      <h3 className="font-medium text-lg">{component.component_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {getComponentDescription(component.component_name)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditComponent(component.component_name)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={component.is_enabled}
                      onCheckedChange={(checked) => toggleComponent(component.id, checked)}
                      disabled={isSaving}
                    />
                    <Badge variant={component.is_enabled ? "default" : "secondary"}>
                      {component.is_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <HeroSectionManager 
        open={showHeroManager} 
        onOpenChange={setShowHeroManager}
        onUpdate={loadHomepageData}
      />
      <FeaturedProductsManager 
        open={showFeaturedManager} 
        onOpenChange={setShowFeaturedManager}
        onUpdate={loadHomepageData}
      />
      <BrandHeritageManager 
        open={showBrandHeritageManager} 
        onOpenChange={setShowBrandHeritageManager}
        onUpdate={loadHomepageData}
      />
      <ProductShowcaseManager 
        open={showProductShowcaseManager} 
        onOpenChange={setShowProductShowcaseManager}
        onUpdate={loadHomepageData}
      />
      <CategoriesGridManager 
        open={showCategoriesGridManager} 
        onOpenChange={setShowCategoriesGridManager}
        onUpdate={loadHomepageData}
      />
      <BlogSectionManager 
        open={showBlogSectionManager} 
        onOpenChange={setShowBlogSectionManager}
        onUpdate={loadHomepageData}
      />
    </div>
  );
}