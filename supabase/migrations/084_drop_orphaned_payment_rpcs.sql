-- Drop orphaned old-payment-flow RPCs.
--
-- The storefront, checkout, and admin all run on Convex now: zero callers of
-- these functions exist in src/ or functions/ (edge). Drops are matched by
-- NAME (every overload) so signature drift across 030/050/061/077 can't
-- strand one behind. Apply with: supabase db push

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT 'public.' || quote_ident(p.proname) || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'verify_order_payment',
        'create_order',
        'admin_verify_payment',
        'get_wallet_balance'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END $$;
