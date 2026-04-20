-- Make handle_new_user() tolerant of phone-only sign-ups.
-- The original function derived the default name from the email local-part,
-- which returns NULL when email is null (phone-OTP users), breaking INSERT.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, name, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'Customer'
    ),
    COALESCE((NEW.raw_user_meta_data->>'isAdmin')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
