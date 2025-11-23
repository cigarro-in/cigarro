-- Migration: Product Management Overhaul (Shopify-Style)
-- Description: Introduces Collections, Tobacco-specific variant fields, and cleans up legacy feature flags.

-- 1. Create COLLECTIONS Table (The new way to group products)
CREATE TABLE IF NOT EXISTS public.collections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    image_url text,
    type text CHECK (type IN ('manual', 'smart')) DEFAULT 'manual',
    rules jsonb DEFAULT '[]'::jsonb, -- For smart collections (e.g. brand='Marlboro')
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    seo_title text,
    seo_description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create COLLECTION_PRODUCTS Junction Table
CREATE TABLE IF NOT EXISTS public.collection_products (
    collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (collection_id, product_id)
);

-- 3. Enhance PRODUCT_VARIANTS with Tobacco Logic
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS packaging text DEFAULT 'pack', -- 'pack', 'carton', 'box', 'bundle'
ADD COLUMN IF NOT EXISTS units_contained integer DEFAULT 1; -- 20 for pack, 200 for carton

-- 4. Enhance BRANDS with Origin & Tier
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS country_of_origin text,
ADD COLUMN IF NOT EXISTS tier text DEFAULT 'standard'; -- 'budget', 'standard', 'premium', 'luxury'

-- 5. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_collections_slug ON public.collections(slug);
CREATE INDEX IF NOT EXISTS idx_collection_products_collection ON public.collection_products(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_products_product ON public.collection_products(product_id);

-- 6. Enable RLS on New Tables
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies (Public Read, Admin Write)
DROP POLICY IF EXISTS "Public can view active collections" ON public.collections;
CREATE POLICY "Public can view active collections" ON public.collections
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage collections" ON public.collections;
CREATE POLICY "Admins can manage collections" ON public.collections
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true)
    );

DROP POLICY IF EXISTS "Public can view collection products" ON public.collection_products;
CREATE POLICY "Public can view collection products" ON public.collection_products
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage collection products" ON public.collection_products;
CREATE POLICY "Admins can manage collection products" ON public.collection_products
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true)
    );

-- 8. Trigger for Updated At
DROP TRIGGER IF EXISTS update_collections_updated_at ON public.collections;
CREATE TRIGGER update_collections_updated_at
    BEFORE UPDATE ON public.collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. MIGRATION LOGIC: Move existing Featured Products to a Collection
DO $$
DECLARE
    featured_collection_id uuid;
BEGIN
    -- Only run if featured_products table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'featured_products') THEN
        -- Create 'Featured' collection
        INSERT INTO public.collections (title, slug, description, type, is_active)
        VALUES ('Featured Products', 'featured', 'Our top picks', 'manual', true)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id INTO featured_collection_id;

        -- If we created it (or found it), migrate data
        IF featured_collection_id IS NULL THEN
            SELECT id INTO featured_collection_id FROM public.collections WHERE slug = 'featured';
        END IF;

        -- Insert existing featured products
        INSERT INTO public.collection_products (collection_id, product_id, sort_order)
        SELECT featured_collection_id, product_id, display_order
        FROM public.featured_products
        WHERE is_active = true
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
