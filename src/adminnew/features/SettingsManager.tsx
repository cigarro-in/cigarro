import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { getAccessToken } from '../../lib/auth/session';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { Save, RefreshCw, Globe, CreditCard, AlertCircle, Map, Database, ExternalLink, Zap, FileText, Cloud, Palette, Check, Truck } from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { DEFAULT_SHIPPING_METHODS, mergeShippingMethods, toShippingConfig, type ShippingMethod } from '../../lib/shipping';
import { resolveStoreSettings, type RawStoreSettings, type StoreSettings, type StoreStateMinAge } from '../../lib/storeSettings';
import { rupeesToPaise } from '../../lib/convex/money';
import { siteConfig } from '../../config/site';
import { useTheme } from '../../themes';
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
  active_theme: string | null;
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
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();
  const [settings, setSettings] = useState<SiteSettings>({
    id: 1,
    site_name: '',
    favicon_url: '',
    meta_title: '',
    meta_description: '',
    upi_id: '',
    active_theme: 'classic',
    updated_at: null,
    updated_by: null
  });
  const { themeId, availableThemes, setTheme } = useTheme();
  const [isSavingTheme, setIsSavingTheme] = useState<string | null>(null);

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

  const serverSettings = useQuery(api.content.getSiteSettings, { orgSlug: ORG_SLUG });
  const saveSettings = useMutation(api.adminCatalog.saveSiteSettings);
  const populatedRef = useRef(false);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>(DEFAULT_SHIPPING_METHODS);
  // Normalized per-store settings (defaults filled in, so the form shows what is live).
  const [store, setStore] = useState<StoreSettings>(() => resolveStoreSettings(null));

  // Populate once from Convex (singleton key "main" — no numeric id anymore).
  useEffect(() => {
    if (!serverSettings || populatedRef.current) return;
    populatedRef.current = true;
    setSettings({
      id: 1,
      site_name: serverSettings.siteName || '',
      favicon_url: serverSettings.faviconUrl || '',
      meta_title: serverSettings.metaTitle || '',
      meta_description: serverSettings.metaDescription || '',
      upi_id: serverSettings.upiId || '',
      active_theme: serverSettings.activeTheme || 'classic',
      updated_at: serverSettings.updatedAt
        ? new Date(serverSettings.updatedAt).toISOString()
        : null,
      updated_by: null,
    });
    setShippingMethods(mergeShippingMethods((serverSettings as any).shippingConfig));
    setStore(resolveStoreSettings(serverSettings as RawStoreSettings));
    setIsLoading(false);
    setIsDirty(false);
  }, [serverSettings]);

  const handleRegenerateSitemap = async () => {
    setIsRegeneratingSitemap(true);
    try {
      // Fetch the sitemap to trigger regeneration (it's dynamically generated)
      const response = await fetch('/sitemap.xml', { cache: 'no-store' });
      if (response.ok) {
        setOpOk('Sitemap regenerated successfully');
      } else {
        throw new Error('Failed to regenerate sitemap');
      }
    } catch (error) {
      console.error('Error regenerating sitemap:', error);
      setOpError('Failed to regenerate sitemap');
    } finally {
      setIsRegeneratingSitemap(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      // Clear browser cache for the site (Convex re-reads fresh on next visit)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      setOpOk('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      setOpError('Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handlePurgeCloudflareCache = async () => {
    const isProduction = window.location.hostname === siteConfig.domain;

    if (!isProduction) {
      setOpOk('Cloudflare cache purge only works in production. In development, there is no CDN cache - all data loads fresh from Convex.');
      return;
    }

    setIsPurgingCloudflare(true);

    try {
      const own = getAccessToken();
      const response = await fetch(`https://${siteConfig.domain}/api/invalidate-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(own ? { Authorization: `Bearer ${own}` } : {}),
        },
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        const modeNote = data.mode === 'warm' ? ' (warmed — add purge credentials for true purges)' : '';
        setOpOk(`Cloudflare cache purged! ${successCount}/${totalCount} endpoints cleared${modeNote}.`);
      } else {
        console.error('Cache purge failed:', data);
        setOpError(data.error || 'Failed to purge Cloudflare cache');
      }
    } catch (error) {
      console.error('Cache purge error:', error);
      setOpError('Failed to purge Cloudflare cache. Check console for details.');
    } finally {
      setIsPurgingCloudflare(false);
    }
  };

  const handleTestPerformance = async () => {
    setIsTestingPerformance(true);

    try {
      // Always test the live HTTP endpoints (same signal in dev and prod —
      // no direct-DB branch, so no Supabase dependency here).

      const endpoints = [
        { name: 'Homepage Data', url: `https://${siteConfig.domain}/api/homepage-data` },
        { name: 'Categories', url: `https://${siteConfig.domain}/api/categories` },
        { name: 'Products', url: `https://${siteConfig.domain}/api/products` },
        { name: 'Brands', url: `https://${siteConfig.domain}/api/brands` },
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

        setOpOk(`CDN Performance: Average ${avgTime}ms, ${hitCount}/${results.length} cache hits`);
    } catch (error) {
      console.error('Performance test error:', error);
      setOpError('Failed to test performance');
    } finally {
      setIsTestingPerformance(false);
    }
  };

  const handleSave = async () => {
    // UPI ID validation if provided
    if (settings.upi_id && settings.upi_id.trim()) {
      const upiPattern = /^[\w.-]+@[\w.-]+$/;
      if (!upiPattern.test(settings.upi_id.trim())) {
        setOpError('Invalid UPI ID format. Expected format: username@provider');
        return;
      }
    }

    const brandColor = store.brand.brandColor.trim();
    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      setOpError('Brand colour must be a hex value like #8B4513');
      return;
    }
    const ages = [store.ageGate.minAge, ...store.ageGate.stateMinAge.map((r) => r.minAge)];
    if (ages.some((a) => !Number.isInteger(a) || a < 0 || a > 100)) {
      setOpError('Minimum ages must be whole numbers between 0 and 100');
      return;
    }

    setIsSaving(true);
    try {
      // updatedBy stamps server-side from the Convex identity.
      await saveSettings({
        orgSlug: ORG_SLUG,
        siteName: settings.site_name?.trim() || undefined,
        metaTitle: settings.meta_title?.trim() || undefined,
        metaDescription: settings.meta_description?.trim() || undefined,
        upiId: settings.upi_id?.trim() || undefined,
        shippingConfig: toShippingConfig(shippingMethods),
        brand: {
          logoUrl: store.brand.logoUrl.trim() || undefined,
          faviconUrl: store.brand.faviconUrl.trim() || undefined,
          brandColor: brandColor || undefined,
        },
        business: {
          legalName: store.business.legalName.trim() || undefined,
          gstin: store.business.gstin.trim() || undefined,
          supportEmail: store.business.supportEmail.trim() || undefined,
          supportPhone: store.business.supportPhone.trim() || undefined,
          address: {
            line1: store.business.address.line1.trim() || undefined,
            line2: store.business.address.line2.trim() || undefined,
            city: store.business.address.city.trim() || undefined,
            state: store.business.address.state.trim() || undefined,
            pincode: store.business.address.pincode.trim() || undefined,
          },
          openingHours: store.business.openingHours.trim() || undefined,
        },
        ageGate: {
          enabled: store.ageGate.enabled,
          minAge: store.ageGate.minAge,
          stateMinAge: store.ageGate.stateMinAge
            .map((r) => ({ state: r.state.trim(), minAge: r.minAge }))
            .filter((r) => r.state !== ''),
        },
        referralRewardPaise: rupeesToPaise(store.referralRewardRupees),
        seo: {
          titleTemplate: store.seo.titleTemplate.trim() || undefined,
          defaultDescription: store.seo.defaultDescription.trim() || undefined,
          googleSiteVerification: store.seo.googleSiteVerification.trim() || undefined,
          bingSiteVerification: store.seo.bingSiteVerification.trim() || undefined,
          gaMeasurementId: store.seo.gaMeasurementId.trim() || undefined,
        },
        socials: {
          instagram: store.socials.instagram.trim() || undefined,
          facebook: store.socials.facebook.trim() || undefined,
          x: store.socials.x.trim() || undefined,
          youtube: store.socials.youtube.trim() || undefined,
          whatsapp: store.socials.whatsapp.trim() || undefined,
        },
      });

      setOpOk('Settings updated successfully');
      setIsDirty(false);
    } catch (error: any) {
      console.error('Error updating settings:', error);
      setOpError(`Failed to update settings: ${error?.data?.code || error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectTheme = async (newThemeId: string) => {
    if (newThemeId === themeId) return;
    setIsSavingTheme(newThemeId);
    try {
      await saveSettings({ orgSlug: ORG_SLUG, activeTheme: newThemeId });
      setTheme(newThemeId);
      setSettings(prev => ({ ...prev, active_theme: newThemeId }));
      setOpOk(`Switched to ${availableThemes.find(t => t.id === newThemeId)?.name}`);
    } catch (error: any) {
      setOpError(`Failed to switch theme: ${error?.data?.code || error.message || 'Unknown error'}`);
    } finally {
      setIsSavingTheme(null);
    }
  };

  const updateShippingMethod = (id: string, patch: Partial<ShippingMethod>) => {
    setShippingMethods((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    setIsDirty(true);
  };

  // Reset = repopulate from the live Convex singleton (reactive, no fetch).
  const handleReset = () => {
    if (!serverSettings) return;
    setShippingMethods(mergeShippingMethods((serverSettings as any).shippingConfig));
    setStore(resolveStoreSettings(serverSettings as RawStoreSettings));
    populatedRef.current = false;
    setSettings({
      id: 1,
      site_name: serverSettings.siteName || '',
      favicon_url: serverSettings.faviconUrl || '',
      meta_title: serverSettings.metaTitle || '',
      meta_description: serverSettings.metaDescription || '',
      upi_id: serverSettings.upiId || '',
      active_theme: serverSettings.activeTheme || 'classic',
      updated_at: serverSettings.updatedAt
        ? new Date(serverSettings.updatedAt).toISOString()
        : null,
      updated_by: null,
    });
    populatedRef.current = true;
    setIsDirty(false);
  };

  const handleChange = (field: keyof SiteSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // Patch one object section of the normalized store settings.
  const patchSection = <K extends 'brand' | 'business' | 'ageGate' | 'seo' | 'socials'>(
    key: K,
    patch: Partial<StoreSettings[K]>,
  ) => {
    setStore((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }) as StoreSettings);
    setIsDirty(true);
  };

  const patchAddress = (patch: Partial<StoreSettings['business']['address']>) => {
    setStore((prev) => ({
      ...prev,
      business: { ...prev.business, address: { ...prev.business.address, ...patch } },
    }));
    setIsDirty(true);
  };

  const setStateRules = (rules: StoreStateMinAge[]) => patchSection('ageGate', { stateMinAge: rules });

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: no-preference)').matches ? 'smooth' : 'auto',
      block: 'start',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Site Settings"
        description="Manage your website configuration"
      >
        <Button variant="outline" onClick={handleReset} disabled={isSaving}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !isDirty}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6 max-w-400 mx-auto">
        <InlineStatus status={opStatus} />
        <nav aria-label="Jump to settings section" className="flex gap-1 overflow-x-auto border-b pb-2">
          {([
            ['settings-store', 'Store'],
            ['settings-brand', 'Brand'],
            ['settings-business', 'Business'],
            ['settings-age', 'Age gate'],
            ['settings-seo', 'SEO'],
            ['settings-payments', 'Payments'],
            ['settings-delivery', 'Delivery'],
            ['settings-performance', 'Performance'],
          ] as const).map(([id, label]) => (
            <Button key={id} type="button" variant="ghost" size="sm" onClick={() => jumpTo(id)}>
              {label}
            </Button>
          ))}
        </nav>
        {/* Storefront Theme */}
        <AdminCard id="settings-store" className="scroll-mt-24">
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Palette className="mr-2 h-5 w-5" />
              Storefront Theme
            </AdminCardTitle>
            <AdminCardDescription>
              Choose which template is shown to customers. Switching applies immediately.
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableThemes.map((t) => {
                const active = t.id === themeId;
                const saving = isSavingTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTheme(t.id)}
                    disabled={saving}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${active ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-border'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{t.name}</h4>
                      {active && <Check className="h-4 w-4 text-primary" />}
                      {saving && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* General Settings */}
        <AdminCard id="settings-general" className="scroll-mt-24">
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
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="meta_title">Meta Title</Label>
              <Input
                id="meta_title"
                value={settings.meta_title || ''}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                placeholder="SEO title for your website"
              />
              <p className="text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
                This appears in search engine results below the title
              </p>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Brand */}
        <AdminCard id="settings-brand" className="scroll-mt-24">
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Palette className="mr-2 h-5 w-5" />
              Brand
            </AdminCardTitle>
            <AdminCardDescription>
              Logo, favicon and the accent colour used across the storefront
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Logo</Label>
                <SingleImagePicker
                  value={store.brand.logoUrl || null}
                  onChange={(url) => patchSection('brand', { logoUrl: url || '' })}
                  searchHint={store.name ? `${store.name} logo` : undefined}
                />
              </div>
              <div className="space-y-1">
                <Label>Favicon</Label>
                <SingleImagePicker
                  value={store.brand.faviconUrl || null}
                  onChange={(url) => patchSection('brand', { faviconUrl: url || '' })}
                  searchHint={store.name ? `${store.name} favicon` : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 32x32px or 64x64px .ico or .png
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="brand_color">Brand colour</Label>
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="color"
                  aria-label="Brand colour picker"
                  value={/^#[0-9a-fA-F]{6}$/.test(store.brand.brandColor) ? store.brand.brandColor : siteConfig.theme.primaryColor}
                  onChange={(e) => patchSection('brand', { brandColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-border/30 bg-transparent p-0.5"
                />
                <Input
                  id="brand_color"
                  value={store.brand.brandColor}
                  onChange={(e) => patchSection('brand', { brandColor: e.target.value })}
                  placeholder={siteConfig.theme.primaryColor}
                />
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Business details */}
        <AdminCard id="settings-business" className="scroll-mt-24">
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Business Details
            </AdminCardTitle>
            <AdminCardDescription>
              Legal name, tax number, contact and address shown on invoices and the contact page
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="legal_name">Legal name</Label>
                <Input
                  id="legal_name"
                  value={store.business.legalName}
                  onChange={(e) => patchSection('business', { legalName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={store.business.gstin}
                  onChange={(e) => patchSection('business', { gstin: e.target.value })}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="support_email">Support email</Label>
                <Input
                  id="support_email"
                  type="email"
                  value={store.business.supportEmail}
                  onChange={(e) => patchSection('business', { supportEmail: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="support_phone">Support phone</Label>
                <Input
                  id="support_phone"
                  value={store.business.supportPhone}
                  onChange={(e) => patchSection('business', { supportPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                ['line1', 'Address line 1'],
                ['line2', 'Address line 2'],
                ['city', 'City'],
                ['state', 'State'],
                ['pincode', 'PIN code'],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`address_${field}`}>{label}</Label>
                  <Input
                    id={`address_${field}`}
                    value={store.business.address[field]}
                    onChange={(e) => patchAddress({ [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="opening_hours">Opening hours</Label>
              <Input
                id="opening_hours"
                value={store.business.openingHours}
                onChange={(e) => patchSection('business', { openingHours: e.target.value })}
                placeholder="Mon-Sat 10:00-19:00"
              />
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Age gate and referral */}
        <AdminCard id="settings-age" className="scroll-mt-24">
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Age Gate & Referrals
            </AdminCardTitle>
            <AdminCardDescription>
              Entry age rules shown to visitors, and the reward paid for a referred first order
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border/20 rounded-lg">
              <div>
                <Label>Show age gate</Label>
                <p className="text-xs text-muted-foreground">
                  {store.ageGate.enabled ? 'Visitors must confirm their age before browsing' : 'No age check on entry'}
                </p>
              </div>
              <Switch
                checked={store.ageGate.enabled}
                onCheckedChange={(checked) => patchSection('ageGate', { enabled: checked })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="min_age">Minimum age</Label>
                <Input
                  id="min_age"
                  type="number"
                  min={0}
                  max={100}
                  value={store.ageGate.minAge}
                  onChange={(e) => patchSection('ageGate', { minAge: Number(e.target.value) || 0 })}
                  className="max-w-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="referral_reward">Referral reward (₹)</Label>
                <Input
                  id="referral_reward"
                  type="number"
                  min={0}
                  value={store.referralRewardRupees}
                  onChange={(e) => {
                    setStore((prev) => ({ ...prev, referralRewardRupees: Math.max(0, Number(e.target.value) || 0) }));
                    setIsDirty(true);
                  }}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Paid to both people when a referred first order is delivered</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>State-specific minimum ages</Label>
              {store.ageGate.stateMinAge.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    aria-label="State"
                    className="min-w-0 flex-1"
                    value={rule.state}
                    placeholder="Karnataka"
                    onChange={(e) =>
                      setStateRules(store.ageGate.stateMinAge.map((r, i) => (i === idx ? { ...r, state: e.target.value } : r)))
                    }
                  />
                  <Input
                    aria-label="Minimum age for state"
                    className="w-32"
                    type="number"
                    min={0}
                    max={100}
                    value={rule.minAge}
                    onChange={(e) =>
                      setStateRules(store.ageGate.stateMinAge.map((r, i) => (i === idx ? { ...r, minAge: Number(e.target.value) || 0 } : r)))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStateRules(store.ageGate.stateMinAge.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStateRules([...store.ageGate.stateMinAge, { state: '', minAge: store.ageGate.minAge }])}
              >
                Add state rule
              </Button>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* SEO and social */}
        <AdminCard id="settings-seo" className="scroll-mt-24">
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Globe className="mr-2 h-5 w-5" />
              SEO & Social
            </AdminCardTitle>
            <AdminCardDescription>
              Title pattern, search verification codes and social profile links
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="seo_title_template">Title template</Label>
                <Input
                  id="seo_title_template"
                  value={store.seo.titleTemplate}
                  onChange={(e) => patchSection('seo', { titleTemplate: e.target.value })}
                  placeholder="%s | Your Store"
                />
                <p className="text-xs text-muted-foreground">%s is replaced by the page title</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="seo_default_description">Default description</Label>
                <Input
                  id="seo_default_description"
                  value={store.seo.defaultDescription}
                  onChange={(e) => patchSection('seo', { defaultDescription: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="google_verification">Google site verification</Label>
                <Input
                  id="google_verification"
                  value={store.seo.googleSiteVerification}
                  onChange={(e) => patchSection('seo', { googleSiteVerification: e.target.value })}
                  placeholder="Content value only"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bing_verification">Bing site verification</Label>
                <Input
                  id="bing_verification"
                  value={store.seo.bingSiteVerification}
                  onChange={(e) => patchSection('seo', { bingSiteVerification: e.target.value })}
                  placeholder="Content value only"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ga_id">Google Analytics ID</Label>
                <Input
                  id="ga_id"
                  value={store.seo.gaMeasurementId}
                  onChange={(e) => patchSection('seo', { gaMeasurementId: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                ['instagram', 'Instagram URL'],
                ['facebook', 'Facebook URL'],
                ['x', 'X (Twitter) URL'],
                ['youtube', 'YouTube URL'],
                ['whatsapp', 'WhatsApp link'],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`social_${field}`}>{label}</Label>
                  <Input
                    id={`social_${field}`}
                    value={store.socials[field]}
                    onChange={(e) => patchSection('socials', { [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Payment Settings */}
        <AdminCard id="settings-payments" className="scroll-mt-24">
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
              <p className="text-xs text-muted-foreground">
                This UPI ID will be used for all payment transactions. Format: username@provider
              </p>
            </div>

            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="text-sm text-warning">
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

        {/* Shipping Methods */}
        <AdminCard id="settings-delivery" className="scroll-mt-24">
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Truck className="mr-2 h-5 w-5" />
              Shipping Methods
            </AdminCardTitle>
            <AdminCardDescription>
              Enable/disable each option and set its price, label and delivery estimate. Applies to desktop + mobile checkout immediately.
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            {shippingMethods.map((m) => (
              <div key={m.id} className="p-4 border border-border/20 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="capitalize">{m.id}</Label>
                    <p className="text-xs text-muted-foreground">{m.enabled ? 'Shown at checkout' : 'Hidden from checkout'}</p>
                  </div>
                  <Switch
                    checked={m.enabled}
                    onCheckedChange={(checked) => updateShippingMethod(m.id, { enabled: checked })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Label</Label>
                    <Input
                      value={m.label}
                      onChange={(e) => updateShippingMethod(m.id, { label: e.target.value })}
                      placeholder="Standard Delivery"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Price (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={m.priceRupees}
                      onChange={(e) => updateShippingMethod(m.id, { priceRupees: Math.max(0, Number(e.target.value) || 0) })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Estimate</Label>
                    <Input
                      value={m.eta}
                      onChange={(e) => updateShippingMethod(m.id, { eta: e.target.value })}
                      placeholder="5-7 days"
                    />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              At least one method should stay enabled — checkout falls back to the first enabled one. ₹0 shows as “Free”.
            </p>
          </AdminCardContent>
        </AdminCard>

        {/* Cloudflare CDN Cache */}
        <AdminCard id="settings-performance" className="scroll-mt-24">
          <AdminCardHeader>
            <AdminCardTitle className="flex items-center">
              <Cloud className="mr-2 h-5 w-5" />
              Cloudflare CDN Cache
            </AdminCardTitle>
            <AdminCardDescription>
              Purge edge cache (bot HTML ~1h, API/data) after making content or price changes
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent className="space-y-4">
            <div className="p-4 bg-card border border-border/30 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-2">Purge All Cached Pages</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Clears the edge cache for key pages, sitemap and API endpoints (HTML prerender ~1h, data feeds).
                      After updating any content or prices, click here to refresh caches immediately across the entire site.
                    </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={handlePurgeCloudflareCache}
                      disabled={isPurgingCloudflare}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                <div className="mt-4 p-4 bg-white rounded-lg border border-border/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">
                      Performance Results
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({performanceResults.mode === 'development' ? 'Development - Direct DB' : 'Production - Cached'})
                      </span>
                    </h4>
                    <span className="text-xs text-muted-foreground">{performanceResults.timestamp}</span>
                  </div>

                  <div className="space-y-2">
                    {performanceResults.results.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 px-3 bg-background rounded border border-border/20">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{result.status}</span>
                          <span className="font-medium text-sm">{result.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className={`font-mono ${result.time < 100 ? 'text-success' : result.time < 300 ? 'text-sunflower' : 'text-destructive'}`}>
                            ⏱️ {result.time}ms
                          </span>
                          <span className="text-muted-foreground">
                            💾 {result.cacheStatus}
                          </span>
                          <span className="text-muted-foreground">
                            📦 {result.size}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 p-3 bg-primary/10 rounded border border-primary/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Average Response Time:</span>
                      <span className={`text-lg font-mono font-bold ${performanceResults.avgTime < 100 ? 'text-success' : performanceResults.avgTime < 300 ? 'text-sunflower' : 'text-destructive'}`}>
                        {performanceResults.avgTime}ms
                      </span>
                    </div>
                    {performanceResults.mode === 'production' && performanceResults.hitCount !== undefined && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-medium text-sm">Cache Hit Rate:</span>
                        <span className="text-lg font-mono font-bold text-success">
                          {performanceResults.hitCount}/{performanceResults.results.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="text-sm text-warning">
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
              <div className="p-4 border border-border/20 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Sitemap</h4>
                    <p className="text-xs text-muted-foreground">
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
                  className="text-xs text-info hover:underline flex items-center gap-1"
                >
                  View Sitemap <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Browser Cache */}
              <div className="p-4 border border-border/20 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Browser Cache</h4>
                    <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
                  Clears browser cache only, not CDN cache.
                </p>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Last Updated */}
        {settings.updated_at && (
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {new Date(settings.updated_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
