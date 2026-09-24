import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image,
  Layout,
  Plus,
  ArrowUp,
  ArrowDown,
  Eye,
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
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
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

// Canonical row order on the card. categories_grid is a legacy component
// name for the same categories section — aliased so it never renders twice.
const SECTION_ORDER = [
  'hero_section',
  'featured_products',
  'product_showcase',
  'categories_section',
  'brands_section',
  'blog_section',
];
const SECTION_ALIAS: Record<string, string> = { categories_grid: 'categories_section' };
const canon = (name: string) => SECTION_ALIAS[name] ?? name;
const orderOf = (name: string) => {
  const i = SECTION_ORDER.indexOf(canon(name));
  return i === -1 ? 99 : i;
};

const SECTION_FALLBACK_TITLES: Record<string, string> = {
  featured_products: 'Top Products',
  product_showcase: 'Discover Our Most Celebrated Collections',
  brands_section: 'Brands We Serve',
  categories_section: 'Explore Premium Categories',
  blog_section: 'Blogs',
};

const LINKABLE_SECTIONS = new Set(['featured_products', 'product_showcase']);

function sectionIcon(name: string) {
  switch (name) {
    case 'hero_section': return <Image className="h-5 w-5" />;
    case 'featured_products': return <Package className="h-5 w-5" />;
    case 'product_showcase': return <Grid3X3 className="h-5 w-5" />;
    case 'categories_grid':
    case 'categories_section': return <Layout className="h-5 w-5" />;
    case 'blog_section': return <BookOpen className="h-5 w-5" />;
    default: return <Settings className="h-5 w-5" />;
  }
}

function sectionLabel(name: string) {
  switch (name) {
    case 'hero_section': return 'Hero Section';
    case 'featured_products': return 'Featured Products';
    case 'product_showcase': return 'Product Showcase';
    case 'categories_grid':
    case 'categories_section': return 'Categories';
    case 'blog_section': return 'Blog Section';
    default: return name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

// One row: toggle + heading edit + (for product sections) collection link.
// Linked sections use the collection's name, so the title field hides while
// linked. hero_section has no editable title (slides carry their own copy).
function SectionRow({
  component,
  collectionRows,
  onToggle,
  onLink,
  onTitle,
  onManage,
}: {
  component: HomepageComponent;
  collectionRows: any[];
  onToggle: (name: string, enabled: boolean) => Promise<void>;
  onLink: (name: string, supabaseId: string) => Promise<void>;
  onTitle: (name: string, title: string) => Promise<void>;
  onManage: () => void;
}) {
  // Display name stays canonical; toggle/link callbacks always write the
  // canonical name the storefront reads.
  const name = canon(component.component_name);
  const row = useQuery(
    api.content.getSectionConfig,
    SECTION_TITLE_ROWS.includes(name) ? { name } : 'skip',
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { status: rowStatus, setError: setRowError } = useInlineStatus();
  const linked = LINKABLE_SECTIONS.has(name) && !!component.section_id;
  const showTitle = SECTION_TITLE_ROWS.includes(name) && name !== 'hero_section' && !linked;
  if (row === undefined && showTitle) {
    return <div className="h-16 animate-pulse bg-[var(--color-creme)] border border-[var(--color-coyote)]/30 rounded-lg" />;
  }
  const current = draft ?? (row?.title || '');
  const dirty = draft !== null && draft.trim() !== (row?.title || '');
  const saveTitle = async () => {
    if (!current.trim()) {
      setRowError('Title cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await onTitle(name, current.trim());
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="p-3 border border-[var(--color-coyote)]/30 rounded-lg bg-[var(--color-creme)] space-y-3">
      <InlineStatus status={rowStatus} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {sectionIcon(name)}
          <div>
            <h3 className="font-medium text-[var(--color-dark)]">{sectionLabel(name)}</h3>
            {linked && component.section && (
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
            onCheckedChange={(checked) => onToggle(name, checked)}
          />
        </div>
      </div>

      {showTitle && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--color-dark)]/60 whitespace-nowrap">
            Heading:
          </label>
          <input
            value={current}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void saveTitle(); }}
            placeholder={SECTION_FALLBACK_TITLES[name] || name}
            className="flex-1 text-sm border border-[var(--color-coyote)]/30 rounded-md px-2 py-1.5 bg-white"
          />
          <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={() => void saveTitle()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      {LINKABLE_SECTIONS.has(name) && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--color-dark)]/60 whitespace-nowrap">
            Collection:
          </label>
          <select
            value={component.section_id || ''}
            onChange={(e) => onLink(name, e.target.value)}
            className="flex-1 text-sm border border-[var(--color-coyote)]/30 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">— Latest products (default) —</option>
            {collectionRows.map((c: any) => (
              <option key={c.supabaseId} value={c.supabaseId}>
                {c.title}{c.isActive === false ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={onManage}>
            <Eye className="h-3 w-3 mr-1" />
            Manage
          </Button>
        </div>
      )}
    </div>
  );
}

export function HomepageManager() {
  const navigate = useNavigate();
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

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

  // One list drives the sections card, in canonical display order. Names
  // are canonicalized (categories_grid → categories_section) so the legacy
  // row never renders a duplicate card; toggles/links always write the
  // canonical name the storefront reads (absent = enabled; the first toggle
  // or title save creates the row via the upsert mutations below).
  const sectionNames = Array.from(
    new Set([
      ...SECTION_ORDER,
      ...components.map((c) => canon(c.component_name)),
      ...SECTION_TITLE_ROWS,
    ]),
  ).sort((a, b) => orderOf(a) - orderOf(b));
  const sectionFor = (name: string): HomepageComponent =>
    components.find((c) => c.component_name === name)
    // Alias fallback for display: a legacy categories_grid row drives the
    // card until the canonical row is created by the first toggle/save.
    ?? components.find((c) => canon(c.component_name) === name)
    ?? {
      id: name,
      component_name: name,
      section_id: '',
      is_enabled: true,
      display_order: 999,
      config: null,
    };

  const handleComponentToggle = async (componentName: string, enabled: boolean) => {
    try {
      await setComponent({ componentName, patch: { isEnabled: enabled } });
      setOpOk(`Component ${enabled ? 'enabled' : 'disabled'}`);
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error toggling component:', error);
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to toggle component');
    }
  };

  // Link a product section to a Collection: title + products follow the
  // collection (rename once in Collections, every linked section follows).
  // Unlink sends explicit null — undefined keys are stripped by the Convex
  // client transport, so { sectionId: undefined } would silently keep the link.
  const handleCollectionLink = async (componentName: string, supabaseId: string) => {
    try {
      await setComponent({
        componentName,
        patch: supabaseId ? { sectionId: supabaseId } : { sectionId: null },
      });
      setOpOk(supabaseId ? 'Collection linked' : 'Collection unlinked');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error linking collection:', error);
      setOpError('Failed to link collection');
    }
  };

  const handleSectionTitle = async (sectionName: string, title: string) => {
    if (!title.trim()) {
      setOpError('Title cannot be empty');
      return;
    }
    try {
      await saveSection({ sectionName, patch: { title: title.trim() } });
      setOpOk('Section title updated');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error saving section title:', error);
      setOpError('Failed to update title');
    }
  };

  const handleSlideToggle = async (slideId: string, isActive: boolean) => {
    try {
      const slide = heroSlides.find((s) => s.id === slideId);
      await patchSlide({ id: slideId as any, slide: { isActive, sortOrder: slide?.sort_order ?? 0 } });
      setOpOk(`Slide ${isActive ? 'activated' : 'deactivated'}`);
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error toggling slide:', error);
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to toggle slide');
    }
  };

  const handleDeleteSlide = async (slideId: string, title: string) => {
    if (!confirm(`Delete slide "${title}"?`)) return;

    try {
      await removeSlide({ id: slideId as any });
      setOpOk('Slide deleted');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error deleting slide:', error);
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete slide');
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
      setOpOk('Slide order updated');
      await invalidateStorefront();
    } catch (error: any) {
      console.error('Error reordering slides:', error);
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to reorder slides');
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
        <InlineStatus status={opStatus} />
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

        {/* Homepage Sections — toggle + title + collection link in one row */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Layout className="mr-2 h-5 w-5" />
              Homepage Sections
            </AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
            <p className="text-sm text-[var(--color-dark)]/60 mb-4">
              Toggle sections on/off and edit their headings. Link a product
              section to a Collection to drive its title + products from it —
              linked sections use the collection&apos;s name, so the title field
              is hidden while linked.
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-canyon)]" />
              </div>
            ) : (
              <div className="space-y-3">
                {sectionNames.map((name) => (
                  <SectionRow
                    key={name}
                    component={sectionFor(name)}
                    collectionRows={collectionRows || []}
                    onToggle={handleComponentToggle}
                    onLink={handleCollectionLink}
                    onTitle={handleSectionTitle}
                    onManage={() => navigate('/admin/collections')}
                  />
                ))}
              </div>
            )}
          </AdminCardContent>
        </AdminCard>
      </div>
    </div>
  );
}
