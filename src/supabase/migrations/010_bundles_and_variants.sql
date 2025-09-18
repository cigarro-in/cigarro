-- Migration: Add Product Variants, Combos, Discounts and Enhanced Search
-- Version: 0016
-- Description: Comprehensive system for product variants, combos, discounts, and variant-aware search

-- ==============================================
-- 1. PRODUCT VARIANTS SYSTEM
-- ==============================================

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
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

-- Create variant_images table
CREATE TABLE IF NOT EXISTS variant_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for variants
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_type ON product_variants(variant_type);
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON variant_images(variant_id);

-- ==============================================
-- 2. PRODUCT COMBOS SYSTEM
-- ==============================================

-- Create product_combos table
CREATE TABLE IF NOT EXISTS product_combos (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create combo_items table
CREATE TABLE IF NOT EXISTS combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for combos
CREATE INDEX IF NOT EXISTS idx_product_combos_active ON product_combos(is_active);
CREATE INDEX IF NOT EXISTS idx_product_combos_slug ON product_combos(slug);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_product_id ON combo_items(product_id);

-- ==============================================
-- 3. DISCOUNTS SYSTEM
-- ==============================================

-- Create discounts table
CREATE TABLE IF NOT EXISTS discounts (
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
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  usage_limit INTEGER, -- max number of uses
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for discounts
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active);
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, end_date);

-- ==============================================
-- 4. UPDATE EXISTING TABLES
-- ==============================================

-- Add variant support to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id),
ADD COLUMN IF NOT EXISTS variant_name VARCHAR(100);

-- Add combo support to order_items  
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES product_combos(id),
ADD COLUMN IF NOT EXISTS combo_name VARCHAR(200);

-- Update cart_items table
ALTER TABLE cart_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id),
ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES product_combos(id);

-- Add discount tracking to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES discounts(id),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50);

-- ==============================================
-- 5. ENHANCED SEARCH SYSTEM
-- ==============================================

-- Create materialized view for search (instead of regular view)
CREATE MATERIALIZED VIEW searchable_products AS
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
  -- Searchable text combining product info
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
  -- Enhanced searchable text including variant info
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
  -- Searchable text for combos
  CONCAT_WS(' ', pc.name, COALESCE(pc.description, ''), 'combo pack bundle special offer deal') as searchable_text
FROM product_combos pc
WHERE pc.is_active = true;

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_searchable_products_text ON searchable_products USING gin(to_tsvector('english', searchable_text));
CREATE INDEX IF NOT EXISTS idx_searchable_products_name ON searchable_products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_searchable_products_brand ON searchable_products USING gin(to_tsvector('english', brand));
CREATE INDEX IF NOT EXISTS idx_searchable_products_variant ON searchable_products (variant_name) WHERE variant_name IS NOT NULL;

-- ==============================================
-- 6. SECURITY POLICIES
-- ==============================================

-- Enable RLS on new tables
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Public read access for variants (no stock info)
CREATE POLICY "Public read variants" ON product_variants
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

-- Public read access for variant images
CREATE POLICY "Public read variant images" ON variant_images
  FOR SELECT TO authenticated, anon
  USING (true);

-- Public read access for combos
CREATE POLICY "Public read combos" ON product_combos
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

-- Public read access for combo items
CREATE POLICY "Public read combo items" ON combo_items
  FOR SELECT TO authenticated, anon
  USING (true);

-- Public read access for active discounts
CREATE POLICY "Public read active discounts" ON discounts
  FOR SELECT TO authenticated, anon
  USING (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));

-- Admin full access for variants
CREATE POLICY "Admin full access variants" ON product_variants
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'is_admin' = 'true');

-- Admin full access for variant images
CREATE POLICY "Admin full access variant images" ON variant_images
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'is_admin' = 'true');

-- Admin full access for combos
CREATE POLICY "Admin full access combos" ON product_combos
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'is_admin' = 'true');

-- Admin full access for combo items
CREATE POLICY "Admin full access combo items" ON combo_items
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'is_admin' = 'true');

-- Admin full access for discounts
CREATE POLICY "Admin full access discounts" ON discounts
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'is_admin' = 'true');

-- ==============================================
-- 7. HELPER FUNCTIONS
-- ==============================================

-- Function to calculate combo original price
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

-- Function to update combo original price and discount
CREATE OR REPLACE FUNCTION update_combo_pricing()
RETURNS TRIGGER AS $$
DECLARE
  original_price DECIMAL(10,2);
  discount_pct DECIMAL(5,2);
BEGIN
  -- Calculate original price
  original_price := calculate_combo_original_price(NEW.combo_id);
  
  -- Calculate discount percentage
  IF original_price > 0 THEN
    discount_pct := ((original_price - NEW.combo_price) / original_price) * 100;
  ELSE
    discount_pct := 0;
  END IF;
  
  -- Update combo with calculated values
  UPDATE product_combos 
  SET 
    original_price = original_price,
    discount_percentage = discount_pct,
    updated_at = NOW()
  WHERE id = NEW.combo_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update combo pricing
CREATE TRIGGER trigger_update_combo_pricing
  AFTER INSERT OR UPDATE OR DELETE ON combo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_combo_pricing();

-- ==============================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ==============================================

-- Insert sample variants for existing products (if any)
-- This is commented out but can be uncommented for testing
/*
INSERT INTO product_variants (product_id, variant_name, variant_type, sku, price, is_active, sort_order)
SELECT 
  id,
  'Packet',
  'packaging',
  CONCAT(slug, '-packet'),
  price,
  true,
  1
FROM products 
WHERE is_active = true
LIMIT 5;

INSERT INTO product_variants (product_id, variant_name, variant_type, sku, price, is_active, sort_order)
SELECT 
  id,
  'Carton',
  'packaging',
  CONCAT(slug, '-carton'),
  price * 10, -- Assuming carton is 10 packets
  true,
  2
FROM products 
WHERE is_active = true
LIMIT 5;
*/

-- ==============================================
-- 9. COMMENTS AND DOCUMENTATION
-- ==============================================

COMMENT ON TABLE product_variants IS 'Product variants like different packaging sizes (Packet, Carton, etc.)';
COMMENT ON TABLE variant_images IS 'Images specific to each product variant';
COMMENT ON TABLE product_combos IS 'Combo packs/bundles of multiple products';
COMMENT ON TABLE combo_items IS 'Individual products included in combo packs';
COMMENT ON TABLE discounts IS 'Discount system supporting percentage, fixed amount, and cart value discounts';
COMMENT ON MATERIALIZED VIEW searchable_products IS 'Unified search materialized view including products, variants, and combos';

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_searchable_products()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW searchable_products;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-refresh materialized view when products change
CREATE OR REPLACE FUNCTION trigger_refresh_searchable_products()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the materialized view asynchronously
  PERFORM pg_notify('refresh_searchable_products', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh materialized view
CREATE TRIGGER trigger_refresh_searchable_products_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_searchable_products();

CREATE TRIGGER trigger_refresh_searchable_products_variants
  AFTER INSERT OR UPDATE OR DELETE ON product_variants
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_searchable_products();

CREATE TRIGGER trigger_refresh_searchable_products_combos
  AFTER INSERT OR UPDATE OR DELETE ON product_combos
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_searchable_products();

COMMENT ON COLUMN product_variants.variant_type IS 'Type of variant: packaging, color, size, etc.';
COMMENT ON COLUMN product_variants.price IS 'Price for this specific variant';
COMMENT ON COLUMN product_combos.combo_price IS 'Final price for the combo pack';
COMMENT ON COLUMN product_combos.original_price IS 'Sum of individual product prices (auto-calculated)';
COMMENT ON COLUMN discounts.type IS 'Type of discount: percentage, fixed_amount, cart_value';
COMMENT ON COLUMN discounts.applicable_to IS 'What the discount applies to: all, products, combos, variants';

-- ==============================================
-- MIGRATION COMPLETE
-- ==============================================

-- Log migration completion
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('010_bundles_and_variants', NOW())
ON CONFLICT (version) DO NOTHING;
