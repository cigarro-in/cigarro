// ============================================================================
// SEO TAB - Search engine optimization
// ============================================================================

import { Search, Globe, Share2, Code, Info } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Badge } from '../../../../components/ui/badge';
import { ProductFormData } from '../../../../types/product';

interface SEOTabProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function SEOTab({ formData, onChange }: SEOTabProps) {
  // Calculate SEO score
  const calculateSEOScore = () => {
    let score = 0;
    const checks = [
      { field: formData.meta_title, weight: 20, label: 'Meta Title' },
      { field: formData.meta_description, weight: 20, label: 'Meta Description' },
      { field: formData.meta_keywords, weight: 10, label: 'Keywords' },
      { field: formData.canonical_url, weight: 10, label: 'Canonical URL' },
      { field: formData.og_title, weight: 10, label: 'OG Title' },
      { field: formData.og_description, weight: 10, label: 'OG Description' },
      { field: formData.og_image, weight: 10, label: 'OG Image' },
      { field: formData.twitter_title, weight: 5, label: 'Twitter Title' },
      { field: formData.twitter_description, weight: 5, label: 'Twitter Description' }
    ];

    checks.forEach(check => {
      if (check.field && check.field.length > 0) {
        score += check.weight;
      }
    });

    return { score, checks };
  };

  const { score, checks } = calculateSEOScore();

  return (
    <div className="space-y-6">
      {/* SEO Score */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-sans text-[var(--color-dark)]">SEO Score</CardTitle>
              <CardDescription className="text-[var(--color-dark)]/70">
                Overall search engine optimization quality
              </CardDescription>
            </div>
            <Badge
              className={
                score >= 80
                  ? 'bg-green-600'
                  : score >= 50
                  ? 'bg-yellow-600'
                  : 'bg-red-600'
              }
            >
              {score}/100
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checks.map((check, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-dark)]/70">{check.label}</span>
                <span className={check.field ? 'text-green-600' : 'text-[var(--color-dark)]/40'}>
                  {check.field ? '✓' : '○'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Basic SEO */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[var(--color-canyon)]" />
            <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Search Engine Listing</CardTitle>
          </div>
          <CardDescription className="text-[var(--color-dark)]/70">
            How your product appears in search results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta_title" className="text-[var(--color-dark)] font-medium">
              Meta Title
            </Label>
            <Input
              id="meta_title"
              value={formData.meta_title || ''}
              onChange={(e) => onChange({ meta_title: e.target.value })}
              placeholder={`${formData.name} | ${formData.brand} | Buy Online`}
              maxLength={60}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              {formData.meta_title?.length || 0}/60 characters (optimal: 50-60)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_description" className="text-[var(--color-dark)] font-medium">
              Meta Description
            </Label>
            <Textarea
              id="meta_description"
              value={formData.meta_description || ''}
              onChange={(e) => onChange({ meta_description: e.target.value })}
              placeholder="Brief description of your product for search results..."
              maxLength={160}
              rows={3}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] resize-none"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              {formData.meta_description?.length || 0}/160 characters (optimal: 150-160)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_keywords" className="text-[var(--color-dark)] font-medium">
              Keywords
            </Label>
            <Input
              id="meta_keywords"
              value={formData.meta_keywords || ''}
              onChange={(e) => onChange({ meta_keywords: e.target.value })}
              placeholder="cigarettes, marlboro, premium, online"
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              Comma-separated keywords
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="canonical_url" className="text-[var(--color-dark)] font-medium">
              Canonical URL
            </Label>
            <Input
              id="canonical_url"
              value={formData.canonical_url || ''}
              onChange={(e) => onChange({ canonical_url: e.target.value })}
              placeholder={`https://cigarro.in/product/${formData.slug || 'product-slug'}`}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              Preferred URL for this product
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Social Media (Open Graph) */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[var(--color-canyon)]" />
            <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Social Media Sharing</CardTitle>
          </div>
          <CardDescription className="text-[var(--color-dark)]/70">
            How your product appears when shared on social media
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="og_title" className="text-[var(--color-dark)] font-medium">
              Open Graph Title
            </Label>
            <Input
              id="og_title"
              value={formData.og_title || ''}
              onChange={(e) => onChange({ og_title: e.target.value })}
              placeholder={formData.meta_title || formData.name}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="og_description" className="text-[var(--color-dark)] font-medium">
              Open Graph Description
            </Label>
            <Textarea
              id="og_description"
              value={formData.og_description || ''}
              onChange={(e) => onChange({ og_description: e.target.value })}
              placeholder={formData.meta_description || formData.description}
              rows={2}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="og_image" className="text-[var(--color-dark)] font-medium">
              Open Graph Image URL
            </Label>
            <Input
              id="og_image"
              value={formData.og_image || ''}
              onChange={(e) => onChange({ og_image: e.target.value })}
              placeholder={formData.gallery_images[0] || 'https://...'}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              Recommended: 1200x630px
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Twitter Card */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--color-canyon)]" />
            <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Twitter Card</CardTitle>
          </div>
          <CardDescription className="text-[var(--color-dark)]/70">
            Customize appearance on Twitter/X
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="twitter_title" className="text-[var(--color-dark)] font-medium">
              Twitter Title
            </Label>
            <Input
              id="twitter_title"
              value={formData.twitter_title || ''}
              onChange={(e) => onChange({ twitter_title: e.target.value })}
              placeholder={formData.og_title || formData.meta_title || formData.name}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitter_description" className="text-[var(--color-dark)] font-medium">
              Twitter Description
            </Label>
            <Textarea
              id="twitter_description"
              value={formData.twitter_description || ''}
              onChange={(e) => onChange({ twitter_description: e.target.value })}
              placeholder={formData.og_description || formData.meta_description || formData.description}
              rows={2}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitter_image" className="text-[var(--color-dark)] font-medium">
              Twitter Image URL
            </Label>
            <Input
              id="twitter_image"
              value={formData.twitter_image || ''}
              onChange={(e) => onChange({ twitter_image: e.target.value })}
              placeholder={formData.og_image || formData.gallery_images[0] || 'https://...'}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
        <Info className="h-4 w-4 text-[var(--color-canyon)]" />
        <AlertDescription className="text-[var(--color-dark)]/70">
          <strong>SEO Tips:</strong> Fill in as many fields as possible for better search rankings. 
          If social media fields are empty, they'll fall back to basic SEO fields.
        </AlertDescription>
      </Alert>
    </div>
  );
}
