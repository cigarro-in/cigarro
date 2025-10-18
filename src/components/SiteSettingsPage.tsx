import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ImageUpload } from './ui/ImageUpload';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { LogOut, Save } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';

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
