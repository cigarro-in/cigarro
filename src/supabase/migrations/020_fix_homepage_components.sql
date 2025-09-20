-- Fix Homepage Components Mapping
-- This migration creates proper sections that match the actual homepage components

-- First, clean up old homepage management system
-- Drop the old homepage_section_content table and related data
DROP TABLE IF EXISTS public.homepage_section_content CASCADE;

-- Clear existing generic sections
DELETE FROM public.homepage_sections;

-- Drop the old homepage_layout table since we're replacing it with component-based management
DROP TABLE IF EXISTS public.homepage_layout CASCADE;

-- Insert sections that match the actual homepage components
INSERT INTO public.homepage_sections (title, slug) VALUES
('Hero Section', 'hero-section'),
('Featured Products', 'featured-products'),
('Brand Heritage', 'brand-heritage'),
('Product Showcase', 'product-showcase'),
('Categories Grid', 'categories-grid'),
('Blog Section', 'blog-section')
ON CONFLICT (slug) DO NOTHING;

-- Create a mapping table for component configuration
CREATE TABLE IF NOT EXISTS public.homepage_component_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    component_name TEXT NOT NULL UNIQUE,
    section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert component mappings
INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order) 
SELECT 
    'Hero',
    hs.id,
    true,
    1
FROM public.homepage_sections hs WHERE hs.slug = 'hero-section'
ON CONFLICT (component_name) DO NOTHING;

INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order) 
SELECT 
    'FeaturedProducts',
    hs.id,
    true,
    2
FROM public.homepage_sections hs WHERE hs.slug = 'featured-products'
ON CONFLICT (component_name) DO NOTHING;

INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order) 
SELECT 
    'BrandHeritage',
    hs.id,
    true,
    3
FROM public.homepage_sections hs WHERE hs.slug = 'brand-heritage'
ON CONFLICT (component_name) DO NOTHING;

INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order) 
SELECT 
    'ProductShowcase',
    hs.id,
    true,
    4
FROM public.homepage_sections hs WHERE hs.slug = 'product-showcase'
ON CONFLICT (component_name) DO NOTHING;

INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order) 
SELECT 
    'CategoriesGrid',
    hs.id,
    true,
    5
FROM public.homepage_sections hs WHERE hs.slug = 'categories-grid'
ON CONFLICT (component_name) DO NOTHING;

INSERT INTO public.homepage_component_config (component_name, section_id, is_enabled, display_order) 
SELECT 
    'BlogSection',
    hs.id,
    true,
    6
FROM public.homepage_sections hs WHERE hs.slug = 'blog-section'
ON CONFLICT (component_name) DO NOTHING;

-- Enable RLS for the new table
ALTER TABLE public.homepage_component_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view homepage component config" ON public.homepage_component_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage homepage component config" ON public.homepage_component_config FOR ALL USING (public.is_admin());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_homepage_component_config_component ON public.homepage_component_config(component_name);
CREATE INDEX IF NOT EXISTS idx_homepage_component_config_enabled ON public.homepage_component_config(is_enabled);
CREATE INDEX IF NOT EXISTS idx_homepage_component_config_order ON public.homepage_component_config(display_order);
