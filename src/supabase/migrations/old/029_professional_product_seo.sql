-- Professional Product Management with Enhanced SEO
-- This migration removes unnecessary fields and adds comprehensive SEO support

-- =============================================================================
-- 1. CLEAN UP PRODUCTS TABLE
-- =============================================================================

-- Remove deprecated fields from products table
ALTER TABLE public.products 
DROP COLUMN IF EXISTS strength,
DROP COLUMN IF EXISTS ingredients;

-- Add enhanced SEO fields to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
ADD COLUMN IF NOT EXISTS canonical_url TEXT,
ADD COLUMN IF NOT EXISTS og_title TEXT,
ADD COLUMN IF NOT EXISTS og_description TEXT,
ADD COLUMN IF NOT EXISTS og_image TEXT,
ADD COLUMN IF NOT EXISTS twitter_title TEXT,
ADD COLUMN IF NOT EXISTS twitter_description TEXT,
ADD COLUMN IF NOT EXISTS twitter_image TEXT,
ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT 0 CHECK (seo_score >= 0 AND seo_score <= 100);

-- =============================================================================
-- 2. ENHANCE PRODUCT VARIANTS TABLE
-- =============================================================================

-- Add variant slug for SEO-friendly URLs (without page reload)
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS variant_slug VARCHAR(200),
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
ADD COLUMN IF NOT EXISTS og_title TEXT,
ADD COLUMN IF NOT EXISTS og_description TEXT,
ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}';

-- Create unique constraint for variant slugs per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_slug_unique 
ON public.product_variants(product_id, variant_slug) 
WHERE variant_slug IS NOT NULL;

-- =============================================================================
-- 3. ENHANCE VARIANT IMAGES TABLE
-- =============================================================================

-- Add comprehensive SEO fields to variant images
ALTER TABLE public.variant_images 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS caption TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS focal_point JSONB DEFAULT '{"x": 0.5, "y": 0.5}',
ADD COLUMN IF NOT EXISTS image_width INTEGER,
ADD COLUMN IF NOT EXISTS image_height INTEGER,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS format VARCHAR(10),
ADD COLUMN IF NOT EXISTS lazy_load BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS webp_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS medium_url TEXT;

-- =============================================================================
-- 4. CREATE PRODUCT SEO ANALYTICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_seo_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0,
    avg_time_on_page INTEGER DEFAULT 0, -- in seconds
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    search_impressions INTEGER DEFAULT 0,
    search_clicks INTEGER DEFAULT 0,
    search_position DECIMAL(5,2) DEFAULT 0,
    last_crawled TIMESTAMP WITH TIME ZONE,
    last_indexed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 5. CREATE PRODUCT REVIEWS TABLE FOR SEO
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(100) NOT NULL,
    reviewer_email VARCHAR(255),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    content TEXT NOT NULL,
    is_verified_purchase BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    helpful_votes INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- SEO Analytics indexes
CREATE INDEX IF NOT EXISTS idx_product_seo_analytics_product_id ON public.product_seo_analytics(product_id);
CREATE INDEX IF NOT EXISTS idx_product_seo_analytics_variant_id ON public.product_seo_analytics(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_seo_analytics_page_views ON public.product_seo_analytics(page_views DESC);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_variant_id ON public.product_reviews(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON public.product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON public.product_reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON public.product_reviews(created_at DESC);

-- Enhanced product indexes for SEO
CREATE INDEX IF NOT EXISTS idx_products_seo_score ON public.products(seo_score DESC);
CREATE INDEX IF NOT EXISTS idx_products_meta_keywords ON public.products USING GIN(to_tsvector('english', meta_keywords));

-- Variant images indexes
CREATE INDEX IF NOT EXISTS idx_variant_images_dimensions ON public.variant_images(image_width, image_height);
CREATE INDEX IF NOT EXISTS idx_variant_images_format ON public.variant_images(format);

-- =============================================================================
-- 7. CREATE TRIGGERS FOR AUTO-UPDATES
-- =============================================================================

-- Update product SEO score trigger
CREATE OR REPLACE FUNCTION update_product_seo_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate SEO score based on completeness
    NEW.seo_score := (
        CASE WHEN NEW.meta_title IS NOT NULL AND LENGTH(NEW.meta_title) > 0 THEN 15 ELSE 0 END +
        CASE WHEN NEW.meta_description IS NOT NULL AND LENGTH(NEW.meta_description) > 0 THEN 15 ELSE 0 END +
        CASE WHEN NEW.meta_keywords IS NOT NULL AND LENGTH(NEW.meta_keywords) > 0 THEN 10 ELSE 0 END +
        CASE WHEN NEW.og_title IS NOT NULL AND LENGTH(NEW.og_title) > 0 THEN 10 ELSE 0 END +
        CASE WHEN NEW.og_description IS NOT NULL AND LENGTH(NEW.og_description) > 0 THEN 10 ELSE 0 END +
        CASE WHEN NEW.og_image IS NOT NULL AND LENGTH(NEW.og_image) > 0 THEN 10 ELSE 0 END +
        CASE WHEN NEW.description IS NOT NULL AND LENGTH(NEW.description) > 100 THEN 10 ELSE 0 END +
        CASE WHEN NEW.gallery_images IS NOT NULL AND array_length(NEW.gallery_images, 1) > 0 THEN 10 ELSE 0 END +
        CASE WHEN NEW.image_alt_text IS NOT NULL AND LENGTH(NEW.image_alt_text) > 0 THEN 10 ELSE 0 END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_seo_score
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_seo_score();

-- Auto-generate variant slugs
CREATE OR REPLACE FUNCTION generate_variant_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    counter INTEGER := 0;
    final_slug TEXT;
BEGIN
    -- Generate base slug from variant name
    base_slug := lower(regexp_replace(NEW.variant_name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    
    -- Ensure uniqueness within the product
    final_slug := base_slug;
    WHILE EXISTS (
        SELECT 1 FROM public.product_variants 
        WHERE product_id = NEW.product_id 
        AND variant_slug = final_slug 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.variant_slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_variant_slug
    BEFORE INSERT OR UPDATE ON public.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION generate_variant_slug();

-- =============================================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.product_seo_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Public read access for approved reviews
CREATE POLICY "Public read approved reviews" ON public.product_reviews
    FOR SELECT TO authenticated, anon
    USING (is_approved = true);

-- Users can create reviews
CREATE POLICY "Users can create reviews" ON public.product_reviews
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON public.product_reviews
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage reviews" ON public.product_reviews
    FOR ALL TO authenticated
    USING (public.is_admin());

-- Public read access for SEO analytics (limited fields)
CREATE POLICY "Public read seo analytics" ON public.product_seo_analytics
    FOR SELECT TO authenticated, anon
    USING (true);

-- Admins can manage SEO analytics
CREATE POLICY "Admins can manage seo analytics" ON public.product_seo_analytics
    FOR ALL TO authenticated
    USING (public.is_admin());

-- =============================================================================
-- 9. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.product_seo_analytics IS 'SEO performance tracking for products and variants';
COMMENT ON TABLE public.product_reviews IS 'Customer reviews for products and variants with SEO benefits';

COMMENT ON COLUMN public.products.meta_keywords IS 'SEO meta keywords for search engines';
COMMENT ON COLUMN public.products.canonical_url IS 'Canonical URL to prevent duplicate content issues';
COMMENT ON COLUMN public.products.structured_data IS 'JSON-LD structured data for rich snippets';
COMMENT ON COLUMN public.products.seo_score IS 'Calculated SEO completeness score (0-100)';

COMMENT ON COLUMN public.product_variants.variant_slug IS 'SEO-friendly URL slug for variant (used in URL without page reload)';
COMMENT ON COLUMN public.variant_images.focal_point IS 'Image focal point for responsive cropping {"x": 0.5, "y": 0.5}';
COMMENT ON COLUMN public.variant_images.webp_url IS 'WebP format URL for better performance';
