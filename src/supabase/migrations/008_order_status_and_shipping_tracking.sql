-- Migration: Order Status Management and Shipping Tracking
-- Version: 0014
-- Description: Updates order status flow and adds comprehensive shipping tracking

-- =============================================================================
-- 1. UPDATE ORDER STATUS ENUM (MUST BE COMMITTED FIRST)
-- =============================================================================

-- Add 'placed' status to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'placed';

-- =============================================================================
-- 2. ADD SHIPPING TRACKING COLUMNS
-- =============================================================================

-- Add comprehensive shipping tracking fields
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_company TEXT,
ADD COLUMN IF NOT EXISTS tracking_id TEXT,
ADD COLUMN IF NOT EXISTS tracking_link TEXT,
ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'Standard',
ADD COLUMN IF NOT EXISTS shipping_notes TEXT,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shipped_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.orders.shipping_company IS 'Name of the shipping company (e.g., Blue Dart, DTDC, FedEx)';
COMMENT ON COLUMN public.orders.tracking_id IS 'Unique tracking ID provided by shipping company';
COMMENT ON COLUMN public.orders.tracking_link IS 'Direct link to track the shipment';
COMMENT ON COLUMN public.orders.shipping_method IS 'Shipping method used (Standard, Express, Overnight)';
COMMENT ON COLUMN public.orders.shipping_notes IS 'Additional notes about shipping';
COMMENT ON COLUMN public.orders.shipped_at IS 'Timestamp when order was shipped';
COMMENT ON COLUMN public.orders.shipped_by IS 'Admin user who marked order as shipped';
COMMENT ON COLUMN public.orders.delivered_at IS 'Timestamp when order was delivered';
COMMENT ON COLUMN public.orders.delivered_by IS 'Admin user who marked order as delivered';
COMMENT ON COLUMN public.orders.delivery_notes IS 'Notes about delivery';
COMMENT ON COLUMN public.orders.delivery_proof_url IS 'URL to delivery proof (photo, signature, etc.)';

-- =============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Create indexes for shipping tracking queries
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON public.orders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_company ON public.orders(shipping_company);
CREATE INDEX IF NOT EXISTS idx_orders_status_shipped ON public.orders(status, shipped_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_delivered ON public.orders(status, delivered_at);
CREATE INDEX IF NOT EXISTS idx_orders_shipped_by ON public.orders(shipped_by);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_by ON public.orders(delivered_by);

-- =============================================================================
-- 4. CREATE HELPER FUNCTIONS
-- =============================================================================

-- Function to update order status with automatic timestamp updates
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

-- =============================================================================
-- 5. CREATE TRIGGER FOR AUTOMATIC STATUS UPDATES
-- =============================================================================

-- Function to automatically update status based on payment verification
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

-- Create trigger for automatic status updates
DROP TRIGGER IF EXISTS trigger_auto_update_order_status ON public.orders;
CREATE TRIGGER trigger_auto_update_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

-- =============================================================================
-- 6. CREATE VIEW FOR ORDER TRACKING
-- =============================================================================

-- Create a comprehensive view for order tracking
CREATE OR REPLACE VIEW public.order_tracking_view AS
SELECT 
  o.id,
  o.display_order_id,
  o.user_id,
  o.status,
  o.payment_verified,
  o.payment_confirmed,
  o.shipping_company,
  o.tracking_id,
  o.tracking_link,
  o.shipping_method,
  o.shipping_notes,
  o.shipped_at,
  o.delivered_at,
  o.delivery_notes,
  o.delivery_proof_url,
  o.created_at,
  o.updated_at,
  -- Customer info
  p.name as customer_name,
  p.email as customer_email,
  -- Shipping info
  o.shipping_name,
  o.shipping_address,
  o.shipping_city,
  o.shipping_state,
  o.shipping_zip_code,
  o.shipping_country,
  o.shipping_phone,
  -- Admin info
  shipped_admin.name as shipped_by_name,
  delivered_admin.name as delivered_by_name,
  verified_admin.name as verified_by_name
FROM public.orders o
LEFT JOIN public.profiles p ON o.user_id = p.id
LEFT JOIN public.profiles shipped_admin ON o.shipped_by = shipped_admin.id
LEFT JOIN public.profiles delivered_admin ON o.delivered_by = delivered_admin.id
LEFT JOIN public.profiles verified_admin ON o.payment_verified_by = verified_admin.id;

-- Grant access to the view
GRANT SELECT ON public.order_tracking_view TO authenticated;

-- =============================================================================
-- 7. CREATE RLS POLICIES FOR SHIPPING TRACKING
-- =============================================================================

-- Enable RLS on orders table if not already enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own orders
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for admins to view all orders
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (public.is_admin());

-- Policy for admins to update orders
CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE USING (public.is_admin());

-- Policy for users to insert their own orders
CREATE POLICY "Users can insert their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 8. SAMPLE DATA FOR TESTING (Optional)
-- =============================================================================

-- Insert sample shipping companies for reference
-- This can be used in the admin interface for dropdowns
CREATE TABLE IF NOT EXISTS public.shipping_companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  website TEXT,
  tracking_url_template TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common Indian shipping companies
INSERT INTO public.shipping_companies (name, website, tracking_url_template) VALUES
('Blue Dart', 'https://www.bluedart.com', 'https://www.bluedart.com/tracking?trackingNumber={tracking_id}'),
('DTDC', 'https://www.dtdc.com', 'https://www.dtdc.com/tracking?trackingNumber={tracking_id}'),
('FedEx', 'https://www.fedex.com', 'https://www.fedex.com/fedextrack/?trknbr={tracking_id}'),
('DHL', 'https://www.dhl.com', 'https://www.dhl.com/in-en/home/tracking.html?trackingNumber={tracking_id}'),
('India Post', 'https://www.indiapost.gov.in', 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?trackingNumber={tracking_id}'),
('Delhivery', 'https://www.delhivery.com', 'https://www.delhivery.com/track/package/{tracking_id}'),
('Ecom Express', 'https://www.ecomexpress.in', 'https://www.ecomexpress.in/tracking?trackingNumber={tracking_id}')
ON CONFLICT (name) DO NOTHING;

-- Grant access to shipping companies table
GRANT SELECT ON public.shipping_companies TO authenticated;
GRANT ALL ON public.shipping_companies TO service_role;
