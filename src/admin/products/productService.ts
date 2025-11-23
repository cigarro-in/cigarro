import { supabase } from "../../lib/supabase/client";
import { ProductFormData } from "../../types/product";

export async function saveProduct(data: ProductFormData, existingId?: string) {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("User not authenticated");

    // 1. Prepare Product Data
    const productPayload = {
      name: data.name,
      slug: data.slug,
      brand: data.brand,
      // brand_id: data.brand_id, // TODO: lookup if needed
      description: data.description,
      short_description: data.short_description,
      price: data.price,
      compare_at_price: data.compare_at_price,
      cost_price: data.cost_price,
      stock: data.stock, // Base stock (if no variants)
      track_inventory: data.track_inventory,
      continue_selling_when_out_of_stock: data.continue_selling_when_out_of_stock,
      gallery_images: data.gallery_images,
      is_active: data.is_active,
      
      // Tobacco Details
      origin: data.origin,
      pack_size: data.pack_size,
      specifications: data.specifications.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {}),
      
      // SEO
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      meta_keywords: data.meta_keywords,
      canonical_url: data.canonical_url,
      og_title: data.og_title,
      og_description: data.og_description,
      og_image: data.og_image,
      twitter_title: data.twitter_title,
      twitter_description: data.twitter_description,
      twitter_image: data.twitter_image,
      
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
        variant_type: variant.variant_type || 'packaging',
        packaging: variant.packaging || 'pack',
        units_contained: variant.units_contained || 1,
        price: variant.price || 0,
        compare_at_price: variant.compare_at_price,
        cost_price: variant.cost_price,
        stock: variant.stock || 0,
        track_inventory: variant.track_inventory ?? true,
        weight: variant.weight,
        dimensions: variant.dimensions,
        attributes: variant.attributes ? variant.attributes.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {}) : {},
        is_active: variant.is_active ?? true,
        sort_order: variant.sort_order || 0,
        images: variant.assigned_images || [], // Save variant images
        updated_at: new Date().toISOString()
      };

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

    return productId;

  } catch (error) {
    console.error("Error saving product:", error);
    throw error;
  }
}
