// ============================================================================
// MEDIA & SEO STEP - Gallery Management & SEO Optimization
// Bulk image upload with AI-powered SEO
// ============================================================================

import { useState } from 'react';
import { Sparkles, Image as ImageIcon, TrendingUp } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Progress } from '../../../../components/ui/progress';
import { ProductFormData } from '../../../../types/product';
import { MultipleImageUpload } from '../../../../components/ui/MultipleImageUpload';
import { toast } from 'sonner';

interface MediaSEOStepProps {
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
}

export function MediaSEOStep({ formData, setFormData }: MediaSEOStepProps) {
  const [generatingSEO, setGeneratingSEO] = useState(false);

  const calculateSEOScore = (): number => {
    let score = 0;
    const checks = [
      { condition: formData.meta_title && formData.meta_title.length >= 30 && formData.meta_title.length <= 60, points: 20 },
      { condition: formData.meta_description && formData.meta_description.length >= 120 && formData.meta_description.length <= 160, points: 20 },
      { condition: formData.meta_keywords && formData.meta_keywords.split(',').length >= 3, points: 15 },
      { condition: formData.og_title && formData.og_title.length > 0, points: 15 },
      { condition: formData.og_description && formData.og_description.length > 0, points: 15 },
      { condition: formData.gallery_images.length >= 3, points: 15 }
    ];

    checks.forEach(check => {
      if (check.condition) score += check.points;
    });

    return score;
  };

  const seoScore = calculateSEOScore();

  const getSEOScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSEOScoreBadge = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const handleAutoGenerateSEO = async () => {
    setGeneratingSEO(true);
    try {
      // Simulate AI generation - in production, call your AI service
      await new Promise(resolve => setTimeout(resolve, 1500));

      const meta_title = `${formData.name} - ${formData.brand} | Premium Cigarettes Online`;
      const meta_description = `Buy ${formData.name} by ${formData.brand} online. Premium quality cigarettes at the best price. Fast delivery across India. Shop now!`;
      const meta_keywords = `${formData.brand}, ${formData.name}, cigarettes, tobacco, premium, online, buy`;
      
      setFormData({
        ...formData,
        meta_title,
        meta_description,
        meta_keywords,
        og_title: meta_title,
        og_description: meta_description,
        og_image: formData.gallery_images[0] || '',
        twitter_title: meta_title,
        twitter_description: meta_description,
        twitter_image: formData.gallery_images[0] || ''
      });

      toast.success('SEO metadata generated successfully!');
    } catch (error) {
      console.error('SEO generation error:', error);
      toast.error('Failed to generate SEO');
    } finally {
      setGeneratingSEO(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Gallery */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)] flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[var(--color-canyon)]" />
            Product Gallery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MultipleImageUpload
            imageUrls={formData.gallery_images}
            onImageUrlsChange={(urls) => setFormData({ ...formData, gallery_images: urls })}
          />
          <div className="space-y-2">
            <Label htmlFor="image_alt_text" className="text-[var(--color-dark)] font-semibold">
              Image Alt Text
              <span className="text-xs font-normal text-[var(--color-dark)]/60 ml-2">For accessibility & SEO</span>
            </Label>
            <Input
              id="image_alt_text"
              value={formData.image_alt_text || ''}
              onChange={(e) => setFormData({ ...formData, image_alt_text: e.target.value })}
              placeholder="e.g., Premium cigarette pack front view"
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO Score Dashboard */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[var(--color-dark)] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--color-canyon)]" />
              SEO Optimization
            </CardTitle>
            <Button
              type="button"
              onClick={handleAutoGenerateSEO}
              disabled={!formData.name || !formData.brand || generatingSEO}
              className="bg-[var(--color-canyon)] text-white hover:bg-[var(--color-dark)]"
            >
              {generatingSEO ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Auto-Generate SEO
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SEO Score */}
          <div className="p-4 bg-[var(--color-creme)] rounded-lg border border-[var(--color-coyote)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[var(--color-dark)]">SEO Score</span>
              <Badge className={seoScore >= 80 ? 'bg-green-600' : seoScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'}>
                {getSEOScoreBadge(seoScore)}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={seoScore} className="flex-1 h-3" />
              <span className={`text-2xl font-bold ${getSEOScoreColor(seoScore)}`}>
                {seoScore}/100
              </span>
            </div>
          </div>

          {/* SEO Checklist */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[var(--color-dark)]">SEO Checklist</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className={formData.meta_title && formData.meta_title.length >= 30 && formData.meta_title.length <= 60 ? 'text-green-600' : 'text-[var(--color-dark)]/40'}>
                  {formData.meta_title && formData.meta_title.length >= 30 && formData.meta_title.length <= 60 ? '✅' : '⚪'}
                </span>
                <span className="text-[var(--color-dark)]/70">Meta title (30-60 chars)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={formData.meta_description && formData.meta_description.length >= 120 && formData.meta_description.length <= 160 ? 'text-green-600' : 'text-[var(--color-dark)]/40'}>
                  {formData.meta_description && formData.meta_description.length >= 120 && formData.meta_description.length <= 160 ? '✅' : '⚪'}
                </span>
                <span className="text-[var(--color-dark)]/70">Meta description (120-160 chars)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={formData.meta_keywords && formData.meta_keywords.split(',').length >= 3 ? 'text-green-600' : 'text-[var(--color-dark)]/40'}>
                  {formData.meta_keywords && formData.meta_keywords.split(',').length >= 3 ? '✅' : '⚪'}
                </span>
                <span className="text-[var(--color-dark)]/70">Keywords (at least 3)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={formData.og_title ? 'text-green-600' : 'text-[var(--color-dark)]/40'}>
                  {formData.og_title ? '✅' : '⚪'}
                </span>
                <span className="text-[var(--color-dark)]/70">Open Graph title</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={formData.gallery_images.length >= 3 ? 'text-green-600' : 'text-[var(--color-dark)]/40'}>
                  {formData.gallery_images.length >= 3 ? '✅' : '⚪'}
                </span>
                <span className="text-[var(--color-dark)]/70">Multiple images (3+)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta Tags */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Meta Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta_title" className="text-[var(--color-dark)] font-semibold">
              Meta Title
              <span className="text-xs font-normal text-[var(--color-dark)]/60 ml-2">
                {formData.meta_title?.length || 0}/60 chars
              </span>
            </Label>
            <Input
              id="meta_title"
              value={formData.meta_title || ''}
              onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
              placeholder="Product Name - Brand | Your Store"
              maxLength={60}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_description" className="text-[var(--color-dark)] font-semibold">
              Meta Description
              <span className="text-xs font-normal text-[var(--color-dark)]/60 ml-2">
                {formData.meta_description?.length || 0}/160 chars
              </span>
            </Label>
            <Textarea
              id="meta_description"
              value={formData.meta_description || ''}
              onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
              placeholder="Brief description that appears in search results..."
              rows={3}
              maxLength={160}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_keywords" className="text-[var(--color-dark)] font-semibold">
              Meta Keywords
              <span className="text-xs font-normal text-[var(--color-dark)]/60 ml-2">Comma-separated</span>
            </Label>
            <Input
              id="meta_keywords"
              value={formData.meta_keywords || ''}
              onChange={(e) => setFormData({ ...formData, meta_keywords: e.target.value })}
              placeholder="brand, product, category, type"
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Open Graph */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Social Media (Open Graph)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="og_title" className="text-[var(--color-dark)] font-semibold">
              OG Title
            </Label>
            <Input
              id="og_title"
              value={formData.og_title || ''}
              onChange={(e) => setFormData({ ...formData, og_title: e.target.value })}
              placeholder="Title for social media shares"
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="og_description" className="text-[var(--color-dark)] font-semibold">
              OG Description
            </Label>
            <Textarea
              id="og_description"
              value={formData.og_description || ''}
              onChange={(e) => setFormData({ ...formData, og_description: e.target.value })}
              placeholder="Description for social media shares..."
              rows={3}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
