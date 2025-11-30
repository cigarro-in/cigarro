export interface HeroSlide {
  id: string;
  title: string;
  suptitle?: string;
  description?: string;
  image_url: string;
  mobile_image_url?: string;
  button_text?: string;
  button_url?: string;
  product_name?: string;
  product_price?: string;
  product_image_url?: string;
  is_active: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
}

export interface SectionConfig {
  title: string;
  subtitle?: string;
  description?: string;
  button_text?: string;
  button_url?: string;
  is_enabled?: boolean;
}

export interface ShowcaseConfig {
  title?: string;
  background_image?: string;
  button_text?: string;
  button_url?: string;
  is_enabled?: boolean;
}

export interface BlogSectionConfig {
  title?: string;
  subtitle?: string;
  description?: string;
}

export interface BlogPostAuthor {
  name?: string;
  email?: string;
}

export interface BlogPostCategory {
  name: string;
  color?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string;
  published_at: string;
  reading_time?: number;
  author?: BlogPostAuthor;
  category?: BlogPostCategory;
}

// Product variant for homepage display
export interface HomepageProductVariant {
  id: string;
  price: number;
  images: string[];
  is_active: boolean;
  is_default: boolean;
  variant_name?: string;
}

/**
 * Product type for homepage components.
 * Compatible with ProductCard's ProductWithVariants interface.
 */
export interface HomepageProduct {
  id: string;
  name: string;
  slug: string;
  brand?: string | { id: string; name: string };
  brand_id?: string;
  price?: number;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  product_variants?: HomepageProductVariant[];
  gallery_images?: string[];
  image?: string | null;
}

// Category with products for CategoryShowcases
export interface CategoryWithProducts extends Category {
  products: HomepageProduct[];
  product_count?: number;
}

export interface HomepageData {
  heroSlides: HeroSlide[];
  featuredProducts: HomepageProduct[];
  categories: Category[];
  brands: Brand[];
  featuredSectionConfig: SectionConfig | null;
  showcaseConfig: ShowcaseConfig | null;
  showcaseProducts: HomepageProduct[];
  blogPosts: BlogPost[];
  blogSectionConfig: BlogSectionConfig | null;
  categoriesWithProducts?: CategoryWithProducts[];
}
