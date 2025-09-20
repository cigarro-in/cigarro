-- Migration: Update Pending Orders to Placed Status
-- Version: 0015
-- Description: Updates existing orders with 'pending' status to 'placed' for better UX
-- This must be run after migration 008 to avoid enum value conflicts

-- =============================================================================
-- UPDATE EXISTING ORDERS
-- =============================================================================

-- Update existing orders with 'pending' status to 'placed' for better UX
UPDATE public.orders 
SET status = 'placed' 
WHERE status = 'pending';

-- =============================================================================
-- VERIFICATION QUERY (Optional - for checking results)
-- =============================================================================

-- Uncomment the following to verify the update worked:
-- SELECT status, COUNT(*) as count 
-- FROM public.orders 
-- GROUP BY status 
-- ORDER BY status;
