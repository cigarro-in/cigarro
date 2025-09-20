-- Migration: Add Section Configurations
-- Version: 0022
-- Description: Create tables to store configuration for homepage sections

-- Create section_configurations table
CREATE TABLE IF NOT EXISTS public.section_configurations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    section_name TEXT NOT NULL UNIQUE,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    background_image TEXT,
    button_text TEXT,
    button_url TEXT,
    max_items INTEGER DEFAULT 6,
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.section_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view section configurations" ON public.section_configurations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage section configurations" ON public.section_configurations FOR ALL USING (auth.role() = 'authenticated');

-- Create index for section_name
CREATE INDEX IF NOT EXISTS idx_section_configurations_section_name ON public.section_configurations(section_name);



-- Add new columns to hero_slides table
ALTER TABLE hero_slides 
ADD COLUMN text_position VARCHAR(10) DEFAULT 'left',
ADD COLUMN text_color VARCHAR(10) DEFAULT 'light',
ADD COLUMN overlay_opacity INTEGER DEFAULT 40,
ADD COLUMN button_style VARCHAR(20) DEFAULT 'primary';

-- Create featured_products table if not exists
CREATE TABLE featured_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  featured_type VARCHAR(20) DEFAULT 'recommended',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);