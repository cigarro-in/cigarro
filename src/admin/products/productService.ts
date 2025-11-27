import { supabase } from "../../lib/supabase/client";
import { ProductFormData } from "../../types/product";

export async function saveProduct(data: ProductFormData, existingId?: string) {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("User not authenticated");

    // 1. Prepare Product Data
    // Ensure slug is unique
    const uniqueSlug = await ensureUniqueSlug(data.slug, existingId);

    const productPayload = {
      name: data.name,
      slug: uniqueSlug,
      brand_id: data.brand_id,
      // brand: data.brand, // Removed - join table used
      description: data.description,
      short_description: data.short_description,
      is_active: data.is_active,
      
      // Tobacco Details
      origin: data.origin,
      specifications: data.specifications.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {}),
      
      // SEO
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      canonical_url: data.canonical_url,
      
      updated_at: new Date().toISOString(),
    };

    let productId = existingId;

    if (productId) {
      // UPDATE
      const { error } = await supabase
        .from('products')
        .update(productPayload)
        .eq('id', productId);
      if (error) throw error;
    } else {
      // INSERT
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert([{ ...productPayload, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      productId = newProduct.id;
    }

    if (!productId) throw new Error("Failed to get product ID");

    // 2. Handle Variants
    // First, get existing variants to know what to delete
    const { data: existingVariants } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', productId);
    
    const existingVariantIds = existingVariants?.map(v => v.id) || [];
    const currentVariantIds = data.variants.filter(v => v.id).map(v => v.id);
    
    // Delete removed variants
    const variantsToDelete = existingVariantIds.filter(id => !currentVariantIds.includes(id));
    if (variantsToDelete.length > 0) {
      await supabase.from('product_variants').delete().in('id', variantsToDelete);
    }

    // Upsert variants
    for (const variant of data.variants) {
      const variantPayload = {
        product_id: productId,
        variant_name: variant.variant_name || 'Untitled Variant',
        variant_slug: variant.variant_slug || `${data.slug}-${(variant.variant_name || 'variant').toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(7)}`,
        variant_type: variant.variant_type || 'pack',
        units_contained: variant.units_contained || 1,
        unit: variant.unit || 'sticks',
        price: variant.price || 0,
        compare_at_price: variant.compare_at_price,
        cost_price: variant.cost_price,
        stock: variant.stock || 0,
        track_inventory: variant.track_inventory ?? true,
        is_active: variant.is_active ?? true,
        is_default: variant.is_default ?? false,
        images: variant.images || [], // Save variant images
        updated_at: new Date().toISOString()
      };

      // Debug: Log the exact payload being sent
      console.log('Variant payload being sent:', JSON.stringify(variantPayload, null, 2));
      
      let error;
      if (variant.id) {
        const result = await supabase.from('product_variants').update(variantPayload).eq('id', variant.id);
        error = result.error;
      } else {
        const result = await supabase.from('product_variants').insert([{ ...variantPayload, created_at: new Date().toISOString() }]);
        error = result.error;
      }
      
      if (error) {
        console.error(`Error saving variant ${variant.variant_name}:`, error);
        throw error;
      }
    }

    // 3. Handle Collections
    // Delete existing links
    await supabase.from('collection_products').delete().eq('product_id', productId);
    
    // Insert new links
    if (data.collections.length > 0) {
      const collectionLinks = data.collections.map(colId => ({
        collection_id: colId,
        product_id: productId,
        created_at: new Date().toISOString()
      }));
      await supabase.from('collection_products').insert(collectionLinks);
    }

    // 4. Handle Categories
    // Delete existing links
    await supabase.from('product_categories').delete().eq('product_id', productId);
    
    // Insert new links
    if (data.categories && data.categories.length > 0) {
      // Ensure uniqueness and valid UUIDs
      const uniqueCategories = [...new Set(data.categories)].filter(id => id && id.length > 0);
      
      if (uniqueCategories.length > 0) {
        const categoryLinks = uniqueCategories.map(catId => ({
          category_id: catId,
          product_id: productId
        }));
        
        const { error: catError } = await supabase.from('product_categories').insert(categoryLinks);
        
        if (catError) {
          console.error("Error saving categories:", catError);
          // Don't throw here, just log - we want the product to be saved even if categories fail
          // throw catError; 
        }
      }
    }

    return productId;

  } catch (error) {
    console.error("Error saving product:", error);
    throw error;
  }
}

async function ensureUniqueSlug(slug: string, existingId?: string): Promise<string> {
  let uniqueSlug = slug;
  let counter = 1;
  
  while (true) {
    let query = supabase
      .from('products')
      .select('id')
      .eq('slug', uniqueSlug);
      
    if (existingId) {
      query = query.neq('id', existingId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return uniqueSlug;
    }
    
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
}
