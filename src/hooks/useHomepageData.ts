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

// Wave 3: homepage composes entirely from Convex hooks (catalog + content).
// No API hop, no Supabase fallback. Shapes match the legacy HomepageData
// contract; money stays rupees.
export function useHomepageData() {
  const {
    products: catalogProducts,
    brands: catalogBrands,
    categories: catalogCategories,
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
  const { posts: convexPosts, loading: blogLoading } = useBlogPosts(6);

  const isLoading =
    catalogLoading ||
    slidesLoading ||
    featuredLoading ||
    showcaseLoading ||
    blogSecLoading ||
    blogLoading;

  if (isLoading) {
    return { data: undefined as HomepageData | undefined, isLoading: true, error: null };
  }

  const active = (catalogProducts as any[]).filter((p: any) => p.is_active);
  const featuredProducts = [...active]
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    )
    .slice(0, 12);
  const showcaseProducts = [...active]
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
    .slice(0, 6);
  const categories = [...(catalogCategories as any[])].sort((a: any, b: any) =>
    String(a.name).localeCompare(String(b.name)),
  );
  const brands = (catalogBrands as any[]).filter((b: any) => b.isActive);

  const byId = new Map(active.map((p: any) => [p.id, p]));
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

  const data: HomepageData = {
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
    featuredSectionConfig: featuredCfg ? mapSection(featuredCfg) : null,
    showcaseConfig: showcaseCfg ? mapShowcase(showcaseCfg) : null,
    showcaseProducts,
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
