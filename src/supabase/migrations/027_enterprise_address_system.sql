-- Enterprise Address Management System
-- Cleans up old tables and creates a comprehensive, self-sufficient address system
-- No third-party lookups required - all serviceable PIN codes in database

-- =============================================================================
-- 1. CLEANUP - Remove old address tables and conflicts
-- =============================================================================

-- Drop old tables from migration 026 and previous migrations
DROP TABLE IF EXISTS public.user_addresses CASCADE;
DROP TABLE IF EXISTS public.pincode_data CASCADE;
DROP TABLE IF EXISTS public.delivery_areas CASCADE;
DROP TABLE IF EXISTS public.addresses CASCADE;
DROP TABLE IF EXISTS public.postal_codes CASCADE;
DROP TABLE IF EXISTS public.delivery_zones CASCADE;
DROP VIEW IF EXISTS public.saved_addresses CASCADE;
DROP VIEW IF EXISTS public.pincode_lookup CASCADE;
DROP TABLE IF EXISTS public.pincodes CASCADE;

-- Drop old types and functions
DROP TYPE IF EXISTS address_type CASCADE;
DROP TYPE IF EXISTS verification_status CASCADE;
DROP TYPE IF EXISTS address_category CASCADE;
DROP TYPE IF EXISTS address_verification CASCADE;
DROP TYPE IF EXISTS zone_type CASCADE;
DROP TYPE IF EXISTS service_type CASCADE;
DROP FUNCTION IF EXISTS ensure_single_default_address() CASCADE;
DROP FUNCTION IF EXISTS update_address_usage() CASCADE;
DROP FUNCTION IF EXISTS get_pincode_details(TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_delivery_charge(TEXT, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS ensure_single_primary_address() CASCADE;
DROP FUNCTION IF EXISTS get_postal_code_info(TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_shipping_cost(TEXT, DECIMAL, TEXT) CASCADE;
DROP FUNCTION IF EXISTS track_address_usage() CASCADE;

-- =============================================================================
-- 2. CORE TYPES AND ENUMS
-- =============================================================================

-- Address types for classification
CREATE TYPE address_category AS ENUM ('home', 'work', 'other', 'pickup_point');

-- Address verification status
CREATE TYPE address_verification AS ENUM ('unverified', 'verified', 'invalid', 'needs_review');

-- Delivery zone types
CREATE TYPE zone_type AS ENUM ('metro', 'tier1', 'tier2', 'rural', 'remote');

-- Service types available
CREATE TYPE service_type AS ENUM ('standard', 'express', 'same_day', 'overnight');

-- =============================================================================
-- 3. MASTER ADDRESS TABLE - Single Source of Truth
-- =============================================================================

CREATE TABLE public.addresses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Address Classification
    category address_category DEFAULT 'home',
    label TEXT NOT NULL DEFAULT 'Address',
    is_primary BOOLEAN DEFAULT false,
    
    -- Personal Details
    recipient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alternate_phone TEXT,
    
    -- Structured Address Components
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    landmark TEXT,
    area TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT DEFAULT 'India',
    
    -- Geolocation (for precise delivery)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Delivery Preferences
    delivery_instructions TEXT,
    preferred_delivery_time TEXT, -- 'morning', 'afternoon', 'evening', 'anytime'
    
    -- Quality and Usage Tracking
    address_quality_score INTEGER DEFAULT 50 CHECK (address_quality_score >= 0 AND address_quality_score <= 100),
    verification_status address_verification DEFAULT 'unverified',
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_phone CHECK (phone ~ '^[\+]?[1-9][\d]{3,14}$'),
    CONSTRAINT valid_postal_code CHECK (postal_code ~ '^[0-9]{6}$'),
    CONSTRAINT unique_primary_per_user UNIQUE (user_id, is_primary) DEFERRABLE INITIALLY DEFERRED
);

-- =============================================================================
-- 4. COMPREHENSIVE POSTAL CODE SYSTEM
-- =============================================================================

CREATE TABLE public.postal_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    postal_code TEXT NOT NULL UNIQUE,
    
    -- Location Hierarchy
    area TEXT,
    city TEXT NOT NULL,
    district TEXT,
    state TEXT NOT NULL,
    state_code TEXT,
    region TEXT, -- North, South, East, West, Northeast, Central
    country TEXT DEFAULT 'India',
    
    -- Geolocation
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Serviceability
    is_serviceable BOOLEAN DEFAULT true,
    zone_type zone_type DEFAULT 'tier2',
    
    -- Delivery Configuration
    standard_delivery_days INTEGER DEFAULT 7,
    express_delivery_days INTEGER DEFAULT 3,
    same_day_available BOOLEAN DEFAULT false,
    overnight_available BOOLEAN DEFAULT false,
    
    -- Service Availability
    cod_available BOOLEAN DEFAULT true,
    return_pickup_available BOOLEAN DEFAULT true,
    installation_available BOOLEAN DEFAULT false,
    
    -- Pricing
    base_shipping_cost DECIMAL(10, 2) DEFAULT 50.00,
    express_shipping_cost DECIMAL(10, 2) DEFAULT 100.00,
    free_shipping_threshold DECIMAL(10, 2) DEFAULT 500.00,
    
    -- Operational
    delivery_hub TEXT, -- Nearest delivery hub
    sort_code TEXT, -- Internal sorting code
    restrictions JSONB, -- Product restrictions, weight limits, etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 5. DELIVERY ZONES CONFIGURATION
-- =============================================================================

CREATE TABLE public.delivery_zones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    zone_name TEXT NOT NULL UNIQUE,
    zone_type zone_type NOT NULL,
    
    -- Zone Definition
    postal_code_pattern TEXT, -- Regex pattern for postal codes
    state_codes TEXT[], -- Array of state codes
    city_names TEXT[], -- Array of city names
    
    -- Pricing Rules
    base_rate DECIMAL(10, 2) DEFAULT 50.00,
    per_kg_rate DECIMAL(10, 2) DEFAULT 10.00,
    fuel_surcharge_percent DECIMAL(5, 2) DEFAULT 0.00,
    peak_season_multiplier DECIMAL(3, 2) DEFAULT 1.00,
    
    -- Service Configuration
    standard_delivery_days INTEGER DEFAULT 7,
    express_delivery_days INTEGER DEFAULT 3,
    same_day_cutoff_time TIME DEFAULT '14:00:00',
    
    -- Service Availability
    services_available service_type[] DEFAULT ARRAY['standard']::service_type[],
    cod_available BOOLEAN DEFAULT true,
    return_pickup_available BOOLEAN DEFAULT true,
    
    -- Operational
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 6. PERFORMANCE INDEXES
-- =============================================================================

-- Addresses indexes
CREATE INDEX idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX idx_addresses_primary ON public.addresses(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_addresses_postal_code ON public.addresses(postal_code);
CREATE INDEX idx_addresses_last_used ON public.addresses(user_id, last_used_at DESC);
CREATE INDEX idx_addresses_category ON public.addresses(user_id, category);

-- Postal codes indexes
CREATE INDEX idx_postal_codes_code ON public.postal_codes(postal_code);
CREATE INDEX idx_postal_codes_city_state ON public.postal_codes(city, state);
CREATE INDEX idx_postal_codes_serviceable ON public.postal_codes(postal_code) WHERE is_serviceable = true;
CREATE INDEX idx_postal_codes_zone ON public.postal_codes(zone_type);
CREATE INDEX idx_postal_codes_region ON public.postal_codes(region);

-- Delivery zones indexes
CREATE INDEX idx_delivery_zones_active ON public.delivery_zones(is_active) WHERE is_active = true;
CREATE INDEX idx_delivery_zones_type ON public.delivery_zones(zone_type);

-- =============================================================================
-- 7. SMART FUNCTIONS
-- =============================================================================

-- Function to ensure only one primary address per user
CREATE OR REPLACE FUNCTION ensure_single_primary_address()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this address as primary, unset all other primaries for this user
    IF NEW.is_primary = true THEN
        UPDATE public.addresses 
        SET is_primary = false 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    
    -- If this is the user's first address, make it primary
    IF NOT EXISTS (
        SELECT 1 FROM public.addresses 
        WHERE user_id = NEW.user_id AND id != COALESCE(NEW.id, uuid_generate_v4())
    ) THEN
        NEW.is_primary = true;
    END IF;
    
    -- Update timestamp and usage tracking
    NEW.updated_at = NOW();
    IF TG_OP = 'UPDATE' AND OLD.last_used_at IS DISTINCT FROM NEW.last_used_at THEN
        NEW.usage_count = COALESCE(OLD.usage_count, 0) + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get postal code details with delivery info
CREATE OR REPLACE FUNCTION get_postal_code_info(input_postal_code TEXT)
RETURNS TABLE (
    postal_code TEXT,
    city TEXT,
    state TEXT,
    zone_type zone_type,
    is_serviceable BOOLEAN,
    standard_delivery_days INTEGER,
    express_delivery_days INTEGER,
    base_shipping_cost DECIMAL,
    free_shipping_threshold DECIMAL,
    cod_available BOOLEAN,
    same_day_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.postal_code,
        pc.city,
        pc.state,
        pc.zone_type,
        pc.is_serviceable,
        pc.standard_delivery_days,
        pc.express_delivery_days,
        pc.base_shipping_cost,
        pc.free_shipping_threshold,
        pc.cod_available,
        pc.same_day_available
    FROM public.postal_codes pc
    WHERE pc.postal_code = input_postal_code AND pc.is_serviceable = true;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate shipping cost
CREATE OR REPLACE FUNCTION calculate_shipping_cost(
    input_postal_code TEXT,
    order_total DECIMAL DEFAULT 0,
    service_type TEXT DEFAULT 'standard'
)
RETURNS DECIMAL AS $$
DECLARE
    shipping_cost DECIMAL := 0;
    free_threshold DECIMAL;
    zone_info RECORD;
BEGIN
    -- Get postal code and zone information
    SELECT 
        pc.base_shipping_cost,
        pc.express_shipping_cost,
        pc.free_shipping_threshold,
        pc.zone_type,
        dz.base_rate,
        dz.fuel_surcharge_percent,
        dz.peak_season_multiplier
    INTO zone_info
    FROM public.postal_codes pc
    LEFT JOIN public.delivery_zones dz ON pc.zone_type = dz.zone_type
    WHERE pc.postal_code = input_postal_code AND pc.is_serviceable = true
    LIMIT 1;
    
    -- Calculate base shipping cost
    IF service_type = 'express' THEN
        shipping_cost := COALESCE(zone_info.express_shipping_cost, zone_info.base_rate * 1.5, 75);
    ELSE
        shipping_cost := COALESCE(zone_info.base_shipping_cost, zone_info.base_rate, 50);
    END IF;
    
    -- Apply surcharges
    IF zone_info.fuel_surcharge_percent > 0 THEN
        shipping_cost := shipping_cost * (1 + zone_info.fuel_surcharge_percent / 100);
    END IF;
    
    -- Apply seasonal multiplier
    shipping_cost := shipping_cost * COALESCE(zone_info.peak_season_multiplier, 1.0);
    
    -- Apply free shipping if threshold met
    free_threshold := COALESCE(zone_info.free_shipping_threshold, 500);
    IF order_total >= free_threshold THEN
        shipping_cost := 0;
    END IF;
    
    RETURN ROUND(shipping_cost, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update address usage when used in orders
CREATE OR REPLACE FUNCTION track_address_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update usage statistics for the address used in the order
    UPDATE public.addresses 
    SET 
        last_used_at = NOW(),
        usage_count = usage_count + 1
    WHERE user_id = NEW.user_id 
    AND recipient_name = NEW.shipping_name
    AND address_line_1 = NEW.shipping_address
    AND postal_code = NEW.shipping_zip_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. TRIGGERS
-- =============================================================================

-- Trigger for primary address management
DROP TRIGGER IF EXISTS trigger_ensure_single_primary ON public.addresses;
CREATE TRIGGER trigger_ensure_single_primary
    BEFORE INSERT OR UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_address();

-- Trigger to track address usage in orders
DROP TRIGGER IF EXISTS trigger_track_address_usage ON public.orders;
CREATE TRIGGER trigger_track_address_usage
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION track_address_usage();

-- Updated_at triggers
CREATE TRIGGER update_addresses_updated_at
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_postal_codes_updated_at
    BEFORE UPDATE ON public.postal_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_zones_updated_at
    BEFORE UPDATE ON public.delivery_zones
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 9. COMPATIBILITY VIEWS - Make existing code work
-- =============================================================================

-- Create saved_addresses view for CheckoutPage.tsx compatibility
CREATE OR REPLACE VIEW public.saved_addresses AS
SELECT 
    id,
    user_id,
    label,
    recipient_name as full_name,
    phone,
    address_line_1 as address,
    address_line_1 as user_provided_address, -- For compatibility
    city,
    state,
    postal_code as pincode,
    country,
    latitude,
    longitude,
    is_primary as is_default,
    created_at,
    updated_at
FROM public.addresses;

-- Create INSTEAD OF trigger to handle INSERTs to the view
CREATE OR REPLACE FUNCTION handle_saved_addresses_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.addresses (
        user_id,
        label,
        recipient_name,
        phone,
        address_line_1,
        city,
        state,
        postal_code,
        country,
        latitude,
        longitude,
        is_primary
    ) VALUES (
        NEW.user_id,
        NEW.label,
        NEW.full_name,
        NEW.phone,
        NEW.address,
        NEW.city,
        NEW.state,
        NEW.pincode,
        NEW.country,
        NEW.latitude,
        NEW.longitude,
        NEW.is_default
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saved_addresses_insert_trigger
    INSTEAD OF INSERT ON public.saved_addresses
    FOR EACH ROW
    EXECUTE FUNCTION handle_saved_addresses_insert();

-- Create pincode_lookup view for CheckoutPage.tsx compatibility
CREATE OR REPLACE VIEW public.pincode_lookup AS
SELECT 
    postal_code as pincode,
    city,
    state,
    country,
    is_serviceable as is_servicable, -- Note: keeping the typo for compatibility
    CASE 
        WHEN same_day_available THEN 'same_day'
        WHEN express_delivery_days <= 2 THEN 'express'
        ELSE 'standard'
    END as shipping_method,
    standard_delivery_days as delivery_time_days,
    base_shipping_cost as shipping_cost,
    CASE 
        WHEN same_day_available THEN 'Same Day Delivery'
        WHEN express_delivery_days <= 2 THEN 'Express Delivery (1-2 days)'
        ELSE 'Standard Shipping (5-7 days)'
    END as shipping_description
FROM public.postal_codes
WHERE is_serviceable = true;

-- =============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postal_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Address policies
CREATE POLICY "Users can view their own addresses" ON public.addresses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses" ON public.addresses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" ON public.addresses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" ON public.addresses
    FOR DELETE USING (auth.uid() = user_id);

-- Postal codes policies (read-only for users)
CREATE POLICY "Anyone can read postal codes" ON public.postal_codes
    FOR SELECT USING (true);

-- Delivery zones policies (read-only for users)
CREATE POLICY "Anyone can read delivery zones" ON public.delivery_zones
    FOR SELECT USING (true);

-- Admin policies
CREATE POLICY "Admins can manage postal codes" ON public.postal_codes
    FOR ALL USING (public.is_admin());

CREATE POLICY "Admins can manage delivery zones" ON public.delivery_zones
    FOR ALL USING (public.is_admin());

-- =============================================================================
-- 11. GRANTS
-- =============================================================================

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT ON public.postal_codes TO authenticated;
GRANT SELECT ON public.delivery_zones TO authenticated;
GRANT SELECT ON public.saved_addresses TO authenticated;
GRANT SELECT ON public.pincode_lookup TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_postal_code_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_shipping_cost(TEXT, DECIMAL, TEXT) TO authenticated;

-- =============================================================================
-- 12. SAMPLE DATA - Major Indian Cities and Zones
-- =============================================================================

-- Insert delivery zones
INSERT INTO public.delivery_zones (zone_name, zone_type, postal_code_pattern, base_rate, standard_delivery_days, express_delivery_days, services_available) VALUES
('Mumbai Metro', 'metro', '^400[0-9]{3}$', 30.00, 1, 1, ARRAY['standard', 'express', 'same_day']::service_type[]),
('Delhi NCR', 'metro', '^11[0-9]{4}$', 25.00, 1, 1, ARRAY['standard', 'express', 'same_day']::service_type[]),
('Bangalore Metro', 'metro', '^560[0-9]{3}$', 35.00, 2, 1, ARRAY['standard', 'express', 'same_day']::service_type[]),
('Chennai Metro', 'metro', '^600[0-9]{3}$', 40.00, 2, 1, ARRAY['standard', 'express']::service_type[]),
('Hyderabad Metro', 'metro', '^500[0-9]{3}$', 40.00, 2, 1, ARRAY['standard', 'express']::service_type[]),
('Pune Metro', 'tier1', '^411[0-9]{3}$', 45.00, 3, 2, ARRAY['standard', 'express']::service_type[]),
('Kolkata Metro', 'tier1', '^700[0-9]{3}$', 45.00, 3, 2, ARRAY['standard', 'express']::service_type[]),
('Tier 1 Cities', 'tier1', '^(380|382|395|462|482|492|533|641|682|695)[0-9]{3}$', 50.00, 4, 3, ARRAY['standard', 'express']::service_type[]),
('Tier 2 Cities', 'tier2', NULL, 60.00, 5, 4, ARRAY['standard']::service_type[]),
('Rural Areas', 'rural', NULL, 75.00, 7, 5, ARRAY['standard']::service_type[])
ON CONFLICT (zone_name) DO NOTHING;

-- Insert major city postal codes
INSERT INTO public.postal_codes (postal_code, area, city, district, state, state_code, region, zone_type, standard_delivery_days, express_delivery_days, same_day_available, base_shipping_cost, free_shipping_threshold) VALUES
-- Mumbai
('400001', 'Fort', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', 'West', 'metro', 1, 1, true, 30.00, 500.00),
('400002', 'Kalbadevi', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', 'West', 'metro', 1, 1, true, 30.00, 500.00),
('400020', 'Churchgate', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', 'West', 'metro', 1, 1, true, 30.00, 500.00),
('400050', 'Bandra West', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', 'West', 'metro', 1, 1, true, 30.00, 500.00),
('400070', 'Andheri West', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', 'West', 'metro', 1, 1, true, 30.00, 500.00),

-- Delhi
('110001', 'Connaught Place', 'New Delhi', 'New Delhi', 'Delhi', 'DL', 'North', 'metro', 1, 1, true, 25.00, 500.00),
('110002', 'Darya Ganj', 'New Delhi', 'New Delhi', 'Delhi', 'DL', 'North', 'metro', 1, 1, true, 25.00, 500.00),
('110020', 'Rajouri Garden', 'New Delhi', 'West Delhi', 'Delhi', 'DL', 'North', 'metro', 1, 1, true, 25.00, 500.00),
('110030', 'Tilak Nagar', 'New Delhi', 'West Delhi', 'Delhi', 'DL', 'North', 'metro', 1, 1, true, 25.00, 500.00),
('110040', 'Lajpat Nagar', 'New Delhi', 'South Delhi', 'Delhi', 'DL', 'North', 'metro', 1, 1, true, 25.00, 500.00),

-- Bangalore
('560001', 'Bangalore GPO', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', 'South', 'metro', 2, 1, true, 35.00, 600.00),
('560002', 'Bangalore City', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', 'South', 'metro', 2, 1, true, 35.00, 600.00),
('560020', 'Rajajinagar', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', 'South', 'metro', 2, 1, true, 35.00, 600.00),
('560050', 'Rajajinagar', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', 'South', 'metro', 2, 1, true, 35.00, 600.00),
('560070', 'Rajajinagar', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', 'South', 'metro', 2, 1, true, 35.00, 600.00),

-- Chennai
('600001', 'Chennai GPO', 'Chennai', 'Chennai', 'Tamil Nadu', 'TN', 'South', 'metro', 2, 1, false, 40.00, 600.00),
('600002', 'Chennai Fort', 'Chennai', 'Chennai', 'Tamil Nadu', 'TN', 'South', 'metro', 2, 1, false, 40.00, 600.00),
('600020', 'T. Nagar', 'Chennai', 'Chennai', 'Tamil Nadu', 'TN', 'South', 'metro', 2, 1, false, 40.00, 600.00),

-- Hyderabad
('500001', 'Hyderabad GPO', 'Hyderabad', 'Hyderabad', 'Telangana', 'TS', 'South', 'metro', 2, 1, false, 40.00, 600.00),
('500002', 'Koti', 'Hyderabad', 'Hyderabad', 'Telangana', 'TS', 'South', 'metro', 2, 1, false, 40.00, 600.00),
('500020', 'Jubilee Hills', 'Hyderabad', 'Hyderabad', 'Telangana', 'TS', 'South', 'metro', 2, 1, false, 40.00, 600.00),

-- Pune
('411001', 'Pune GPO', 'Pune', 'Pune', 'Maharashtra', 'MH', 'West', 'tier1', 3, 2, false, 45.00, 750.00),
('411002', 'Pune Cantonment', 'Pune', 'Pune', 'Maharashtra', 'MH', 'West', 'tier1', 3, 2, false, 45.00, 750.00),

-- Kolkata
('700001', 'Kolkata GPO', 'Kolkata', 'Kolkata', 'West Bengal', 'WB', 'East', 'tier1', 3, 2, false, 45.00, 750.00),
('700020', 'Entally', 'Kolkata', 'Kolkata', 'West Bengal', 'WB', 'East', 'tier1', 3, 2, false, 45.00, 750.00)

ON CONFLICT (postal_code) DO NOTHING;

-- =============================================================================
-- 13. COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.addresses IS 'Master address table - single source of truth for all user addresses';
COMMENT ON TABLE public.postal_codes IS 'Comprehensive postal code database with delivery and pricing information';
COMMENT ON TABLE public.delivery_zones IS 'Delivery zone configuration for pricing and service rules';
COMMENT ON VIEW public.saved_addresses IS 'Compatibility view for existing CheckoutPage.tsx code';
COMMENT ON VIEW public.pincode_lookup IS 'Compatibility view for existing postal code lookups';
COMMENT ON FUNCTION get_postal_code_info(TEXT) IS 'Get comprehensive postal code information including delivery options';
COMMENT ON FUNCTION calculate_shipping_cost(TEXT, DECIMAL, TEXT) IS 'Calculate shipping cost based on postal code, order value, and service type';
