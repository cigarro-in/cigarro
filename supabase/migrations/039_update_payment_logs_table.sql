-- Migration: Update Payment Verification Logs Table
-- Description: Simplify logs table for monitoring dashboard
-- Created: 2025-10-19

-- Drop old logs table if it exists
DROP TABLE IF EXISTS public.payment_verification_logs CASCADE;

-- Create simplified logs table for monitoring
CREATE TABLE public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  
  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  
  -- Step-by-step tracking
  email_found BOOLEAN DEFAULT false,
  email_parsed BOOLEAN DEFAULT false,
  amount_matched BOOLEAN DEFAULT false,
  
  -- Payment details
  bank_name TEXT,
  upi_reference TEXT,
  sender_vpa TEXT,
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  
  UNIQUE(transaction_id)
);

-- Create indexes
CREATE INDEX idx_verification_logs_order ON public.payment_verification_logs(order_id);
CREATE INDEX idx_verification_logs_transaction ON public.payment_verification_logs(transaction_id);
CREATE INDEX idx_verification_logs_status ON public.payment_verification_logs(status);
CREATE INDEX idx_verification_logs_created ON public.payment_verification_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can do everything on payment_verification_logs"
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

-- Service role can insert logs
CREATE POLICY "Service role can insert logs"
  ON public.payment_verification_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.payment_verification_logs IS 'Simplified audit log for payment verification monitoring dashboard';
