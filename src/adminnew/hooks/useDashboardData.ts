import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { Product, ProductVariant, DashboardAnalytics, VariantFormData } from '../types';

export function useDashboardData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>({
    totalProducts: 0,
    activeProducts: 0,
    totalValue: 0,
    lowStockProducts: 0,
    recentOrders: 0,
    totalCustomers: 0,
    totalVariants: 0
  });
  const [loading, setLoading] = useState(false);

  // Load products (no price/stock in new schema)
  const loadProducts = useCallback(async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          brand_id,
          brand:brands(id, name),
          description,
          is_active,
          created_at,
          categories(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setProducts(products as any || []);
      return products || [];
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
      return [];
    }
  }, []);

  // Load variants with optimized query
  const loadVariants = useCallback(async () => {
    try {
      const { data: variants, error } = await supabase
        .from('product_variants')
        .select(`
          id,
          product_id,
          variant_name,
          variant_type,
          price,
          stock,
          is_active,
          products!inner(name),
          images
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setVariants(variants as any || []);
      return variants || [];
    } catch (error) {
      console.error('Error loading variants:', error);
      toast.error('Failed to load variants');
      return [];
    }
  }, []);

  // Load analytics with optimized query
  const loadAnalytics = useCallback(async () => {
    try {
      // Products for counts
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, is_active');

      // Variants for inventory/value
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, price, stock, is_active');

      if (productsError) throw productsError;
      if (variantsError) throw variantsError;

      if (products) {
        const totalProducts = products.length;
        const activeProducts = products.filter((p: any) => p.is_active).length;

        const totalValue = (variants || []).reduce((sum: number, v: any) => sum + (v.price * v.stock), 0);
        const lowStockProducts = (variants || []).filter((v: any) => v.stock < 10).length;
        const totalVariants = variants?.length || 0;

        const newAnalytics = {
          totalProducts,
          activeProducts,
          totalValue,
          lowStockProducts,
          totalVariants,
          recentOrders: 0, // Would come from orders table
          totalCustomers: 0 // Would come from customers/profiles table
        };

        setAnalytics(newAnalytics);
        return newAnalytics;
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      return analytics;
    }
  }, []);

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Use Promise.allSettled to prevent one failure from stopping all loading
      const results = await Promise.allSettled([
        loadProducts(),
        loadVariants(),
        loadAnalytics()
      ]);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to load data ${index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [loadProducts, loadVariants, loadAnalytics]);

  // Save variant
  const saveVariant = useCallback(async (
    variantForm: VariantFormData, 
    editingVariant: ProductVariant | null
  ) => {
    try {
      if (editingVariant) {
        // Update existing variant
        const variantData = {
          variant_name: variantForm.variant_name,
          variant_type: variantForm.variant_type,
          price: variantForm.price,
          stock: variantForm.stock,
          is_active: variantForm.is_active
        };
        
        const { error } = await supabase
          .from('product_variants')
          .update(variantData)
          .eq('id', editingVariant.id);

        if (error) throw error;

        // Update variant images directly
        if (variantForm.variant_images.length > 0) {
          await supabase
            .from('product_variants')
            .update({ images: variantForm.variant_images })
            .eq('id', editingVariant.id);
        }

        toast.success('Variant updated successfully');
      } else {
        // Create new variant
        const variantData = {
          product_id: variantForm.product_id,
          variant_name: variantForm.variant_name,
          variant_type: variantForm.variant_type,
          price: variantForm.price,
          stock: variantForm.stock,
          is_active: variantForm.is_active
        };
        
        const { data: newVariant, error: variantError } = await supabase
          .from('product_variants')
          .insert([variantData])
          .select()
          .single();

        if (variantError) throw variantError;

        // Set variant images directly
        if (variantForm.variant_images.length > 0 && newVariant) {
          await supabase
            .from('product_variants')
            .update({ images: variantForm.variant_images })
            .eq('id', newVariant.id);
        }

        toast.success('Variant created successfully');
      }

      // Reload data
      await Promise.all([loadVariants(), loadAnalytics()]);
      return true;
    } catch (error) {
      console.error('Error saving variant:', error);
      toast.error('Failed to save variant');
      return false;
    }
  }, []);

  // Delete variant
  const deleteVariant = useCallback(async (variantId: string) => {
    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;
      toast.success('Variant deleted successfully');
      
      // Reload data
      await Promise.all([loadVariants(), loadAnalytics()]);
      return true;
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Failed to delete variant');
      return false;
    }
  }, []);

  return {
    products,
    variants,
    analytics,
    loading,
    loadDashboardData,
    saveVariant,
    deleteVariant
  };
}
