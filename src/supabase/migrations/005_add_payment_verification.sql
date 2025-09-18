-- Add missing columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_country TEXT DEFAULT 'India',
ADD COLUMN IF NOT EXISTS shipping_phone TEXT,
ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_verified TEXT DEFAULT 'NO' CHECK (payment_verified IN ('YES', 'NO', 'REJECTED')),
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
ADD COLUMN IF NOT EXISTS payment_link_email TEXT,
ADD COLUMN IF NOT EXISTS payment_link_phone TEXT;

-- Create index for payment verification queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_verified ON public.orders(payment_verified);
CREATE INDEX IF NOT EXISTS idx_orders_user_payment_status ON public.orders(user_id, payment_verified);
CREATE INDEX IF NOT EXISTS idx_orders_payment_confirmed ON public.orders(payment_confirmed);

-- Update existing orders to have payment_verified as 'YES' and payment_confirmed as true for completed orders
UPDATE public.orders 
SET payment_confirmed = true, 
    payment_confirmed_at = created_at,
    payment_verified = 'YES', 
    payment_verified_at = created_at
WHERE status IN ('processing', 'shipped', 'delivered') AND payment_verified = 'NO';
