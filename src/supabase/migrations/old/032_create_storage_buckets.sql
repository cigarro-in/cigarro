-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('images', 'images', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
    ('asset_images', 'asset_images', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for images bucket
CREATE POLICY "Images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete images" ON storage.objects
    FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Create storage policies for asset_images bucket
CREATE POLICY "Asset images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'asset_images');

CREATE POLICY "Authenticated users can upload asset images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'asset_images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update asset images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'asset_images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete asset images" ON storage.objects
    FOR DELETE USING (bucket_id = 'asset_images' AND auth.role() = 'authenticated');
