import {
  HomepageData,
  HeroSlide,
  SectionConfig,
  ShowcaseConfig,
  BlogSectionConfig,
  BlogPost,
} from '../types/home';
import { useHeroSlides, useSectionConfig, useBlogPosts } from './data/useContent';
import { useFullCatalog } from './data/useCatalog';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Wave 3: homepage composes entirely from Convex hooks (catalog + content).
// No API hop, no Supabase fallback. Shapes match the legacy HomepageData
// contract; money stays rupees.
//
// Featured + showcase sections resolve from admin-linked Collections
// (homepageComponentConfig.sectionId = collection supabaseId): the section
// title/description come from the collection, products from its membership.
// Unlinked sections fall back to the legacy derived lists + sectionConfigs.
export function useHomepageData() {
  const {
    products: catalogProducts,
    brands: catalogBrands,
    categories: catalogCategories,
    collections: catalogCollections,
    collectionProducts: catalogCollectionProducts,
    productCategories,
    loading: catalogLoading,
  } = useFullCatalog();
  const { slides, loading: slidesLoading } = useHeroSlides();
  const { config: featuredCfg, loading: featuredLoading } =
    useSectionConfig('featured_products');
  const { config: showcaseCfg, loading: showcaseLoading } =
    useSectionConfig('product_showcase');
  const { config: blogSecCfg, loading: blogSecLoading } =
    useSectionConfig('blog_section');
  const { config: brandsCfg, loading: brandsLoading } =
    useSectionConfig('brands_section');
  const { config: categoriesCfg, loading: categoriesLoading } =
    useSectionConfig('categories_section');
  const { posts: convexPosts, loading: blogLoading } = useBlogPosts(6);
  const homepageComponents = useQuery(api.content.listHomepageComponents, {});

  const isLoading =
    catalogLoading ||
    slidesLoading ||
    featuredLoading ||
    showcaseLoading ||
    blogSecLoading ||
    brandsLoading ||
    categoriesLoading ||
    blogLoading ||
    homepageComponents === undefined;

  if (isLoading) {
    return { data: undefined as HomepageData | undefined, isLoading: true, error: null };
  }

  const active = (catalogProducts as any[]).filter((p: any) => p.is_active);
  const byId = new Map(active.map((p: any) => [p.id, p]));

  // Products of an admin-linked collection, in collection sort order.
  const collectionProducts = (supabaseId: string | undefined, fallback: any[]) => {
    if (!supabaseId) return fallback;
    const joins = ((catalogCollectionProducts as any[]) || [])
      .filter((j: any) => j.collectionSupabaseId === supabaseId)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const list = joins.map((j: any) => byId.get(j.productSupabaseId)).filter(Boolean);
    return list.length > 0 ? list : fallback;
  };
  const linkedCollection = (componentName: string) => {
    const comp = (homepageComponents || []).find((c: any) => c.componentName === componentName);
    const id = comp?.sectionId;
    if (!id) return null;
    const found = ((catalogCollections as any[]) || []).find((c: any) => c.supabaseId === id) ?? null;
    // Deactivated collections stop driving the section (fall back to latest).
    if (found && found.isActive === false) return null;
    return found;
  };

  const newestFirst = [...active]
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    )
    .slice(0, 12);
  const alphaFirst = [...active]
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
    .slice(0, 6);

  const featuredCollection = linkedCollection('featured_products');
  const showcaseCollection = linkedCollection('product_showcase');
  const featuredProducts = collectionProducts(featuredCollection?.supabaseId, newestFirst);
  const showcaseProducts = collectionProducts(showcaseCollection?.supabaseId, alphaFirst);
  const categories = [...(catalogCategories as any[])].sort((a: any, b: any) =>
    String(a.name).localeCompare(String(b.name)),
  );
  const brands = (catalogBrands as any[]).filter((b: any) => b.isActive);

  const categoriesWithProducts = categories
    .slice(0, 6)
    .map((cat: any) => ({
      id: cat.supabaseId,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      products: (productCategories as any[])
        .filter((j: any) => j.categorySupabaseId === cat.supabaseId)
        .map((j: any) => byId.get(j.productSupabaseId))
        .filter(Boolean),
    }))
    .filter((cat: any) => cat.products.length > 0);

  // Collection titles win over sectionConfig titles (admin renames a
  // collection once, every linked section follows).
  const featuredSection = featuredCollection
    ? { title: featuredCollection.title, subtitle: featuredCfg?.subtitle, description: featuredCollection.description ?? featuredCfg?.description, button_text: (featuredCfg as any)?.button_text ?? (featuredCfg as any)?.buttonText, button_url: (featuredCfg as any)?.button_url ?? (featuredCfg as any)?.buttonUrl, is_enabled: (featuredCfg as any)?.is_enabled ?? (featuredCfg as any)?.isEnabled }
    : featuredCfg;
  const showcaseSection = showcaseCollection
    ? { title: showcaseCollection.title, background_image: (showcaseCfg as any)?.background_image ?? (showcaseCfg as any)?.backgroundImage ?? showcaseCollection.imageUrl, button_text: (showcaseCfg as any)?.button_text ?? (showcaseCfg as any)?.buttonText, button_url: (showcaseCfg as any)?.button_url ?? (showcaseCfg as any)?.buttonUrl, is_enabled: (showcaseCfg as any)?.is_enabled ?? (showcaseCfg as any)?.isEnabled }
    : showcaseCfg;

  // Admin on/off toggles (absent row = enabled, so existing installs keep rendering).
  const compEnabled = (name: string) =>
    (homepageComponents || []).find((c: any) => c.componentName === name)?.isEnabled !== false;
  const sectionsEnabled: Record<string, boolean> = {
    hero_section: compEnabled('hero_section'),
    featured_products: compEnabled('featured_products'),
    product_showcase: compEnabled('product_showcase'),
    brands_section: compEnabled('brands_section'),
    categories_section: compEnabled('categories_section'),
    blog_section: compEnabled('blog_section'),
  };

  const data: HomepageData = {
    sectionsEnabled,
    featuredProducts,
    categories: categories.slice(0, 20).map((c: any) => ({
      id: c.supabaseId,
      name: c.name,
      slug: c.slug,
      image: c.image,
      description: c.description,
    })),
    brands: brands.slice(0, 20).map((b: any) => ({
      id: b.supabaseId,
      name: b.name,
      slug: b.slug,
      description: b.description,
      logo_url: b.logoUrl,
      is_active: b.isActive,
    })),
    heroSlides: slides.map(mapHeroSlide),
    featuredSectionConfig: featuredSection ? mapSection(featuredSection) : null,
    showcaseConfig: showcaseSection ? mapShowcase(showcaseSection) : null,
    showcaseProducts,
    showcaseCollection: showcaseCollection
      ? { title: showcaseCollection.title, description: showcaseCollection.description, imageUrl: showcaseCollection.imageUrl }
      : null,
    brandsSectionConfig: brandsCfg ? mapBlogSection(brandsCfg) : null,
    categoriesSectionConfig: categoriesCfg ? mapBlogSection(categoriesCfg) : null,
    blogPosts: convexPosts.map(mapHomePost),
    blogSectionConfig: blogSecCfg ? mapBlogSection(blogSecCfg) : null,
    categoriesWithProducts,
  };

  return { data, isLoading: false, error: null };
}

// ---------- Convex (camelCase + compat aliases) -> home shapes ----------

function mapHeroSlide(s: any): HeroSlide {
  return {
    id: String(s._id ?? s.id),
    title: s.title ?? '',
    suptitle: s.suptitle,
    description: s.description,
    image_url: s.image_url ?? s.imageUrl ?? '',
    mobile_image_url: s.mobile_image_url ?? s.mobileImageUrl,
    button_text: s.button_text ?? s.buttonText,
    button_url: s.button_url ?? s.buttonUrl,
    product_name: s.product_name ?? s.productName,
    product_price:
      s.product_price ??
      (s.productPrice != null ? String(s.productPrice) : undefined),
    product_image_url: s.product_image_url ?? s.productImageUrl,
    is_active: s.is_active ?? true,
    sort_order: s.sort_order ?? s.sortOrder ?? 0,
  };
}

function mapSection(c: any): SectionConfig {
  return {
    title: c.title ?? '',
    subtitle: c.subtitle,
    description: c.description,
    button_text: c.button_text ?? c.buttonText,
    button_url: c.button_url ?? c.buttonUrl,
    is_enabled: c.is_enabled ?? c.isEnabled,
  };
}

function mapShowcase(c: any): ShowcaseConfig {
  return {
    title: c.title,
    background_image: c.background_image ?? c.backgroundImage,
    button_text: c.button_text ?? c.buttonText,
    button_url: c.button_url ?? c.buttonUrl,
    is_enabled: c.is_enabled ?? c.isEnabled,
  };
}

function mapBlogSection(c: any): BlogSectionConfig {
  return {
    title: c.title,
    subtitle: c.subtitle,
    description: c.description,
  };
}

function mapHomePost(p: any): BlogPost {
  return {
    id: String(p._id ?? p.id),
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    featured_image: p.featured_image ?? p.featuredImage,
    published_at: p.published_at ?? '',
    reading_time: p.reading_time ?? p.readingTime,
    author: p.author ?? (p.authorName ? { name: p.authorName } : undefined),
    category: p.category,
  };
}
