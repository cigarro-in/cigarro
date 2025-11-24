-- Migration: 057_grant_create_order_permissions.sql
-- Description: Grants execute permissions on create_order to authenticated users
-- Date: 2025-11-24

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, JSONB, TEXT, TEXT, DECIMAL, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, JSONB, TEXT, TEXT, DECIMAL, UUID) TO service_role;

-- Ensure discounts table is readable by authenticated users (needed for coupons)
GRANT SELECT ON public.discounts TO authenticated;
GRANT SELECT ON public.discounts TO service_role;

-- Ensure products and variants are readable
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.product_variants TO authenticated;
GRANT SELECT ON public.product_combos TO authenticated;
GRANT SELECT ON public.variant_images TO authenticated;
