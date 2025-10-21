-- Fix RLS policy for payment_verification_logs
-- Allow any authenticated user to read (for testing)

DROP POLICY IF EXISTS "Admins can do everything on payment_verification_logs" ON public.payment_verification_logs;

-- Simpler policy - any authenticated user can read
CREATE POLICY "Authenticated users can read logs"
  ON public.payment_verification_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage logs"
  ON public.payment_verification_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
