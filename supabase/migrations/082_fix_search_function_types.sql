-- Fix get_searchable_products return-type drift (prod 42804).
--
-- The matview yields VARCHAR (e.g. brands.name AS brand) where the function
-- declares TEXT, so EVERY call currently fails and site search returns [].
-- RETURNS SETOF the matview rowtype so the signature can never drift again.
-- NOTE: return-type change requires DROP + CREATE (no longer REPLACE-able).
-- Apply via Supabase dashboard SQL editor or `supabase db push`.

DROP FUNCTION IF EXISTS public.get_searchable_products(TEXT);

CREATE FUNCTION public.get_searchable_products(search_query TEXT DEFAULT '')
RETURNS SETOF public.searchable_products AS $$
BEGIN
    IF search_query = '' OR search_query IS NULL THEN
        RETURN QUERY
        SELECT * FROM public.searchable_products
        WHERE searchable_products.is_active = true;
    ELSE
        RETURN QUERY
        SELECT * FROM public.searchable_products
        WHERE searchable_products.is_active = true
        AND searchable_products.searchable_text ILIKE '%' || search_query || '%';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO anon;

COMMENT ON FUNCTION public.get_searchable_products(TEXT) IS 'Catalog search for storefront + agent ?format= endpoints. SETOF matview rowtype avoids varchar/text drift (see 082).';
