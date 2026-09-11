-- 077: audit_logs sink repair.
-- Production currently has NO audit_logs table (verified 2026-09-11: the
-- endpoint 404s even for service_role), so src/utils/audit-logger.ts writes
-- into the void. This makes the sink exist with least-privilege policies:
-- inserts allowed (needed by the anon storefront logger), reads restricted
-- to admins (audit data is sensitive). Safe to apply on top of migration 001
-- (IF NOT EXISTS guards throughout).

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  user_id UUID,
  details JSONB,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- metadata column may be missing if 001's version applied without it
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN metadata JSONB;
  END IF;
END $$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Storefront logger (anon key) must be able to append events.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Anyone can insert audit events'
  ) THEN
    CREATE POLICY "Anyone can insert audit events"
      ON public.audit_logs FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Admins can view audit logs'
  ) THEN
    CREATE POLICY "Admins can view audit logs"
      ON public.audit_logs FOR SELECT USING (public.is_admin());
  END IF;
END $$;
