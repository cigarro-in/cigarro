import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ImageUpload } from './ui/ImageUpload';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SiteSettings {
  site_name: string;
  favicon_url: string;
  meta_title: string;
  meta_description: string;
}

export function SiteSettingsPage() {
  const { signOut } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: '',
    favicon_url: '',
    meta_title: '',
    meta_description: '',
  });

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
    const { error } = await supabase
      .from('site_settings')
      .update(settings)
      .eq('id', 1);

    if (error) {
      toast.error('Failed to save site settings');
    } else {
      toast.success('Site settings saved successfully');
    }
  };

  const handleInputChange = (field: keyof SiteSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="glass-card border-border/20">
      <CardHeader>
        <CardTitle className="font-serif-premium">Site Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Site Name</Label>
          <Input
            value={settings.site_name}
            onChange={(e) => handleInputChange('site_name', e.target.value)}
          />
        </div>
        <div>
          <Label>Favicon URL</Label>
          <ImageUpload
            imageUrl={settings.favicon_url}
            onImageUrlChange={(url) => handleInputChange('favicon_url', url || '')}
          />
        </div>
        <div>
          <Label>Default Meta Title</Label>
          <Input
            value={settings.meta_title}
            onChange={(e) => handleInputChange('meta_title', e.target.value)}
          />
        </div>
        <div>
          <Label>Default Meta Description</Label>
          <Textarea
            value={settings.meta_description}
            onChange={(e) => handleInputChange('meta_description', e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={handleSaveSettings} className="bg-accent text-accent-foreground">
            Save Settings
          </Button>
          <Button 
            variant="destructive" 
            onClick={signOut}
            className="px-6 py-2"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
