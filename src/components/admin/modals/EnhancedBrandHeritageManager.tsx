import { useState, useEffect } from 'react';
import { Settings, Save, X, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Alert, AlertDescription } from '../../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { SingleImageUpload, MultipleImageUpload } from '../../ui/UnifiedImageUpload';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';

interface BrandHeritageConfig {
  title: string;
  subtitle: string;
  description: string;
  background_image: string;
  gallery_images: string[];
  button_text: string;
  button_url: string;
  is_enabled: boolean;
  stats: {
    years_experience: string;
    products_crafted: string;
    satisfied_customers: string;
    awards_won: string;
  };
}

interface BrandHeritageManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function EnhancedBrandHeritageManager({ open, onOpenChange, onUpdate }: BrandHeritageManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<BrandHeritageConfig>({
    title: 'Our Heritage',
    subtitle: 'Crafting Excellence Since 1952',
    description: 'For over seven decades, we have been dedicated to the art of tobacco cultivation and the creation of premium products that embody tradition, quality, and innovation.',
    background_image: '',
    gallery_images: [],
    button_text: 'Learn More',
    button_url: '/about',
    is_enabled: true,
    stats: {
      years_experience: '70+',
      products_crafted: '500+',
      satisfied_customers: '10,000+',
      awards_won: '25+'
    }
  });

  useEffect(() => {
    if (open) {
      loadBrandHeritageData();
    }
  }, [open]);

  const loadBrandHeritageData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('section_configurations')
        .select('*')
        .eq('section_name', 'brand_heritage')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const config = data.config || {};
        setFormData({
          title: data.title || 'Our Heritage',
          subtitle: data.subtitle || 'Crafting Excellence Since 1952',
          description: data.description || 'For over seven decades, we have been dedicated to the art of tobacco cultivation and the creation of premium products that embody tradition, quality, and innovation.',
          background_image: data.background_image || '',
          gallery_images: config.gallery_images || [],
          button_text: data.button_text || 'Learn More',
          button_url: data.button_url || '/about',
          is_enabled: data.is_enabled !== false,
          stats: {
            years_experience: config.stats?.years_experience || '70+',
            products_crafted: config.stats?.products_crafted || '500+',
            satisfied_customers: config.stats?.satisfied_customers || '10,000+',
            awards_won: config.stats?.awards_won || '25+'
          }
        });
      }
    } catch (error) {
      console.error('Error loading brand heritage data:', error);
      toast.error('Failed to load brand heritage data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('section_configurations')
        .upsert({
          section_name: 'brand_heritage',
          title: formData.title,
          subtitle: formData.subtitle,
          description: formData.description,
          background_image: formData.background_image,
          button_text: formData.button_text,
          button_url: formData.button_url,
          is_enabled: formData.is_enabled,
          config: {
            gallery_images: formData.gallery_images,
            stats: formData.stats
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_name'
        });

      if (error) throw error;

      toast.success('Brand Heritage settings saved successfully');
      onUpdate();
    } catch (error) {
      console.error('Error saving brand heritage data:', error);
      toast.error('Failed to save brand heritage settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatsChange = (key: keyof typeof formData.stats, value: string) => {
    setFormData(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        [key]: value
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Brand Heritage Management
          </DialogTitle>
          <DialogDescription>
            Configure your brand heritage section to tell your company's story and showcase your legacy. Customize content, images, and statistics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              Configure your brand heritage section to tell your company's story and showcase your legacy.
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading brand heritage data...</p>
            </div>
          ) : (
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Section Content</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="title">Main Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter main title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subtitle">Subtitle</Label>
                      <Input
                        id="subtitle"
                        value={formData.subtitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="Enter subtitle"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter section description"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="button_text">Button Text</Label>
                        <Input
                          id="button_text"
                          value={formData.button_text}
                          onChange={(e) => setFormData(prev => ({ ...prev, button_text: e.target.value }))}
                          placeholder="e.g., Learn More"
                        />
                      </div>
                      <div>
                        <Label htmlFor="button_url">Button URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="button_url"
                            value={formData.button_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, button_url: e.target.value }))}
                            placeholder="e.g., /about"
                          />
                          {formData.button_url && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(formData.button_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="images" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Background Image</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Main background image for the brand heritage section
                    </p>
                  </CardHeader>
                  <CardContent>
                    <SingleImageUpload
                      imageUrl={formData.background_image || null}
                      onImageUrlChange={(url) => setFormData(prev => ({ ...prev, background_image: url || '' }))}
                      showSelector={true}
                      title="Select Background Image"
                      description="Choose a background image that represents your brand heritage"
                      aspectRatio="landscape"
                      size="lg"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Gallery Images</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Additional images to showcase your brand history and heritage
                    </p>
                  </CardHeader>
                  <CardContent>
                    <MultipleImageUpload
                      imageUrls={formData.gallery_images}
                      onImageUrlsChange={(urls) => setFormData(prev => ({ ...prev, gallery_images: urls }))}
                      showSelector={true}
                      title="Select Gallery Images"
                      description="Choose images that tell your brand's story"
                      maxImages={8}
                      size="md"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Brand Statistics</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Showcase key numbers that highlight your brand's achievements
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="years_experience">Years of Experience</Label>
                        <Input
                          id="years_experience"
                          value={formData.stats.years_experience}
                          onChange={(e) => handleStatsChange('years_experience', e.target.value)}
                          placeholder="e.g., 70+"
                        />
                      </div>
                      <div>
                        <Label htmlFor="products_crafted">Products Crafted</Label>
                        <Input
                          id="products_crafted"
                          value={formData.stats.products_crafted}
                          onChange={(e) => handleStatsChange('products_crafted', e.target.value)}
                          placeholder="e.g., 500+"
                        />
                      </div>
                      <div>
                        <Label htmlFor="satisfied_customers">Satisfied Customers</Label>
                        <Input
                          id="satisfied_customers"
                          value={formData.stats.satisfied_customers}
                          onChange={(e) => handleStatsChange('satisfied_customers', e.target.value)}
                          placeholder="e.g., 10,000+"
                        />
                      </div>
                      <div>
                        <Label htmlFor="awards_won">Awards Won</Label>
                        <Input
                          id="awards_won"
                          value={formData.stats.awards_won}
                          onChange={(e) => handleStatsChange('awards_won', e.target.value)}
                          placeholder="e.g., 25+"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Section Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="section_enabled"
                        checked={formData.is_enabled}
                        onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                      />
                      <Label htmlFor="section_enabled">Enable Brand Heritage Section</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When disabled, this section will not appear on the homepage
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg p-4 bg-muted/20">
                      <h3 className="text-lg font-bold">{formData.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{formData.subtitle}</p>
                      <p className="text-sm mb-4">{formData.description}</p>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="font-bold">{formData.stats.years_experience}</div>
                          <div className="text-xs text-muted-foreground">Years</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold">{formData.stats.products_crafted}</div>
                          <div className="text-xs text-muted-foreground">Products</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold">{formData.stats.satisfied_customers}</div>
                          <div className="text-xs text-muted-foreground">Customers</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold">{formData.stats.awards_won}</div>
                          <div className="text-xs text-muted-foreground">Awards</div>
                        </div>
                      </div>
                      {formData.button_text && (
                        <Button size="sm" variant="outline">
                          {formData.button_text}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
