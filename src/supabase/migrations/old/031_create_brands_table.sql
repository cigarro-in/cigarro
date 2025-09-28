-- Create brands table
CREATE TABLE IF NOT EXISTS public.brands (
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

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brands_updated_at 
    BEFORE UPDATE ON public.brands 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON public.brands(is_active);
CREATE INDEX IF NOT EXISTS idx_brands_is_featured ON public.brands(is_featured);
CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON public.brands(sort_order);

-- Insert some sample brands
INSERT INTO public.brands (name, slug, description, is_active, is_featured, sort_order) VALUES
('Marlboro', 'marlboro', 'Premium cigarette brand', true, true, 1),
('Camel', 'camel', 'Classic cigarette brand', true, true, 2),
('Lucky Strike', 'lucky-strike', 'Iconic cigarette brand', true, false, 3),
('Parliament', 'parliament', 'Premium filter cigarettes', true, false, 4),
('Dunhill', 'dunhill', 'Luxury cigarette brand', true, true, 5)
ON CONFLICT (name) DO NOTHING;

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
