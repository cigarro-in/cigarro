-- Migration: Insert Default Section Configurations
-- Version: 0025
-- Description: Insert default configurations for all homepage sections

-- Insert default section configurations
INSERT INTO public.section_configurations (section_name, title, subtitle, description, button_text, button_url, max_items, is_enabled)
VALUES
  ('featured_products', 'Curated Selection of Premium Tobacco', 'Featured Products', 'Discover our handpicked selection of premium tobacco products', 'View All Products', '/products', 3, true),
  ('product_showcase', 'Discover Our Most Celebrated Collections', 'Premium Collections', 'Handpicked selections from our finest tobacco products', 'Explore Collection', '/products', 6, true),
  ('hero_section', 'Welcome to Premium Tobacco', 'Luxury Experience', 'Experience the finest selection of premium cigarettes, cigars, and vapes', 'Shop Now', '/products', 5, true),
  ('brand_heritage', 'Our Heritage', 'Legacy of Excellence', 'Over decades of crafting the perfect smoking experience', 'Learn More', '/about', 1, true),
  ('blog_section', 'Latest from Our Blog', 'Stories, Tips & Insights', 'Stay updated with the latest news, stories, and insights from the world of premium tobacco.', 'View All Articles', '/blog', 4, true)
ON CONFLICT (section_name) DO NOTHING;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
