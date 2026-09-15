import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Image, 
  Layout, 
  Plus, 
  ArrowUp,
  ArrowDown,
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
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { invalidateStorefront } from '../../lib/cache/invalidateStorefront';
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

const SECTION_TITLE_ROWS = [
  'featured_products',
  'product_showcase',
  'brands_section',
  'categories_section',
  'blog_section',
];

const SECTION_FALLBACK_TITLES: Record<string, string> = {
  featured_products: 'Top Products',
  product_showcase: 'Discover Our Most Celebrated Collections',
  brands_section: 'Brands We Serve',
  categories_section: 'Explore Premium Categories',
  blog_section: 'Blogs',
};

const SECTION_LABELS: Record<string, string> = {
  featured_products: 'Featured products',
  product_showcase: 'Product showcase',
  brands_section: 'Brands',
  categories_section: 'Categories',
  blog_section: 'Blog',
};

function SectionTitleRow({
  sectionName,
  onSave,
}: {
  sectionName: string;
  onSave: (name: string, title: string) => Promise<void>;
}) {
  const row = useQuery(api.content.getSectionConfig, { name: sectionName });
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  if (row === undefined) {
    return <div className="h-10 animate-pulse bg-[var(--color-creme-light)] rounded" />;
  }
  const current = draft ?? (row?.title || '');
  const dirty = draft !== null && draft.trim() !== (row?.title || '');
  const empty = attempted && !current.trim();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-[var(--color-dark)]/70 w-40 shrink-0 truncate" title={sectionName}>
        {SECTION_LABELS[sectionName] || sectionName} <span className="text-red-500">*</span>
      </label>
      <input
        value={current}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={SECTION_FALLBACK_TITLES[sectionName] || sectionName}
        aria-invalid={empty}
        className={`flex-1 text-sm border rounded-md px-2 py-1.5 bg-white ${empty ? 'border-red-500' : 'border-[var(--color-coyote)]/30'}`}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={!dirty || saving}
        onClick={async () => {
          setAttempted(true);
          if (!current.trim()) return;
          setSaving(true);
          try {
            await onSave(sectionName, draft ?? '');
            setDraft(null);
            setAttempted(false);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}

export function HomepageManager() {
  const navigate = useNavigate();

  // Reactive Convex reads replace load + manual refresh (no Refresh button —
  // the list is always live).
  const componentRows = useQuery(api.content.listHomepageComponents, {});
  const slideRows = useQuery(api.adminCatalog.listHeroSlidesForAdmin, {});
  const collectionRows = useQuery(api.catalog.listCollections, {});
  const setComponent = useMutation(api.adminCatalog.saveHomepageComponent);
  const saveSection = useMutation(api.adminCatalog.saveSectionConfig);
  const patchSlide = useMutation(api.adminCatalog.saveHeroSlide);
  const removeSlide = useMutation(api.adminCatalog.deleteHeroSlide);

  const collectionTitle = new Map(
    (collectionRows || []).map((c: any) => [c.supabaseId, c.title])
  );
  const components: HomepageComponent[] = (componentRows || []).map((c: any) => ({
    id: c.componentName,
    component_name: c.componentName,
    section_id: c.sectionId ?? '',
    is_enabled: c.isEnabled,
    display_order: c.displayOrder,
    config: c.config,
    section: c.sectionId
      ? { id: c.sectionId, title: collectionTitle.get(c.sectionId) || c.sectionId, slug: '' }
      : undefined,
  }));
  const heroSlides: HeroSlide[] = (slideRows || []).map((s: any) => ({
    id: s._id,
    title: s.title || '',
    subtitle: s.subtitle ?? null,
    image_url: s.imageUrl || '',
    is_active: s.isActive,
    sort_order: s.sortOrder,
  }));
  const isLoading = componentRows === undefined || slideRows === undefined;

  const handleComponentToggle = async (componentName: string, enabled: boolean) => {
    try {
      await setComponent({ componentName, patch: { isEnabled: enabled } });
      toast.success(`Component ${enabled ? 'enabled' : 'disabled'}`);
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error toggling component:', error);
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to toggle component');
    }
  };

  // Link a product section to a Collection: title + products follow the
  // collection (rename once in Collections, every linked section follows).
  const handleCollectionLink = async (componentName: string, supabaseId: string) => {
    try {
      await setComponent({
        componentName,
        patch: supabaseId ? { sectionId: supabaseId } : { sectionId: undefined },
      });
      toast.success(supabaseId ? 'Collection linked' : 'Collection unlinked');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error linking collection:', error);
      toast.error('Failed to link collection');
    }
  };

  const handleSectionTitle = async (sectionName: string, title: string) => {
    if (!title.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    try {
      await saveSection({ sectionName, patch: { title: title.trim() } });
      toast.success('Section title updated');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error saving section title:', error);
      toast.error('Failed to update title');
    }
  };

  const handleSlideToggle = async (slideId: string, isActive: boolean) => {
    try {
      const slide = heroSlides.find((s) => s.id === slideId);
      await patchSlide({ id: slideId as any, slide: { isActive, sortOrder: slide?.sort_order ?? 0 } });
      toast.success(`Slide ${isActive ? 'activated' : 'deactivated'}`);
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error toggling slide:', error);
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to toggle slide');
    }
  };

  const handleDeleteSlide = async (slideId: string, title: string) => {
    if (!confirm(`Delete slide "${title}"?`)) return;

    try {
      await removeSlide({ id: slideId as any });
      toast.success('Slide deleted');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error deleting slide:', error);
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete slide');
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
      for (let i = 0; i < newSlides.length; i++) {
        await patchSlide({ id: newSlides[i].id as any, slide: { isActive: newSlides[i].is_active, sortOrder: i } });
      }
      toast.success('Slide order updated');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error reordering slides:', error);
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to reorder slides');
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

        {/* Section Titles */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Layout className="mr-2 h-5 w-5" />
              Section Titles
            </AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
            <p className="text-sm text-[var(--color-dark)]/60 mb-4">
              Headings shown on the storefront for sections that aren&apos;t linked
              to a collection. Linked sections use the collection&apos;s name.
            </p>
            <div className="space-y-3">
              {SECTION_TITLE_ROWS.map((name) => (
                <SectionTitleRow key={name} sectionName={name} onSave={handleSectionTitle} />
              ))}
            </div>
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
              Toggle sections on/off. Link product sections to a Collection to drive
              their title + products from it — rename the collection once, the
              storefront follows. Titles for the rest are edited below.
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
                    className="p-3 border border-[var(--color-coyote)]/30 rounded-lg bg-[var(--color-creme)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
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

                    {(component.component_name === 'featured_products' ||
                      component.component_name === 'product_showcase') && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--color-dark)]/60 whitespace-nowrap">
                          Collection:
                        </label>
                        <select
                          value={component.section_id || ''}
                          onChange={(e) => handleCollectionLink(component.id, e.target.value)}
                          className="flex-1 text-sm border border-[var(--color-coyote)]/30 rounded-md px-2 py-1.5 bg-white"
                        >
                          <option value="">— Latest products (default) —</option>
                          {(collectionRows || []).map((c: any) => (
                            <option key={c.supabaseId} value={c.supabaseId}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/admin/collections')}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Manage
                        </Button>
                      </div>
                    )}
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
