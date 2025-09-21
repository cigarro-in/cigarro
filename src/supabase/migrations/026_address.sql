-- Comprehensive Address Management System Migration
-- Inspired by premier e-commerce platforms like Amazon, Flipkart

-- =============================================================================
-- 1. ADDRESS TYPES AND ENUMS
-- =============================================================================

-- Address type enum for categorization
CREATE TYPE address_type AS ENUM ('home', 'work', 'other');

-- Address verification status
CREATE TYPE verification_status AS ENUM ('unverified', 'verified', 'invalid');

-- =============================================================================
-- 2. CORE ADDRESS TABLES
-- =============================================================================

-- User addresses table - stores all saved addresses
CREATE TABLE IF NOT EXISTS public.user_addresses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Address identification
    label TEXT NOT NULL DEFAULT 'Address', -- Custom name like "Home", "Office"
    address_type address_type DEFAULT 'other',
    is_default BOOLEAN DEFAULT false,
    
    -- Personal details
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alternate_phone TEXT,
    
    -- Address components
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    landmark TEXT,
    area TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    country TEXT DEFAULT 'India',
    
    -- Geolocation data
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Delivery instructions
    delivery_instructions TEXT,
    
    -- Verification and metadata
    verification_status verification_status DEFAULT 'unverified',
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT unique_default_per_user UNIQUE (user_id, is_default) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT valid_phone CHECK (phone ~ '^[\+]?[1-9][\d]{3,14}$'),
    CONSTRAINT valid_pincode CHECK (pincode ~ '^[0-9]{6}$')
);

-- Pincode master data for validation and auto-fill
CREATE TABLE IF NOT EXISTS public.pincode_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pincode TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    district TEXT,
    state TEXT NOT NULL,
    state_code TEXT,
    country TEXT DEFAULT 'India',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_serviceable BOOLEAN DEFAULT true,
    delivery_days INTEGER DEFAULT 7,
    cod_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery areas configuration
CREATE TABLE IF NOT EXISTS public.delivery_areas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    area_name TEXT NOT NULL,
    pincode_pattern TEXT, -- Regex pattern for pincodes
    city TEXT,
    state TEXT,
    is_active BOOLEAN DEFAULT true,
    delivery_charge DECIMAL(10, 2) DEFAULT 0,
    free_delivery_threshold DECIMAL(10, 2),
    estimated_delivery_days INTEGER DEFAULT 7,
    cod_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- =============================================================================

-- User addresses indexes
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON public.user_addresses(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_user_addresses_pincode ON public.user_addresses(pincode);
CREATE INDEX IF NOT EXISTS idx_user_addresses_last_used ON public.user_addresses(user_id, last_used_at DESC);

-- Pincode data indexes
CREATE INDEX IF NOT EXISTS idx_pincode_data_pincode ON public.pincode_data(pincode);
CREATE INDEX IF NOT EXISTS idx_pincode_data_city_state ON public.pincode_data(city, state);
CREATE INDEX IF NOT EXISTS idx_pincode_data_serviceable ON public.pincode_data(pincode) WHERE is_serviceable = true;

-- Delivery areas indexes
CREATE INDEX IF NOT EXISTS idx_delivery_areas_active ON public.delivery_areas(is_active) WHERE is_active = true;

-- =============================================================================
-- 4. FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to ensure only one default address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this address as default, unset all other defaults for this user
    IF NEW.is_default = true THEN
        UPDATE public.user_addresses 
        SET is_default = false 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    
    -- If this is the user's first address, make it default
    IF NOT EXISTS (
        SELECT 1 FROM public.user_addresses 
        WHERE user_id = NEW.user_id AND id != COALESCE(NEW.id, uuid_generate_v4())
    ) THEN
        NEW.is_default = true;
    END IF;
    
    -- Update last_used_at when address is modified
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update last_used_at when address is used in an order
CREATE OR REPLACE FUNCTION update_address_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Find and update the matching address based on shipping details
    UPDATE public.user_addresses 
    SET last_used_at = NOW()
    WHERE user_id = NEW.user_id 
    AND full_name = NEW.shipping_name
    AND address_line_1 = NEW.shipping_address
    AND pincode = NEW.shipping_zip_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get pincode details
CREATE OR REPLACE FUNCTION get_pincode_details(input_pincode TEXT)
RETURNS TABLE (
    pincode TEXT,
    city TEXT,
    district TEXT,
    state TEXT,
    is_serviceable BOOLEAN,
    delivery_days INTEGER,
    cod_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.pincode,
        p.city,
        p.district,
        p.state,
        p.is_serviceable,
        p.delivery_days,
        p.cod_available
    FROM public.pincode_data p
    WHERE p.pincode = input_pincode;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate delivery charge
CREATE OR REPLACE FUNCTION calculate_delivery_charge(
    input_pincode TEXT,
    order_total DECIMAL DEFAULT 0
)
RETURNS DECIMAL AS $$
DECLARE
    delivery_charge DECIMAL := 0;
    free_threshold DECIMAL;
BEGIN
    -- Get delivery charge from delivery_areas or pincode_data
    SELECT 
        COALESCE(da.delivery_charge, 50) as charge,
        da.free_delivery_threshold
    INTO delivery_charge, free_threshold
    FROM public.pincode_data pd
    LEFT JOIN public.delivery_areas da ON pd.pincode ~ da.pincode_pattern
    WHERE pd.pincode = input_pincode AND pd.is_serviceable = true
    LIMIT 1;
    
    -- Apply free delivery if threshold met
    IF order_total >= COALESCE(free_threshold, 999999) THEN
        delivery_charge := 0;
    END IF;
    
    RETURN COALESCE(delivery_charge, 50); -- Default charge if not found
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- Trigger for default address management
DROP TRIGGER IF EXISTS trigger_ensure_single_default ON public.user_addresses;
CREATE TRIGGER trigger_ensure_single_default
    BEFORE INSERT OR UPDATE ON public.user_addresses
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_address();

-- Trigger to update address usage when orders are placed
DROP TRIGGER IF EXISTS trigger_update_address_usage ON public.orders;
CREATE TRIGGER trigger_update_address_usage
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_address_usage();

-- Updated_at trigger for user_addresses
CREATE TRIGGER update_user_addresses_updated_at
    BEFORE UPDATE ON public.user_addresses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for pincode_data
CREATE TRIGGER update_pincode_data_updated_at
    BEFORE UPDATE ON public.pincode_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincode_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_areas ENABLE ROW LEVEL SECURITY;

-- User addresses policies
CREATE POLICY "Users can view their own addresses" ON public.user_addresses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses" ON public.user_addresses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" ON public.user_addresses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" ON public.user_addresses
    FOR DELETE USING (auth.uid() = user_id);

-- Pincode data policies (read-only for users)
CREATE POLICY "Anyone can read pincode data" ON public.pincode_data
    FOR SELECT USING (true);

-- Delivery areas policies (read-only for users)
CREATE POLICY "Anyone can read delivery areas" ON public.delivery_areas
    FOR SELECT USING (true);

-- Admin policies
CREATE POLICY "Admins can manage pincode data" ON public.pincode_data
    FOR ALL USING (public.is_admin());

CREATE POLICY "Admins can manage delivery areas" ON public.delivery_areas
    FOR ALL USING (public.is_admin());

-- =============================================================================
-- 7. SAMPLE DATA
-- =============================================================================

-- Insert major Indian cities pincode data
INSERT INTO public.pincode_data (pincode, city, district, state, state_code, is_serviceable, delivery_days, cod_available) VALUES
-- Mumbai
('400001', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', true, 2, true),
('400002', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', true, 2, true),
('400020', 'Mumbai', 'Mumbai', 'Maharashtra', 'MH', true, 2, true),
-- Delhi
('110001', 'New Delhi', 'New Delhi', 'Delhi', 'DL', true, 1, true),
('110002', 'New Delhi', 'New Delhi', 'Delhi', 'DL', true, 1, true),
('110020', 'New Delhi', 'New Delhi', 'Delhi', 'DL', true, 1, true),
-- Bangalore
('560001', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', true, 2, true),
('560002', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', true, 2, true),
('560020', 'Bangalore', 'Bangalore Urban', 'Karnataka', 'KA', true, 2, true),
-- Chennai
('600001', 'Chennai', 'Chennai', 'Tamil Nadu', 'TN', true, 3, true),
('600002', 'Chennai', 'Chennai', 'Tamil Nadu', 'TN', true, 3, true),
-- Hyderabad
('500001', 'Hyderabad', 'Hyderabad', 'Telangana', 'TS', true, 3, true),
('500002', 'Hyderabad', 'Hyderabad', 'Telangana', 'TS', true, 3, true)
ON CONFLICT (pincode) DO NOTHING;

-- Insert delivery area configurations
INSERT INTO public.delivery_areas (area_name, pincode_pattern, city, state, delivery_charge, free_delivery_threshold, estimated_delivery_days) VALUES
('Mumbai Metro', '^400[0-9]{3}$', 'Mumbai', 'Maharashtra', 30, 500, 1),
('Delhi NCR', '^11[0-9]{4}$', 'New Delhi', 'Delhi', 25, 500, 1),
('Bangalore Urban', '^560[0-9]{3}$', 'Bangalore', 'Karnataka', 35, 600, 2),
('Chennai Metro', '^600[0-9]{3}$', 'Chennai', 'Tamil Nadu', 40, 600, 2),
('Hyderabad Metro', '^500[0-9]{3}$', 'Hyderabad', 'Telangana', 40, 600, 2),
('Tier 1 Cities', '^(400|110|560|600|500)[0-9]{3}$', NULL, NULL, 50, 750, 3),
('Rest of India', '^[0-9]{6}$', NULL, NULL, 75, 1000, 7)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 8. GRANTS
-- =============================================================================

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;
GRANT SELECT ON public.pincode_data TO authenticated;
GRANT SELECT ON public.delivery_areas TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_pincode_details(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_delivery_charge(TEXT, DECIMAL) TO authenticated;
