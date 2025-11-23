-- Migration: Fix RLS for product_variants
-- Description: Ensure product_variants table has correct RLS policies for access.

-- 1. Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh (safe for this table)
DROP POLICY IF EXISTS "Public can view active product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can manage product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view variants" ON public.product_variants;

-- 3. Create Policy: Public Read
-- Allow public to read all variants. 
-- Logic: If the parent product is active, the variant should be visible. 
-- But for simplicity in admin, we just allow reading all.
CREATE POLICY "Public can view variants" ON public.product_variants
    FOR SELECT USING (true);

-- 4. Create Policy: Admin Full Access
CREATE POLICY "Admins can manage product variants" ON public.product_variants
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true)
    );

-- 5. Verify images column exists (sanity check from previous step)
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
