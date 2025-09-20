-- Supabase Schema: Final Consolidated Implementation
-- Version: 0012
-- Features:
-- - UUIDs for all Primary Keys.
-- - Granular RLS policies for each action.
-- - Centralized is_admin() SECURITY DEFINER function.
-- - Scalable homepage content management system.
-- - Detailed product attributes including slugs and SEO fields.
-- - Seed data for initial setup.

-- 1. SETUP
------------------------------------------------------------
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Drop existing objects in order of dependency
DROP TABLE IF EXISTS public.homepage_section_categories CASCADE;
DROP TABLE IF EXISTS public.homepage_sections CASCADE;
DROP TABLE IF EXISTS public.product_categories CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE; -- Keep existing profiles
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.order_status CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.slugify(TEXT) CASCADE;

-- Create custom types
CREATE TYPE public.user_role AS ENUM ('user', 'admin');
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');


-- 2. TABLE DEFINITIONS
------------------------------------------------------------
-- Profiles table (assuming it exists, altering instead of creating)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Site Settings table (single row)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id INT PRIMARY KEY DEFAULT 1,
    site_name TEXT,
    favicon_url TEXT,
    meta_title TEXT,
    meta_description TEXT,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Homepage Sections table
CREATE TABLE public.homepage_sections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);



-- Categories table
CREATE TABLE public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image TEXT,
    image_alt_text TEXT,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Homepage Section Categories (Join Table)
CREATE TABLE public.homepage_section_categories (
    section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (section_id, category_id)
);

-- Products table with detailed fields
CREATE TABLE public.products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    image TEXT,
    image_alt_text TEXT,
    description TEXT,
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    rating DECIMAL(2,1) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
    origin TEXT,
    strength TEXT,
    pack_size TEXT,
    specifications JSONB,
    ingredients TEXT[],
    gallery_images TEXT[],
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Categories (Join Table)
CREATE TABLE public.product_categories (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

-- Cart Items table
CREATE TABLE public.cart_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Orders table
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status public.order_status DEFAULT 'pending',
    subtotal INTEGER NOT NULL,
    tax INTEGER NOT NULL,
    shipping INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    payment_method TEXT,
    tracking_number TEXT,
    estimated_delivery TIMESTAMPTZ,
    shipping_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    shipping_zip_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items table
CREATE TABLE public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
    product_name TEXT NOT NULL,
    product_brand TEXT NOT NULL,
    product_price INTEGER NOT NULL,
    product_image TEXT,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3. HELPER FUNCTIONS & TRIGGERS
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.slugify(v TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(BOTH '-' FROM regexp_replace(lower(unaccent(trim(v))), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('is_admin', NEW.is_admin) WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign triggers
-- NOTE: Dropping and recreating triggers and policies for the profiles table to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update AFTER INSERT OR UPDATE OF is_admin ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_to_auth_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();


-- 4. ROW LEVEL SECURITY (RLS)
------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_section_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public can view profiles." ON public.profiles;
CREATE POLICY "Public can view profiles." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles." ON public.profiles;
CREATE POLICY "Admins can manage all profiles." ON public.profiles FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can view categories." ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories." ON public.categories FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can view active products." ON public.products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage products." ON public.products FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can view links." ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage links." ON public.product_categories FOR ALL USING (public.is_admin());

CREATE POLICY "Users can manage their own cart." ON public.cart_items FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own orders." ON public.orders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all orders." ON public.orders FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view their own order items." ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can manage all order items." ON public.order_items FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can view homepage sections." ON public.homepage_sections FOR SELECT USING (true);
CREATE POLICY "Admins can manage homepage sections." ON public.homepage_sections FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can view section-category links." ON public.homepage_section_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage section-category links." ON public.homepage_section_categories FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view site settings." ON public.site_settings;
CREATE POLICY "Public can view site settings." ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage site settings." ON public.site_settings;
CREATE POLICY "Admins can manage site settings." ON public.site_settings FOR ALL USING (public.is_admin());


-- 5. STORAGE
------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('asset_images', 'asset_images', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for images" ON storage.objects;
CREATE POLICY "Public read access for images" ON storage.objects FOR SELECT USING (bucket_id = 'asset_images');

DROP POLICY IF EXISTS "Admin can manage images" ON storage.objects;
CREATE POLICY "Admin can manage images" ON storage.objects FOR ALL USING (bucket_id = 'asset_images' AND public.is_admin());


-- 6. SEED DATA
------------------------------------------------------------
-- Seed Site Settings
INSERT INTO public.site_settings (id, site_name, meta_title, meta_description)
VALUES (1, 'Premium Cigarettes', 'Premium Cigarette Marketplace', 'The finest selection of premium cigarettes, cigars, and vapes.')
ON CONFLICT (id) DO NOTHING;

-- Seed Homepage Sections
INSERT INTO public.homepage_sections (title, slug) VALUES
('Featured Collection', 'featured-collection'),
('New Arrivals', 'new-arrivals')
ON CONFLICT (slug) DO NOTHING;

-- Seed Categories
INSERT INTO public.categories (name, slug, description) VALUES
('Premium Cigarettes', 'premium-cigarettes', 'A selection of the finest tobacco cigarettes.'),
('Luxury Cigars', 'luxury-cigars', 'Exquisite hand-rolled cigars for the discerning connoisseur.'),
('Modern Vapes', 'modern-vapes', 'Cutting-edge vaping devices and premium e-liquids.')
ON CONFLICT (name) DO NOTHING;

-- Seed Products & Links
DO $$
DECLARE
    cigarettes_cat_id UUID;
    cigars_cat_id UUID;
    vapes_cat_id UUID;
    featured_section_id UUID;
BEGIN
    SELECT id INTO cigarettes_cat_id FROM public.categories WHERE name = 'Premium Cigarettes';
    SELECT id INTO cigars_cat_id FROM public.categories WHERE name = 'Luxury Cigars';
    SELECT id INTO vapes_cat_id FROM public.categories WHERE name = 'Modern Vapes';
    SELECT id INTO featured_section_id FROM public.homepage_sections WHERE slug = 'featured-collection';

    -- Link "Luxury Cigars" to the "Featured Collection" section
    INSERT INTO public.homepage_section_categories (section_id, category_id)
    VALUES (featured_section_id, cigars_cat_id)
    ON CONFLICT DO NOTHING;

    -- Seed Products
    WITH new_products AS (
        INSERT INTO public.products (
          name, slug, brand, price, description, stock, is_active,
          rating, review_count, origin, strength, pack_size, specifications, ingredients, gallery_images,
          meta_title, meta_description
        ) VALUES
        (
          'Vintage Series', 'vintage-series', 'Craftsman''s Choice', 18900, 
          'Our Vintage Series embodies the art of traditional tobacco blending with modern refinement.',
          50, TRUE,
          4.8, 127, 'North Carolina, USA', 'Full', '20 cigarettes',
          '{"Length": "84mm"}',
          '{"Aged Virginia tobacco", "Burley blend"}',
          '{"https://example.com/gallery1.jpg", "https://example.com/gallery2.jpg"}',
          'Vintage Series Cigarettes | Craftsman''s Choice', 'Experience the rich, full-bodied flavor of our Vintage Series cigarettes.'
        ),
        (
          'Marlboro Gold', 'marlboro-gold', 'Marlboro', 34000, 
          'The iconic taste of Marlboro in a smoother blend.', 
          150, TRUE,
          4.5, 250, 'USA', 'Medium', '20 cigarettes',
          '{"Length": "84mm"}',
          '{"Premium tobacco"}',
          '{}',
          'Marlboro Gold Cigarettes', 'Buy Marlboro Gold cigarettes online for a smooth, premium tobacco experience.'
        )
        RETURNING id, name
    )
    -- Seed Product-Category Links
    INSERT INTO public.product_categories (product_id, category_id)
    SELECT
        p.id,
        CASE
            WHEN p.name = 'Vintage Series' THEN cigarettes_cat_id
            WHEN p.name = 'Marlboro Gold' THEN cigarettes_cat_id
        END
    FROM new_products p
    ON CONFLICT (product_id, category_id) DO NOTHING;
END $$;

-- End of script
