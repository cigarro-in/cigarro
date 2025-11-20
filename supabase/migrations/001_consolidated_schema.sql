-- 001_consolidated_schema.sql
-- Idempotent, industry-grade consolidated schema for Cigarro marketplace
-- Merges 001–034 and timestamped fixes into a single authoritative baseline
-- Non-destructive (no DROPs). Safe to run multiple times.

-- =============================================================================
-- 0) EXTENSIONS (safe)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================================================
-- 1) COMMON FUNCTIONS (shared across modules)
-- =============================================================================
-- Update updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Admin check (used by RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic slug generator for products/blogs
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(BOTH '-' FROM regexp_replace(lower(unaccent(trim(input_text))), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 2) ACCOUNTS & SETTINGS
-- =============================================================================
-- Profiles extend auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on new auth user
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
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created 
      AFTER INSERT ON auth.users 
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END; $$;

-- Site settings (single row pattern)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  site_name TEXT,
  favicon_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at 
      BEFORE UPDATE ON public.profiles 
      FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
  END IF;
END; $$;

-- =============================================================================
-- 3) CATALOG: CATEGORIES, PRODUCTS, VARIANTS, IMAGES, COMBOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT, -- retained for compatibility
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  rating DECIMAL(2,1) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
  origin TEXT,
  pack_size TEXT,
  specifications JSONB,
  gallery_images TEXT[], -- Removed redundant 'image' column, using gallery_images
  image_alt_text TEXT,
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  canonical_url TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,
  structured_data JSONB DEFAULT '{}',
  seo_score INTEGER DEFAULT 0 CHECK (seo_score BETWEEN 0 AND 100),
  -- Brands FK (031 + embedding support)
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create brands before referencing (in case brands not yet defined)
-- Brands (031)
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure products.brand_id now references brands
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Optional backfill (match by name, case-insensitive)
UPDATE public.products p
SET brand_id = b.id
FROM public.brands b
WHERE p.brand_id IS NULL AND p.brand IS NOT NULL AND lower(p.brand) = lower(b.name);

-- Product-Category join
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  "order" INT DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);

-- =============================================================================
-- 4. PRODUCT VARIANTS AND COMBOS
-- =============================================================================

-- Product Variants table (SKU removed - 030)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name VARCHAR(100) NOT NULL,
  variant_type VARCHAR(50) NOT NULL DEFAULT 'packaging',
  price DECIMAL(10,2) NOT NULL,
  weight DECIMAL(8,2),
  dimensions JSONB,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  -- SEO fields (029)
  variant_slug VARCHAR(200),
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  structured_data JSONB DEFAULT '{}',
  -- brand (compatibility if needed)
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variant images with shared product gallery support (029/030)
CREATE TABLE IF NOT EXISTS public.variant_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  -- SEO / meta
  title TEXT,
  caption TEXT,
  meta_description TEXT,
  focal_point JSONB DEFAULT '{"x":0.5,"y":0.5}',
  image_width INTEGER,
  image_height INTEGER,
  file_size INTEGER,
  format VARCHAR(10),
  lazy_load BOOLEAN DEFAULT true,
  webp_url TEXT,
  thumbnail_url TEXT,
  medium_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Either variant_id or product_id must be set, but not both
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_variant_or_product_id'
  ) THEN
    ALTER TABLE public.variant_images
      ADD CONSTRAINT check_variant_or_product_id
      CHECK (
        (variant_id IS NOT NULL AND product_id IS NULL) OR
        (variant_id IS NULL AND product_id IS NOT NULL)
      );
  END IF;
END; $$;

-- Product Combos table
CREATE TABLE IF NOT EXISTS public.product_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  combo_price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2), -- sum of individual items
  discount_percentage DECIMAL(5,2),
  combo_image TEXT,
  gallery_images TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Combo Items table
CREATE TABLE IF NOT EXISTS public.combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. DISCOUNTS SYSTEM
-- =============================================================================

-- Discounts table
CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  usage_limit INTEGER, -- max number of uses
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT, -- Added missing description column
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. CART AND ORDERS
-- =============================================================================

-- Cart Items table with variant and combo support
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES public.product_variants(id),
  combo_id UUID REFERENCES public.product_combos(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, variant_id, combo_id)
);

-- Order status enum
CREATE TYPE IF NOT EXISTS order_status AS ENUM ('pending','placed','processing','shipped','delivered','cancelled');

-- Orders table with comprehensive payment and shipping tracking
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  payment_confirmed_at TIMESTAMPTZ,
  payment_verified TEXT DEFAULT 'NO' CHECK (payment_verified IN ('YES', 'NO', 'REJECTED')),
  payment_verified_at TIMESTAMPTZ,
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
  estimated_delivery TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  shipped_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES auth.users(id),
  delivery_notes TEXT,
  delivery_proof_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items table with variant and combo support
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. USER WISHLISTS
-- =============================================================================

-- User Wishlists table
CREATE TABLE IF NOT EXISTS public.user_wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- =============================================================================
-- 8. SHIPPING AND PINCODES
-- =============================================================================

-- Shipping Companies table
CREATE TABLE IF NOT EXISTS public.shipping_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  website TEXT,
  tracking_url_template TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pincodes table for location-based shipping
CREATE TABLE IF NOT EXISTS public.pincodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pincode VARCHAR(6) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'India',
  region VARCHAR(100),
  is_servicable BOOLEAN NOT NULL DEFAULT true,
  shipping_method VARCHAR(50) NOT NULL DEFAULT 'standard',
  delivery_time_days INTEGER DEFAULT 5,
  shipping_cost DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. HELPER FUNCTIONS
-- =============================================================================

-- Slugify function
CREATE OR REPLACE FUNCTION public.slugify(v TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(BOTH '-' FROM regexp_replace(lower(unaccent(trim(v))), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- Variants indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON public.product_variants(is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_type ON public.product_variants(variant_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_slug_unique
ON public.product_variants(product_id, variant_slug) WHERE variant_slug IS NOT NULL;

-- Variant images indexes
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON public.variant_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_product_id ON public.variant_images(product_id);

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
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_component_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postal_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Public read discounts" ON public.discounts FOR SELECT USING (true);
CREATE POLICY "Admins can manage discounts" ON public.discounts FOR ALL USING (public.is_admin());

-- =============================================================================
-- 13. HOMEPAGE: SECTIONS, CONFIG, HERO SLIDES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Homepage Section Categories (Join Table)
CREATE TABLE IF NOT EXISTS public.homepage_section_categories (
  section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.homepage_component_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name TEXT NOT NULL UNIQUE,
  section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.section_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name TEXT NOT NULL UNIQUE,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  background_image TEXT,
  button_text TEXT,
  button_url TEXT,
  max_items INTEGER DEFAULT 6,
  is_enabled BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hero slides (022 & 023)
CREATE TABLE IF NOT EXISTS public.hero_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  small_image_url TEXT,
  button_text TEXT,
  button_url TEXT,
  button_style VARCHAR(20) DEFAULT 'primary',
  text_position VARCHAR(10) DEFAULT 'left' CHECK (text_position IN ('left','center','right')),
  text_color VARCHAR(10) DEFAULT 'light' CHECK (text_color IN ('light','dark')),
  overlay_opacity INTEGER DEFAULT 40,
  product_name TEXT,
  product_price TEXT,
  product_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for hero slides
CREATE INDEX IF NOT EXISTS idx_hero_slides_active ON public.hero_slides(is_active);
CREATE INDEX IF NOT EXISTS idx_hero_slides_sort_order ON public.hero_slides(sort_order);

-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_hero_slides_updated_at') THEN
    CREATE TRIGGER update_hero_slides_updated_at
      BEFORE UPDATE ON public.hero_slides
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END; $$;

-- Default homepage sections and component map (idempotent seeds)
INSERT INTO public.homepage_sections (title, slug) VALUES
  ('Hero Section','hero-section'),
  ('Featured Products','featured-products'),
  ('Product Showcase','product-showcase'),
  ('Categories Grid','categories-grid'),
  ('Blog Section','blog-section')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order)
SELECT 'Hero', hs.id, true, 1 FROM public.homepage_sections hs WHERE hs.slug = 'hero-section'
ON CONFLICT (component_name) DO NOTHING;
INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order)
SELECT 'FeaturedProducts', hs.id, true, 2 FROM public.homepage_sections hs WHERE hs.slug = 'featured-products'
ON CONFLICT (component_name) DO NOTHING;
INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order)
SELECT 'ProductShowcase', hs.id, true, 3 FROM public.homepage_sections hs WHERE hs.slug = 'product-showcase'
ON CONFLICT (component_name) DO NOTHING;
INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order)
SELECT 'CategoriesGrid', hs.id, true, 4 FROM public.homepage_sections hs WHERE hs.slug = 'categories-grid'
ON CONFLICT (component_name) DO NOTHING;
INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order)
SELECT 'BlogSection', hs.id, true, 5 FROM public.homepage_sections hs WHERE hs.slug = 'blog-section'
ON CONFLICT (component_name) DO NOTHING;

-- =============================================================================
-- 14. BLOG SYSTEM (023)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  reading_time INTEGER,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  meta_title VARCHAR(60),
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  canonical_url TEXT,
  og_title VARCHAR(100),
  og_description VARCHAR(200),
  og_image TEXT,
  structured_data JSONB DEFAULT '{}',
  social_title VARCHAR(100),
  social_description VARCHAR(200),
  social_image TEXT,
  gallery_images TEXT[],
  attachments JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  author_name VARCHAR(100) NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  is_spam BOOLEAN DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reading time helper
CREATE OR REPLACE FUNCTION public.calculate_reading_time(content TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, CEIL(LENGTH(REGEXP_REPLACE(content, '\\s+', ' ', 'g')) / 200.0));
END; $$ LANGUAGE plpgsql;

-- Auto slug for blogs
CREATE OR REPLACE FUNCTION public.auto_generate_blog_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Auto reading time
CREATE OR REPLACE FUNCTION public.auto_calculate_reading_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.reading_time := public.calculate_reading_time(NEW.content);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_generate_blog_slug') THEN
    CREATE TRIGGER trigger_auto_generate_blog_slug
      BEFORE INSERT OR UPDATE ON public.blog_posts
      FOR EACH ROW EXECUTE FUNCTION public.auto_generate_blog_slug();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_calculate_reading_time') THEN
    CREATE TRIGGER trigger_auto_calculate_reading_time
      BEFORE INSERT OR UPDATE ON public.blog_posts
      FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_reading_time();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_blog_posts_updated_at') THEN
    CREATE TRIGGER trigger_update_blog_posts_updated_at
      BEFORE UPDATE ON public.blog_posts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_blog_categories_updated_at') THEN
    CREATE TRIGGER trigger_update_blog_categories_updated_at
      BEFORE UPDATE ON public.blog_categories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_blog_tags_updated_at') THEN
    CREATE TRIGGER trigger_update_blog_tags_updated_at
      BEFORE UPDATE ON public.blog_tags
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_blog_comments_updated_at') THEN
    CREATE TRIGGER trigger_update_blog_comments_updated_at
      BEFORE UPDATE ON public.blog_comments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END; $$;

-- =============================================================================
-- 15. ADDRESS SYSTEM + COMPATIBILITY VIEWS (027)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Address',
  is_primary BOOLEAN DEFAULT false,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  landmark TEXT,
  area TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- One primary address per user (partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_address_per_user
ON public.addresses (user_id) WHERE is_primary = true;

-- Postal codes (minimal for pincode_lookup)
CREATE TABLE IF NOT EXISTS public.postal_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postal_code TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  is_serviceable BOOLEAN DEFAULT true,
  standard_delivery_days INTEGER DEFAULT 5,
  base_shipping_cost DECIMAL(10,2) DEFAULT 50.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibility view: saved_addresses
CREATE OR REPLACE VIEW public.saved_addresses AS
SELECT 
  a.id,
  a.user_id,
  a.label,
  a.recipient_name AS full_name,
  a.phone,
  a.address_line_1 AS address,
  a.address_line_1 AS user_provided_address,
  a.city,
  a.state,
  a.postal_code AS pincode,
  a.country,
  a.latitude,
  a.longitude,
  a.is_primary AS is_default,
  a.created_at,
  a.updated_at
FROM public.addresses a;

-- Compatibility view: pincode_lookup
CREATE OR REPLACE VIEW public.pincode_lookup AS
SELECT 
  postal_code AS pincode,
  city,
  state,
  country,
  is_serviceable AS is_servicable,
  'standard' AS shipping_method,
  standard_delivery_days AS delivery_time_days,
  base_shipping_cost AS shipping_cost,
  CASE 
    WHEN is_serviceable THEN 'Standard Shipping (3-7 days)'
    ELSE 'Not serviceable'
  END AS shipping_description
FROM public.postal_codes;

-- INSTEAD OF triggers for saved_addresses (insert/update/delete) with normalization
CREATE OR REPLACE FUNCTION public.handle_saved_addresses_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_digits TEXT;
  v_country TEXT;
BEGIN
  v_country := COALESCE(NULLIF(NEW.country, ''), 'India');
  v_digits := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  IF lower(v_country) IN ('india','in') THEN
    IF char_length(v_digits) >= 10 THEN
      v_digits := right(v_digits, 10);
    END IF;
  END IF;
  INSERT INTO public.addresses (
    user_id, label, recipient_name, phone,
    address_line_1, city, state, postal_code, country,
    latitude, longitude, is_primary
  ) VALUES (
    NEW.user_id, NEW.label, NEW.full_name, v_digits,
    NEW.address, NEW.city, NEW.state, NEW.pincode, v_country,
    NEW.latitude, NEW.longitude, NEW.is_default
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_saved_addresses_update()
RETURNS TRIGGER AS $$
DECLARE
  v_digits TEXT;
  v_country TEXT;
BEGIN
  v_country := COALESCE(NULLIF(NEW.country, ''), 'India');
  v_digits := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  IF lower(v_country) IN ('india','in') THEN
    IF char_length(v_digits) >= 10 THEN
      v_digits := right(v_digits, 10);
    END IF;
  END IF;
  UPDATE public.addresses SET
    label = NEW.label,
    recipient_name = NEW.full_name,
    phone = v_digits,
    address_line_1 = NEW.address,
    city = NEW.city,
    state = NEW.state,
    postal_code = NEW.pincode,
    country = v_country,
    latitude = NEW.latitude,
    longitude = NEW.longitude,
    is_primary = NEW.is_default,
    updated_at = NOW()
  WHERE id = NEW.id AND user_id = NEW.user_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_saved_addresses_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.addresses WHERE id = OLD.id AND user_id = OLD.user_id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'saved_addresses_insert_trigger') THEN
    CREATE TRIGGER saved_addresses_insert_trigger
      INSTEAD OF INSERT ON public.saved_addresses
      FOR EACH ROW EXECUTE FUNCTION public.handle_saved_addresses_insert();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'saved_addresses_update_trigger') THEN
    CREATE TRIGGER saved_addresses_update_trigger
      INSTEAD OF UPDATE ON public.saved_addresses
      FOR EACH ROW EXECUTE FUNCTION public.handle_saved_addresses_update();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'saved_addresses_delete_trigger') THEN
    CREATE TRIGGER saved_addresses_delete_trigger
      INSTEAD OF DELETE ON public.saved_addresses
      FOR EACH ROW EXECUTE FUNCTION public.handle_saved_addresses_delete();
  END IF;
END; $$;

-- =============================================================================
-- 16. ORDER ID GENERATION (025)
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 100001;

CREATE OR REPLACE FUNCTION public.generate_display_order_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_order_id IS NULL THEN
    NEW.display_order_id := nextval('order_number_seq')::TEXT;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_display_order_id') THEN
    CREATE TRIGGER trigger_generate_display_order_id
      BEFORE INSERT ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.generate_display_order_id();
  END IF;
END; $$;

-- =============================================================================
-- 17. SEO HELPERS (029/030)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_fill_product_seo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.name);
  END IF;
  IF NEW.meta_title IS NULL OR NEW.meta_title = '' THEN
    NEW.meta_title := NEW.name || ' | ' || COALESCE(NEW.brand,'');
  END IF;
  IF NEW.meta_description IS NULL OR NEW.meta_description = '' THEN
    NEW.meta_description := 'Buy ' || NEW.name || COALESCE(' from ' || NEW.brand, '') || '.';
  END IF;
  IF NEW.canonical_url IS NULL OR NEW.canonical_url = '' THEN
    NEW.canonical_url := 'https://cigarro.in/product/' || NEW.slug;
  END IF;
  IF NEW.og_title IS NULL OR NEW.og_title = '' THEN NEW.og_title := NEW.meta_title; END IF;
  IF NEW.og_description IS NULL OR NEW.og_description = '' THEN NEW.og_description := NEW.meta_description; END IF;
  IF NEW.twitter_title IS NULL OR NEW.twitter_title = '' THEN NEW.twitter_title := NEW.meta_title; END IF;
  IF NEW.twitter_description IS NULL OR NEW.twitter_description = '' THEN NEW.twitter_description := NEW.meta_description; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_fill_product_seo') THEN
    CREATE TRIGGER trigger_auto_fill_product_seo
      BEFORE INSERT OR UPDATE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.auto_fill_product_seo();
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_variant_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  counter INTEGER := 0;
  final_slug TEXT;
BEGIN
  base_slug := public.generate_slug(COALESCE(NEW.variant_name,''));
  IF base_slug IS NULL OR base_slug = '' THEN
    RETURN NEW;
  END IF;
  final_slug := base_slug;
  WHILE EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE product_id = NEW.product_id AND variant_slug = final_slug AND id IS DISTINCT FROM NEW.id
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.variant_slug := final_slug;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_variant_slug') THEN
    CREATE TRIGGER trigger_generate_variant_slug
      BEFORE INSERT OR UPDATE ON public.product_variants
      FOR EACH ROW EXECUTE FUNCTION public.generate_variant_slug();
  END IF;
END; $$;

-- =============================================================================
-- 18. AUDIT LOGS (used by src/utils/audit-logger.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  user_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 19. FINAL RLS POLICIES (blogs, brands, homepage, addresses, audit)
-- =============================================================================
-- Brands
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='Brands are viewable by everyone'
  ) THEN
    CREATE POLICY "Brands are viewable by everyone" ON public.brands FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='Brands are editable by authenticated users'
  ) THEN
    CREATE POLICY "Brands are editable by authenticated users" ON public.brands FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Homepage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='section_configurations' AND policyname='Anyone can view section configurations'
  ) THEN
    CREATE POLICY "Anyone can view section configurations" ON public.section_configurations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='section_configurations' AND policyname='Authenticated users can manage section configurations'
  ) THEN
    CREATE POLICY "Authenticated users can manage section configurations" ON public.section_configurations FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='hero_slides' AND policyname='Public read hero slides'
  ) THEN
    CREATE POLICY "Public read hero slides" ON public.hero_slides FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='hero_slides' AND policyname='Admins can manage hero slides'
  ) THEN
    CREATE POLICY "Admins can manage hero slides" ON public.hero_slides FOR ALL USING (public.is_admin());
  END IF;
END $$;

-- Blogs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='blog_categories' AND policyname='Anyone can view blog categories'
  ) THEN
    CREATE POLICY "Anyone can view blog categories" ON public.blog_categories FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='blog_tags' AND policyname='Anyone can view blog tags'
  ) THEN
    CREATE POLICY "Anyone can view blog tags" ON public.blog_tags FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname='Anyone can view published blog posts'
  ) THEN
    CREATE POLICY "Anyone can view published blog posts" ON public.blog_posts FOR SELECT USING (status = 'published');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname='Authors can manage their own posts'
  ) THEN
    CREATE POLICY "Authors can manage their own posts" ON public.blog_posts FOR ALL USING (author_id = auth.uid());
  END IF;
END $$;

-- Addresses
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='addresses' AND policyname='Users can manage their own addresses'
  ) THEN
    CREATE POLICY "Users can manage their own addresses" ON public.addresses FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='Admins can view audit logs'
  ) THEN
    CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());
  END IF;
END $$;

-- =============================================================================
-- 20. SEED DATA (idempotent)
-- =============================================================================
-- Brands
INSERT INTO public.brands (name, slug, description, is_active, is_featured, sort_order) VALUES
('Marlboro','marlboro','Premium cigarette brand',true,true,1),
('Camel','camel','Classic cigarette brand',true,true,2),
('Lucky Strike','lucky-strike','Iconic cigarette brand',true,false,3),
('Parliament','parliament','Premium filter cigarettes',true,false,4),
('Dunhill','dunhill','Luxury cigarette brand',true,true,5)
ON CONFLICT (name) DO NOTHING;

-- Postal codes (minimal for India)
INSERT INTO public.postal_codes (postal_code, city, state, is_serviceable, standard_delivery_days, base_shipping_cost) VALUES
('110001','New Delhi','Delhi',true,3,50.00),
('400001','Mumbai','Maharashtra',true,4,60.00),
('700001','Kolkata','West Bengal',true,5,55.00),
('560001','Bangalore','Karnataka',true,4,45.00),
('600001','Chennai','Tamil Nadu',true,4,50.00)
ON CONFLICT (postal_code) DO NOTHING;

-- Blog categories
INSERT INTO public.blog_categories (name, slug, description, color, is_active, sort_order) VALUES
('News','news','Latest updates and news',' #3B82F6',true,1),
('Tips','tips','Smoking tips and advice','#10B981',true,2),
('Reviews','reviews','Product reviews','#F59E0B',true,3),
('Lifestyle','lifestyle','Lifestyle content','#EF4444',true,4)
ON CONFLICT (name) DO NOTHING;

-- Blog tags
INSERT INTO public.blog_tags (name, slug, color, is_active) VALUES
('Health','health','#EF4444',true),
('Trends','trends','#8B5CF6',true),
('Guide','guide','#06B6D4',true),
('Tips','tips','#10B981',true),
('News','news','#F59E0B',true)
ON CONFLICT (name) DO NOTHING;
