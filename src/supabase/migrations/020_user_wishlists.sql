-- Migration: Add User Wishlists Table
-- Version: 0020
-- Description: Create user_wishlists table to store user wishlist data

-- Create user_wishlists table
CREATE TABLE IF NOT EXISTS public.user_wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user can't have the same product in wishlist twice
    UNIQUE(user_id, product_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_wishlists_user_id ON public.user_wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_product_id ON public.user_wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_created_at ON public.user_wishlists(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_wishlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_wishlists
-- Users can only see their own wishlist items
CREATE POLICY "Users can view own wishlist items" 
ON public.user_wishlists FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own wishlist items
CREATE POLICY "Users can insert own wishlist items" 
ON public.user_wishlists FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own wishlist items
CREATE POLICY "Users can delete own wishlist items" 
ON public.user_wishlists FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can view all wishlist items
CREATE POLICY "Admins can view all wishlist items" 
ON public.user_wishlists FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_wishlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_wishlists_updated_at_trigger ON public.user_wishlists;
CREATE TRIGGER update_user_wishlists_updated_at_trigger
    BEFORE UPDATE ON public.user_wishlists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_wishlists_updated_at();
