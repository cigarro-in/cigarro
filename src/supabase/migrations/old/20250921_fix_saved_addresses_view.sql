-- Normalize phone and ensure triggers for saved_addresses compatibility view
-- Stores digits-only phone (10 digits for India) and sets default country when missing

-- Create INSTEAD OF trigger to handle INSERTs to the view with normalization
CREATE OR REPLACE FUNCTION handle_saved_addresses_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_digits TEXT;
    v_country TEXT;
BEGIN
    -- Normalize country (default to India if empty)
    v_country := COALESCE(NULLIF(NEW.country, ''), 'India');

    -- Strip all non-digits from phone and normalize
    v_digits := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
    IF lower(v_country) IN ('india', 'in') THEN
        -- For Indian numbers, store last 10 digits
        IF char_length(v_digits) >= 10 THEN
            v_digits := right(v_digits, 10);
        END IF;
    END IF;

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
        v_digits,
        NEW.address,
        NEW.city,
        NEW.state,
        NEW.pincode,
        v_country,
        NEW.latitude,
        NEW.longitude,
        NEW.is_default
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS saved_addresses_insert_trigger ON public.saved_addresses;

-- Create the INSERT trigger
CREATE TRIGGER saved_addresses_insert_trigger
    INSTEAD OF INSERT ON public.saved_addresses
    FOR EACH ROW
    EXECUTE FUNCTION handle_saved_addresses_insert();

-- UPDATE normalization trigger
CREATE OR REPLACE FUNCTION handle_saved_addresses_update()
RETURNS TRIGGER AS $$
DECLARE
    v_digits TEXT;
    v_country TEXT;
BEGIN
    -- Normalize country (default to India if empty)
    v_country := COALESCE(NULLIF(NEW.country, ''), 'India');

    -- Strip all non-digits from phone and normalize
    v_digits := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
    IF lower(v_country) IN ('india', 'in') THEN
        -- For Indian numbers, store last 10 digits
        IF char_length(v_digits) >= 10 THEN
            v_digits := right(v_digits, 10);
        END IF;
    END IF;

    UPDATE public.addresses SET
        label = NEW.label,
        recipient_name = NEW.full_name,
        phone = v_digits,
        address_line_1 = NEW.address,
        city = NEW.city,
        state = NEW.state,
        postal_code = NEW.pincode,
        country = v_country,
        latitude = NEW.latitude,
        longitude = NEW.longitude,
        is_primary = NEW.is_default,
        updated_at = NOW()
    WHERE id = NEW.id AND user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_saved_addresses_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.addresses 
    WHERE id = OLD.id AND user_id = OLD.user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create UPDATE and DELETE triggers
DROP TRIGGER IF EXISTS saved_addresses_update_trigger ON public.saved_addresses;
CREATE TRIGGER saved_addresses_update_trigger
    INSTEAD OF UPDATE ON public.saved_addresses
    FOR EACH ROW
    EXECUTE FUNCTION handle_saved_addresses_update();

DROP TRIGGER IF EXISTS saved_addresses_delete_trigger ON public.saved_addresses;
CREATE TRIGGER saved_addresses_delete_trigger
    INSTEAD OF DELETE ON public.saved_addresses
    FOR EACH ROW
    EXECUTE FUNCTION handle_saved_addresses_delete();
