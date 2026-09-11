import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

// Theme-safe content reads (Wave 2: Convex; replaces Supabase blog / hero /
// config / settings reads). Shapes are UI-shaped (camelCase); blog author is
// a plain string (no profiles join). Tags were never migrated (no tag UI
// depended on real tag rows beyond display) — tags read as [].
export interface BlogListPost {
  _id: string;
  slug: string;
  title: string;
  excerpt?: string;
  featuredImage?: string | null;
  authorName: string;
  categorySlug?: string;
  readingTime?: number;
  metaTitle?: string;
  metaDescription?: string;
  publishedAt?: number;
  // compat aliases for Supabase-shaped consumers (removed as callers migrate)
  featured_image?: string | null;
  author?: { name: string };
  category?: { name: string };
  published_at?: string;
  reading_time?: number;
  meta_title?: string;
  meta_description?: string;
  tags?: Array<{ name: string }>;
}

export interface BlogDetailPost extends BlogListPost {
  content: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

function withCompat(row: any): any {
  if (!row) return row;
  return {
    ...row,
    featured_image: row.featuredImage ?? null,
    author: { name: row.authorName ?? 'Cigarro' },
    category: row.categorySlug ? { name: row.categorySlug } : undefined,
    published_at: row.publishedAt
      ? new Date(row.publishedAt).toISOString()
      : undefined,
    reading_time: row.readingTime,
    meta_title: row.metaTitle,
    meta_description: row.metaDescription,
    tags: [],
  };
}

export function useBlogPosts(limit = 50) {
  const rows = useQuery(api.content.listBlogPosts, { limit });
  return {
    posts: ((rows ?? []).map(withCompat) as BlogDetailPost[]),
    loading: rows === undefined,
  };
}

export function useBlogPost(slug: string | undefined) {
  const row = useQuery(
    api.content.getBlogPostBySlug,
    slug ? { slug } : 'skip'
  );
  return {
    post: (row ? withCompat(row) : null) as BlogDetailPost | null,
    loading: row === undefined,
  };
}

export function useRelatedPosts(categorySlug?: string, excludeSlug?: string, limit = 3) {
  const rows = useQuery(api.content.listRelatedPosts, {
    categorySlug,
    excludeSlug,
    limit,
  });
  return { posts: ((rows ?? []).map(withCompat) as BlogListPost[]) };
}

export function useBlogCategories() {
  const rows = useQuery(api.content.listBlogCategories, {});
  return { categories: rows ?? [] };
}

export interface HeroSlide {
  _id: string;
  title?: string;
  subtitle?: string;
  suptitle?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  buttonStyle?: string;
  imageUrl?: string;
  image_url?: string;
  mobileImageUrl?: string;
  mobile_image_url?: string;
  productImageUrl?: string;
  productName?: string;
  productPrice?: number;
  smallImageUrl?: string;
  overlayOpacity?: number;
  textColor?: string;
  textPosition?: string;
  sortOrder: number;
  sort_order?: number;
  isActive?: boolean;
  is_active?: boolean;
}

function withSlideCompat(row: any): any {
  if (!row) return row;
  return {
    ...row,
    image_url: row.imageUrl,
    mobile_image_url: row.mobileImageUrl,
    sort_order: row.sortOrder,
    is_active: true,
  };
}

export function useHeroSlides() {
  const rows = useQuery(api.content.listHeroSlides, {});
  return {
    slides: ((rows ?? []).map(withSlideCompat) as HeroSlide[]),
    loading: rows === undefined,
  };
}

export function useSectionConfig(name: string | undefined) {
  const row = useQuery(
    api.content.getSectionConfig,
    name ? { name } : 'skip'
  );
  if (!row) return { config: null, loading: row === undefined };
  return {
    config: {
      ...row,
      section_name: (row as any).sectionName,
      background_image: (row as any).backgroundImage,
      button_text: (row as any).buttonText,
      button_url: (row as any).buttonUrl,
      is_enabled: (row as any).isEnabled,
    },
    loading: false,
  };
}

export function useSiteSettings() {
  const row = useQuery(api.content.getSiteSettings, {});
  if (!row) return { settings: null, loading: row === undefined };
  return {
    settings: {
      ...row,
      site_name: (row as any).siteName,
      meta_title: (row as any).metaTitle,
      meta_description: (row as any).metaDescription,
      favicon_url: (row as any).faviconUrl,
      active_theme: (row as any).activeTheme,
      upi_id: (row as any).upiId,
    },
    loading: false,
  };
}
