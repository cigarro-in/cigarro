-- Migration: Fix brands table and blog posts timestamp issues
-- Version: 033
-- Description: Create brands table (if not exists) and fix blog posts timestamp handling

-- Create brands table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'brands') THEN
        CREATE TABLE public.brands (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            slug VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            logo_url TEXT,
            website_url TEXT,
            is_active BOOLEAN DEFAULT true,
            is_featured BOOLEAN DEFAULT false,
            sort_order INTEGER DEFAULT 0,
            meta_title VARCHAR(255),
            meta_description TEXT,
            meta_keywords TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug);
        CREATE INDEX IF NOT EXISTS idx_brands_is_active ON public.brands(is_active);
        CREATE INDEX IF NOT EXISTS idx_brands_is_featured ON public.brands(is_featured);
        CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON public.brands(sort_order);

        -- Enable RLS (Row Level Security)
        ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "Brands are viewable by everyone" ON public.brands
            FOR SELECT USING (true);

        CREATE POLICY "Brands are editable by authenticated users" ON public.brands
            FOR ALL USING (auth.role() = 'authenticated');

        -- Grant permissions
        GRANT ALL ON public.brands TO authenticated;
        GRANT SELECT ON public.brands TO anon;

        -- Insert sample brands
        INSERT INTO public.brands (name, slug, description, is_active, is_featured, sort_order) VALUES
        ('Marlboro', 'marlboro', 'Premium cigarette brand', true, true, 1),
        ('Camel', 'camel', 'Classic cigarette brand', true, true, 2),
        ('Lucky Strike', 'lucky-strike', 'Iconic cigarette brand', true, false, 3),
        ('Parliament', 'parliament', 'Premium filter cigarettes', true, false, 4),
        ('Dunhill', 'dunhill', 'Luxury cigarette brand', true, true, 5)
        ON CONFLICT (name) DO NOTHING;
    END IF;
END
$$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_brands_updated_at') THEN
        CREATE TRIGGER update_brands_updated_at 
            BEFORE UPDATE ON public.brands 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Fix blog posts table - make published_at nullable and handle empty strings
DO $$
BEGIN
    -- Check if blog_posts table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blog_posts') THEN
        -- Make published_at nullable
        ALTER TABLE public.blog_posts 
        ALTER COLUMN published_at DROP NOT NULL;
        
        -- Update empty string timestamps to NULL (only if they exist)
        UPDATE public.blog_posts 
        SET published_at = NULL 
        WHERE published_at IS NOT NULL 
        AND (
            published_at::text = '' 
            OR published_at::text = '0000-00-00 00:00:00'
            OR LENGTH(TRIM(published_at::text)) = 0
        );
    END IF;
END
$$;
