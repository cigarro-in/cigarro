import { supabase } from './client';

/**
 * Get the public URL for a file in Supabase storage
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @returns The full public URL for the file
 */
export function getStorageUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get the public URL for a product image
 * @param imagePath - The image path (can be full URL or relative path)
 * @returns The full public URL for the image
 */
export function getProductImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return getStorageUrl('products', 'placeholder.webp');
  }
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a relative path, assume it's in the products bucket
  return getStorageUrl('products', imagePath);
}

/**
 * Get the public URL for a hero slide image
 * @param imagePath - The image path (can be full URL or relative path)
 * @returns The full public URL for the image
 */
export function getHeroImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return getStorageUrl('hero-slides', 'placeholder.webp');
  }
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a relative path, assume it's in the hero-slides bucket
  return getStorageUrl('hero-slides', imagePath);
}

/**
 * Get the public URL for a blog image
 * @param imagePath - The image path (can be full URL or relative path)
 * @returns The full public URL for the image
 */
export function getBlogImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return getStorageUrl('blog', 'placeholder.webp');
  }
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a relative path, assume it's in the blog bucket
  return getStorageUrl('blog', imagePath);
}

/**
 * Get the public URL for a team member image
 * @param imagePath - The image path (can be full URL or relative path)
 * @returns The full public URL for the image
 */
export function getTeamImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return getStorageUrl('team', 'placeholder.jpg');
  }
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a relative path, assume it's in the team bucket
  return getStorageUrl('team', imagePath);
}

/**
 * Get the public URL for a lifestyle image
 * @param imagePath - The image path (can be full URL or relative path)
 * @returns The full public URL for the image
 */
export function getLifestyleImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return getStorageUrl('lifestyle', 'placeholder.webp');
  }
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a relative path, assume it's in the lifestyle bucket
  return getStorageUrl('lifestyle', imagePath);
}

/**
 * Get the public URL for a brand heritage image
 * @param imagePath - The image path (can be full URL or relative path)
 * @returns The full public URL for the image
 */
export function getBrandHeritageImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return getStorageUrl('brand-heritage', 'placeholder.webp');
  }
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a relative path, assume it's in the brand-heritage bucket
  return getStorageUrl('brand-heritage', imagePath);
}

