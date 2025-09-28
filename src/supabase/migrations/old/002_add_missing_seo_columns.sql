-- Add missing SEO columns to products table
-- This migration adds all the missing SEO and metadata columns that the ProductForm is trying to save

-- Add missing SEO columns to products table
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
ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT 0;

-- Add missing variant_slug column to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS variant_slug TEXT;

-- Add missing attributes column to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

-- Add missing SEO columns to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
ADD COLUMN IF NOT EXISTS og_title TEXT,
ADD COLUMN IF NOT EXISTS og_description TEXT,
ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.products.meta_keywords IS 'SEO meta keywords for search engines';
COMMENT ON COLUMN public.products.canonical_url IS 'Canonical URL for SEO';
COMMENT ON COLUMN public.products.og_title IS 'Open Graph title for social media sharing';
COMMENT ON COLUMN public.products.og_description IS 'Open Graph description for social media sharing';
COMMENT ON COLUMN public.products.og_image IS 'Open Graph image URL for social media sharing';
COMMENT ON COLUMN public.products.twitter_title IS 'Twitter card title';
COMMENT ON COLUMN public.products.twitter_description IS 'Twitter card description';
COMMENT ON COLUMN public.products.twitter_image IS 'Twitter card image URL';
COMMENT ON COLUMN public.products.structured_data IS 'JSON-LD structured data for SEO';
COMMENT ON COLUMN public.products.seo_score IS 'Calculated SEO score (0-100)';

COMMENT ON COLUMN public.product_variants.variant_slug IS 'URL-friendly slug for this variant';
COMMENT ON COLUMN public.product_variants.attributes IS 'JSON object storing variant-specific attributes (e.g., size, color)';
COMMENT ON COLUMN public.product_variants.meta_title IS 'SEO meta title for this variant';
COMMENT ON COLUMN public.product_variants.meta_description IS 'SEO meta description for this variant';
COMMENT ON COLUMN public.product_variants.meta_keywords IS 'SEO meta keywords for this variant';
COMMENT ON COLUMN public.product_variants.og_title IS 'Open Graph title for this variant';
COMMENT ON COLUMN public.product_variants.og_description IS 'Open Graph description for this variant';
COMMENT ON COLUMN public.product_variants.structured_data IS 'JSON-LD structured data for this variant';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_meta_keywords ON public.products USING gin(to_tsvector('english', meta_keywords));
CREATE INDEX IF NOT EXISTS idx_products_canonical_url ON public.products (canonical_url);
CREATE INDEX IF NOT EXISTS idx_product_variants_variant_slug ON public.product_variants (variant_slug);
