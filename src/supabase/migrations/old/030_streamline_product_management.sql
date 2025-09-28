-- Streamline Product Management - Remove SKU and optimize structure
-- This migration removes SKU fields and optimizes the product management system

-- =============================================================================
-- 1. REMOVE SKU FROM PRODUCT VARIANTS
-- =============================================================================

-- Drop SKU column and related constraints
ALTER TABLE public.product_variants 
DROP COLUMN IF EXISTS sku;

-- Remove any indexes related to SKU
DROP INDEX IF EXISTS idx_product_variants_sku;

-- =============================================================================
-- 2. UPDATE VARIANT IMAGES TO BE MORE FLEXIBLE
-- =============================================================================

-- Add variant_id as nullable to support shared images
ALTER TABLE public.variant_images 
ALTER COLUMN variant_id DROP NOT NULL;

-- Add product_id for shared images
ALTER TABLE public.variant_images 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;

-- Add constraint to ensure either variant_id or product_id is set
ALTER TABLE public.variant_images 
ADD CONSTRAINT check_variant_or_product_id 
CHECK (
  (variant_id IS NOT NULL AND product_id IS NULL) OR 
  (variant_id IS NULL AND product_id IS NOT NULL)
);

-- =============================================================================
-- 3. CREATE FUNCTION TO AUTO-GENERATE SLUGS
-- =============================================================================

-- Drop existing function if it exists (to handle parameter name changes)
DROP FUNCTION IF EXISTS generate_slug(TEXT);

CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(input_text, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 4. CREATE FUNCTION TO AUTO-FILL SEO DATA
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_fill_product_seo()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate slug if not provided
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  
  -- Auto-fill meta_title if not provided
  IF NEW.meta_title IS NULL OR NEW.meta_title = '' THEN
    NEW.meta_title := NEW.name || ' | ' || NEW.brand || ' | Premium Quality';
  END IF;
  
  -- Auto-fill meta_description if not provided
  IF NEW.meta_description IS NULL OR NEW.meta_description = '' THEN
    NEW.meta_description := 'Buy ' || NEW.name || ' from ' || NEW.brand || 
      ' for ₹' || NEW.price || '. Premium quality, fast delivery, authentic products. Order now!';
  END IF;
  
  -- Auto-fill canonical_url if not provided
  IF NEW.canonical_url IS NULL OR NEW.canonical_url = '' THEN
    NEW.canonical_url := 'https://cigarro.in/product/' || NEW.slug;
  END IF;
  
  -- Auto-fill og_title if not provided
  IF NEW.og_title IS NULL OR NEW.og_title = '' THEN
    NEW.og_title := NEW.meta_title;
  END IF;
  
  -- Auto-fill og_description if not provided
  IF NEW.og_description IS NULL OR NEW.og_description = '' THEN
    NEW.og_description := NEW.meta_description;
  END IF;
  
  -- Auto-fill twitter_title if not provided
  IF NEW.twitter_title IS NULL OR NEW.twitter_title = '' THEN
    NEW.twitter_title := NEW.meta_title;
  END IF;
  
  -- Auto-fill twitter_description if not provided
  IF NEW.twitter_description IS NULL OR NEW.twitter_description = '' THEN
    NEW.twitter_description := NEW.meta_description;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-filling SEO data
DROP TRIGGER IF EXISTS trigger_auto_fill_product_seo ON public.products;
CREATE TRIGGER trigger_auto_fill_product_seo
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_product_seo();

-- =============================================================================
-- 5. CREATE FUNCTION TO AUTO-FILL VARIANT SEO DATA
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_fill_variant_seo()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
BEGIN
  -- Get product information
  SELECT name, brand, slug INTO product_record 
  FROM public.products 
  WHERE id = NEW.product_id;
  
  -- Auto-generate variant_slug if not provided
  IF NEW.variant_slug IS NULL OR NEW.variant_slug = '' THEN
    NEW.variant_slug := generate_slug(NEW.variant_name);
  END IF;
  
  -- Auto-fill meta_title if not provided
  IF NEW.meta_title IS NULL OR NEW.meta_title = '' THEN
    NEW.meta_title := product_record.name || ' - ' || NEW.variant_name || 
      ' | ' || product_record.brand || ' | Premium Quality';
  END IF;
  
  -- Auto-fill meta_description if not provided
  IF NEW.meta_description IS NULL OR NEW.meta_description = '' THEN
    NEW.meta_description := 'Buy ' || product_record.name || ' - ' || NEW.variant_name || 
      ' for ₹' || NEW.price || '. Premium quality, fast delivery, authentic products. Order now!';
  END IF;
  
  -- Auto-fill og_title if not provided
  IF NEW.og_title IS NULL OR NEW.og_title = '' THEN
    NEW.og_title := NEW.meta_title;
  END IF;
  
  -- Auto-fill og_description if not provided
  IF NEW.og_description IS NULL OR NEW.og_description = '' THEN
    NEW.og_description := NEW.meta_description;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-filling variant SEO data
DROP TRIGGER IF EXISTS trigger_auto_fill_variant_seo ON public.product_variants;
CREATE TRIGGER trigger_auto_fill_variant_seo
  BEFORE INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_variant_seo();

-- =============================================================================
-- 6. UPDATE EXISTING DATA
-- =============================================================================

-- Update existing products to have auto-filled SEO data
UPDATE public.products 
SET 
  slug = generate_slug(name),
  meta_title = name || ' | ' || brand || ' | Premium Quality',
  meta_description = 'Buy ' || name || ' from ' || brand || ' for ₹' || price || '. Premium quality, fast delivery, authentic products. Order now!',
  canonical_url = 'https://cigarro.in/product/' || generate_slug(name),
  og_title = name || ' | ' || brand || ' | Premium Quality',
  og_description = 'Buy ' || name || ' from ' || brand || ' for ₹' || price || '. Premium quality, fast delivery, authentic products. Order now!',
  twitter_title = name || ' | ' || brand || ' | Premium Quality',
  twitter_description = 'Buy ' || name || ' from ' || brand || ' for ₹' || price || '. Premium quality, fast delivery, authentic products. Order now!'
WHERE 
  meta_title IS NULL OR meta_title = '' OR
  meta_description IS NULL OR meta_description = '' OR
  slug IS NULL OR slug = '';

-- Update existing variants to have auto-filled data
UPDATE public.product_variants 
SET 
  variant_slug = generate_slug(variant_name)
WHERE 
  variant_slug IS NULL OR variant_slug = '';

-- =============================================================================
-- 7. ADD HELPFUL INDEXES
-- =============================================================================

-- Index for product slug lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- Index for variant slug lookups within products
CREATE INDEX IF NOT EXISTS idx_product_variants_slug ON public.product_variants(product_id, variant_slug);

-- Index for shared images
CREATE INDEX IF NOT EXISTS idx_variant_images_product_id ON public.variant_images(product_id) WHERE product_id IS NOT NULL;

-- =============================================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION generate_slug(TEXT) IS 'Auto-generates SEO-friendly slugs from input text';
COMMENT ON FUNCTION auto_fill_product_seo() IS 'Automatically fills SEO fields for products on insert/update';
COMMENT ON FUNCTION auto_fill_variant_seo() IS 'Automatically fills SEO fields for variants on insert/update';

COMMENT ON COLUMN public.variant_images.product_id IS 'Product ID for shared images (when variant_id is NULL)';
COMMENT ON CONSTRAINT check_variant_or_product_id ON public.variant_images IS 'Ensures image belongs to either a variant or product, but not both';
