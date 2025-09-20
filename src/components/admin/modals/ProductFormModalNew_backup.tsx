import { useState, useEffect } from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { StandardModal } from './StandardModal';
import { EnhancedImageUpload } from '../../ui/EnhancedImageUpload';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';
import { productValidator, sanitizer } from '../../../utils/admin-validation';
import { auditLogger } from '../../../utils/audit-logger';
import { errorHandler } from '../../../utils/error-handler';

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  image_alt_text?: string;
  category_id: string;
  brand_id?: string;
  is_active: boolean;
  rating?: number;
  review_count?: number;
  specifications?: Record<string, any>;
  ingredients?: string;
  origin?: string;
  strength?: string;
  pack_size?: string;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSaved: () => void;
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  image_alt_text: string;
  category_id: string;
  brand_id: string;
  is_active: boolean;
  rating: number;
  review_count: number;
  specifications: Record<string, any>;
  ingredients: string;
  origin: string;
  strength: string;
  pack_size: string;
  meta_title: string;
  meta_description: string;
}

export function ProductFormModal({ 
  isOpen, 
  onClose, 
  product, 
  onSaved, 
  categories, 
  brands 
}: ProductFormModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    description: '',
    price: 0,
    stock: 0,
    image: '',
    image_alt_text: '',
    category_id: '',
    brand_id: '',
    is_active: true,
    rating: 0,
    review_count: 0,
    specifications: {},
    ingredients: '',
    origin: '',
    strength: '',
    pack_size: '',
    meta_title: '',
    meta_description: ''
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        price: product.price || 0,
        stock: product.stock || 0,
        image: product.image || '',
        image_alt_text: product.image_alt_text || '',
        category_id: product.category_id || '',
        brand_id: product.brand_id || '',
        is_active: product.is_active ?? true,
        rating: product.rating || 0,
        review_count: product.review_count || 0,
        specifications: product.specifications || {},
        ingredients: product.ingredients || '',
        origin: product.origin || '',
        strength: product.strength || '',
        pack_size: product.pack_size || '',
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || ''
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        price: 0,
        stock: 0,
        image: '',
        image_alt_text: '',
        category_id: '',
        brand_id: '',
        is_active: true,
        rating: 0,
        review_count: 0,
        specifications: {},
        ingredients: '',
        origin: '',
        strength: '',
        pack_size: '',
        meta_title: '',
        meta_description: ''
      });
    }
    setValidationErrors([]);
    setActiveTab('basic');
  }, [product, isOpen]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'name' && { slug: generateSlug(value) })
    }));
  };

  const validateForm = (): boolean => {
    const result = productValidator.validate(formData);
    setValidationErrors(result.errors);
    return result.isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const productData = {
        name: sanitizer.html(formData.name.trim()),
        slug: sanitizer.slug(formData.slug.trim()),
        description: formData.description.trim() || null,
        price: formData.price,
        stock: formData.stock,
        image: formData.image || null,
        image_alt_text: formData.image_alt_text.trim() || null,
        category_id: formData.category_id || null,
        brand_id: formData.brand_id || null,
        is_active: formData.is_active,
        rating: formData.rating,
        review_count: formData.review_count,
        specifications: Object.keys(formData.specifications).length > 0 ? formData.specifications : null,
        ingredients: formData.ingredients.trim() || null,
        origin: formData.origin.trim() || null,
        strength: formData.strength.trim() || null,
        pack_size: formData.pack_size.trim() || null,
        meta_title: formData.meta_title.trim() || null,
        meta_description: formData.meta_description.trim() || null
      };

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;

        // Log the action
        await auditLogger.logProduct(
          'UPDATE',
          product.id,
          product,
          productData
        );

        toast.success('Product updated successfully');
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) throw error;

        // Log the action
        await auditLogger.logProduct(
          'INSERT',
          data.id,
          null,
          productData
        );

        toast.success('Product created successfully');
      }

      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Error saving product:', error);
      const appError = errorHandler.handleSupabaseError(error, 'save_product');
      toast.error(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = validationErrors.length === 0 && formData.name.trim() !== '';

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add New Product'}
      onSave={handleSave}
      saveLabel={product ? 'Update' : 'Create'}
      isLoading={isLoading}
      isValid={isValid}
      validationErrors={validationErrors}
      size="2xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Product Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter product name"
                className="w-full"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-sm font-medium">
                Slug *
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                placeholder="product-slug"
                className="w-full"
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter product description"
              rows={4}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm font-medium">
                Price *
              </Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock" className="text-sm font-medium">
                Stock Quantity
              </Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => handleInputChange('stock', parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id" className="text-sm font-medium">
                Category *
              </Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => handleInputChange('category_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand_id" className="text-sm font-medium">
                Brand
              </Label>
              <Select
                value={formData.brand_id}
                onValueChange={(value) => handleInputChange('brand_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Product Image</Label>
            <EnhancedImageUpload
              imageUrl={formData.image}
              onImageUrlChange={(url) => handleInputChange('image', url)}
              bucket="product_images"
              folder="products"
              maxSize={5}
              allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_alt_text" className="text-sm font-medium">
              Image Alt Text
            </Label>
            <Input
              id="image_alt_text"
              value={formData.image_alt_text}
              onChange={(e) => handleInputChange('image_alt_text', e.target.value)}
              placeholder="Describe the image for accessibility"
              maxLength={125}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin" className="text-sm font-medium">
                Origin
              </Label>
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) => handleInputChange('origin', e.target.value)}
                placeholder="Product origin"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strength" className="text-sm font-medium">
                Strength
              </Label>
              <Input
                id="strength"
                value={formData.strength}
                onChange={(e) => handleInputChange('strength', e.target.value)}
                placeholder="Product strength"
                maxLength={50}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pack_size" className="text-sm font-medium">
                Pack Size
              </Label>
              <Input
                id="pack_size"
                value={formData.pack_size}
                onChange={(e) => handleInputChange('pack_size', e.target.value)}
                placeholder="Pack size"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ingredients" className="text-sm font-medium">
                Ingredients
              </Label>
              <Input
                id="ingredients"
                value={formData.ingredients}
                onChange={(e) => handleInputChange('ingredients', e.target.value)}
                placeholder="Product ingredients"
                maxLength={500}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rating" className="text-sm font-medium">
                Rating
              </Label>
              <Input
                id="rating"
                type="number"
                value={formData.rating}
                onChange={(e) => handleInputChange('rating', parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                min="0"
                max="5"
                step="0.1"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review_count" className="text-sm font-medium">
                Review Count
              </Label>
              <Input
                id="review_count"
                type="number"
                value={formData.review_count}
                onChange={(e) => handleInputChange('review_count', parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
                className="w-full"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta_title" className="text-sm font-medium">
              Meta Title
            </Label>
            <Input
              id="meta_title"
              value={formData.meta_title}
              onChange={(e) => handleInputChange('meta_title', e.target.value)}
              placeholder="SEO title for search engines"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              {formData.meta_title.length}/60 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_description" className="text-sm font-medium">
              Meta Description
            </Label>
            <Textarea
              id="meta_description"
              value={formData.meta_description}
              onChange={(e) => handleInputChange('meta_description', e.target.value)}
              placeholder="SEO description for search engines"
              rows={3}
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">
              {formData.meta_description.length}/160 characters
            </p>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Product Status</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active" className="text-sm font-medium">
                Active (visible to customers)
              </Label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </StandardModal>
  );
}
