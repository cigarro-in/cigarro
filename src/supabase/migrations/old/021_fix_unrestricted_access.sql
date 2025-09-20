-- Migration: Fix Unrestricted Access to Views and Tables
-- Version: 0021
-- Description: Add proper RLS policies to order_tracking_view, searchable_products, and shipping_companies

-- 1. FIX ORDER TRACKING VIEW SECURITY
-- Remove ALL access to the view (it's completely unrestricted)
REVOKE ALL ON public.order_tracking_view FROM authenticated;
REVOKE ALL ON public.order_tracking_view FROM anon;
REVOKE ALL ON public.order_tracking_view FROM public;

-- IMPORTANT: Views and materialized views do NOT inherit RLS policies automatically
-- The view is now completely inaccessible - users must use secure functions

-- 2. FIX SEARCHABLE PRODUCTS MATERIALIZED VIEW SECURITY
-- Remove ALL access to the materialized view (it's completely unrestricted)
REVOKE ALL ON public.searchable_products FROM authenticated;
REVOKE ALL ON public.searchable_products FROM anon;
REVOKE ALL ON public.searchable_products FROM public;

-- Materialized views don't support RLS directly, so we need to create a secure wrapper
-- The materialized view is now completely inaccessible - users must use secure functions

-- Create a secure function to access searchable products
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
  -- Only allow access to active products (same as products table RLS)
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

-- Grant access to the secure function instead of the materialized view
-- Allow both authenticated and anonymous users to search products
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO anon;

-- 3. FIX SHIPPING COMPANIES TABLE SECURITY
-- Enable RLS on shipping companies table
ALTER TABLE public.shipping_companies ENABLE ROW LEVEL SECURITY;

-- Remove unrestricted access
REVOKE SELECT ON public.shipping_companies FROM authenticated;

-- Create RLS policy for shipping companies
-- Allow authenticated users to read shipping companies (needed for order tracking)
CREATE POLICY "Authenticated users can view shipping companies" 
ON public.shipping_companies FOR SELECT 
TO authenticated
USING (true);

-- Only admins can manage shipping companies
CREATE POLICY "Admins can manage shipping companies" 
ON public.shipping_companies FOR ALL 
TO authenticated
USING (public.is_admin());

-- 4. ADDITIONAL SECURITY: Create secure order tracking function
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
  -- Users can only see their own orders
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

-- Grant access to the secure order tracking function
GRANT EXECUTE ON FUNCTION public.get_user_order_tracking(UUID) TO authenticated;

-- 5. ADMIN FUNCTION FOR VIEWING ALL ORDERS
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
  -- Only admins can access this function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
  
  RETURN QUERY
  SELECT * FROM public.order_tracking_view;
END;
$$;

-- Grant access to admin function
GRANT EXECUTE ON FUNCTION public.get_all_orders_for_admin() TO authenticated;

-- 6. UPDATE SEARCH UTILITY TO USE SECURE FUNCTION
-- This will be handled in the application code by updating the search functions
-- to use get_searchable_products() instead of direct access to searchable_products

COMMENT ON FUNCTION public.get_searchable_products(TEXT) IS 'Secure function to access searchable products with proper access controls';
COMMENT ON FUNCTION public.get_user_order_tracking(UUID) IS 'Secure function for users to access their own order tracking data';
COMMENT ON FUNCTION public.get_all_orders_for_admin() IS 'Admin-only function to access all order tracking data';

-- SECURITY NOTE: The original views and materialized views are now completely inaccessible
-- All access must go through the secure functions above which enforce proper RLS policies
-- This prevents any direct access to unrestricted data
