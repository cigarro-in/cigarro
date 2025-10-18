-- ============================================================================
-- Migration 031: Create Brands Table
-- ============================================================================
-- Purpose: Create brands table for product brand management
-- Date: October 18, 2025
-- ============================================================================

-- ============================================================================
-- 1. CREATE BRANDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  heritage JSONB DEFAULT '{}'::jsonb,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brands IS 'Product brands with metadata and heritage information';
COMMENT ON COLUMN public.brands.id IS 'Unique brand identifier';
COMMENT ON COLUMN public.brands.name IS 'Brand display name';
COMMENT ON COLUMN public.brands.slug IS 'URL-friendly brand identifier';
COMMENT ON COLUMN public.brands.description IS 'Brand description';
COMMENT ON COLUMN public.brands.logo_url IS 'Brand logo image URL';
COMMENT ON COLUMN public.brands.website_url IS 'Brand official website';
COMMENT ON COLUMN public.brands.sort_order IS 'Display order (lower = first)';
COMMENT ON COLUMN public.brands.is_active IS 'Whether brand is active and visible';
COMMENT ON COLUMN public.brands.is_featured IS 'Whether brand is featured';
COMMENT ON COLUMN public.brands.heritage IS 'Brand heritage (founded_year, origin_country, founder, story)';
COMMENT ON COLUMN public.brands.meta_title IS 'SEO meta title';
COMMENT ON COLUMN public.brands.meta_description IS 'SEO meta description';

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_brands_name ON public.brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON public.brands(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brands_is_featured ON public.brands(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON public.brands(sort_order);
CREATE INDEX IF NOT EXISTS idx_brands_heritage ON public.brands USING gin(heritage);

-- ============================================================================
-- 3. CREATE TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_brands_updated_at();

-- Auto-generate slug from name if not provided
CREATE OR REPLACE FUNCTION public.generate_brand_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug = lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug = trim(both '-' from NEW.slug);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_brands_generate_slug
  BEFORE INSERT OR UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_brand_slug();

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active brands
CREATE POLICY "Public can view active brands"
  ON public.brands
  FOR SELECT
  USING (is_active = true);

-- Allow authenticated users to view all brands
CREATE POLICY "Authenticated users can view all brands"
  ON public.brands
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert brands
CREATE POLICY "Authenticated users can insert brands"
  ON public.brands
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update brands
CREATE POLICY "Authenticated users can update brands"
  ON public.brands
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete brands
CREATE POLICY "Authenticated users can delete brands"
  ON public.brands
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 5. INSERT SAMPLE BRANDS
-- ============================================================================

INSERT INTO public.brands (name, slug, description, sort_order, is_active, is_featured, heritage) VALUES
  ('Marlboro', 'marlboro', 'World''s best-selling cigarette brand', 1, true, true, '{"founded_year": "1924", "origin_country": "USA", "founder": "Philip Morris"}'),
  ('Camel', 'camel', 'Premium American cigarette brand', 2, true, true, '{"founded_year": "1913", "origin_country": "USA", "founder": "R.J. Reynolds"}'),
  ('Lucky Strike', 'lucky-strike', 'Classic American cigarette brand', 3, true, false, '{"founded_year": "1871", "origin_country": "USA"}'),
  ('Parliament', 'parliament', 'Luxury cigarette brand with recessed filter', 4, true, false, '{"founded_year": "1931", "origin_country": "USA"}'),
  ('Dunhill', 'dunhill', 'British luxury cigarette brand', 5, true, false, '{"founded_year": "1907", "origin_country": "UK", "founder": "Alfred Dunhill"}')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.brands TO anon;
GRANT ALL ON public.brands TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 031 completed successfully';
  RAISE NOTICE '📊 Created brands table with all columns including heritage';
  RAISE NOTICE '🔍 Created indexes for performance';
  RAISE NOTICE '🔒 Enabled RLS with proper policies';
  RAISE NOTICE '📝 Inserted 5 sample brands';
END $$;
