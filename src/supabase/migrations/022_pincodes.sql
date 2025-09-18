-- Create pincodes table for storing all postal codes with location and shipping data
CREATE TABLE IF NOT EXISTS pincodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pincode VARCHAR(6) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    district VARCHAR(100),
    region VARCHAR(100),
    is_servicable BOOLEAN NOT NULL DEFAULT true,
    shipping_method VARCHAR(50) NOT NULL DEFAULT 'standard',
    delivery_time_days INTEGER DEFAULT 5,
    shipping_cost DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pincodes_pincode ON pincodes(pincode);
CREATE INDEX IF NOT EXISTS idx_pincodes_city ON pincodes(city);
CREATE INDEX IF NOT EXISTS idx_pincodes_state ON pincodes(state);
CREATE INDEX IF NOT EXISTS idx_pincodes_servicable ON pincodes(is_servicable);
CREATE INDEX IF NOT EXISTS idx_pincodes_shipping_method ON pincodes(shipping_method);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_pincodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_pincodes_updated_at
    BEFORE UPDATE ON pincodes
    FOR EACH ROW
    EXECUTE FUNCTION update_pincodes_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE pincodes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to pincodes (needed for checkout)
CREATE POLICY "Allow public read access to pincodes" ON pincodes
    FOR SELECT USING (true);

-- Allow authenticated users to update pincodes (for admin)
CREATE POLICY "Allow authenticated users to update pincodes" ON pincodes
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert pincodes (for admin)
CREATE POLICY "Allow authenticated users to insert pincodes" ON pincodes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add some sample data for testing (major Indian cities)
INSERT INTO pincodes (pincode, city, state, country, district, region, is_servicable, shipping_method, delivery_time_days, shipping_cost) VALUES
('110001', 'New Delhi', 'Delhi', 'India', 'Central Delhi', 'North', true, 'standard', 3, 0.00),
('110002', 'New Delhi', 'Delhi', 'India', 'Central Delhi', 'North', true, 'standard', 3, 0.00),
('400001', 'Mumbai', 'Maharashtra', 'India', 'Mumbai City', 'West', true, 'standard', 4, 0.00),
('400002', 'Mumbai', 'Maharashtra', 'India', 'Mumbai City', 'West', true, 'standard', 4, 0.00),
('560001', 'Bangalore', 'Karnataka', 'India', 'Bangalore Urban', 'South', true, 'standard', 5, 0.00),
('560002', 'Bangalore', 'Karnataka', 'India', 'Bangalore Urban', 'South', true, 'standard', 5, 0.00),
('600001', 'Chennai', 'Tamil Nadu', 'India', 'Chennai', 'South', true, 'standard', 5, 0.00),
('600002', 'Chennai', 'Tamil Nadu', 'India', 'Chennai', 'South', true, 'standard', 5, 0.00),
('700001', 'Kolkata', 'West Bengal', 'India', 'Kolkata', 'East', true, 'standard', 6, 0.00),
('700002', 'Kolkata', 'West Bengal', 'India', 'Kolkata', 'East', true, 'standard', 6, 0.00),
('380001', 'Ahmedabad', 'Gujarat', 'India', 'Ahmedabad', 'West', true, 'standard', 4, 0.00),
('380002', 'Ahmedabad', 'Gujarat', 'India', 'Ahmedabad', 'West', true, 'standard', 4, 0.00),
('302001', 'Jaipur', 'Rajasthan', 'India', 'Jaipur', 'North', true, 'standard', 5, 0.00),
('302002', 'Jaipur', 'Rajasthan', 'India', 'Jaipur', 'North', true, 'standard', 5, 0.00),
('226001', 'Lucknow', 'Uttar Pradesh', 'India', 'Lucknow', 'North', true, 'standard', 6, 0.00),
('226002', 'Lucknow', 'Uttar Pradesh', 'India', 'Lucknow', 'North', true, 'standard', 6, 0.00),
('110003', 'New Delhi', 'Delhi', 'India', 'New Delhi', 'North', true, 'express', 2, 150.00),
('400003', 'Mumbai', 'Maharashtra', 'India', 'Mumbai Suburban', 'West', true, 'express', 2, 150.00),
('560003', 'Bangalore', 'Karnataka', 'India', 'Bangalore Urban', 'South', true, 'express', 2, 150.00),
('600003', 'Chennai', 'Tamil Nadu', 'India', 'Chennai', 'South', true, 'express', 2, 150.00)
ON CONFLICT (pincode) DO NOTHING;

-- Create a view for easy pincode lookup
CREATE OR REPLACE VIEW pincode_lookup AS
SELECT 
    pincode,
    city,
    state,
    country,
    district,
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

-- Grant access to the view
GRANT SELECT ON pincode_lookup TO anon, authenticated;
