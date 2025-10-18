-- Migration: Payment Verification System
-- Description: Tables for automatic UPI payment verification via email parsing
-- Created: 2025-10-18

-- =====================================================
-- 1. Payment Verifications Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  
  -- Email data
  email_subject TEXT,
  email_body TEXT,
  email_from TEXT,
  email_received_at TIMESTAMPTZ,
  email_message_id TEXT UNIQUE, -- Gmail message ID to prevent duplicates
  
  -- Parsed payment data
  bank_name TEXT,
  upi_reference TEXT,
  amount DECIMAL(10,2),
  sender_vpa TEXT,
  receiver_vpa TEXT,
  payment_timestamp TIMESTAMPTZ,
  
  -- Verification status
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'duplicate', 'manual')),
  verification_method TEXT CHECK (verification_method IN ('email_parse', 'manual', 'api', 'webhook')),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- For manual verifications
  
  -- Matching logic results
  amount_match BOOLEAN,
  reference_match BOOLEAN,
  time_window_match BOOLEAN,
  confidence_score DECIMAL(5,2), -- 0-100 confidence in match
  
  -- Metadata
  raw_email_data JSONB,
  parser_version TEXT DEFAULT '1.0.0',
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_payment_verifications_txn ON public.payment_verifications(transaction_id);
CREATE INDEX idx_payment_verifications_order ON public.payment_verifications(order_id);
CREATE INDEX idx_payment_verifications_status ON public.payment_verifications(verification_status);
CREATE INDEX idx_payment_verifications_email_msg ON public.payment_verifications(email_message_id);
CREATE INDEX idx_payment_verifications_created ON public.payment_verifications(created_at DESC);
CREATE INDEX idx_payment_verifications_upi_ref ON public.payment_verifications(upi_reference);

-- =====================================================
-- 2. Bank Email Templates Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name TEXT NOT NULL,
  email_domain TEXT NOT NULL, -- e.g., 'paytm.com', 'phonepe.com', 'google.com'
  
  -- Regex patterns for parsing (stored as text, applied in code)
  subject_pattern TEXT,
  amount_pattern TEXT NOT NULL, -- Required to extract amount
  reference_pattern TEXT,
  sender_vpa_pattern TEXT,
  receiver_vpa_pattern TEXT,
  timestamp_pattern TEXT,
  transaction_id_pattern TEXT, -- Pattern to find our TXN ID in email
  
  -- Template metadata
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority templates checked first
  last_tested_at TIMESTAMPTZ,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  total_attempts INTEGER DEFAULT 0,
  successful_parses INTEGER DEFAULT 0,
  
  -- Sample email for testing
  sample_email_subject TEXT,
  sample_email_body TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on bank + domain
CREATE UNIQUE INDEX idx_bank_templates_unique ON public.bank_email_templates(bank_name, email_domain);
CREATE INDEX idx_bank_templates_active ON public.bank_email_templates(is_active, priority DESC);

-- =====================================================
-- 3. Payment Verification Logs Table (Simplified for Monitoring)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_verification_logs (
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

CREATE INDEX idx_verification_logs_order ON public.payment_verification_logs(order_id);
CREATE INDEX idx_verification_logs_transaction ON public.payment_verification_logs(transaction_id);
CREATE INDEX idx_verification_logs_status ON public.payment_verification_logs(status);
CREATE INDEX idx_verification_logs_created ON public.payment_verification_logs(created_at DESC);

-- =====================================================
-- 4. Update Orders Table
-- =====================================================
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_verification_id UUID REFERENCES public.payment_verifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_verification_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_payment_verification ON public.orders(payment_verification_id);
CREATE INDEX IF NOT EXISTS idx_orders_auto_verified ON public.orders(auto_verified);

-- =====================================================
-- 5. Triggers for Updated At
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_verifications_updated_at
  BEFORE UPDATE ON public.payment_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_email_templates_updated_at
  BEFORE UPDATE ON public.bank_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. Insert Default Bank Templates
-- =====================================================
INSERT INTO public.bank_email_templates (
  bank_name,
  email_domain,
  subject_pattern,
  amount_pattern,
  reference_pattern,
  sender_vpa_pattern,
  receiver_vpa_pattern,
  transaction_id_pattern,
  priority,
  notes
) VALUES
  -- PhonePe
  (
    'PhonePe',
    'phonepe.com',
    'Payment Successful|Money Sent',
    '₹\s*([0-9,]+(?:\.[0-9]{2})?)',
    'UPI Ref[:\s]+([A-Z0-9]+)',
    'From[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'To[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'TXN[0-9]{8}',
    10,
    'PhonePe payment confirmation emails'
  ),
  -- Google Pay
  (
    'Google Pay',
    'google.com',
    'You sent ₹|Payment to',
    '₹\s*([0-9,]+(?:\.[0-9]{2})?)',
    'UPI transaction ID[:\s]+([A-Z0-9]+)',
    'From[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'To[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'TXN[0-9]{8}',
    10,
    'Google Pay payment confirmation emails'
  ),
  -- Paytm
  (
    'Paytm',
    'paytm.com',
    'Payment Successful|Money Transferred',
    '₹\s*([0-9,]+(?:\.[0-9]{2})?)',
    'Transaction ID[:\s]+([A-Z0-9]+)',
    'From[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'To[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'TXN[0-9]{8}',
    9,
    'Paytm payment confirmation emails'
  ),
  -- BHIM
  (
    'BHIM',
    'npci.org.in',
    'Transaction Successful|Payment Confirmation',
    '₹\s*([0-9,]+(?:\.[0-9]{2})?)',
    'RRN[:\s]+([A-Z0-9]+)',
    'Payer VPA[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'Payee VPA[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'TXN[0-9]{8}',
    8,
    'BHIM UPI payment confirmation emails'
  ),
  -- Generic UPI (fallback)
  (
    'Generic UPI',
    '*',
    'UPI|Payment|Transaction',
    '₹\s*([0-9,]+(?:\.[0-9]{2})?)|Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)',
    'Reference[:\s]+([A-Z0-9]+)|Ref[:\s]+([A-Z0-9]+)|RRN[:\s]+([A-Z0-9]+)',
    'From[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)|Payer[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'To[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)|Payee[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    'TXN[0-9]{8}',
    1,
    'Generic fallback template for any UPI payment email'
  );

-- =====================================================
-- 7. RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;

-- Admin full access to all tables
CREATE POLICY "Admins can do everything on payment_verifications"
  ON public.payment_verifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can do everything on bank_email_templates"
  ON public.bank_email_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

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

-- Users can view their own payment verifications
CREATE POLICY "Users can view own payment verifications"
  ON public.payment_verifications
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE user_id = auth.uid()
    )
  );

-- Service role (for Cloudflare Worker) can insert/update
CREATE POLICY "Service role can insert payment verifications"
  ON public.payment_verifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update payment verifications"
  ON public.payment_verifications
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can read bank templates"
  ON public.bank_email_templates
  FOR SELECT
  TO service_role
  USING (is_active = true);

CREATE POLICY "Service role can insert logs"
  ON public.payment_verification_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- 8. Helper Functions
-- =====================================================

-- Function to find matching order for a payment
CREATE OR REPLACE FUNCTION find_matching_order(
  p_transaction_id TEXT,
  p_amount DECIMAL,
  p_payment_time TIMESTAMPTZ
)
RETURNS TABLE (
  order_id UUID,
  confidence_score DECIMAL,
  match_reason TEXT
) AS $$
BEGIN
  -- Priority 1: Exact transaction_id match
  RETURN QUERY
  SELECT 
    o.id,
    100.0::DECIMAL as confidence_score,
    'exact_transaction_id_match'::TEXT as match_reason
  FROM public.orders o
  WHERE o.transaction_id = p_transaction_id
    AND o.status IN ('pending', 'processing')
    AND o.payment_confirmed = false
  LIMIT 1;
  
  -- If found, return immediately
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- Priority 2: Amount + time window match (within 10 minutes)
  RETURN QUERY
  SELECT 
    o.id,
    CASE 
      WHEN ABS(o.total - p_amount) < 0.01 THEN 90.0
      WHEN ABS(o.total - p_amount) < 1.0 THEN 80.0
      ELSE 70.0
    END::DECIMAL as confidence_score,
    'amount_and_time_match'::TEXT as match_reason
  FROM public.orders o
  WHERE o.status IN ('pending', 'processing')
    AND o.payment_confirmed = false
    AND ABS(o.total - p_amount) < 2.0 -- Within ₹2 tolerance
    AND p_payment_time BETWEEN o.created_at AND (o.created_at + INTERVAL '10 minutes')
  ORDER BY 
    ABS(o.total - p_amount) ASC,
    o.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update order with payment verification
CREATE OR REPLACE FUNCTION verify_order_payment(
  p_order_id UUID,
  p_verification_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  UPDATE public.orders
  SET 
    status = 'paid',
    payment_confirmed = true,
    payment_confirmed_at = NOW(),
    payment_verification_id = p_verification_id,
    auto_verified = true,
    updated_at = NOW()
  WHERE id = p_order_id
    AND status IN ('pending', 'processing')
    AND payment_confirmed = false;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Comments
-- =====================================================
COMMENT ON TABLE public.payment_verifications IS 'Stores automatic payment verifications from email parsing';
COMMENT ON TABLE public.bank_email_templates IS 'Regex templates for parsing bank confirmation emails';
COMMENT ON TABLE public.payment_verification_logs IS 'Audit log for payment verification process';
COMMENT ON COLUMN public.payment_verifications.confidence_score IS 'Confidence level (0-100) in the order match';
COMMENT ON FUNCTION find_matching_order IS 'Finds the most likely order for a parsed payment';
COMMENT ON FUNCTION verify_order_payment IS 'Updates order status after successful payment verification';
