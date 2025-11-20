import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { LogOut, Save, RefreshCw, FileText } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface SiteSettings {
  site_name: string;
  favicon_url: string;
  meta_title: string;
  meta_description: string;
}

export function SiteSettingsPage() {
  const navigate = useNavigate();
  const { signOut, adminProfile } = useAdminAuth();
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: '',
    favicon_url: '',
    meta_title: '',
    meta_description: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSitemap, setIsGeneratingSitemap] = useState(false);
  const [performanceResults, setPerformanceResults] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .single();

    if (error) {
      toast.error('Failed to fetch site settings');
    } else if (data) {
      setSettings(data);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update(settings)
        .eq('id', 1);

      if (error) {
        toast.error('Failed to save site settings');
      } else {
        toast.success('Site settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      toast.loading('Signing out...');
      await signOut();
      // No need to navigate or show success toast - signOut handles full page reload
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
      // On error, try to navigate away
      navigate('/');
    }
  };

  const handleInputChange = (field: keyof SiteSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePurgeSitemapCache = async () => {
    setIsGeneratingSitemap(true);
    const loadingToast = toast.loading('Purging sitemap cache...');
    
    try {
      // Force refresh by adding cache-busting parameter
      const response = await fetch(`https://cigarro.in/sitemap.xml?t=${Date.now()}`, {
        cache: 'reload',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        toast.dismiss(loadingToast);
        toast.success('Sitemap cache purged! Fresh sitemap will be generated on next request.');
      } else {
        throw new Error('Failed to purge cache');
      }
    } catch (error) {
      console.error('Error purging sitemap cache:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to purge sitemap cache');
    } finally {
      setIsGeneratingSitemap(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Site Settings Card */}
      <Card className="bg-creme-light border-coyote">
        <CardHeader>
          <CardTitle className="font-serif-premium text-dark">Site Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-dark">Site Name</Label>
            <Input
              value={settings.site_name}
              onChange={(e) => handleInputChange('site_name', e.target.value)}
              className="bg-white border-coyote"
            />
          </div>
          <div>
            <Label className="text-dark">Favicon URL</Label>
            <ImageUpload
              imageUrl={settings.favicon_url}
              onImageUrlChange={(url) => handleInputChange('favicon_url', url || '')}
            />
          </div>
          <div>
            <Label className="text-dark">Default Meta Title</Label>
            <Input
              value={settings.meta_title}
              onChange={(e) => handleInputChange('meta_title', e.target.value)}
              className="bg-white border-coyote"
            />
          </div>
          <div>
            <Label className="text-dark">Default Meta Description</Label>
            <Textarea
              value={settings.meta_description}
              onChange={(e) => handleInputChange('meta_description', e.target.value)}
              rows={3}
              className="bg-white border-coyote"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleSaveSettings} 
              disabled={isSaving}
              className="bg-canyon hover:bg-canyon/90 text-creme"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SEO & Performance Tools Card */}
      <Card className="bg-creme-light border-coyote">
        <CardHeader>
          <CardTitle className="font-serif-premium text-dark">SEO & Performance Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cache Refresh */}
          <div className="p-4 bg-white rounded-lg border border-coyote">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-5 h-5 text-canyon" />
                  <h3 className="font-medium text-dark">Cloudflare Cache</h3>
                </div>
                <p className="text-sm text-dark/70 mb-4">
                  <strong>All pages cached for 24 hours:</strong> Homepage, Products, Categories, Brands, Featured Products.
                  After updating any content, click here to refresh ALL caches immediately and show fresh data across the entire site.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={async () => {
                      const isProduction = window.location.hostname === 'cigarro.in';
                      
                      if (!isProduction) {
                        toast.info('⚠️ Cache refresh only works in production.\n\nIn development, there is no cache - all data loads fresh from Supabase.', { duration: 5000 });
                        return;
                      }
                      
                      const loading = toast.loading('Refreshing cache...');
                      try {
                        const response = await fetch('https://cigarro.in/api/invalidate-cache', {
                          method: 'POST',
                        });
                        if (response.ok) {
                          toast.dismiss(loading);
                          toast.success('Cache refreshed! Changes will appear immediately.');
                        } else {
                          throw new Error('Failed');
                        }
                      } catch (error) {
                        toast.dismiss(loading);
                        toast.error('Failed to refresh cache');
                      }
                    }}
                    className="bg-canyon hover:bg-canyon/90 text-creme"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Cache Now
                  </Button>
                  
                  <Button
                    onClick={async () => {
                      console.log('🧪 Test Performance button clicked');
                      const loading = toast.loading('Testing performance...');
                      try {
                        const isProduction = window.location.hostname === 'cigarro.in';
                        console.log('🌍 Hostname:', window.location.hostname);
                        console.log('🏭 Is Production:', isProduction);
                        
                        let endpoints;
                        
                        if (!isProduction) {
                          console.log('💻 Development mode - Testing Supabase directly');
                          toast.dismiss(loading);
                          const devLoading = toast.loading('Testing Supabase connection...');
                          
                          // First test basic connection with timeout
                          console.log('🔌 Testing Supabase connection...');
                          console.log('📍 Supabase URL:', import.meta.env.VITE_SUPABASE_URL || 'NOT SET');
                          
                          try {
                            const connectionTimeout = new Promise((_, reject) => 
                              setTimeout(() => reject(new Error('Connection timeout (5s)')), 5000)
                            );
                            
                            const connectionTest = supabase
                              .from('categories')
                              .select('count')
                              .limit(1);
                            
                            const { data: testData, error: testError } = await Promise.race([
                              connectionTest,
                              connectionTimeout
                            ]) as any;
                            
                            if (testError) {
                              console.error('❌ Supabase connection failed:', testError);
                              toast.dismiss(devLoading);
                              toast.error(`Supabase Error: ${testError.message}\n\nCheck your database and RLS policies.`, { duration: 8000 });
                              return;
                            }
                            console.log('✅ Supabase connected successfully');
                          } catch (err: any) {
                            console.error('❌ Supabase connection error:', err);
                            toast.dismiss(devLoading);
                            
                            if (err.message.includes('timeout')) {
                              toast.error(`⏱️ Supabase connection timeout!\n\nYour database is not responding. Check:\n1. Internet connection\n2. Supabase project status\n3. .env credentials`, { duration: 10000 });
                            } else {
                              toast.error(`Cannot connect to Supabase: ${err?.message || 'Unknown error'}`, { duration: 8000 });
                            }
                            return;
                          }
                          
                          toast.dismiss(devLoading);
                          const perfLoading = toast.loading('Testing query performance...');
                          
                          // Test Supabase directly in development
                          const results = [];
                          
                          const tests = [
                            { name: 'Categories', query: () => supabase.from('categories').select('id, name, slug, image').limit(20) },
                            { name: 'Products', query: () => supabase.from('products').select('id, name, slug, brand, price, gallery_images').limit(50) },
                            { name: 'Homepage Data', query: () => supabase.from('hero_slides').select('*').limit(10) },
                            { name: 'Brands', query: () => supabase.from('brands').select('*').limit(20) },
                            { name: 'Featured Products', query: () => supabase.from('products').select('id, name, price').eq('is_featured', true).limit(12) },
                          ];
                          
                          console.log(`📡 Testing ${tests.length} Supabase queries...`);
                          
                          for (const test of tests) {
                            console.log(`🔍 Testing: ${test.name}`);
                            try {
                              const start = performance.now();
                              
                              // Add 10 second timeout
                              const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
                              );
                              
                              const { data, error } = await Promise.race([
                                test.query(),
                                timeoutPromise
                              ]) as any;
                              
                              const end = performance.now();
                              const time = Math.round(end - start);
                              
                              if (error) {
                                console.error(`   ❌ Error:`, error);
                              }
                              
                              const sizeBytes = data ? JSON.stringify(data).length : 0;
                              const sizeKB = sizeBytes >= 1024 ? `${Math.round(sizeBytes / 1024)}KB` : `${sizeBytes}B`;
                              
                              const result = {
                                name: test.name,
                                time,
                                cacheStatus: 'SUPABASE',
                                size: sizeKB,
                                status: !error ? '✅' : '❌',
                                error: error?.message || null
                              };
                              
                              console.log(`   ${result.status} ${time}ms | Direct DB | ${result.size}${error ? ` | Error: ${error.message}` : ''}`);
                              results.push(result);
                            } catch (err: any) {
                              console.error(`   ❌ Exception:`, err);
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
                          
                          console.log('✅ All Supabase tests completed');
                          toast.dismiss(perfLoading);
                          
                          // Show results
                          let message = '📊 Supabase Performance (Development):\n\n';
                          results.forEach(r => {
                            message += `${r.status} ${r.name}:\n`;
                            message += `   ⏱️ ${r.time}ms | 💾 Direct DB | 📦 ${r.size}\n\n`;
                          });
                          
                          const avgTime = Math.round(results.reduce((sum, r) => sum + r.time, 0) / results.length);
                          message += `Average: ${avgTime}ms (No cache - Direct Supabase)\n\n`;
                          message += `💡 Deploy to production to see cache performance (30-50ms expected)`;
                          
                          console.table(results);
                          console.log('📊 Supabase Performance Summary:', {
                            averageTime: `${avgTime}ms`,
                            mode: 'Development - Direct Database',
                            recommendation: 'Deploy to production for 10x faster cached responses'
                          });
                          
                          // Store results for display
                          setPerformanceResults({
                            mode: 'development',
                            results,
                            avgTime,
                            timestamp: new Date().toLocaleTimeString()
                          });
                          
                          toast.success(message, { duration: 10000 });
                          return;
                        }
                        
                        console.log('✅ Production detected, starting cache tests...');
                        
                        endpoints = [
                          { name: 'Categories', url: 'https://cigarro.in/api/categories' },
                          { name: 'Products', url: 'https://cigarro.in/api/products' },
                          { name: 'Homepage Data', url: 'https://cigarro.in/api/homepage-data' },
                          { name: 'Brands', url: 'https://cigarro.in/api/brands' },
                          { name: 'Featured Products', url: 'https://cigarro.in/api/featured-products' },
                        ];

                        const results = [];
                        
                        console.log(`📡 Testing ${endpoints.length} endpoints...`);
                        
                        for (const endpoint of endpoints) {
                          console.log(`🔍 Testing: ${endpoint.name} - ${endpoint.url}`);
                          const start = performance.now();
                          
                          try {
                            const response = await fetch(endpoint.url, {
                              cache: 'no-store', // Prevent browser cache interference
                              headers: {
                                'Accept': 'application/json',
                              },
                            });
                            
                            const data = await response.text();
                            const end = performance.now();
                            const time = Math.round(end - start);
                            
                            // Check Cloudflare's native cache status header
                            const cfCacheStatus = response.headers.get('cf-cache-status') || 'UNKNOWN';
                            const cacheControl = response.headers.get('cache-control') || 'none';
                            const age = response.headers.get('age') || '0';
                            const size = `${Math.round(data.length / 1024)}KB`;
                            
                            console.log(`   Response headers:`, {
                              'cf-cache-status': cfCacheStatus,
                              'cache-control': cacheControl,
                              'age': age,
                              'content-length': response.headers.get('content-length'),
                            });
                            
                            const result = {
                              name: endpoint.name,
                              time,
                              cacheStatus: cfCacheStatus,
                              size,
                              age: `${age}s`,
                              status: response.ok ? '✅' : '❌'
                            };
                            
                            console.log(`   ${result.status} ${time}ms | ${cfCacheStatus} | ${size} | Age: ${age}s`);
                            results.push(result);
                          } catch (err: any) {
                            console.error(`   ❌ Error testing ${endpoint.name}:`, err);
                            results.push({
                              name: endpoint.name,
                              time: 0,
                              cacheStatus: 'ERROR',
                              size: 'N/A',
                              age: 'N/A',
                              status: '❌',
                              error: err?.message || 'Unknown error'
                            });
                          }
                        }
                        
                        console.log('✅ All endpoint tests completed');

                        toast.dismiss(loading);
                        
                        // Create detailed results message
                        let message = '📊 Cloudflare CDN Cache Performance:\n\n';
                        results.forEach(r => {
                          const statusIcon = r.cacheStatus === 'HIT' ? '🟢' : r.cacheStatus === 'MISS' ? '🟡' : r.cacheStatus === 'DYNAMIC' ? '🔵' : '🔴';
                          message += `${r.status} ${r.name}:\n`;
                          message += `   ${statusIcon} ${r.cacheStatus} | ⏱️ ${r.time}ms | 📦 ${r.size} | Age: ${r.age}\n\n`;
                        });
                        
                        const validResults = results.filter(r => r.time > 0);
                        const avgTime = validResults.length > 0 ? Math.round(validResults.reduce((sum, r) => sum + r.time, 0) / validResults.length) : 0;
                        const hitCount = results.filter(r => r.cacheStatus === 'HIT').length;
                        const missCount = results.filter(r => r.cacheStatus === 'MISS').length;
                        const dynamicCount = results.filter(r => r.cacheStatus === 'DYNAMIC').length;
                        
                        message += `📈 Summary:\n`;
                        message += `Average: ${avgTime}ms\n`;
                        message += `🟢 HIT: ${hitCount} | 🟡 MISS: ${missCount} | 🔵 DYNAMIC: ${dynamicCount}\n\n`;
                        message += hitCount === results.length ? '🚀 Perfect! All cached!' : 
                                   hitCount > 0 ? '✅ Partial cache - Run again for more HITs' : 
                                   '⚠️ No cache - First request or cache purged';
                        
                        // Show in console for detailed view
                        console.table(results);
                        console.log('📊 Cloudflare CDN Cache Summary:', {
                          averageTime: `${avgTime}ms`,
                          cacheHitRate: `${hitCount}/${results.length}`,
                          hits: hitCount,
                          misses: missCount,
                          dynamic: dynamicCount,
                          performance: avgTime < 50 ? '🚀 Excellent (CDN cached)' : avgTime < 200 ? '✅ Good (Some cached)' : '⚠️ Slow (No cache)',
                          recommendation: hitCount === 0 ? 'Run test again to see cache HITs' : 'Cache working correctly'
                        });
                        
                        // Store results for display
                        setPerformanceResults({
                          mode: 'production',
                          results,
                          avgTime,
                          hitCount,
                          timestamp: new Date().toLocaleTimeString()
                        });
                        
                        console.log('📊 Showing results toast...');
                        toast.success(message, { duration: 10000 });
                        console.log('✅ Cache performance test complete!');
                      } catch (error) {
                        console.error('❌ Cache test error:', error);
                        toast.dismiss(loading);
                        toast.error('Failed to test cache performance');
                      }
                    }}
                    variant="outline"
                    className="border-canyon text-canyon hover:bg-canyon/10"
                  >
                    📊 Test Performance
                  </Button>
                </div>
                
                {/* Performance Results Display */}
                {performanceResults && (
                  <div className="mt-6 p-4 bg-creme-light rounded-lg border border-coyote">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-dark">
                        📊 Performance Test Results
                        <span className="ml-2 text-xs text-dark/60">
                          {performanceResults.mode === 'development' ? '(Development - Direct DB)' : '(Production - Cached)'}
                        </span>
                      </h4>
                      <span className="text-xs text-dark/60">{performanceResults.timestamp}</span>
                    </div>
                    
                    <div className="space-y-2">
                      {performanceResults.results.map((result: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white rounded border border-coyote/30">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{result.status}</span>
                            <span className="font-medium text-dark">{result.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className={`font-mono ${result.time < 100 ? 'text-green-600' : result.time < 300 ? 'text-yellow-600' : 'text-red-600'}`}>
                              ⏱️ {result.time}ms
                            </span>
                            <span className="text-dark/60">
                              💾 {result.cacheStatus}
                            </span>
                            <span className="text-dark/60">
                              📦 {result.size}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 p-3 bg-canyon/10 rounded border border-canyon/30">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-dark">Average Response Time:</span>
                        <span className={`text-lg font-mono font-bold ${performanceResults.avgTime < 100 ? 'text-green-600' : performanceResults.avgTime < 300 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {performanceResults.avgTime}ms
                        </span>
                      </div>
                      {performanceResults.mode === 'production' && performanceResults.hitCount !== undefined && (
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-medium text-dark">Cache Hit Rate:</span>
                          <span className="text-lg font-mono font-bold text-green-600">
                            {performanceResults.hitCount}/{performanceResults.results.length}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 text-sm text-dark/70">
                        {performanceResults.mode === 'development' ? (
                          <p>💡 Deploy to production to see 3-5x faster cached responses (30-50ms expected)</p>
                        ) : (
                          <p>
                            {performanceResults.avgTime < 100 ? '🚀 Excellent performance!' : 
                             performanceResults.avgTime < 300 ? '✅ Good performance' : 
                             '⚠️ Consider refreshing cache'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sitemap */}
          <div className="p-4 bg-white rounded-lg border border-coyote">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-canyon" />
                  <h3 className="font-medium text-dark">Sitemap Generator</h3>
                </div>
                <p className="text-sm text-dark/70 mb-4">
                  Your sitemap is generated dynamically at <code className="bg-coyote/20 px-1 py-0.5 rounded text-xs">cigarro.in/sitemap.xml</code> and cached for 1 hour. 
                  Purge the cache to force immediate regeneration with latest products, categories, and brands.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={handlePurgeSitemapCache}
                    disabled={isGeneratingSitemap}
                    className="bg-canyon hover:bg-canyon/90 text-creme"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingSitemap ? 'animate-spin' : ''}`} />
                    {isGeneratingSitemap ? 'Purging...' : 'Purge Cache'}
                  </Button>
                  <Button
                    onClick={() => window.open('https://cigarro.in/sitemap.xml', '_blank')}
                    variant="outline"
                    className="border-canyon text-canyon hover:bg-canyon hover:text-creme"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Sitemap
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account & Security Card */}
      <Card className="bg-creme-light border-coyote">
        <CardHeader>
          <CardTitle className="font-serif-premium text-dark">Account & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Admin Info */}
          <div className="p-4 bg-white rounded-lg border border-coyote">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-dark">Logged in as</p>
                <p className="text-lg font-semibold text-dark mt-1">
                  {adminProfile?.full_name || 'Admin User'}
                </p>
                <p className="text-sm text-dark/60 mt-0.5">
                  {adminProfile?.email}
                </p>
                {adminProfile?.is_admin && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-canyon/10 text-canyon text-xs font-medium mt-2">
                    Administrator
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="pt-2">
            <Button 
              variant="outline"
              onClick={handleSignOut}
              className="w-full sm:w-auto border-canyon text-canyon hover:bg-canyon hover:text-creme transition-all duration-200"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out of Admin Panel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
