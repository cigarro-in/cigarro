-- Migration: Repair product_variants table schema
-- Description: Ensures product_variants table has correct defaults, foreign keys, and columns.

-- 1. Ensure ID has a default generator (essential for inserts without explicit ID)
ALTER TABLE public.product_variants 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Ensure product_id is not null and references products
ALTER TABLE public.product_variants 
ALTER COLUMN product_id SET NOT NULL;

DO $$ 
BEGIN
    -- Check if constraint exists, if not add it (though usually it exists)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_product_id_fkey') THEN
        ALTER TABLE public.product_variants 
        ADD CONSTRAINT product_variants_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Ensure critical columns exist and have defaults
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS variant_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS variant_type text DEFAULT 'packaging',
ADD COLUMN IF NOT EXISTS packaging text DEFAULT 'pack',
ADD COLUMN IF NOT EXISTS units_contained integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- 4. Grant permissions (just in case)
GRANT ALL ON public.product_variants TO postgres;
GRANT ALL ON public.product_variants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT ON public.product_variants TO anon;
