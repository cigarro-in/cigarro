-- First drop the view that depends on the district column
DROP VIEW IF EXISTS pincode_lookup;

-- Then remove district column from pincodes table
ALTER TABLE pincodes DROP COLUMN IF EXISTS district;

CREATE OR REPLACE VIEW pincode_lookup AS
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

-- Grant access to the updated view
GRANT SELECT ON pincode_lookup TO anon, authenticated;
