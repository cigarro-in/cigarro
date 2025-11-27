-- ============================================================================
-- Migration: 030_consolidated_brands_products_payments.sql
-- Description: Consolidated migration for Brands, Product Updates, and Payment Verification
--              Merges migrations 031-039 into a single coherent update.
--              Includes:
--              1. Brands Table & Heritage (031, 037)
--              2. Product & Variant Column Updates (035)
--              3. RLS Policy Fixes (036)
--              4. Payment Verification System (038, 039)
-- Date: 2024-11-27
-- ============================================================================

-- ============================================================================
-- SECTION 1: BRANDS TABLE (031 & 037)
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
COMMENT ON COLUMN public.brands.heritage IS 'Brand heritage information (founded_year, origin_country, founder, story)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brands_name ON public.brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON public.brands(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brands_is_featured ON public.brands(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_brands_heritage ON public.brands USING gin(heritage);

-- Triggers
CREATE OR REPLACE FUNCTION public.update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_brands_updated_at ON public.brands;
CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_brands_updated_at();

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

DROP TRIGGER IF EXISTS trigger_brands_generate_slug ON public.brands;
CREATE TRIGGER trigger_brands_generate_slug
  BEFORE INSERT OR UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_brand_slug();

-- RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active brands" ON public.brands;
CREATE POLICY "Public can view active brands" ON public.brands FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can view all brands" ON public.brands;
CREATE POLICY "Authenticated users can view all brands" ON public.brands FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage brands" ON public.brands;
CREATE POLICY "Authenticated users can manage brands" ON public.brands FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sample Data
INSERT INTO public.brands (name, slug, description, sort_order, is_active, is_featured, heritage) VALUES
  ('Marlboro', 'marlboro', 'World''s best-selling cigarette brand', 1, true, true, '{"founded_year": "1924", "origin_country": "USA", "founder": "Philip Morris"}'),
  ('Camel', 'camel', 'Premium American cigarette brand', 2, true, true, '{"founded_year": "1913", "origin_country": "USA", "founder": "R.J. Reynolds"}'),
  ('Lucky Strike', 'lucky-strike', 'Classic American cigarette brand', 3, true, false, '{"founded_year": "1871", "origin_country": "USA"}'),
  ('Parliament', 'parliament', 'Luxury cigarette brand with recessed filter', 4, true, false, '{"founded_year": "1931", "origin_country": "USA"}'),
  ('Dunhill', 'dunhill', 'British luxury cigarette brand', 5, true, false, '{"founded_year": "1907", "origin_country": "UK", "founder": "Alfred Dunhill"}')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SECTION 2: PRODUCT & VARIANT UPDATES (035)
-- ============================================================================

-- Add columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC,
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS continue_selling_when_out_of_stock BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS showcase_order INTEGER,
  ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0;

-- Add columns to product_variants
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC,
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;

-- Remove redundant brand column from variants
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS brand;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_compare_at_price ON public.products(compare_at_price) WHERE compare_at_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_showcase_order ON public.products(showcase_order) WHERE is_showcase = true AND showcase_order IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_featured_order ON public.products(featured_order) WHERE is_featured = true;

-- Backfill brand_id
UPDATE public.products p
SET brand_id = b.id
FROM public.brands b
WHERE p.brand_id IS NULL 
  AND lower(trim(p.brand)) = lower(trim(b.name));

-- Constraints
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS check_products_cost_price;
ALTER TABLE public.products ADD CONSTRAINT check_products_cost_price CHECK (cost_price IS NULL OR cost_price >= 0);

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS check_variants_cost_price;
ALTER TABLE public.product_variants ADD CONSTRAINT check_variants_cost_price CHECK (cost_price IS NULL OR cost_price >= 0);

-- Helper Functions
CREATE OR REPLACE FUNCTION public.calculate_discount_percentage(price NUMERIC, compare_at_price NUMERIC)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF compare_at_price IS NULL OR compare_at_price <= price THEN RETURN 0; END IF;
  RETURN ROUND(((compare_at_price - price) / compare_at_price * 100)::NUMERIC);
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_profit_margin(price NUMERIC, cost_price NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF cost_price IS NULL OR cost_price = 0 THEN RETURN NULL; END IF;
  RETURN ROUND(((price - cost_price) / price * 100)::NUMERIC, 2);
END;
$$;

-- Views
CREATE OR REPLACE VIEW public.products_with_discounts AS
SELECT 
  p.*,
  calculate_discount_percentage(p.price, p.compare_at_price) as discount_percentage,
  calculate_profit_margin(p.price, p.cost_price) as profit_margin,
  CASE WHEN p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price THEN p.compare_at_price - p.price ELSE 0 END as savings_amount,
  b.name as brand_name,
  b.logo_url as brand_logo
FROM public.products p
LEFT JOIN public.brands b ON p.brand_id = b.id;

CREATE OR REPLACE VIEW public.variants_with_discounts AS
SELECT 
  v.*,
  calculate_discount_percentage(v.price, v.compare_at_price) as discount_percentage,
  calculate_profit_margin(v.price, v.cost_price) as profit_margin,
  CASE WHEN v.compare_at_price IS NOT NULL AND v.compare_at_price > v.price THEN v.compare_at_price - v.price ELSE 0 END as savings_amount,
  p.name as product_name,
  p.brand as product_brand,
  p.brand_id as product_brand_id
FROM public.product_variants v
JOIN public.products p ON v.product_id = p.id;

-- ============================================================================
-- SECTION 3: RLS POLICY FIXES (036)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_images ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

DROP POLICY IF EXISTS "variants_select_policy" ON public.product_variants;
DROP POLICY IF EXISTS "variants_insert_policy" ON public.product_variants;
DROP POLICY IF EXISTS "variants_update_policy" ON public.product_variants;
DROP POLICY IF EXISTS "variants_delete_policy" ON public.product_variants;

DROP POLICY IF EXISTS "variant_images_select_policy" ON public.variant_images;
DROP POLICY IF EXISTS "variant_images_insert_policy" ON public.variant_images;
DROP POLICY IF EXISTS "variant_images_update_policy" ON public.variant_images;
DROP POLICY IF EXISTS "variant_images_delete_policy" ON public.variant_images;

-- Create new policies (Public Read, Admin/Auth Write)
CREATE POLICY "products_select_policy" ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "products_insert_policy" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update_policy" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_delete_policy" ON public.products FOR DELETE TO authenticated USING (true);

CREATE POLICY "variants_select_policy" ON public.product_variants FOR SELECT TO public USING (true);
CREATE POLICY "variants_insert_policy" ON public.product_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "variants_update_policy" ON public.product_variants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "variants_delete_policy" ON public.product_variants FOR DELETE TO authenticated USING (true);

CREATE POLICY "variant_images_select_policy" ON public.variant_images FOR SELECT TO public USING (true);
CREATE POLICY "variant_images_insert_policy" ON public.variant_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "variant_images_update_policy" ON public.variant_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "variant_images_delete_policy" ON public.variant_images FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- SECTION 4: PAYMENT VERIFICATION SYSTEM (038, 039)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  email_subject TEXT,
  email_body TEXT,
  email_from TEXT,
  email_received_at TIMESTAMPTZ,
  email_message_id TEXT UNIQUE,
  bank_name TEXT,
  upi_reference TEXT,
  amount DECIMAL(10,2),
  sender_vpa TEXT,
  receiver_vpa TEXT,
  payment_timestamp TIMESTAMPTZ,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'duplicate', 'manual')),
  verification_method TEXT CHECK (verification_method IN ('email_parse', 'manual', 'api', 'webhook')),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_match BOOLEAN,
  reference_match BOOLEAN,
  time_window_match BOOLEAN,
  confidence_score DECIMAL(5,2),
  raw_email_data JSONB,
  parser_version TEXT DEFAULT '1.0.0',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  subject_pattern TEXT,
  amount_pattern TEXT NOT NULL,
  reference_pattern TEXT,
  sender_vpa_pattern TEXT,
  receiver_vpa_pattern TEXT,
  timestamp_pattern TEXT,
  transaction_id_pattern TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  last_tested_at TIMESTAMPTZ,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  total_attempts INTEGER DEFAULT 0,
  successful_parses INTEGER DEFAULT 0,
  sample_email_subject TEXT,
  sample_email_body TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_name, email_domain)
);

DROP TABLE IF EXISTS public.payment_verification_logs CASCADE;
CREATE TABLE public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  email_found BOOLEAN DEFAULT false,
  email_parsed BOOLEAN DEFAULT false,
  amount_matched BOOLEAN DEFAULT false,
  bank_name TEXT,
  upi_reference TEXT,
  sender_vpa TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE(transaction_id)
);

-- Updates to Orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_verification_id UUID REFERENCES public.payment_verifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_verification_attempt_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_verifications_txn ON public.payment_verifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_order ON public.payment_verifications(order_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_transaction ON public.payment_verification_logs(transaction_id);

-- RLS for Payment Tables
ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can do everything on payment_verifications" ON public.payment_verifications FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can do everything on bank_email_templates" ON public.bank_email_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can read logs" ON public.payment_verification_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage logs" ON public.payment_verification_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role can insert logs" ON public.payment_verification_logs FOR INSERT TO service_role WITH CHECK (true);

-- Insert Default Bank Templates
INSERT INTO public.bank_email_templates (bank_name, email_domain, subject_pattern, amount_pattern, transaction_id_pattern, priority) VALUES
  ('PhonePe', 'phonepe.com', 'Payment Successful|Money Sent', '₹\s*([0-9,]+(?:\.[0-9]{2})?)', 'TXN[0-9]{8}', 10),
  ('Google Pay', 'google.com', 'You sent ₹|Payment to', '₹\s*([0-9,]+(?:\.[0-9]{2})?)', 'TXN[0-9]{8}', 10),
  ('Paytm', 'paytm.com', 'Payment Successful|Money Transferred', '₹\s*([0-9,]+(?:\.[0-9]{2})?)', 'TXN[0-9]{8}', 9),
  ('BHIM', 'npci.org.in', 'Transaction Successful|Payment Confirmation', '₹\s*([0-9,]+(?:\.[0-9]{2})?)', 'TXN[0-9]{8}', 8),
  ('Generic UPI', '*', 'UPI|Payment|Transaction', '₹\s*([0-9,]+(?:\.[0-9]{2})?)|Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)', 'TXN[0-9]{8}', 1)
ON CONFLICT (bank_name, email_domain) DO NOTHING;

-- Helper Functions
CREATE OR REPLACE FUNCTION find_matching_order(p_transaction_id TEXT, p_amount DECIMAL, p_payment_time TIMESTAMPTZ)
RETURNS TABLE (order_id UUID, confidence_score DECIMAL, match_reason TEXT) AS $$
BEGIN
  RETURN QUERY SELECT o.id, 100.0::DECIMAL, 'exact_transaction_id_match'::TEXT 
  FROM public.orders o WHERE o.transaction_id = p_transaction_id AND o.status IN ('pending', 'processing') AND o.payment_confirmed = false LIMIT 1;
  
  IF FOUND THEN RETURN; END IF;
  
  RETURN QUERY SELECT o.id, CASE WHEN ABS(o.total - p_amount) < 0.01 THEN 90.0 WHEN ABS(o.total - p_amount) < 1.0 THEN 80.0 ELSE 70.0 END::DECIMAL, 'amount_and_time_match'::TEXT
  FROM public.orders o WHERE o.status IN ('pending', 'processing') AND o.payment_confirmed = false AND ABS(o.total - p_amount) < 2.0 AND p_payment_time BETWEEN o.created_at AND (o.created_at + INTERVAL '10 minutes') ORDER BY ABS(o.total - p_amount) ASC, o.created_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_order_payment(p_order_id UUID, p_verification_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_updated BOOLEAN := false;
BEGIN
  UPDATE public.orders SET status = 'paid', payment_confirmed = true, payment_confirmed_at = NOW(), payment_verification_id = p_verification_id, auto_verified = true, updated_at = NOW()
  WHERE id = p_order_id AND status IN ('pending', 'processing') AND payment_confirmed = false;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 030_consolidated_brands_products_payments completed successfully';
END $$;
