-- Phone-based authentication support
-- Adds phone column to profiles and relaxes email to be optional,
-- so accounts can be identified solely by phone (via MSG91 OTP verification).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON profiles (phone)
  WHERE phone IS NOT NULL;

ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- Track when the phone was last verified (for audit / future MFA)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
