export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  reading_time: number | null;
  view_count: number;
  like_count: number;
  is_featured: boolean;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  category_id: string | null;
  
  // SEO Fields
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  structured_data: any;
  
  // Social Media
  social_title: string | null;
  social_description: string | null;
  social_image: string | null;
  
  // Additional Content
  gallery_images: string[];
  attachments: any;
  
  // Relations
  author?: {
    id: string;
    name: string;
    email: string;
  } | null;
  category?: {
    id: string;
    name: string;
    slug: string;
    color: string;
  } | null;
  tags?: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
  }>;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlogComment {
  id: string;
  post_id: string;
  author_id: string | null;
  parent_id: string | null;
  author_name: string;
  author_email: string;
  content: string;
  is_approved: boolean;
  is_spam: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}
