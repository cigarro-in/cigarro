-- Fix Schema Issues
-- This migration fixes missing columns and schema inconsistencies

-- 1. Fix orders table - add missing total_decimal column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS total_decimal DECIMAL(10,2);

-- Update existing orders to have total_decimal = total
UPDATE public.orders 
SET total_decimal = total::DECIMAL(10,2) 
WHERE total_decimal IS NULL;

-- 2. Fix products table - add missing columns
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Update existing products to set is_featured based on some criteria
-- For now, set all active products as not featured by default
UPDATE public.products 
SET is_featured = FALSE 
WHERE is_featured IS NULL;

-- 3. Fix homepage_section_content table - ensure proper structure
-- The table should already exist from previous migration, but let's ensure it's correct
CREATE TABLE IF NOT EXISTS public.homepage_section_content (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    button_text TEXT,
    button_url TEXT,
    content_type TEXT DEFAULT 'text',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_homepage_section_content_section_id ON public.homepage_section_content(section_id);
CREATE INDEX IF NOT EXISTS idx_homepage_section_content_is_active ON public.homepage_section_content(is_active);
CREATE INDEX IF NOT EXISTS idx_homepage_section_content_sort_order ON public.homepage_section_content(sort_order);

-- 5. Ensure RLS policies are in place
DO $$
BEGIN
    -- Orders table policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Users can view their own orders'
    ) THEN
        CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Admins can view all orders'
    ) THEN
        CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT USING (public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Users can create their own orders'
    ) THEN
        CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' 
        AND policyname = 'Admins can manage all orders'
    ) THEN
        CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.is_admin());
    END IF;

    -- Products table policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' 
        AND policyname = 'Anyone can view active products'
    ) THEN
        CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' 
        AND policyname = 'Admins can manage products'
    ) THEN
        CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.is_admin());
    END IF;

    -- Homepage section content policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'homepage_section_content' 
        AND policyname = 'Anyone can view homepage section content'
    ) THEN
        CREATE POLICY "Anyone can view homepage section content" ON public.homepage_section_content FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'homepage_section_content' 
        AND policyname = 'Admins can manage homepage section content'
    ) THEN
        CREATE POLICY "Admins can manage homepage section content" ON public.homepage_section_content FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- 6. Refresh the schema cache
NOTIFY pgrst, 'reload schema';

