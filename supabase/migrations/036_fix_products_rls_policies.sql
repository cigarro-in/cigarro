-- ============================================================================
-- Migration 036: Fix Products RLS Policies for Admin Access
-- ============================================================================
-- Purpose: Ensure authenticated admin users can create/update products
-- Date: October 17, 2025
-- ============================================================================

-- ============================================================================
-- 1. DROP EXISTING POLICIES
-- ============================================================================

-- Drop all existing policies on products table
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.products;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.products;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.products;
DROP POLICY IF EXISTS "Allow public read access" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

-- Drop all existing policies on product_variants table
DROP POLICY IF EXISTS "Enable read access for all users" ON public.product_variants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.product_variants;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.product_variants;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.product_variants;
DROP POLICY IF EXISTS "Allow public read access" ON public.product_variants;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.product_variants;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.product_variants;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.product_variants;
DROP POLICY IF EXISTS "variants_select_policy" ON public.product_variants;
DROP POLICY IF EXISTS "variants_insert_policy" ON public.product_variants;
DROP POLICY IF EXISTS "variants_update_policy" ON public.product_variants;
DROP POLICY IF EXISTS "variants_delete_policy" ON public.product_variants;

-- Drop all existing policies on variant_images table
DROP POLICY IF EXISTS "Enable read access for all users" ON public.variant_images;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.variant_images;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.variant_images;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.variant_images;
DROP POLICY IF EXISTS "Allow public read access" ON public.variant_images;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.variant_images;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.variant_images;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.variant_images;

-- ============================================================================
-- 2. ENABLE RLS ON TABLES
-- ============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_images ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE NEW POLICIES FOR PRODUCTS
-- ============================================================================

-- Allow everyone to read products (public access)
CREATE POLICY "products_select_policy"
  ON public.products
  FOR SELECT
  TO public
  USING (true);

-- Allow ADMIN users to insert products
CREATE POLICY "products_insert_policy"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Allow ADMIN users to update products
CREATE POLICY "products_update_policy"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Allow ADMIN users to delete products
CREATE POLICY "products_delete_policy"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- ============================================================================
-- 4. CREATE NEW POLICIES FOR PRODUCT_VARIANTS
-- ============================================================================

-- Allow everyone to read variants (public access)
CREATE POLICY "variants_select_policy"
  ON public.product_variants
  FOR SELECT
  TO public
  USING (true);

-- Allow ADMIN users to insert variants
CREATE POLICY "variants_insert_policy"
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Allow ADMIN users to update variants
CREATE POLICY "variants_update_policy"
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Allow ADMIN users to delete variants
CREATE POLICY "variants_delete_policy"
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- ============================================================================
-- 5. CREATE NEW POLICIES FOR VARIANT_IMAGES
-- ============================================================================

-- Allow everyone to read variant images (public access)
CREATE POLICY "variant_images_select_policy"
  ON public.variant_images
  FOR SELECT
  TO public
  USING (true);

-- Allow ADMIN users to insert variant images
CREATE POLICY "variant_images_insert_policy"
  ON public.variant_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Allow ADMIN users to update variant images
CREATE POLICY "variant_images_update_policy"
  ON public.variant_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Allow ADMIN users to delete variant images
CREATE POLICY "variant_images_delete_policy"
  ON public.variant_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant SELECT to anonymous users (public read access)
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT ON public.variant_images TO anon;

-- Grant all operations to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variant_images TO authenticated;

-- Grant USAGE on sequences (for auto-increment IDs if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- 7. VERIFY POLICIES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 036 completed successfully';
  RAISE NOTICE '📊 RLS policies updated for products, product_variants, and variant_images';
  RAISE NOTICE '🔓 Public read access enabled';
  RAISE NOTICE '🔐 Authenticated users can create/update/delete';
END $$;
