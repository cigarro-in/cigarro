import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
import { Save, RefreshCw, Globe, CreditCard, AlertCircle, Map, Database, ExternalLink, Zap, FileText, Cloud } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import { 
  AdminCard, 
  AdminCardContent, 
  AdminCardHeader, 
  AdminCardTitle, 
  AdminCardDescription 
} from '../components/shared/AdminCard';

interface SiteSettings {
  id: number;
  site_name: string | null;
  favicon_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  upi_id: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface PerformanceResult {
  name: string;
  time: number;
  cacheStatus: string;
  size: string;
  status: string;
  age?: string;
  error?: string | null;
}

export function SettingsManager() {
  const [settings, setSettings] = useState<SiteSettings>({
    id: 1,
    site_name: '',
    favicon_url: '',
    meta_title: '',
    meta_description: '',
    upi_id: '',
    updated_at: null,
    updated_by: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isRegeneratingSitemap, setIsRegeneratingSitemap] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isPurgingCloudflare, setIsPurgingCloudflare] = useState(false);
  const [isTestingPerformance, setIsTestingPerformance] = useState(false);
  const [performanceResults, setPerformanceResults] = useState<{
    mode: string;
    results: PerformanceResult[];
    avgTime: number;
    hitCount?: number;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      
      // Try to get the single row from site_settings
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        console.warn('No site_settings row found');
        toast.error('No settings found in database');
      }
      setIsDirty(false);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error(`Failed to load settings: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateSitemap = async () => {
    setIsRegeneratingSitemap(true);
    try {
      // Fetch the sitemap to trigger regeneration (it's dynamically generated)
      const response = await fetch('/sitemap.xml', { cache: 'no-store' });
      if (response.ok) {
        toast.success('Sitemap regenerated successfully');
      } else {
        throw new Error('Failed to regenerate sitemap');
      }
    } catch (error) {
      console.error('Error regenerating sitemap:', error);
      toast.error('Failed to regenerate sitemap');
    } finally {
      setIsRegeneratingSitemap(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      // Clear browser cache for the site
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Also trigger a reload of critical data
      await fetchSettings();
      
      toast.success('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handlePurgeCloudflareCache = async () => {
    const isProduction = window.location.hostname === 'cigarro.in';

    if (!isProduction) {
      toast.info('⚠️ Cloudflare cache purge only works in production.\n\nIn development, there is no CDN cache - all data loads fresh from Supabase.', { duration: 5000 });
      return;
    }

    setIsPurgingCloudflare(true);
    const loading = toast.loading('Purging Cloudflare cache...');
    
    try {
      const response = await fetch('https://cigarro.in/api/invalidate-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      toast.dismiss(loading);
      
      if (response.ok && data.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        toast.success(`Cloudflare cache purged! ${successCount}/${totalCount} endpoints cleared.`, { duration: 4000 });
      } else {
        console.error('Cache purge failed:', data);
        toast.error(data.error || 'Failed to purge Cloudflare cache');
      }
    } catch (error) {
      console.error('Cache purge error:', error);
      toast.dismiss(loading);
      toast.error('Failed to purge Cloudflare cache. Check console for details.');
    } finally {
      setIsPurgingCloudflare(false);
    }
  };

  const handleTestPerformance = async () => {
    setIsTestingPerformance(true);
    const isProduction = window.location.hostname === 'cigarro.in';

    try {
      if (!isProduction) {
        // Development mode - test Supabase directly
        const devLoading = toast.loading('Testing Supabase connection...');
        
        const tests = [
          { name: 'Homepage Data', query: () => supabase.from('hero_slides').select('*').limit(10) },
          { name: 'Categories', query: () => supabase.from('categories').select('id, name, slug, image').limit(20) },
          { name: 'Products', query: () => supabase.from('products').select('id, name, slug, brand_id, is_active').limit(50) },
          { name: 'Brands', query: () => supabase.from('brands').select('*').limit(20) },
        ];

        const results: PerformanceResult[] = [];

        for (const test of tests) {
          try {
            const start = performance.now();
            const { data, error } = await test.query();
            const end = performance.now();
            const time = Math.round(end - start);
            const sizeBytes = data ? JSON.stringify(data).length : 0;
            const sizeKB = sizeBytes >= 1024 ? `${Math.round(sizeBytes / 1024)}KB` : `${sizeBytes}B`;

            results.push({
              name: test.name,
              time,
              cacheStatus: 'SUPABASE',
              size: sizeKB,
              status: !error ? '✅' : '❌',
              error: error?.message || null
            });
          } catch (err: any) {
            results.push({
              name: test.name,
              time: 0,
              cacheStatus: 'ERROR',
              size: 'N/A',
              status: '❌',
              error: err?.message || 'Unknown error'
            });
          }
        }

        toast.dismiss(devLoading);
        const avgTime = Math.round(results.reduce((sum, r) => sum + r.time, 0) / results.length);
        
        setPerformanceResults({
          mode: 'development',
          results,
          avgTime,
          timestamp: new Date().toLocaleTimeString()
        });

        toast.success(`Development mode: Average ${avgTime}ms (Direct Supabase)`, { duration: 4000 });
      } else {
        // Production mode - test CDN endpoints
        const loading = toast.loading('Testing CDN performance...');
        
        const endpoints = [
          { name: 'Homepage Data', url: 'https://cigarro.in/api/homepage-data' },
          { name: 'Categories', url: 'https://cigarro.in/api/categories' },
          { name: 'Products', url: 'https://cigarro.in/api/products' },
          { name: 'Brands', url: 'https://cigarro.in/api/brands' },
        ];

        const results: PerformanceResult[] = [];

        for (const endpoint of endpoints) {
          try {
            const start = performance.now();
            const response = await fetch(endpoint.url, { cache: 'no-store' });
            const data = await response.text();
            const end = performance.now();
            const time = Math.round(end - start);
            const cfCacheStatus = response.headers.get('cf-cache-status') || 'UNKNOWN';
            const age = response.headers.get('age') || '0';
            const size = `${Math.round(data.length / 1024)}KB`;

            results.push({
              name: endpoint.name,
              time,
              cacheStatus: cfCacheStatus,
              size,
              age: `${age}s`,
              status: response.ok ? '✅' : '❌'
            });
          } catch (err: any) {
            results.push({
              name: endpoint.name,
              time: 0,
              cacheStatus: 'ERROR',
              size: 'N/A',
              status: '❌',
              error: err?.message || 'Unknown error'
            });
          }
        }

        toast.dismiss(loading);
        const validResults = results.filter(r => r.time > 0);
        const avgTime = validResults.length > 0 ? Math.round(validResults.reduce((sum, r) => sum + r.time, 0) / validResults.length) : 0;
        const hitCount = results.filter(r => r.cacheStatus === 'HIT').length;

        setPerformanceResults({
          mode: 'production',
          results,
          avgTime,
          hitCount,
          timestamp: new Date().toLocaleTimeString()
        });

        toast.success(`CDN Performance: Average ${avgTime}ms, ${hitCount}/${results.length} cache hits`, { duration: 4000 });
      }
    } catch (error) {
      console.error('Performance test error:', error);
      toast.error('Failed to test performance');
    } finally {
      setIsTestingPerformance(false);
    }
  };

  const handleSave = async () => {
    // UPI ID validation if provided
    if (settings.upi_id && settings.upi_id.trim()) {
      const upiPattern = /^[\w.-]+@[\w.-]+$/;
      if (!upiPattern.test(settings.upi_id.trim())) {
        toast.error('Invalid UPI ID format. Expected format: username@provider');
        return;
      }
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('site_settings')
        .update({
          site_name: settings.site_name?.trim() || null,
          favicon_url: settings.favicon_url?.trim() || null,
          meta_title: settings.meta_title?.trim() || null,
          meta_description: settings.meta_description?.trim() || null,
          upi_id: settings.upi_id?.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast.success('Settings updated successfully');
      setIsDirty(false);
      await fetchSettings();
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error(`Failed to update settings: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof SiteSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader
        title="Site Settings"
        description="Manage your website configuration"
      >
        <Button variant="outline" onClick={fetchSettings} disabled={isSaving}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !isDirty}
          className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* General Settings */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Globe className="mr-2 h-5 w-5" />
              General Settings
            </AdminCardTitle>
            <AdminCardDescription>
              Basic site information and SEO configuration
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="site_name">Site Name</Label>
                <Input
                  id="site_name"
                  value={settings.site_name || ''}
                  onChange={(e) => handleChange('site_name', e.target.value)}
                  placeholder="Your website name"
                />
              </div>
              <div className="space-y-1">
                <Label>Favicon</Label>
                <SingleImagePicker
                  value={settings.favicon_url || null}
                  onChange={(url) => {
                    setSettings(prev => ({ ...prev, favicon_url: url || '' }));
                    setIsDirty(true);
                  }}
                />
                <p className="text-xs text-[var(--color-dark)]/50">
                  Recommended: 32x32px or 64x64px .ico or .png
                </p>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="meta_title">Meta Title</Label>
              <Input
                id="meta_title"
                value={settings.meta_title || ''}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                placeholder="SEO title for your website"
              />
              <p className="text-xs text-[var(--color-dark)]/50">
                This appears in browser tabs and search results
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="meta_description">Meta Description</Label>
              <Textarea
                id="meta_description"
                value={settings.meta_description || ''}
                onChange={(e) => handleChange('meta_description', e.target.value)}
                placeholder="Brief description of your website for search engines"
                rows={3}
              />
              <p className="text-xs text-[var(--color-dark)]/50">
                This appears in search engine results below the title
              </p>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Payment Settings */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              Payment Settings
            </AdminCardTitle>
            <AdminCardDescription>
              Configure payment gateway settings for your store
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="upi_id">UPI ID</Label>
              <Input
                id="upi_id"
                value={settings.upi_id || ''}
                onChange={(e) => handleChange('upi_id', e.target.value)}
                placeholder="yourname@upi"
                className="max-w-md"
              />
              <p className="text-xs text-[var(--color-dark)]/50">
                This UPI ID will be used for all payment transactions. Format: username@provider
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Important Notes:</p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                  <li>Changing the UPI ID will affect all new orders immediately</li>
                  <li>Existing pending orders will continue to use the old UPI ID</li>
                  <li>Make sure the UPI ID is active and can receive payments</li>
                  <li>Test the new UPI ID with a small transaction before going live</li>
                </ul>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Cloudflare CDN Cache */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Cloud className="mr-2 h-5 w-5" />
              Cloudflare CDN Cache
            </AdminCardTitle>
            <AdminCardDescription>
              Purge the 24-hour Cloudflare cache after making content changes
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="p-4 bg-[var(--color-creme-light)] border border-[var(--color-coyote)]/30 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-2">Purge All Cached Pages</h4>
                  <p className="text-xs text-[var(--color-dark)]/60 mb-3">
                    All pages are cached for 24 hours: Homepage, Products, Categories, Brands, Featured Products.
                    After updating any content, click here to refresh ALL caches immediately and show fresh data across the entire site.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={handlePurgeCloudflareCache}
                      disabled={isPurgingCloudflare}
                      className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
                    >
                      {isPurgingCloudflare ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Cloud className="h-4 w-4 mr-2" />
                      )}
                      {isPurgingCloudflare ? 'Purging...' : 'Purge Cloudflare Cache'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleTestPerformance}
                      disabled={isTestingPerformance}
                    >
                      {isTestingPerformance ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Test Performance
                    </Button>
                  </div>
                </div>
              </div>

              {/* Performance Results */}
              {performanceResults && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-[var(--color-coyote)]/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">
                      Performance Results
                      <span className="ml-2 text-xs text-[var(--color-dark)]/60">
                        ({performanceResults.mode === 'development' ? 'Development - Direct DB' : 'Production - Cached'})
                      </span>
                    </h4>
                    <span className="text-xs text-[var(--color-dark)]/60">{performanceResults.timestamp}</span>
                  </div>

                  <div className="space-y-2">
                    {performanceResults.results.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 px-3 bg-[var(--color-creme)] rounded border border-[var(--color-coyote)]/20">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{result.status}</span>
                          <span className="font-medium text-sm">{result.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className={`font-mono ${result.time < 100 ? 'text-green-600' : result.time < 300 ? 'text-yellow-600' : 'text-red-600'}`}>
                            ⏱️ {result.time}ms
                          </span>
                          <span className="text-[var(--color-dark)]/60">
                            💾 {result.cacheStatus}
                          </span>
                          <span className="text-[var(--color-dark)]/60">
                            📦 {result.size}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 p-3 bg-[var(--color-canyon)]/10 rounded border border-[var(--color-canyon)]/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Average Response Time:</span>
                      <span className={`text-lg font-mono font-bold ${performanceResults.avgTime < 100 ? 'text-green-600' : performanceResults.avgTime < 300 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {performanceResults.avgTime}ms
                      </span>
                    </div>
                    {performanceResults.mode === 'production' && performanceResults.hitCount !== undefined && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-medium text-sm">Cache Hit Rate:</span>
                        <span className="text-lg font-mono font-bold text-green-600">
                          {performanceResults.hitCount}/{performanceResults.results.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">When to purge cache:</p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                  <li>After adding or updating products, categories, or brands</li>
                  <li>After changing hero slides or homepage content</li>
                  <li>After modifying featured products or collections</li>
                  <li>Changes may take 1-2 minutes to propagate globally</li>
                </ul>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Sitemap & Browser Cache */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Map className="mr-2 h-5 w-5" />
              Sitemap & Browser Cache
            </AdminCardTitle>
            <AdminCardDescription>
              Manage sitemap generation and local cache settings
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sitemap */}
              <div className="p-4 border border-[var(--color-coyote)]/20 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Sitemap</h4>
                    <p className="text-xs text-[var(--color-dark)]/50">
                      Regenerate sitemap for search engines
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateSitemap}
                    disabled={isRegeneratingSitemap}
                  >
                    {isRegeneratingSitemap ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="ml-2">Regenerate</span>
                  </Button>
                </div>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  View Sitemap <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Browser Cache */}
              <div className="p-4 border border-[var(--color-coyote)]/20 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Browser Cache</h4>
                    <p className="text-xs text-[var(--color-dark)]/50">
                      Clear local cached data
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                  >
                    {isClearingCache ? (
                      <Database className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    <span className="ml-2">Clear</span>
                  </Button>
                </div>
                <p className="text-xs text-[var(--color-dark)]/40">
                  Clears browser cache only, not CDN cache.
                </p>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Last Updated */}
        {settings.updated_at && (
          <div className="text-center text-sm text-[var(--color-dark)]/50">
            Last updated: {new Date(settings.updated_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
