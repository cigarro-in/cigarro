-- Migration: Blog Management System
-- Version: 0023
-- Description: Create comprehensive blog management system with categories, tags, and SEO

-- Create blog_categories table
CREATE TABLE IF NOT EXISTS public.blog_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for category
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blog_tags table
CREATE TABLE IF NOT EXISTS public.blog_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#6B7280', -- Hex color for tag
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blog_posts table with comprehensive fields
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    reading_time INTEGER, -- in minutes
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    
    -- SEO Fields
    meta_title VARCHAR(60),
    meta_description VARCHAR(160),
    meta_keywords TEXT,
    canonical_url TEXT,
    og_title VARCHAR(100),
    og_description VARCHAR(200),
    og_image TEXT,
    structured_data JSONB DEFAULT '{}',
    
    -- Social Media
    social_title VARCHAR(100),
    social_description VARCHAR(200),
    social_image TEXT,
    
    -- Additional Content
    gallery_images TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '{}', -- For PDFs, etc.
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blog_post_tags junction table
CREATE TABLE IF NOT EXISTS public.blog_post_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, tag_id)
);

-- Create blog_comments table
CREATE TABLE IF NOT EXISTS public.blog_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE, -- For nested comments
    author_name VARCHAR(100) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    is_spam BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category_id ON public.blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON public.blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON public.blog_posts(is_featured, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_pinned ON public.blog_posts(is_pinned, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_post_id ON public.blog_post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag_id ON public.blog_post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON public.blog_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_approved ON public.blog_comments(is_approved, created_at DESC);

-- Insert default blog categories
INSERT INTO public.blog_categories (name, slug, description, color, sort_order) VALUES
('Tobacco Culture', 'tobacco-culture', 'Stories about tobacco traditions and culture', '#8B4513', 1),
('Product Reviews', 'product-reviews', 'In-depth reviews of our products', '#DC2626', 2),
('Lifestyle', 'lifestyle', 'Lifestyle articles and tips', '#059669', 3),
('News & Updates', 'news-updates', 'Company news and product updates', '#2563EB', 4),
('Tutorials', 'tutorials', 'How-to guides and tutorials', '#7C3AED', 5)
ON CONFLICT (name) DO NOTHING;

-- Insert default blog tags
INSERT INTO public.blog_tags (name, slug, color) VALUES
('Premium', 'premium', '#FFD700'),
('Traditional', 'traditional', '#8B4513'),
('Modern', 'modern', '#3B82F6'),
('Review', 'review', '#DC2626'),
('Guide', 'guide', '#059669'),
('News', 'news', '#2563EB'),
('Lifestyle', 'lifestyle', '#7C3AED'),
('Culture', 'culture', '#8B4513'),
('Quality', 'quality', '#059669'),
('Heritage', 'heritage', '#8B4513')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blog_categories
CREATE POLICY "Anyone can view blog categories" ON public.blog_categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage blog categories" ON public.blog_categories FOR ALL USING (public.is_admin());

-- RLS Policies for blog_tags
CREATE POLICY "Anyone can view blog tags" ON public.blog_tags FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage blog tags" ON public.blog_tags FOR ALL USING (public.is_admin());

-- RLS Policies for blog_posts
CREATE POLICY "Anyone can view published blog posts" ON public.blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Authors can view their own posts" ON public.blog_posts FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "Admins can manage all blog posts" ON public.blog_posts FOR ALL USING (public.is_admin());
CREATE POLICY "Authors can manage their own posts" ON public.blog_posts FOR ALL USING (author_id = auth.uid());

-- RLS Policies for blog_post_tags
CREATE POLICY "Anyone can view blog post tags" ON public.blog_post_tags FOR SELECT USING (true);
CREATE POLICY "Admins can manage blog post tags" ON public.blog_post_tags FOR ALL USING (public.is_admin());

-- RLS Policies for blog_comments
CREATE POLICY "Anyone can view approved comments" ON public.blog_comments FOR SELECT USING (is_approved = TRUE AND is_spam = FALSE);
CREATE POLICY "Comment authors can view their own comments" ON public.blog_comments FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "Admins can manage all comments" ON public.blog_comments FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can insert comments" ON public.blog_comments FOR INSERT WITH CHECK (true);

-- Create function to update reading time
CREATE OR REPLACE FUNCTION public.calculate_reading_time(content TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Estimate 200 words per minute reading speed
  RETURN GREATEST(1, CEIL(LENGTH(REGEXP_REPLACE(content, '\s+', ' ', 'g')) / 200));
END;
$$ LANGUAGE plpgsql;

-- Create function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug
CREATE OR REPLACE FUNCTION public.auto_generate_blog_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_blog_slug
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_blog_slug();

-- Create trigger to auto-calculate reading time
CREATE OR REPLACE FUNCTION public.auto_calculate_reading_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.reading_time := public.calculate_reading_time(NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_calculate_reading_time
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_reading_time();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_updated_at();

CREATE TRIGGER trigger_update_blog_categories_updated_at
  BEFORE UPDATE ON public.blog_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_updated_at();

CREATE TRIGGER trigger_update_blog_tags_updated_at
  BEFORE UPDATE ON public.blog_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_updated_at();

CREATE TRIGGER trigger_update_blog_comments_updated_at
  BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_updated_at();


