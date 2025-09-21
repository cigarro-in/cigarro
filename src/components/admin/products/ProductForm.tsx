import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { toast } from 'sonner';
import { formatINR } from '../../../utils/currency';
import { supabase } from '../../../utils/supabase/client';
import { MultipleImageUpload } from '../../ui/MultipleImageUpload';

interface ProductVariant {
  id?: string;
  name: string;
  price: number;
  stock: number;
  attributes: { key: string; value: string }[];
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  strength: string;
  pack_size: string;
  specifications: Record<string, string>;
  ingredients: string[];
  gallery_images: string[];
  meta_title: string;
  meta_description: string;
  image_alt_text: string;
}

interface ProductFormProps {
  product?: Product | null;
  isActive?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

interface ProductFormData {
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  strength: string;
  pack_size: string;
  specifications: { key: string; value: string }[];
  ingredients: string;
  gallery_images: string[];
  meta_title: string;
  meta_description: string;
  image_alt_text: string;
  variants: ProductVariant[];
}

export function ProductForm({ product, isActive = true, onSave, onCancel, onDelete }: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    brand: '',
    price: 0,
    description: '',
    stock: 0,
    is_active: true,
    rating: 0,
    review_count: 0,
    origin: '',
    strength: '',
    pack_size: '',
    specifications: [{ key: '', value: '' }],
    ingredients: '',
    gallery_images: [],
    meta_title: '',
    meta_description: '',
    image_alt_text: '',
    variants: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        price: product.price,
        description: product.description,
        stock: product.stock,
        is_active: product.is_active,
        rating: product.rating,
        review_count: product.review_count,
        origin: product.origin || '',
        strength: product.strength || '',
        pack_size: product.pack_size || '',
        specifications: product.specifications 
          ? Object.entries(product.specifications).map(([key, value]) => ({ key, value }))
          : [{ key: '', value: '' }],
        ingredients: product.ingredients ? product.ingredients.join(', ') : '',
        gallery_images: product.gallery_images || [],
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || '',
        image_alt_text: product.image_alt_text || '',
        variants: []
      });
    }
  }, [product]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const handleSpecificationChange = (index: number, field: 'key' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.map((spec, i) =>
        i === index ? { ...spec, [field]: value } : spec
      )
    }));
  };

  const addSpecification = () => {
    setFormData(prev => ({
      ...prev,
      specifications: [...prev.specifications, { key: '', value: '' }]
    }));
  };

  const removeSpecification = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare data for submission
      const specifications = formData.specifications
        .filter(spec => spec.key && spec.value)
        .reduce((acc, spec) => ({ ...acc, [spec.key]: spec.value }), {});

      const ingredients = formData.ingredients
        .split(',')
        .map(ingredient => ingredient.trim())
        .filter(ingredient => ingredient);

      const productData = {
        name: formData.name,
        slug: formData.slug,
        brand: formData.brand,
        price: formData.price,
        description: formData.description,
        stock: formData.stock,
        is_active: formData.is_active,
        rating: formData.rating,
        review_count: formData.review_count,
        origin: formData.origin,
        strength: formData.strength,
        pack_size: formData.pack_size,
        specifications,
        ingredients,
        gallery_images: formData.gallery_images,
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
        image_alt_text: formData.image_alt_text
      };

      let error;
      if (product) {
        // Update existing product
        ({ error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id));
      } else {
        // Create new product
        ({ error } = await supabase
          .from('products')
          .insert([productData]));
      }

      if (error) throw error;

      toast.success(product ? 'Product updated successfully' : 'Product created successfully');
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!product || !onDelete) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${product.name}"? This will also delete all variants and cannot be undone.`
    );
    
    if (!confirmDelete) return;

    setLoading(true);
    try {
      // Delete all variants first
      const { error: variantsError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', product.id);

      if (variantsError) throw variantsError;

      // Delete the product
      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (productError) throw productError;

      toast.success('Product deleted successfully');
      onDelete();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVariant = async (variantId: string, variantName: string) => {
    if (!variantId) {
      // Remove from local state if it's a new variant
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.filter((_, i) => i !== formData.variants.findIndex(v => v.name === variantName))
      }));
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the variant "${variantName}"? This cannot be undone.`
    );
    
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        variants: prev.variants.filter(v => v.id !== variantId)
      }));

      toast.success('Variant deleted successfully');
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Failed to delete variant');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 admin-form">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-coyote/20">
          <TabsTrigger value="general" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">General Info</TabsTrigger>
          <TabsTrigger value="details" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">Details & Specs</TabsTrigger>
          <TabsTrigger value="variants" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">Variants</TabsTrigger>
          <TabsTrigger value="media" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">Media & SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="bg-creme-light border-coyote">
            <CardHeader>
              <CardTitle className="text-dark">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-dark font-medium">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter product name"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50 focus:border-canyon focus:ring-canyon"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="product-url-slug"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand">Brand *</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="Enter brand name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="Enter price"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter product description"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    placeholder="Enter stock quantity"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                  />
                </div>
                <div>
                  <Label htmlFor="rating">Rating</Label>
                  <Input
                    id="rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.rating || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, rating: parseFloat(e.target.value) || 0 }))}
                    placeholder="Enter rating"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                  />
                </div>
                <div>
                  <Label htmlFor="review_count">Review Count</Label>
                  <Input
                    id="review_count"
                    type="number"
                    value={formData.review_count || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, review_count: parseInt(e.target.value) || 0 }))}
                    placeholder="Enter review count"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                  />
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="origin">Origin</Label>
                  <Input
                    id="origin"
                    value={formData.origin}
                    onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                    placeholder="Country of origin"
                  />
                </div>
                <div>
                  <Label htmlFor="strength">Strength</Label>
                  <Input
                    id="strength"
                    value={formData.strength}
                    onChange={(e) => setFormData(prev => ({ ...prev, strength: e.target.value }))}
                    placeholder="e.g., Light, Medium, Strong"
                  />
                </div>
                <div>
                  <Label htmlFor="pack_size">Pack Size</Label>
                  <Input
                    id="pack_size"
                    value={formData.pack_size}
                    onChange={(e) => setFormData(prev => ({ ...prev, pack_size: e.target.value }))}
                    placeholder="e.g., 20 pieces"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ingredients">Ingredients (comma-separated)</Label>
                <Textarea
                  id="ingredients"
                  value={formData.ingredients}
                  onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
                  placeholder="Tobacco, Paper, Filter..."
                  rows={3}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Specifications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSpecification}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Specification
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.specifications.map((spec, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Property name"
                        value={spec.key}
                        onChange={(e) => handleSpecificationChange(index, 'key', e.target.value)}
                      />
                      <Input
                        placeholder="Property value"
                        value={spec.value}
                        onChange={(e) => handleSpecificationChange(index, 'value', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeSpecification(index)}
                        disabled={formData.specifications.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          <Card className="bg-creme-light border-coyote">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-dark">Product Variants</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newVariant: ProductVariant = {
                      name: '',
                      price: formData.price,
                      stock: 0,
                      attributes: [{ key: '', value: '' }],
                      is_active: true
                    };
                    setFormData(prev => ({
                      ...prev,
                      variants: [...prev.variants, newVariant]
                    }));
                  }}
                  className="border-canyon text-canyon hover:bg-canyon/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.variants.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark/60 mb-4">No variants created yet</p>
                  <p className="text-sm text-dark/50">
                    Create different variations of this product (size, color, etc.)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.variants.map((variant, index) => (
                    <div key={index} className="p-4 border border-coyote rounded-lg bg-creme">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-dark">
                          Variant {index + 1}
                        </h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteVariant(variant.id || '', variant.name)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="mb-4">
                        <div>
                          <Label className="text-dark font-medium">Variant Name</Label>
                          <Input
                            value={variant.name}
                            onChange={(e) => {
                              const newVariants = [...formData.variants];
                              newVariants[index].name = e.target.value;
                              setFormData(prev => ({ ...prev, variants: newVariants }));
                            }}
                            placeholder="e.g., Large, Red, Premium"
                            className="bg-creme border-coyote text-dark"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <Label className="text-dark font-medium">Price (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variant.price || ''}
                            onChange={(e) => {
                              const newVariants = [...formData.variants];
                              newVariants[index].price = parseFloat(e.target.value) || 0;
                              setFormData(prev => ({ ...prev, variants: newVariants }));
                            }}
                            placeholder="Enter price"
                            className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                          />
                        </div>
                        <div>
                          <Label className="text-dark font-medium">Stock</Label>
                          <Input
                            type="number"
                            value={variant.stock || ''}
                            onChange={(e) => {
                              const newVariants = [...formData.variants];
                              newVariants[index].stock = parseInt(e.target.value) || 0;
                              setFormData(prev => ({ ...prev, variants: newVariants }));
                            }}
                            placeholder="Enter stock"
                            className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={variant.is_active}
                              onCheckedChange={(checked: boolean) => {
                                const newVariants = [...formData.variants];
                                newVariants[index].is_active = checked;
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                            />
                            <Label className="text-dark font-medium">Active</Label>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-dark font-medium">Attributes</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newVariants = [...formData.variants];
                              newVariants[index].attributes.push({ key: '', value: '' });
                              setFormData(prev => ({ ...prev, variants: newVariants }));
                            }}
                            className="text-canyon hover:bg-canyon/10"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Attribute
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {variant.attributes.map((attr, attrIndex) => (
                            <div key={attrIndex} className="flex gap-2">
                              <Input
                                placeholder="Attribute (e.g., Size)"
                                value={attr.key}
                                onChange={(e) => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].attributes[attrIndex].key = e.target.value;
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="bg-creme border-coyote text-dark"
                              />
                              <Input
                                placeholder="Value (e.g., Large)"
                                value={attr.value}
                                onChange={(e) => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].attributes[attrIndex].value = e.target.value;
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="bg-creme border-coyote text-dark"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].attributes = newVariants[index].attributes.filter((_, i) => i !== attrIndex);
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                disabled={variant.attributes.length === 1}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              <MultipleImageUpload
                imageUrls={formData.gallery_images}
                onImageUrlsChange={(images: string[]) => setFormData(prev => ({ ...prev, gallery_images: images }))}
                showSelector={true}
                title="Product Gallery"
                description="Upload product images (up to 10 images)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                  placeholder="SEO title for search engines"
                />
              </div>
              <div>
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                  placeholder="SEO description for search engines"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="image_alt_text">Image Alt Text</Label>
                <Input
                  id="image_alt_text"
                  value={formData.image_alt_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_alt_text: e.target.value }))}
                  placeholder="Alt text for product images"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-6 border-t border-coyote">
        {/* Delete button - only show when editing existing product */}
        <div>
          {product && onDelete && (
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDeleteProduct}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Deleting...' : 'Delete Product'}
            </Button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex space-x-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-coyote text-dark hover:bg-coyote/20">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-canyon hover:bg-canyon/90 text-creme">
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </div>
    </form>
  );
}
