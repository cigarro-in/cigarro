-- Migration: Migrate Existing Blog Posts
-- Version: 0024
-- Description: Insert existing blog posts from the frontend into the database

-- First, ensure we have the necessary categories
INSERT INTO public.blog_categories (name, slug, description, color, sort_order) VALUES
('Craftsmanship', 'craftsmanship', 'Articles about the art and craft of tobacco', '#8B4513', 1),
('Education', 'education', 'Educational content about tobacco and cigars', '#2563EB', 2),
('Lifestyle', 'lifestyle', 'Lifestyle articles and tips', '#059669', 3),
('Heritage', 'heritage', 'Historical and heritage content', '#7C3AED', 4)
ON CONFLICT (name) DO NOTHING;

-- Insert existing blog posts
INSERT INTO public.blog_posts (
    title,
    slug,
    excerpt,
    content,
    featured_image,
    status,
    published_at,
    reading_time,
    view_count,
    like_count,
    is_featured,
    is_pinned,
    category_id,
    meta_title,
    meta_description,
    meta_keywords,
    created_at,
    updated_at
) VALUES
(
    'The Art of Cuban Cigar Rolling: A Master''s Journey',
    'art-of-cuban-cigar-rolling',
    'Discover the centuries-old traditions and meticulous craftsmanship that goes into creating the world''s finest Cuban cigars.',
    '<p>The art of Cuban cigar rolling is a tradition that has been passed down through generations, combining centuries of knowledge with the skilled hands of master torcedores. In the heart of Havana, where the humid air carries the sweet aroma of aging tobacco, these artisans continue to create some of the world''s most sought-after cigars.</p>
    
    <p>Each cigar is a testament to the torcedor''s expertise, requiring years of training to master the delicate balance of wrapper, binder, and filler leaves. The process begins with the selection of premium tobacco leaves, each chosen for its specific characteristics and flavor profile.</p>
    
    <p>The rolling technique itself is a dance of precision and artistry. The torcedor must maintain consistent pressure while rolling, ensuring the cigar has the perfect draw and burn characteristics. This attention to detail is what sets Cuban cigars apart from all others.</p>
    
    <p>From the initial leaf selection to the final quality inspection, every step in the Cuban cigar-making process reflects a commitment to excellence that has made these cigars legendary among connoisseurs worldwide.</p>',
    'https://emecdqvsvskzzncmltna.supabase.co/storage/v1/object/public/blog/DSC07634-Edit_1.webp',
    'published',
    '2024-01-15T00:00:00Z',
    8,
    0,
    0,
    true,
    false,
    (SELECT id FROM public.blog_categories WHERE slug = 'craftsmanship'),
    'The Art of Cuban Cigar Rolling: A Master''s Journey',
    'Discover the centuries-old traditions and meticulous craftsmanship that goes into creating the world''s finest Cuban cigars.',
    'Cuban cigars, cigar rolling, craftsmanship, tradition, tobacco, Havana',
    '2024-01-15T00:00:00Z',
    '2024-01-15T00:00:00Z'
),
(
    'Understanding Tobacco Terroir: How Climate Shapes Flavor',
    'tobacco-terroir-climate-flavor',
    'Explore how different growing regions around the world influence the unique characteristics and flavor profiles of premium tobacco.',
    '<p>Just as wine grapes reflect their terroir, tobacco plants absorb the unique characteristics of their growing environment. The soil composition, climate, altitude, and even the angle of sunlight all contribute to the final flavor profile of premium tobacco.</p>
    
    <p>In the Dominican Republic, the rich volcanic soil and consistent tropical climate produce tobacco with bold, earthy notes. Nicaraguan tobacco, grown in the shadow of active volcanoes, develops a distinctive peppery spice that has become highly prized among cigar enthusiasts.</p>
    
    <p>Connecticut''s broadleaf tobacco, grown under shade cloths, develops the smooth, creamy characteristics that make it perfect for premium cigar wrappers. Meanwhile, the high-altitude regions of Ecuador produce wrapper leaves with exceptional elasticity and subtle sweetness.</p>
    
    <p>Understanding these regional differences allows us to appreciate the complexity and diversity of tobacco flavors, and helps explain why certain growing regions have become synonymous with specific taste profiles.</p>',
    'https://emecdqvsvskzzncmltna.supabase.co/storage/v1/object/public/blog/DSC04514-Edit_1.webp',
    'published',
    '2024-01-12T00:00:00Z',
    6,
    0,
    0,
    false,
    false,
    (SELECT id FROM public.blog_categories WHERE slug = 'education'),
    'Understanding Tobacco Terroir: How Climate Shapes Flavor',
    'Explore how different growing regions around the world influence the unique characteristics and flavor profiles of premium tobacco.',
    'tobacco terroir, climate, flavor, Dominican Republic, Nicaragua, Connecticut, Ecuador',
    '2024-01-12T00:00:00Z',
    '2024-01-12T00:00:00Z'
),
(
    'The Perfect Pairing: Cigars and Fine Spirits',
    'cigar-spirit-pairing-guide',
    'Learn the art of pairing premium cigars with whiskey, rum, and other fine spirits to enhance your tasting experience.',
    '<p>The art of pairing cigars with spirits is about finding complementary flavors that enhance both the cigar and the drink. The key is understanding how different spirits interact with tobacco''s natural oils and flavors.</p>
    
    <p>Single malt Scotch whiskies, with their smoky, peaty characteristics, pair beautifully with full-bodied cigars. The smoke from both creates a harmonious blend that intensifies the experience. Aged rums, with their caramel and vanilla notes, complement medium-bodied cigars with natural sweetness.</p>
    
    <p>Cognac and brandy offer a different approach, with their fruity, floral notes providing a counterpoint to the earthiness of tobacco. The high alcohol content helps cleanse the palate between draws, allowing you to fully appreciate the cigar''s evolving flavors.</p>
    
    <p>When pairing, consider the strength of both the cigar and the spirit. A delicate Connecticut-wrapped cigar might be overwhelmed by a powerful Islay Scotch, while a full-bodied Nicaraguan cigar could overpower a light, floral gin.</p>',
    'https://emecdqvsvskzzncmltna.supabase.co/storage/v1/object/public/blog/DSC05471_1.webp',
    'published',
    '2024-01-10T00:00:00Z',
    5,
    0,
    0,
    false,
    false,
    (SELECT id FROM public.blog_categories WHERE slug = 'lifestyle'),
    'The Perfect Pairing: Cigars and Fine Spirits',
    'Learn the art of pairing premium cigars with whiskey, rum, and other fine spirits to enhance your tasting experience.',
    'cigar pairing, spirits, whiskey, rum, cognac, lifestyle, tasting',
    '2024-01-10T00:00:00Z',
    '2024-01-10T00:00:00Z'
),
(
    'Vintage Tobacco: The Beauty of Aged Blends',
    'vintage-tobacco-aged-blends',
    'Delve into the world of aged tobacco and discover how time transforms flavor, creating some of the most sought-after blends.',
    '<p>Aging tobacco is an art form that requires patience, expertise, and the perfect conditions. Like fine wine, tobacco improves with age, developing complex flavors and smoother characteristics that cannot be achieved through any other process.</p>
    
    <p>The aging process begins immediately after harvest, as the tobacco leaves undergo fermentation. This natural process breaks down harsh compounds and develops the rich, complex flavors that define premium tobacco. The leaves are carefully monitored and rotated to ensure even aging.</p>
    
    <p>Temperature and humidity control are crucial during aging. Too much moisture can lead to mold, while too little can cause the leaves to become brittle. The ideal conditions allow the tobacco to slowly transform, developing the smooth, mellow characteristics that connoisseurs prize.</p>
    
    <p>Some of the most sought-after cigars are made with tobacco that has been aged for five, ten, or even twenty years. These vintage blends offer a smoking experience that cannot be replicated, with flavors that have been refined and perfected over decades.</p>',
    'https://emecdqvsvskzzncmltna.supabase.co/storage/v1/object/public/blog/Eucalyptus_2025-05-29-142724_oydb_1.webp',
    'published',
    '2024-01-08T00:00:00Z',
    7,
    0,
    0,
    false,
    false,
    (SELECT id FROM public.blog_categories WHERE slug = 'heritage'),
    'Vintage Tobacco: The Beauty of Aged Blends',
    'Delve into the world of aged tobacco and discover how time transforms flavor, creating some of the most sought-after blends.',
    'vintage tobacco, aged blends, aging, fermentation, heritage, premium tobacco',
    '2024-01-08T00:00:00Z',
    '2024-01-08T00:00:00Z'
),
(
    'The Science of Cigar Storage: Creating the Perfect Environment',
    'cigar-storage-perfect-environment',
    'Learn the essential principles of cigar storage to maintain optimal flavor, humidity, and aging conditions for your collection.',
    '<p>Proper cigar storage is essential for maintaining the quality and flavor of your collection. The key factors are temperature, humidity, and air circulation, all of which must be carefully balanced to create the perfect aging environment.</p>
    
    <p>Ideal storage conditions maintain a temperature between 65-70°F (18-21°C) and relative humidity between 65-70%. These conditions allow the tobacco to age gracefully while preventing mold growth and maintaining the cigar''s structural integrity.</p>
    
    <p>Humidors are the traditional choice for cigar storage, using Spanish cedar to help regulate humidity and impart subtle flavors. Modern electric humidors offer precise climate control, while coolers can be converted into effective storage solutions for larger collections.</p>
    
    <p>Regular monitoring and maintenance are crucial. Use calibrated hygrometers to track humidity levels, and rotate your cigars regularly to ensure even aging. With proper care, your cigars will continue to improve over time, developing the complex flavors that make premium tobacco so special.</p>',
    'https://emecdqvsvskzzncmltna.supabase.co/storage/v1/object/public/blog/Primer-LA_Escalier_Pivoine_B-1_1.webp',
    'published',
    '2024-01-05T00:00:00Z',
    6,
    0,
    0,
    false,
    false,
    (SELECT id FROM public.blog_categories WHERE slug = 'education'),
    'The Science of Cigar Storage: Creating the Perfect Environment',
    'Learn the essential principles of cigar storage to maintain optimal flavor, humidity, and aging conditions for your collection.',
    'cigar storage, humidor, humidity, temperature, collection, education',
    '2024-01-05T00:00:00Z',
    '2024-01-05T00:00:00Z'
),
(
    'The History of Premium Cigars: From Columbus to Today',
    'history-premium-cigars-columbus-today',
    'Trace the fascinating journey of cigars from their discovery by Christopher Columbus to their current status as symbols of luxury and sophistication.',
    '<p>The story of premium cigars begins with Christopher Columbus''s arrival in the New World in 1492. The explorer and his crew were the first Europeans to encounter tobacco, observing the native peoples smoking rolled tobacco leaves in a practice that would eventually spread across the globe.</p>
    
    <p>By the 16th century, tobacco had reached Europe, where it quickly gained popularity among the aristocracy. The first cigar factories were established in Spain, using tobacco imported from the Caribbean colonies. These early cigars were crude by today''s standards, but they established the foundation for the industry.</p>
    
    <p>The 19th century saw the golden age of cigar making, with Cuba emerging as the world''s premier producer. The island''s unique climate and soil conditions, combined with generations of expertise, created cigars of unparalleled quality that became symbols of luxury and sophistication.</p>
    
    <p>Today, premium cigars continue to be handcrafted using traditional methods, with master torcedores passing their skills down through generations. The industry has expanded globally, but the commitment to quality and craftsmanship remains unchanged, ensuring that each cigar represents the pinnacle of the tobacco art.</p>',
    'https://emecdqvsvskzzncmltna.supabase.co/storage/v1/object/public/blog/DSC01551-2_1.webp',
    'published',
    '2024-01-03T00:00:00Z',
    9,
    0,
    0,
    false,
    false,
    (SELECT id FROM public.blog_categories WHERE slug = 'heritage'),
    'The History of Premium Cigars: From Columbus to Today',
    'Trace the fascinating journey of cigars from their discovery by Christopher Columbus to their current status as symbols of luxury and sophistication.',
    'cigar history, Christopher Columbus, Cuba, heritage, tradition, luxury',
    '2024-01-03T00:00:00Z',
    '2024-01-03T00:00:00Z'
);

-- Insert tags for the blog posts
INSERT INTO public.blog_tags (name, slug, color) VALUES
('Cuban', 'cuban', '#8B4513'),
('Craftsmanship', 'craftsmanship', '#8B4513'),
('Tradition', 'tradition', '#8B4513'),
('Cigars', 'cigars', '#8B4513'),
('Terroir', 'terroir', '#2563EB'),
('Climate', 'climate', '#2563EB'),
('Flavor', 'flavor', '#2563EB'),
('Education', 'education', '#2563EB'),
('Pairing', 'pairing', '#059669'),
('Spirits', 'spirits', '#059669'),
('Lifestyle', 'lifestyle', '#059669'),
('Whiskey', 'whiskey', '#059669'),
('Vintage', 'vintage', '#7C3AED'),
('Aging', 'aging', '#7C3AED'),
('Heritage', 'heritage', '#7C3AED'),
('Blends', 'blends', '#7C3AED'),
('Storage', 'storage', '#2563EB'),
('Humidity', 'humidity', '#2563EB'),
('Collection', 'collection', '#2563EB'),
('History', 'history', '#7C3AED'),
('Cuba', 'cuba', '#8B4513'),
('Luxury', 'luxury', '#FFD700')
ON CONFLICT (name) DO NOTHING;

-- Link blog posts to tags
INSERT INTO public.blog_post_tags (post_id, tag_id)
SELECT 
    bp.id,
    bt.id
FROM public.blog_posts bp
CROSS JOIN public.blog_tags bt
WHERE 
    (bp.slug = 'art-of-cuban-cigar-rolling' AND bt.slug IN ('Cuban', 'Craftsmanship', 'Tradition', 'Cigars'))
    OR (bp.slug = 'tobacco-terroir-climate-flavor' AND bt.slug IN ('Terroir', 'Climate', 'Flavor', 'Education'))
    OR (bp.slug = 'cigar-spirit-pairing-guide' AND bt.slug IN ('Pairing', 'Spirits', 'Lifestyle', 'Whiskey'))
    OR (bp.slug = 'vintage-tobacco-aged-blends' AND bt.slug IN ('Vintage', 'Aging', 'Heritage', 'Blends'))
    OR (bp.slug = 'cigar-storage-perfect-environment' AND bt.slug IN ('Storage', 'Humidity', 'Education', 'Collection'))
    OR (bp.slug = 'history-premium-cigars-columbus-today' AND bt.slug IN ('History', 'Heritage', 'Cuba', 'Luxury'));

-- Update the blog section configuration
INSERT INTO public.section_configurations (section_name, title, subtitle, description, is_enabled) VALUES
('blog_section', 'Latest from Our Blog', 'Stories, Tips & Insights', 'Stay updated with the latest news, stories, and insights from the world of premium tobacco.', TRUE)
ON CONFLICT (section_name) DO NOTHING;

