-- Consolidated Schema Migration for Premium Cigarette Marketplace
-- Version: Consolidated (All migrations merged)
-- 
-- This migration consolidates all previous migrations into a single comprehensive schema
-- Features included:
-- - User profiles and authentication
-- - Product catalog with variants and combos
-- - Shopping cart and order management
-- - Categories and homepage sections
-- - Payment verification and order tracking
-- - Discounts and promotions
-- - User wishlists
-- - Pincode-based shipping
-- - Enhanced search capabilities
-- - Row Level Security (RLS)
-- - Storage policies

-- =============================================================================
-- 1. EXTENSIONS AND SETUP
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Drop existing objects in dependency order
DROP MATERIALIZED VIEW IF EXISTS searchable_products CASCADE;
DROP VIEW IF EXISTS pincode_lookup CASCADE;
DROP VIEW IF EXISTS order_tracking_view CASCADE;
DROP TABLE IF EXISTS user_wishlists CASCADE;
DROP TABLE IF EXISTS pincodes CASCADE;
DROP TABLE IF EXISTS shipping_companies CASCADE;
DROP TABLE IF EXISTS variant_images CASCADE;
DROP TABLE IF EXISTS combo_items CASCADE;
DROP TABLE IF EXISTS product_combos CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS discounts CASCADE;
DROP TABLE IF EXISTS homepage_section_categories CASCADE;
DROP TABLE IF EXISTS homepage_sections CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;

-- Drop types and functions
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.slugify(TEXT) CASCADE;

-- =============================================================================
-- 2. CUSTOM TYPES
-- =============================================================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE order_status AS ENUM ('pending', 'placed', 'processing', 'shipped', 'delivered', 'cancelled');

-- =============================================================================
-- 3. CORE TABLES
-- =============================================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site Settings table (single row for global settings)
CREATE TABLE public.site_settings (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Homepage Section Categories (Join Table)
CREATE TABLE public.homepage_section_categories (
    section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (section_id, category_id)
);

-- Products table with detailed fields (using DECIMAL for prices)
CREATE TABLE public.products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
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
    gallery_images TEXT[], -- Removed redundant 'image' column, using gallery_images
    image_alt_text TEXT,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Categories (Join Table) with ordering
CREATE TABLE public.product_categories (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    "order" INT DEFAULT 0,
    PRIMARY KEY (product_id, category_id)
);

-- =============================================================================
-- 4. PRODUCT VARIANTS AND COMBOS
-- =============================================================================

-- Product Variants table
CREATE TABLE public.product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL, -- "Packet", "Carton", "Half Carton"
    variant_type VARCHAR(50) NOT NULL DEFAULT 'packaging', -- "packaging", "color", "size"
    sku VARCHAR(100) UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    weight DECIMAL(8,2), -- for shipping calculations
    dimensions JSONB, -- {length, width, height}
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Variant Images table
CREATE TABLE public.variant_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Combos table
CREATE TABLE public.product_combos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    combo_price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2), -- sum of individual items
    discount_percentage DECIMAL(5,2),
    combo_image TEXT,
    gallery_images TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Combo Items table
CREATE TABLE public.combo_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    combo_id UUID NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 5. DISCOUNTS SYSTEM
-- =============================================================================

-- Discounts table
CREATE TABLE public.discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE, -- Optional coupon code
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'cart_value')),
    value DECIMAL(10,2) NOT NULL, -- discount amount or percentage
    min_cart_value DECIMAL(10,2), -- minimum cart value for discount
    max_discount_amount DECIMAL(10,2), -- cap on discount amount
    applicable_to VARCHAR(20) DEFAULT 'all' CHECK (applicable_to IN ('all', 'products', 'combos', 'variants')),
    product_ids UUID[], -- specific products if applicable_to = 'products'
    combo_ids UUID[], -- specific combos if applicable_to = 'combos'
    variant_ids UUID[], -- specific variants if applicable_to = 'variants'
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    usage_limit INTEGER, -- max number of uses
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 6. CART AND ORDERS
-- =============================================================================

-- Cart Items table with variant and combo support
CREATE TABLE public.cart_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    variant_id UUID REFERENCES public.product_variants(id),
    combo_id UUID REFERENCES public.product_combos(id),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id, variant_id, combo_id)
);

-- Orders table with comprehensive payment and shipping tracking
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    display_order_id TEXT, -- For custom order numbering
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status order_status DEFAULT 'pending',
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    shipping DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Payment information
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    upi_id TEXT,
    payment_confirmed BOOLEAN DEFAULT FALSE,
    payment_confirmed_at TIMESTAMP WITH TIME ZONE,
    payment_verified TEXT DEFAULT 'NO' CHECK (payment_verified IN ('YES', 'NO', 'REJECTED')),
    payment_verified_at TIMESTAMP WITH TIME ZONE,
    payment_verified_by UUID REFERENCES auth.users(id),
    payment_rejection_reason TEXT,
    transaction_id TEXT,
    payment_proof_url TEXT,
    payment_link_email TEXT,
    payment_link_phone TEXT,
    
    -- Discount tracking
    discount_id UUID REFERENCES public.discounts(id),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    discount_code VARCHAR(50),
    
    -- Shipping information
    shipping_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    shipping_zip_code TEXT NOT NULL,
    shipping_country TEXT DEFAULT 'India',
    shipping_phone TEXT,
    
    -- Shipping tracking
    shipping_company TEXT,
    tracking_id TEXT,
    tracking_link TEXT,
    tracking_number TEXT, -- Legacy field
    shipping_method TEXT DEFAULT 'Standard',
    shipping_notes TEXT,
    estimated_delivery TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    shipped_by UUID REFERENCES auth.users(id),
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivered_by UUID REFERENCES auth.users(id),
    delivery_notes TEXT,
    delivery_proof_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items table with variant and combo support
CREATE TABLE public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
    product_name TEXT NOT NULL,
    product_brand TEXT NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,
    product_image TEXT,
    quantity INTEGER NOT NULL,
    
    -- Variant support
    variant_id UUID REFERENCES public.product_variants(id),
    variant_name VARCHAR(100),
    
    -- Combo support
    combo_id UUID REFERENCES public.product_combos(id),
    combo_name VARCHAR(200),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 7. USER WISHLISTS
-- =============================================================================

-- User Wishlists table
CREATE TABLE public.user_wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- =============================================================================
-- 8. SHIPPING AND PINCODES
-- =============================================================================

-- Shipping Companies table
CREATE TABLE public.shipping_companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    website TEXT,
    tracking_url_template TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pincodes table for location-based shipping
CREATE TABLE public.pincodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pincode VARCHAR(6) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    region VARCHAR(100),
    is_servicable BOOLEAN NOT NULL DEFAULT true,
    shipping_method VARCHAR(50) NOT NULL DEFAULT 'standard',
    delivery_time_days INTEGER DEFAULT 5,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 9. HELPER FUNCTIONS
-- =============================================================================

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Slugify function
CREATE OR REPLACE FUNCTION public.slugify(v TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(BOTH '-' FROM regexp_replace(lower(unaccent(trim(v))), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- New user handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, is_admin)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'isAdmin')::boolean, false)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sync profile to auth user
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users 
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('is_admin', NEW.is_admin) 
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Combo pricing calculation
CREATE OR REPLACE FUNCTION calculate_combo_original_price(combo_uuid UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_price DECIMAL(10,2) := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN ci.variant_id IS NOT NULL THEN pv.price * ci.quantity
      ELSE p.price * ci.quantity
    END
  ), 0)
  INTO total_price
  FROM combo_items ci
  LEFT JOIN product_variants pv ON ci.variant_id = pv.id
  LEFT JOIN products p ON ci.product_id = p.id
  WHERE ci.combo_id = combo_uuid;
  
  RETURN total_price;
END;
$$ LANGUAGE plpgsql;

-- Update combo pricing
CREATE OR REPLACE FUNCTION update_combo_pricing()
RETURNS TRIGGER AS $$
DECLARE
  original_price DECIMAL(10,2);
  discount_pct DECIMAL(5,2);
  combo_record RECORD;
BEGIN
  -- Get combo record to check if we need to update
  SELECT * INTO combo_record FROM product_combos 
  WHERE id = COALESCE(NEW.combo_id, OLD.combo_id);
  
  IF combo_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate original price
  original_price := calculate_combo_original_price(combo_record.id);
  
  -- Calculate discount percentage
  IF original_price > 0 THEN
    discount_pct := ((original_price - combo_record.combo_price) / original_price) * 100;
  ELSE
    discount_pct := 0;
  END IF;
  
  -- Update combo with calculated values
  UPDATE product_combos 
  SET 
    original_price = original_price,
    discount_percentage = discount_pct,
    updated_at = NOW()
  WHERE id = combo_record.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Order status update function
CREATE OR REPLACE FUNCTION public.update_order_status(
  order_id UUID,
  new_status public.order_status,
  admin_user_id UUID DEFAULT NULL,
  additional_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status public.order_status;
BEGIN
  -- Get current status
  SELECT status INTO current_status FROM public.orders WHERE id = order_id;
  
  -- Validate status transition
  IF NOT (
    (current_status = 'placed' AND new_status IN ('processing', 'cancelled')) OR
    (current_status = 'processing' AND new_status IN ('shipped', 'cancelled')) OR
    (current_status = 'shipped' AND new_status IN ('delivered', 'cancelled')) OR
    (current_status = 'delivered' AND new_status = 'delivered') OR
    (current_status = 'cancelled' AND new_status = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', current_status, new_status;
  END IF;
  
  -- Update order with appropriate timestamps
  UPDATE public.orders 
  SET 
    status = new_status,
    updated_at = NOW(),
    shipped_at = CASE WHEN new_status = 'shipped' THEN NOW() ELSE shipped_at END,
    shipped_by = CASE WHEN new_status = 'shipped' THEN admin_user_id ELSE shipped_by END,
    delivered_at = CASE WHEN new_status = 'delivered' THEN NOW() ELSE delivered_at END,
    delivered_by = CASE WHEN new_status = 'delivered' THEN admin_user_id ELSE delivered_by END
  WHERE id = order_id;
  
  -- Update additional data if provided
  IF additional_data IS NOT NULL THEN
    UPDATE public.orders 
    SET 
      shipping_company = COALESCE(additional_data->>'shipping_company', shipping_company),
      tracking_id = COALESCE(additional_data->>'tracking_id', tracking_id),
      tracking_link = COALESCE(additional_data->>'tracking_link', tracking_link),
      shipping_method = COALESCE(additional_data->>'shipping_method', shipping_method),
      shipping_notes = COALESCE(additional_data->>'shipping_notes', shipping_notes),
      delivery_notes = COALESCE(additional_data->>'delivery_notes', delivery_notes),
      delivery_proof_url = COALESCE(additional_data->>'delivery_proof_url', delivery_proof_url)
    WHERE id = order_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatic order status updates based on payment verification
CREATE OR REPLACE FUNCTION public.auto_update_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When payment is verified, automatically move to processing
  IF NEW.payment_verified = 'YES' AND OLD.payment_verified = 'NO' THEN
    NEW.status = 'processing';
    NEW.payment_verified_at = NOW();
  END IF;
  
  -- When payment is rejected, keep status as placed
  IF NEW.payment_verified = 'REJECTED' AND OLD.payment_verified = 'NO' THEN
    NEW.status = 'placed';
    NEW.payment_verified_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. TRIGGERS
-- =============================================================================

-- User creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Profile sync trigger
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update 
  AFTER INSERT OR UPDATE OF is_admin ON public.profiles 
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_to_auth_user();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON public.categories 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON public.products 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at 
  BEFORE UPDATE ON public.cart_items 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON public.orders 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_user_wishlists_updated_at 
  BEFORE UPDATE ON public.user_wishlists 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_pincodes_updated_at 
  BEFORE UPDATE ON public.pincodes 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at 
  BEFORE UPDATE ON public.product_variants 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_product_combos_updated_at 
  BEFORE UPDATE ON public.product_combos 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_discounts_updated_at 
  BEFORE UPDATE ON public.discounts 
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Combo pricing trigger
CREATE TRIGGER trigger_update_combo_pricing
  AFTER INSERT OR UPDATE OR DELETE ON combo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_combo_pricing();

-- Order status auto-update trigger
CREATE TRIGGER trigger_auto_update_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

-- =============================================================================
-- 11. INDEXES FOR PERFORMANCE
-- =============================================================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- Product categories indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON public.product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id ON public.product_categories(category_id);

-- Cart items indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_verified ON public.orders(payment_verified);
CREATE INDEX IF NOT EXISTS idx_orders_user_payment_status ON public.orders(user_id, payment_verified);
CREATE INDEX IF NOT EXISTS idx_orders_payment_confirmed ON public.orders(payment_confirmed);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON public.orders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_company ON public.orders(shipping_company);
CREATE INDEX IF NOT EXISTS idx_orders_status_shipped ON public.orders(status, shipped_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_delivered ON public.orders(status, delivered_at);
CREATE INDEX IF NOT EXISTS idx_orders_shipped_by ON public.orders(shipped_by);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_by ON public.orders(delivered_by);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Wishlists indexes
CREATE INDEX IF NOT EXISTS idx_user_wishlists_user_id ON public.user_wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_product_id ON public.user_wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_created_at ON public.user_wishlists(created_at DESC);

-- Pincodes indexes
CREATE INDEX IF NOT EXISTS idx_pincodes_pincode ON public.pincodes(pincode);
CREATE INDEX IF NOT EXISTS idx_pincodes_city ON public.pincodes(city);
CREATE INDEX IF NOT EXISTS idx_pincodes_state ON public.pincodes(state);
CREATE INDEX IF NOT EXISTS idx_pincodes_servicable ON public.pincodes(is_servicable);
CREATE INDEX IF NOT EXISTS idx_pincodes_shipping_method ON public.pincodes(shipping_method);

-- Variants indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON public.product_variants(is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_type ON public.product_variants(variant_type);
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON public.variant_images(variant_id);

-- Combos indexes
CREATE INDEX IF NOT EXISTS idx_product_combos_active ON public.product_combos(is_active);
CREATE INDEX IF NOT EXISTS idx_product_combos_slug ON public.product_combos(slug);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON public.combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_product_id ON public.combo_items(product_id);

-- Discounts indexes
CREATE INDEX IF NOT EXISTS idx_discounts_code ON public.discounts(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discounts_active ON public.discounts(is_active);
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON public.discounts(start_date, end_date);

-- =============================================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_section_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Site settings policies
CREATE POLICY "Public can view site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage site settings" ON public.site_settings FOR ALL USING (public.is_admin());

-- Categories policies
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.is_admin());

-- Products policies
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.is_admin());

-- Product categories policies
CREATE POLICY "Anyone can view product categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage product categories" ON public.product_categories FOR ALL USING (public.is_admin());

-- Cart items policies
CREATE POLICY "Users can manage their own cart" ON public.cart_items FOR ALL USING (auth.uid() = user_id);

-- Orders policies
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE USING (public.is_admin());

-- Order items policies
CREATE POLICY "Users can view their order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Users can create order items" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT USING (public.is_admin());

-- Homepage sections policies
CREATE POLICY "Anyone can view homepage sections" ON public.homepage_sections FOR SELECT USING (true);
CREATE POLICY "Admins can manage homepage sections" ON public.homepage_sections FOR ALL USING (public.is_admin());

-- Homepage section categories policies
CREATE POLICY "Anyone can view section-category links" ON public.homepage_section_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage section-category links" ON public.homepage_section_categories FOR ALL USING (public.is_admin());

-- User wishlists policies
CREATE POLICY "Users can view own wishlist items" ON public.user_wishlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wishlist items" ON public.user_wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own wishlist items" ON public.user_wishlists FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all wishlist items" ON public.user_wishlists FOR SELECT USING (public.is_admin());

-- Pincodes policies
CREATE POLICY "Allow public read access to pincodes" ON public.pincodes FOR SELECT USING (true);
CREATE POLICY "Admins can manage pincodes" ON public.pincodes FOR ALL USING (public.is_admin());

-- Shipping companies policies
CREATE POLICY "Authenticated users can view shipping companies" ON public.shipping_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage shipping companies" ON public.shipping_companies FOR ALL TO authenticated USING (public.is_admin());

-- Product variants policies
CREATE POLICY "Public read variants" ON public.product_variants FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage variants" ON public.product_variants FOR ALL USING (public.is_admin());

-- Variant images policies
CREATE POLICY "Public read variant images" ON public.variant_images FOR SELECT USING (true);
CREATE POLICY "Admins can manage variant images" ON public.variant_images FOR ALL USING (public.is_admin());

-- Product combos policies
CREATE POLICY "Public read combos" ON public.product_combos FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage combos" ON public.product_combos FOR ALL USING (public.is_admin());

-- Combo items policies
CREATE POLICY "Public read combo items" ON public.combo_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage combo items" ON public.combo_items FOR ALL USING (public.is_admin());

-- Discounts policies
CREATE POLICY "Public read active discounts" ON public.discounts FOR SELECT USING (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));
CREATE POLICY "Admins can manage discounts" ON public.discounts FOR ALL USING (public.is_admin());

-- =============================================================================
-- 13. VIEWS AND MATERIALIZED VIEWS
-- =============================================================================

-- Order tracking view (restricted access via functions)
CREATE OR REPLACE VIEW public.order_tracking_view AS
SELECT 
  o.id,
  o.display_order_id,
  o.user_id,
  o.status,
  o.subtotal,
  o.tax,
  o.shipping,
  o.total,
  o.payment_method,
  o.payment_confirmed,
  o.payment_confirmed_at,
  o.payment_verified,
  o.transaction_id,
  o.shipping_company,
  o.tracking_id,
  o.tracking_link,
  o.shipping_method,
  o.shipping_notes,
  o.estimated_delivery,
  o.created_at,
  o.updated_at,
  o.shipping_name,
  o.shipping_address,
  o.shipping_city,
  o.shipping_state,
  o.shipping_zip_code,
  o.shipping_country,
  o.shipping_phone,
  -- Customer info
  p.name as customer_name,
  p.email as customer_email,
  -- Admin info
  shipped_admin.name as shipped_by_name,
  delivered_admin.name as delivered_by_name,
  verified_admin.name as verified_by_name
FROM public.orders o
LEFT JOIN public.profiles p ON o.user_id = p.id
LEFT JOIN public.profiles shipped_admin ON o.shipped_by = shipped_admin.id
LEFT JOIN public.profiles delivered_admin ON o.delivered_by = delivered_admin.id
LEFT JOIN public.profiles verified_admin ON o.payment_verified_by = verified_admin.id;

-- Searchable products materialized view (restricted access via functions)
CREATE MATERIALIZED VIEW public.searchable_products AS
-- Base products
SELECT 
  p.id,
  p.name,
  p.slug,
  p.brand,
  p.description,
  p.price as base_price,
  p.gallery_images,
  p.rating,
  p.review_count,
  p.is_active,
  p.created_at,
  'product' as item_type,
  NULL::UUID as variant_id,
  NULL::VARCHAR as variant_name,
  NULL::DECIMAL as variant_price,
  NULL::UUID as combo_id,
  NULL::VARCHAR as combo_name,
  NULL::DECIMAL as combo_price,
  CONCAT_WS(' ', p.name, p.brand, COALESCE(p.description, '')) as searchable_text
FROM products p
WHERE p.is_active = true

UNION ALL

-- Add variants to searchable content
SELECT 
  p.id,
  p.name,
  p.slug,
  p.brand,
  p.description,
  p.price as base_price,
  p.gallery_images,
  p.rating,
  p.review_count,
  p.is_active,
  p.created_at,
  'variant' as item_type,
  pv.id as variant_id,
  pv.variant_name,
  pv.price as variant_price,
  NULL::UUID as combo_id,
  NULL::VARCHAR as combo_name,
  NULL::DECIMAL as combo_price,
  CONCAT_WS(' ', p.name, p.brand, COALESCE(p.description, ''), pv.variant_name, 
    CASE 
      WHEN pv.variant_type = 'packaging' THEN 'packet carton half carton pack box'
      WHEN pv.variant_type = 'color' THEN 'red blue green black white'
      ELSE pv.variant_name 
    END) as searchable_text
FROM products p
JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true AND pv.is_active = true

UNION ALL

-- Add combos to searchable content
SELECT 
  pc.id,
  pc.name,
  pc.slug,
  'Combo' as brand,
  pc.description,
  pc.combo_price as base_price,
  pc.gallery_images,
  0 as rating,
  0 as review_count,
  pc.is_active,
  pc.created_at,
  'combo' as item_type,
  NULL::UUID as variant_id,
  NULL::VARCHAR as variant_name,
  NULL::DECIMAL as variant_price,
  pc.id as combo_id,
  pc.name as combo_name,
  pc.combo_price,
  CONCAT_WS(' ', pc.name, COALESCE(pc.description, ''), 'combo pack bundle special offer deal') as searchable_text
FROM product_combos pc
WHERE pc.is_active = true;

-- Pincode lookup view
CREATE OR REPLACE VIEW public.pincode_lookup AS
SELECT 
    pincode,
    city,
    state,
    country,
    region,
    is_servicable,
    shipping_method,
    delivery_time_days,
    shipping_cost,
    CASE 
        WHEN shipping_method = 'express' THEN 'Express Shipping (2-3 days)'
        WHEN shipping_method = 'overnight' THEN 'Overnight Delivery (Next day)'
        ELSE 'Standard Shipping (5-7 days)'
    END as shipping_description
FROM pincodes
WHERE is_servicable = true;

-- =============================================================================
-- 14. SECURE ACCESS FUNCTIONS
-- =============================================================================

-- Secure function to access searchable products
CREATE OR REPLACE FUNCTION public.get_searchable_products(search_query TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  brand TEXT,
  description TEXT,
  base_price DECIMAL,
  gallery_images TEXT[],
  rating DECIMAL,
  review_count INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  item_type TEXT,
  variant_id UUID,
  variant_name TEXT,
  variant_price DECIMAL,
  combo_id UUID,
  combo_name TEXT,
  combo_price DECIMAL,
  searchable_text TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF search_query = '' OR search_query IS NULL THEN
    RETURN QUERY
    SELECT * FROM public.searchable_products 
    WHERE is_active = true;
  ELSE
    RETURN QUERY
    SELECT * FROM public.searchable_products 
    WHERE is_active = true 
    AND searchable_text ILIKE '%' || search_query || '%';
  END IF;
END;
$$;

-- Secure function for user order tracking
CREATE OR REPLACE FUNCTION public.get_user_order_tracking(order_id_param UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  display_order_id TEXT,
  user_id UUID,
  status TEXT,
  subtotal DECIMAL,
  tax DECIMAL,
  shipping DECIMAL,
  total DECIMAL,
  payment_method TEXT,
  payment_confirmed BOOLEAN,
  payment_confirmed_at TIMESTAMPTZ,
  payment_verified TEXT,
  transaction_id TEXT,
  shipping_company TEXT,
  tracking_id TEXT,
  tracking_link TEXT,
  shipping_method TEXT,
  shipping_notes TEXT,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  shipping_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip_code TEXT,
  shipping_country TEXT,
  shipping_phone TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF order_id_param IS NULL THEN
    RETURN QUERY
    SELECT * FROM public.order_tracking_view 
    WHERE user_id = auth.uid();
  ELSE
    RETURN QUERY
    SELECT * FROM public.order_tracking_view 
    WHERE id = order_id_param 
    AND user_id = auth.uid();
  END IF;
END;
$$;

-- Admin function for viewing all orders
CREATE OR REPLACE FUNCTION public.get_all_orders_for_admin()
RETURNS TABLE (
  id UUID,
  display_order_id TEXT,
  user_id UUID,
  status TEXT,
  subtotal DECIMAL,
  tax DECIMAL,
  shipping DECIMAL,
  total DECIMAL,
  payment_method TEXT,
  payment_confirmed BOOLEAN,
  payment_confirmed_at TIMESTAMPTZ,
  payment_verified TEXT,
  transaction_id TEXT,
  shipping_company TEXT,
  tracking_id TEXT,
  tracking_link TEXT,
  shipping_method TEXT,
  shipping_notes TEXT,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  shipping_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip_code TEXT,
  shipping_country TEXT,
  shipping_phone TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
  
  RETURN QUERY
  SELECT * FROM public.order_tracking_view;
END;
$$;

-- Function to refresh searchable products materialized view
CREATE OR REPLACE FUNCTION refresh_searchable_products()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW searchable_products;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 15. SEARCH INDEXES
-- =============================================================================

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_searchable_products_text ON searchable_products USING gin(to_tsvector('english', searchable_text));
CREATE INDEX IF NOT EXISTS idx_searchable_products_name ON searchable_products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_searchable_products_brand ON searchable_products USING gin(to_tsvector('english', brand));
CREATE INDEX IF NOT EXISTS idx_searchable_products_variant ON searchable_products (variant_name) WHERE variant_name IS NOT NULL;

-- =============================================================================
-- 16. STORAGE POLICIES
-- =============================================================================

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset_images', 'asset_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public read access for images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete images" ON storage.objects;

CREATE POLICY "Public read access for images" ON storage.objects
    FOR SELECT USING (bucket_id = 'asset_images');

CREATE POLICY "Admin can upload images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'asset_images' AND public.is_admin());

CREATE POLICY "Admin can delete images" ON storage.objects
    FOR DELETE USING (bucket_id = 'asset_images' AND public.is_admin());

-- =============================================================================
-- 17. REALTIME SUBSCRIPTIONS
-- =============================================================================

BEGIN;
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_wishlists;

-- =============================================================================
-- 18. GRANT PERMISSIONS
-- =============================================================================

-- Grant access to secure functions
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_order_tracking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_orders_for_admin() TO authenticated;

-- Grant access to views
GRANT SELECT ON public.pincode_lookup TO anon, authenticated;

-- Remove unrestricted access to views and materialized views
REVOKE ALL ON public.order_tracking_view FROM authenticated;
REVOKE ALL ON public.order_tracking_view FROM anon;
REVOKE ALL ON public.order_tracking_view FROM public;
REVOKE ALL ON public.searchable_products FROM authenticated;
REVOKE ALL ON public.searchable_products FROM anon;
REVOKE ALL ON public.searchable_products FROM public;

-- =============================================================================
-- 19. SEED DATA
-- =============================================================================

-- Site settings
INSERT INTO public.site_settings (id, site_name, meta_title, meta_description)
VALUES (1, 'Premium Cigarettes', 'Premium Cigarette Marketplace', 'The finest selection of premium cigarettes, cigars, and vapes.')
ON CONFLICT (id) DO NOTHING;

-- Homepage sections
INSERT INTO public.homepage_sections (title, slug) VALUES
('Featured Collection', 'featured-collection'),
('New Arrivals', 'new-arrivals')
ON CONFLICT (slug) DO NOTHING;

-- Categories
INSERT INTO public.categories (name, slug, description) VALUES
('Premium Cigarettes', 'premium-cigarettes', 'A selection of the finest tobacco cigarettes.'),
('Luxury Cigars', 'luxury-cigars', 'Exquisite hand-rolled cigars for the discerning connoisseur.'),
('Modern Vapes', 'modern-vapes', 'Cutting-edge vaping devices and premium e-liquids.')
ON CONFLICT (name) DO NOTHING;

-- Shipping companies
INSERT INTO public.shipping_companies (name, website, tracking_url_template) VALUES
('Blue Dart', 'https://www.bluedart.com', 'https://www.bluedart.com/tracking?trackingNumber={tracking_id}'),
('DTDC', 'https://www.dtdc.com', 'https://www.dtdc.com/tracking?trackingNumber={tracking_id}'),
('FedEx', 'https://www.fedex.com', 'https://www.fedex.com/fedextrack/?trknbr={tracking_id}'),
('DHL', 'https://www.dhl.com', 'https://www.dhl.com/in-en/home/tracking.html?trackingNumber={tracking_id}'),
('India Post', 'https://www.indiapost.gov.in', 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?trackingNumber={tracking_id}'),
('Delhivery', 'https://www.delhivery.com', 'https://www.delhivery.com/track/package/{tracking_id}'),
('Ecom Express', 'https://www.ecomexpress.in', 'https://www.ecomexpress.in/tracking?trackingNumber={tracking_id}')
ON CONFLICT (name) DO NOTHING;

-- Sample pincodes
INSERT INTO public.pincodes (pincode, city, state, country, region, is_servicable, shipping_method, delivery_time_days, shipping_cost) VALUES
('110001', 'New Delhi', 'Delhi', 'India', 'North', true, 'standard', 3, 0.00),
('110002', 'New Delhi', 'Delhi', 'India', 'North', true, 'standard', 3, 0.00),
('400001', 'Mumbai', 'Maharashtra', 'India', 'West', true, 'standard', 4, 0.00),
('400002', 'Mumbai', 'Maharashtra', 'India', 'West', true, 'standard', 4, 0.00),
('560001', 'Bangalore', 'Karnataka', 'India', 'South', true, 'standard', 5, 0.00),
('560002', 'Bangalore', 'Karnataka', 'India', 'South', true, 'standard', 5, 0.00),
('600001', 'Chennai', 'Tamil Nadu', 'India', 'South', true, 'standard', 5, 0.00),
('600002', 'Chennai', 'Tamil Nadu', 'India', 'South', true, 'standard', 5, 0.00),
('700001', 'Kolkata', 'West Bengal', 'India', 'East', true, 'standard', 6, 0.00),
('700002', 'Kolkata', 'West Bengal', 'India', 'East', true, 'standard', 6, 0.00),
('110003', 'New Delhi', 'Delhi', 'India', 'North', true, 'express', 2, 150.00),
('400003', 'Mumbai', 'Maharashtra', 'India', 'West', true, 'express', 2, 150.00),
('560003', 'Bangalore', 'Karnataka', 'India', 'South', true, 'express', 2, 150.00),
('600003', 'Chennai', 'Tamil Nadu', 'India', 'South', true, 'express', 2, 150.00)
ON CONFLICT (pincode) DO NOTHING;

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
          'Vintage Series', 'vintage-series', 'Craftsman''s Choice', 189.00, 
          'Our Vintage Series embodies the art of traditional tobacco blending with modern refinement. Each blend is crafted using time-honored techniques passed down through generations, creating a rich, full-bodied experience with distinctive caramel undertones that develop naturally through our unique aging process.',
          50, TRUE,
          4.8, 127, 'North Carolina, USA', 'Full', '20 cigarettes',
          '{"Length": "84mm"}',
          '{"Aged Virginia tobacco", "Burley blend"}',
          '{"https://example.com/gallery1.jpg", "https://example.com/gallery2.jpg"}',
          'Vintage Series Cigarettes | Craftsman''s Choice', 'Experience the rich, full-bodied flavor of our Vintage Series cigarettes.'
        ),
        (
          'Marlboro Gold', 'marlboro-gold', 'Marlboro', 340.00, 
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

-- =============================================================================
-- 20. COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE public.products IS 'Product catalog with detailed attributes';
COMMENT ON TABLE public.product_variants IS 'Product variants like different packaging sizes (Packet, Carton, etc.)';
COMMENT ON TABLE public.variant_images IS 'Images specific to each product variant';
COMMENT ON TABLE public.product_combos IS 'Combo packs/bundles of multiple products';
COMMENT ON TABLE public.combo_items IS 'Individual products included in combo packs';
COMMENT ON TABLE public.discounts IS 'Discount system supporting percentage, fixed amount, and cart value discounts';
COMMENT ON TABLE public.user_wishlists IS 'User wishlist items for saved products';
COMMENT ON TABLE public.pincodes IS 'Postal codes with shipping information';
COMMENT ON TABLE public.shipping_companies IS 'Available shipping companies and tracking templates';
COMMENT ON MATERIALIZED VIEW public.searchable_products IS 'Unified search materialized view including products, variants, and combos';
COMMENT ON VIEW public.order_tracking_view IS 'Comprehensive order tracking with customer and admin details';
COMMENT ON VIEW public.pincode_lookup IS 'Public view for pincode validation and shipping info';

-- Price column comments
COMMENT ON COLUMN public.products.price IS 'Price in INR rupees (e.g., 100.35)';
COMMENT ON COLUMN public.orders.subtotal IS 'Subtotal in INR rupees (e.g., 100.35)';
COMMENT ON COLUMN public.orders.tax IS 'Tax in INR rupees (e.g., 10.50)';
COMMENT ON COLUMN public.orders.shipping IS 'Shipping cost in INR rupees (e.g., 25.00)';
COMMENT ON COLUMN public.orders.discount IS 'Discount amount in INR rupees (e.g., 10.50)';
COMMENT ON COLUMN public.orders.total IS 'Total amount in INR rupees (e.g., 135.85)';
COMMENT ON COLUMN public.order_items.product_price IS 'Product price in INR rupees (e.g., 100.35)';

-- Function comments
COMMENT ON FUNCTION public.get_searchable_products(TEXT) IS 'Secure function to access searchable products with proper access controls';
COMMENT ON FUNCTION public.get_user_order_tracking(UUID) IS 'Secure function for users to access their own order tracking data';
COMMENT ON FUNCTION public.get_all_orders_for_admin() IS 'Admin-only function to access all order tracking data';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Update existing orders with 'pending' status to 'placed' for better UX
UPDATE public.orders 
SET status = 'placed' 
WHERE status = 'pending';

-- Initial refresh of materialized view
SELECT refresh_searchable_products();

-- Log completion
-- Note: This would be logged in a schema_migrations table if you have one
