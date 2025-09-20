import { supabase } from './client';
import { toast } from 'sonner';

/**
 * Get homepage component configuration
 */
export async function getHomepageComponents() {
  try {
    const { data, error } = await supabase
      .from('homepage_component_config')
      .select(`
        *,
        section:homepage_sections(id, title, slug)
      `)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching homepage components:', error);
    return null;
  }
}

/**
 * Toggle a homepage component on/off
 */
export async function toggleHomepageComponent(componentId: string, enabled: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('homepage_component_config')
      .update({ 
        is_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', componentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error toggling component:', error);
    toast.error('Failed to update component');
    return false;
  }
}

/**
 * Reorder homepage components
 */
export async function reorderHomepageComponents(components: Array<{id: string, display_order: number}>): Promise<boolean> {
  try {
    for (const component of components) {
      const { error } = await supabase
        .from('homepage_component_config')
        .update({ 
          display_order: component.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', component.id);

      if (error) throw error;
    }
    return true;
  } catch (error) {
    console.error('Error reordering components:', error);
    toast.error('Failed to reorder components');
    return false;
  }
}

/**
 * Get homepage layout status (which components are enabled)
 */
export async function getHomepageLayout() {
  try {
    const { data, error } = await supabase
      .from('homepage_component_config')
      .select('component_name, is_enabled, display_order')
      .order('display_order');

    if (error) throw error;
    
    // Convert to a more usable format
    const layout: Record<string, boolean> = {};
    data?.forEach(comp => {
      layout[comp.component_name] = comp.is_enabled;
    });
    
    return layout;
  } catch (error) {
    console.error('Error fetching homepage layout:', error);
    return null;
  }
}

/**
 * Check if a specific component is enabled
 */
export async function isComponentEnabled(componentName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('homepage_component_config')
      .select('is_enabled')
      .eq('component_name', componentName)
      .single();

    if (error) throw error;
    return data?.is_enabled || false;
  } catch (error) {
    console.error('Error checking component status:', error);
    return false;
  }
}