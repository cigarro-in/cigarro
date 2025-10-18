import { z } from 'zod';

// Zod schema for product form validation
export const productFormSchema = z.object({
  // Required fields
  name: z.string().min(1, 'Product name is required').max(200, 'Name too long'),
  brand: z.string().min(1, 'Brand is required'),
  price: z.number().positive('Price must be greater than 0'),
  gallery_images: z.array(z.string()).min(1, 'At least one image is required'),
  
  // Optional fields with defaults
  slug: z.string().optional(),
  description: z.string().default(''),
  short_description: z.string().optional(),
  compare_at_price: z.number().positive().optional(),
  cost_price: z.number().positive().optional(),
  stock: z.number().int().min(0).default(0),
  track_inventory: z.boolean().default(true),
  continue_selling_when_out_of_stock: z.boolean().default(false),
  image_alt_text: z.string().optional(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_showcase: z.boolean().default(false),
  origin: z.string().optional(),
  pack_size: z.string().optional(),
  specifications: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).default([]),
  
  // SEO fields
  meta_title: z.string().max(60, 'Meta title should be under 60 characters').optional(),
  meta_description: z.string().max(160, 'Meta description should be under 160 characters').optional(),
  meta_keywords: z.string().optional(),
  canonical_url: z.string().url().optional().or(z.literal('')),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
  og_image: z.string().optional(),
  twitter_title: z.string().optional(),
  twitter_description: z.string().optional(),
  twitter_image: z.string().optional(),
  structured_data: z.record(z.any()).optional(),
  
  // Variants
  variants: z.array(z.object({
    id: z.string().optional(),
    variant_name: z.string().min(1, 'Variant name is required'),
    variant_slug: z.string(),
    variant_type: z.enum(['packaging', 'size', 'color', 'flavor', 'material', 'other']),
    price: z.number().positive('Price must be greater than 0'),
    compare_at_price: z.number().positive().optional(),
    cost_price: z.number().positive().optional(),
    stock: z.number().int().min(0),
    track_inventory: z.boolean().default(true),
    attributes: z.array(z.object({
      key: z.string(),
      value: z.string()
    })).default([]),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().min(0),
    assigned_images: z.array(z.string()).default([]),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    meta_keywords: z.string().optional(),
    og_title: z.string().optional(),
    og_description: z.string().optional(),
    structured_data: z.record(z.any()).optional()
  })).default([])
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

// Helper to get field-specific error messages
export function getFieldError(errors: any, fieldName: string): string | undefined {
  const keys = fieldName.split('.');
  let error = errors;
  
  for (const key of keys) {
    if (!error) return undefined;
    error = error[key];
  }
  
  return error?.message;
}

// Validation for step 0 (Quick Add)
export function validateQuickAddStep(data: Partial<ProductFormValues>) {
  const schema = productFormSchema.pick({
    name: true,
    brand: true,
    price: true,
    gallery_images: true
  });
  
  return schema.safeParse(data);
}
