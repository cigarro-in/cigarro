import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Users, Package, ShoppingBag, Crown, Eye, ToggleLeft, ToggleRight, LogOut, User as UserIcon, Tag, Settings, CheckCircle, XCircle, Clock, Truck, Search, Filter, Download, MoreHorizontal, CreditCard, MapPin, Phone, Mail, Calendar, DollarSign, AlertTriangle, CheckSquare, Square, ExternalLink, Copy, FileText, Image as ImageIcon, TrendingUp, Upload, Layers, Gift, Percent, Star, ImageIcon as ImageIconAlt } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { supabase } from '../utils/supabase/client';
import { Checkbox } from './ui/checkbox';
import { ImageUpload } from './ui/ImageUpload';
import { MultipleImageUpload } from './ui/MultipleImageUpload';
import { SiteSettingsPage } from './SiteSettingsPage';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ProductVariant, ProductCombo, Discount } from '../types/variants';
import { formatINR } from '../utils/currency';
import HomepageManager from './admin/HomepageManager';
import { AssetManager } from './admin/AssetManager';
import { BlogManager } from './admin/BlogManager';

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

interface Order {
  id: string;
  display_order_id: string;
  user_id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: Array<{
    id: string;
    name: string;
    brand: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  status: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method?: string;
  payment_verified: 'YES' | 'NO' | 'REJECTED';
  payment_confirmed: boolean;
  payment_confirmed_at?: string;
  payment_verified_at?: string;
  payment_verified_by?: string;
  payment_rejection_reason?: string;
  transaction_id?: string;
  payment_proof_url?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip_code: string;
  shipping_country: string;
  // New shipping tracking fields
  shipping_company?: string;
  tracking_id?: string;
  tracking_link?: string;
  shipping_method?: string;
  shipping_notes?: string;
  shipped_at?: string;
  shipped_by?: string;
  delivered_at?: string;
  delivered_by?: string;
  delivery_notes?: string;
  delivery_proof_url?: string;
  createdAt: string;
  updatedAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_admin: boolean;
  orderCount: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: string;
  firstOrderDate?: string;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  image_alt_text: string;
}

interface HomepageSection {
  id: string;
  title: string;
  slug: string;
}

interface CategoryProduct {
  id: string; // product_id
  name: string;
  slug: string;
  brand: string;
  price: number;
  gallery_images: string[];
  order: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryProductsOrder, setCategoryProductsOrder] = useState<CategoryProduct[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('all');
  const [showOrderDetails, setShowOrderDetails] = useState<string | null>(null);
  const [showShippingModal, setShowShippingModal] = useState<string | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [shippingData, setShippingData] = useState({
    shipping_company: '',
    tracking_id: '',
    tracking_link: '',
    shipping_method: 'Standard',
    shipping_notes: ''
  });
  const [deliveryData, setDeliveryData] = useState({
    delivery_notes: '',
    delivery_proof_url: ''
  });
  const [showCustomerDetails, setShowCustomerDetails] = useState<string | null>(null);

  // Variants, Combos, and Discounts state
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [combos, setCombos] = useState<ProductCombo[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [selectedCombos, setSelectedCombos] = useState<string[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  const [variantSearchTerm, setVariantSearchTerm] = useState('');
  const [comboSearchTerm, setComboSearchTerm] = useState('');
  const [discountSearchTerm, setDiscountSearchTerm] = useState('');
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [showComboDialog, setShowComboDialog] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editingCombo, setEditingCombo] = useState<ProductCombo | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [showProductDetails, setShowProductDetails] = useState<string | null>(null);
  const [showCategoryDetails, setShowCategoryDetails] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchCustomers();
    fetchCategories();
    fetchVariants();
    fetchCombos();
    fetchDiscounts();
  }, []);

  // Populate form when editing product changes
  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name,
        slug: editingProduct.slug,
        brand: editingProduct.brand,
        price: editingProduct.price,
        description: editingProduct.description,
        stock: editingProduct.stock,
        category_ids: [], // This will need to be fetched separately if needed
        rating: editingProduct.rating,
        review_count: editingProduct.review_count,
        origin: editingProduct.origin || '',
        strength: editingProduct.strength || '',
        pack_size: editingProduct.pack_size || '',
        specifications: editingProduct.specifications ? Object.entries(editingProduct.specifications).map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }],
        ingredients: editingProduct.ingredients ? editingProduct.ingredients.join(', ') : '',
        gallery_images: editingProduct.gallery_images || [],
        meta_title: editingProduct.meta_title || '',
        meta_description: editingProduct.meta_description || '',
        image_alt_text: editingProduct.image_alt_text || ''
      });
    }
  }, [editingProduct]);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      toast.error('Failed to fetch products');
    } else {
      setProducts(data || []);
    }
  };

  const fetchOrders = async () => {
    try {
      // First, get orders with a simpler query
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      toast.error('Failed to fetch orders');
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        console.log('No orders found');
        setOrders([]);
        return;
      }

      // Get order items for each order
      const orderIds = ordersData.map(order => order.id);
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
      }

      // Get user profiles for each order
      const userIds = [...new Set(ordersData.map(order => order.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Format the data
      const formattedOrders = ordersData.map((order: any) => {
        const orderItems = orderItemsData?.filter(item => item.order_id === order.id) || [];
        const profile = profilesData?.find(p => p.id === order.user_id);

        return {
        id: order.id,
          display_order_id: order.display_order_id || order.id.slice(0, 8),
          user_id: order.user_id,
          customerName: profile?.name || order.shipping_name || 'Unknown',
          customerEmail: profile?.email || 'N/A',
          customerPhone: order.shipping_phone || 'N/A',
          items: orderItems.map((item: any) => ({
            id: item.id,
            name: item.product_name,
            brand: item.product_brand,
            quantity: item.quantity,
            price: item.product_price,
            image: item.product_image,
          })),
          total: order.total,
          subtotal: order.subtotal,
          tax: order.tax,
          shipping: order.shipping,
          discount: order.discount || 0,
        status: order.status,
          payment_method: order.payment_method,
          payment_verified: order.payment_verified || 'NO',
          payment_confirmed: order.payment_confirmed || false,
          payment_confirmed_at: order.payment_confirmed_at,
          payment_verified_at: order.payment_verified_at,
          payment_verified_by: order.payment_verified_by,
          payment_rejection_reason: order.payment_rejection_reason,
          transaction_id: order.transaction_id,
          payment_proof_url: order.payment_proof_url,
          tracking_number: order.tracking_number,
          estimated_delivery: order.estimated_delivery,
          shipping_address: order.shipping_address,
          shipping_city: order.shipping_city,
          shipping_state: order.shipping_state,
          shipping_zip_code: order.shipping_zip_code,
          shipping_country: order.shipping_country || 'India',
        createdAt: order.created_at,
          updatedAt: order.updated_at,
        };
      });

      console.log('Formatted orders:', formattedOrders);
      setOrders(formattedOrders);
    } catch (error) {
      console.error('Unexpected error fetching orders:', error);
      toast.error('Failed to fetch orders');
    }
  };

  const fetchCustomers = async () => {
    try {
      // First, get all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      toast.error('Failed to fetch customers');
        return;
      }

      if (!profilesData || profilesData.length === 0) {
        console.log('No customers found');
        setCustomers([]);
        return;
      }

      // Get orders for each customer
      const userIds = profilesData.map(profile => profile.id);
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('user_id, total, created_at, status')
        .in('user_id', userIds);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      }

      // Format the data
      const formattedCustomers = profilesData.map((customer: any) => {
        const customerOrders = ordersData?.filter(order => order.user_id === customer.id) || [];
        const totalSpent = customerOrders.reduce((sum: number, order: any) => 
          sum + order.total, 0);
        const orderCount = customerOrders.length;
        const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
        const lastOrderDate = customerOrders.length > 0 
          ? customerOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : null;
        const firstOrderDate = customerOrders.length > 0 
          ? customerOrders.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0].created_at
          : null;

        return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
          phone: customer.phone,
        is_admin: customer.is_admin,
          orderCount,
          totalSpent,
          averageOrderValue,
          lastOrderDate,
          firstOrderDate,
          status: (customer.is_admin ? 'active' : (orderCount > 0 ? 'active' : 'inactive')) as 'active' | 'inactive' | 'blocked',
        created_at: customer.created_at,
          updated_at: customer.updated_at,
        };
      });

      console.log('Formatted customers:', formattedCustomers);
      setCustomers(formattedCustomers);
    } catch (error) {
      console.error('Unexpected error fetching customers:', error);
      toast.error('Failed to fetch customers');
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*');
    if (error) {
      toast.error('Failed to fetch categories');
    } else {
      setCategories(data || []);
    }
  };


  // Fetch functions for variants, combos, and discounts
  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        *,
        products (id, name, brand),
        variant_images (*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to fetch variants');
    } else {
      setVariants(data || []);
    }
  };

  const fetchCombos = async () => {
    const { data, error } = await supabase
      .from('product_combos')
      .select(`
        *,
        combo_items (
          *,
          products (id, name, brand),
          product_variants (id, variant_name)
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to fetch combos');
    } else {
      setCombos(data || []);
    }
  };

  const fetchDiscounts = async () => {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to fetch discounts');
    } else {
      setDiscounts(data || []);
    }
  };

  const [productForm, setProductForm] = useState({
    name: '',
    slug: '',
    brand: '',
    price: 0,
    description: '',
    stock: 0,
    category_ids: [] as string[],
    rating: 0,
    review_count: 0,
    origin: '',
    strength: '',
    pack_size: '',
    specifications: [{ key: '', value: '' }],
    ingredients: '',
    gallery_images: [] as string[],
    meta_title: '',
    meta_description: '',
    image_alt_text: '',
  });

  // Form states for variants, combos, and discounts
  const [variantForm, setVariantForm] = useState({
    product_id: '',
    variant_name: '',
    variant_description: '',
    price: 0,
    sku: '',
    stock_quantity: 0,
    is_active: true,
    sort_order: 0,
    images: [] as string[],
  });

  const [comboForm, setComboForm] = useState({
    name: '',
    description: '',
    combo_price: 0,
    savings_amount: 0,
    is_active: true,
    sort_order: 0,
    combo_items: [] as Array<{
      product_id: string;
      variant_id?: string;
      quantity: number;
    }>,
  });

  const [discountForm, setDiscountForm] = useState({
    discount_name: '',
    discount_code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount' | 'cart_value',
    discount_value: 0,
    minimum_cart_value: 0,
    maximum_discount_amount: 0,
    usage_limit: 0,
    usage_count: 0,
    valid_from: '',
    valid_until: '',
    is_active: true,
    applicable_products: [] as string[],
    applicable_variants: [] as string[],
    applicable_combos: [] as string[],
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    image: '',
    image_alt_text: '',
  });

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalProducts = products.length;
  const totalCustomers = customers.length;
  const totalOrders = orders.length;

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const reorderedProducts = Array.from(categoryProductsOrder);
    const [removed] = reorderedProducts.splice(result.source.index, 1);
    reorderedProducts.splice(result.destination.index, 0, removed);

    // Update the order property based on the new array index
    const updatedProductsWithOrder = reorderedProducts.map((product, index) => ({
      ...product,
      order: index,
    }));

    setCategoryProductsOrder(updatedProductsWithOrder);
  };

  const handleSaveProduct = async () => {
    if (editingProduct) {
      // Update existing product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .update({
          name: productForm.name,
          brand: productForm.brand,
          price: productForm.price,
          description: productForm.description,
          stock: productForm.stock,
          rating: productForm.rating,
          review_count: productForm.review_count,
          origin: productForm.origin,
          strength: productForm.strength,
          pack_size: productForm.pack_size,
          specifications: productForm.specifications.reduce((acc, spec) => {
            if (spec.key) acc[spec.key] = spec.value;
            return acc;
          }, {} as Record<string, string>),
          ingredients: productForm.ingredients.split('\n').filter(i => i.trim() !== ''),
          gallery_images: productForm.gallery_images,
        })
        .eq('id', editingProduct.id)
        .select();

      if (productError) {
        toast.error('Failed to update product');
        return;
      }

      // Manage categories
      const { error: deleteError } = await supabase
        .from('product_categories')
        .delete()
        .eq('product_id', editingProduct.id);

      if (deleteError) {
        toast.error('Failed to update product categories');
        return;
      }

      const { error: insertError } = await supabase
        .from('product_categories')
        .insert(productForm.category_ids.map(category_id => ({
          product_id: editingProduct.id,
          category_id,
        })));

      if (insertError) {
        toast.error('Failed to update product categories');
      } else {
        toast.success('Product updated successfully');
        fetchProducts();
      }
    } else {
      // Add new product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert([
          {
            name: productForm.name,
            slug: productForm.slug,
            brand: productForm.brand,
            price: productForm.price,
            description: productForm.description,
            stock: productForm.stock,
            rating: productForm.rating,
            review_count: productForm.review_count,
            origin: productForm.origin,
          strength: productForm.strength,
          pack_size: productForm.pack_size,
          specifications: productForm.specifications.reduce((acc, spec) => {
            if (spec.key) acc[spec.key] = spec.value;
            return acc;
          }, {} as Record<string, string>),
          ingredients: productForm.ingredients.split('\n').filter(i => i.trim() !== ''),
          gallery_images: productForm.gallery_images,
            meta_title: productForm.meta_title,
            meta_description: productForm.meta_description,
          },
        ])
        .select();

      if (productError || !productData) {
        toast.error('Failed to add product');
        return;
      }

      const newProductId = productData[0].id;

      const { error: insertError } = await supabase
        .from('product_categories')
        .insert(productForm.category_ids.map(category_id => ({
          product_id: newProductId,
          category_id,
        })));

      if (insertError) {
        toast.error('Failed to add product categories');
      } else {
        toast.success('Product added successfully');
        fetchProducts();
      }
    }
    
    handleProductDialogClose();
  };

  const handleProductDialogClose = () => {
    setShowProductDialog(false);
    setEditingProduct(null);
    setProductForm({
      name: '',
      slug: '',
      brand: '',
      price: 0,
      description: '',
      stock: 0,
      category_ids: [],
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
    });
  };

  const handleSaveCategory = async () => {
    let categoryId = editingCategory?.id;

    if (editingCategory) {
      // Update existing category
      const { data, error } = await supabase
        .from('categories')
        .update({
          name: categoryForm.name,
          description: categoryForm.description,
          image: categoryForm.image,
        })
        .eq('id', editingCategory.id)
        .select();

      if (error) {
        toast.error('Failed to update category');
        return;
      }
    } else {
      // Add new category
      const { data, error } = await supabase
        .from('categories')
        .insert([
          {
            name: categoryForm.name,
            slug: categoryForm.slug,
            description: categoryForm.description,
            image: categoryForm.image,
            image_alt_text: categoryForm.image_alt_text,
          },
        ])
        .select();

      if (error || !data) {
        toast.error('Failed to add category');
        return;
      }
      categoryId = data[0].id;
    }

    if (!categoryId) return;



    // Update product order within the category
    if (categoryProductsOrder.length > 0) {
      const updates = categoryProductsOrder.map((product, index) => ({
        product_id: product.id,
        category_id: categoryId,
        order: index, // Assign new order based on current array index
      }));

      // Perform upsert to update existing product_category entries or insert new ones
      const { error: updateOrderError } = await supabase
        .from('product_categories')
        .upsert(updates, { onConflict: 'product_id, category_id' });

      if (updateOrderError) {
        toast.error('Failed to update product order in category');
        console.error('Update order error:', updateOrderError);
        return;
      }
    }

    toast.success(`Category ${editingCategory ? 'updated' : 'added'} successfully`);
    fetchCategories();
    setShowCategoryDialog(false);
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      slug: '',
      description: '',
      image: '',
      image_alt_text: '',
    });
    setCategoryProductsOrder([]); // Clear ordered products state
  };

  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product);

    const { data, error } = await supabase
      .from('product_categories')
      .select('category_id')
      .eq('product_id', product.id);

    if (error) {
      toast.error('Failed to fetch product categories');
    } else {
      setProductForm({
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        price: product.price,
        description: product.description,
        stock: product.stock,
        category_ids: data.map(c => c.category_id),
        rating: product.rating,
        review_count: product.review_count,
        origin: product.origin,
        strength: product.strength,
        pack_size: product.pack_size,
        specifications: product.specifications ? Object.entries(product.specifications).map(([key, value]) => ({ key, value: String(value) })) : [{ key: '', value: '' }],
        ingredients: product.ingredients?.join('\n') || '',
        gallery_images: product.gallery_images || [],
        meta_title: product.meta_title,
        meta_description: product.meta_description,
        image_alt_text: product.image_alt_text,
      });
    }
    setShowProductDialog(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      // First check if product is referenced in any orders
      const { data: orderItems, error: checkError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

      if (checkError) {
        toast.error('Failed to check product references');
        return;
      }

      if (orderItems && orderItems.length > 0) {
        toast.error('Cannot delete product: It is referenced in existing orders. Consider deactivating it instead.');
        return;
      }

      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) {
        toast.error('Failed to delete product');
      } else {
        toast.success('Product deleted successfully');
        fetchProducts();
        setShowProductDialog(false);
        setEditingProduct(null);
      }
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const toggleProductStatus = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', productId);

    if (error) {
      toast.error('Failed to update product status');
    } else {
      toast.success('Product status updated successfully');
      fetchProducts();
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'placed': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'processing': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'shipped': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'delivered': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'YES': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'NO': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'REJECTED': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status'], adminUserId?: string, shippingData?: {
    shipping_company?: string;
    tracking_id?: string;
    tracking_link?: string;
    shipping_method?: string;
    shipping_notes?: string;
    delivery_notes?: string;
    delivery_proof_url?: string;
  }) => {
    try {
      // Use the database function for proper status updates
      const { error } = await supabase.rpc('update_order_status', {
        order_id: orderId,
        new_status: newStatus,
        admin_user_id: adminUserId || user?.id,
        additional_data: shippingData ? {
          shipping_company: shippingData.shipping_company,
          tracking_id: shippingData.tracking_id,
          tracking_link: shippingData.tracking_link,
          shipping_method: shippingData.shipping_method,
          shipping_notes: shippingData.shipping_notes,
          delivery_notes: shippingData.delivery_notes,
          delivery_proof_url: shippingData.delivery_proof_url
        } : null
      });

      if (error) {
        toast.error(`Failed to update order status: ${error.message}`);
      } else {
        toast.success('Order status updated successfully');
        fetchOrders();
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const confirmPayment = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_verified: 'YES',
        payment_verified_at: new Date().toISOString(),
        payment_verified_by: user?.id,
        payment_confirmed: true,
        payment_confirmed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to confirm payment');
    } else {
      toast.success('Payment confirmed successfully');
      fetchOrders();
    }
  };

  const rejectPayment = async (orderId: string, reason: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_verified: 'REJECTED',
        payment_verified_at: new Date().toISOString(),
        payment_verified_by: user?.id,
        payment_rejection_reason: reason
      })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to reject payment');
    } else {
      toast.success('Payment rejected successfully');
      fetchOrders();
    }
  };

  const updateTrackingNumber = async (orderId: string, trackingNumber: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ 
        tracking_number: trackingNumber,
        status: 'shipped'
      })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update tracking number');
    } else {
      toast.success('Tracking number updated successfully');
      fetchOrders();
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.display_order_id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                          order.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                          order.customerEmail.toLowerCase().includes(orderSearchTerm.toLowerCase());
    const matchesStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;
    const matchesPayment = paymentStatusFilter === 'all' || order.payment_verified === paymentStatusFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                          customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase());
    return matchesSearch;
  });

  // Handler functions for variants, combos, and discounts
  const handleSaveVariant = async () => {
    try {
      if (editingVariant) {
        // Update existing variant
        const { error } = await supabase
          .from('product_variants')
          .update({
            variant_name: variantForm.variant_name,
            variant_description: variantForm.variant_description,
            price: variantForm.price,
            sku: variantForm.sku,
            stock_quantity: variantForm.stock_quantity,
            is_active: variantForm.is_active,
            sort_order: variantForm.sort_order,
          })
          .eq('id', editingVariant.id);

        if (error) throw error;

        // Update variant images
        if (variantForm.images.length > 0) {
          // Delete existing images
          await supabase
            .from('variant_images')
            .delete()
            .eq('variant_id', editingVariant.id);

          // Insert new images
          const imageInserts = variantForm.images.map((imageUrl, index) => ({
            variant_id: editingVariant.id,
            image_url: imageUrl,
            sort_order: index,
          }));

          const { error: imagesError } = await supabase
            .from('variant_images')
            .insert(imageInserts);

          if (imagesError) throw imagesError;
        }

        toast.success('Variant updated successfully');
      } else {
        // Create new variant
        const { data: variantData, error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: variantForm.product_id,
            variant_name: variantForm.variant_name,
            variant_description: variantForm.variant_description,
            price: variantForm.price,
            sku: variantForm.sku,
            stock_quantity: variantForm.stock_quantity,
            is_active: variantForm.is_active,
            sort_order: variantForm.sort_order,
          })
          .select()
          .single();

        if (variantError) throw variantError;

        // Insert variant images
        if (variantForm.images.length > 0) {
          const imageInserts = variantForm.images.map((imageUrl, index) => ({
            variant_id: variantData.id,
            image_url: imageUrl,
            sort_order: index,
          }));

          const { error: imagesError } = await supabase
            .from('variant_images')
            .insert(imageInserts);

          if (imagesError) throw imagesError;
        }

        toast.success('Variant created successfully');
      }

      setShowVariantDialog(false);
      fetchVariants();
    } catch (error) {
      console.error('Error saving variant:', error);
      toast.error('Failed to save variant');
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;

      toast.success('Variant deleted successfully');
      fetchVariants();
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Failed to delete variant');
    }
  };

  const handleSaveCombo = async () => {
    try {
      if (editingCombo) {
        // Update existing combo
        const { error } = await supabase
          .from('product_combos')
          .update({
            name: comboForm.name,
            description: comboForm.description,
            combo_price: comboForm.combo_price,
            savings_amount: comboForm.savings_amount,
            is_active: comboForm.is_active,
            sort_order: comboForm.sort_order,
          })
          .eq('id', editingCombo.id);

        if (error) throw error;

        // Update combo items
        await supabase
          .from('combo_items')
          .delete()
          .eq('combo_id', editingCombo.id);

        if (comboForm.combo_items.length > 0) {
          const itemInserts = comboForm.combo_items.map(item => ({
            combo_id: editingCombo.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
          }));

          const { error: itemsError } = await supabase
            .from('combo_items')
            .insert(itemInserts);

          if (itemsError) throw itemsError;
        }

        toast.success('Combo updated successfully');
      } else {
        // Create new combo
        const { data: comboData, error: comboError } = await supabase
          .from('product_combos')
          .insert({
            name: comboForm.name,
            description: comboForm.description,
            combo_price: comboForm.combo_price,
            savings_amount: comboForm.savings_amount,
            is_active: comboForm.is_active,
            sort_order: comboForm.sort_order,
          })
          .select()
          .single();

        if (comboError) throw comboError;

        // Insert combo items
        if (comboForm.combo_items.length > 0) {
          const itemInserts = comboForm.combo_items.map(item => ({
            combo_id: comboData.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
          }));

          const { error: itemsError } = await supabase
            .from('combo_items')
            .insert(itemInserts);

          if (itemsError) throw itemsError;
        }

        toast.success('Combo created successfully');
      }

      setShowComboDialog(false);
      fetchCombos();
    } catch (error) {
      console.error('Error saving combo:', error);
      toast.error('Failed to save combo');
    }
  };

  const handleDeleteCombo = async (comboId: string) => {
    try {
      const { error } = await supabase
        .from('product_combos')
        .delete()
        .eq('id', comboId);

      if (error) throw error;

      toast.success('Combo deleted successfully');
      fetchCombos();
    } catch (error) {
      console.error('Error deleting combo:', error);
      toast.error('Failed to delete combo');
    }
  };

  const handleSaveDiscount = async () => {
    try {
      if (editingDiscount) {
        // Update existing discount
        const { error } = await supabase
          .from('discounts')
          .update({
            discount_name: discountForm.discount_name,
            discount_code: discountForm.discount_code,
            discount_type: discountForm.discount_type,
            discount_value: discountForm.discount_value,
            minimum_cart_value: discountForm.minimum_cart_value,
            maximum_discount_amount: discountForm.maximum_discount_amount,
            usage_limit: discountForm.usage_limit,
            valid_from: discountForm.valid_from,
            valid_until: discountForm.valid_until,
            is_active: discountForm.is_active,
            applicable_products: discountForm.applicable_products,
            applicable_variants: discountForm.applicable_variants,
            applicable_combos: discountForm.applicable_combos,
          })
          .eq('id', editingDiscount.id);

        if (error) throw error;

        toast.success('Discount updated successfully');
      } else {
        // Create new discount
        const { error } = await supabase
          .from('discounts')
          .insert({
            discount_name: discountForm.discount_name,
            discount_code: discountForm.discount_code,
            discount_type: discountForm.discount_type,
            discount_value: discountForm.discount_value,
            minimum_cart_value: discountForm.minimum_cart_value,
            maximum_discount_amount: discountForm.maximum_discount_amount,
            usage_limit: discountForm.usage_limit,
            valid_from: discountForm.valid_from,
            valid_until: discountForm.valid_until,
            is_active: discountForm.is_active,
            applicable_products: discountForm.applicable_products,
            applicable_variants: discountForm.applicable_variants,
            applicable_combos: discountForm.applicable_combos,
          });

        if (error) throw error;

        toast.success('Discount created successfully');
      }

      setShowDiscountDialog(false);
      fetchDiscounts();
    } catch (error) {
      console.error('Error saving discount:', error);
      toast.error('Failed to save discount');
    }
  };

  const handleDeleteDiscount = async (discountId: string) => {
    try {
      const { error } = await supabase
        .from('discounts')
        .delete()
        .eq('id', discountId);

      if (error) throw error;

      toast.success('Discount deleted successfully');
      fetchDiscounts();
    } catch (error) {
      console.error('Error deleting discount:', error);
      toast.error('Failed to delete discount');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                          product.brand.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                          product.slug.toLowerCase().includes(productSearchTerm.toLowerCase());
    const matchesStatus = productStatusFilter === 'all' || 
                         (productStatusFilter === 'active' && product.is_active) ||
                         (productStatusFilter === 'inactive' && !product.is_active);
    return matchesSearch && matchesStatus;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
                          category.slug.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
                          category.description.toLowerCase().includes(categorySearchTerm.toLowerCase());
    return matchesSearch;
  }).sort((a, b) => a.name.localeCompare(b.name));

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="bg-background border border-border max-w-md">
          <CardContent className="text-center p-8">
            <Crown className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="text-2xl font-serif text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You need admin privileges to access this dashboard.
            </p>
            <Button onClick={() => navigate('/')}>
              Back to Store
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-12 lg:w-auto lg:flex bg-secondary">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="variants">
              <Layers className="w-4 h-4 mr-2" />
              Variants
            </TabsTrigger>
            <TabsTrigger value="combos">
              <Gift className="w-4 h-4 mr-2" />
              Combos
            </TabsTrigger>
            <TabsTrigger value="discounts">
              <Percent className="w-4 h-4 mr-2" />
              Discounts
            </TabsTrigger>
            <TabsTrigger value="homepage">
              <Crown className="w-4 h-4 mr-2" />
              Homepage
            </TabsTrigger>
            <TabsTrigger value="blog">
              <FileText className="w-4 h-4 mr-2" />
              Blog
            </TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="assets">
              <ImageIcon className="w-4 h-4 mr-2" />
              Assets
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Debug Information */}
            <Card className="bg-background border border-border bg-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Settings className="w-5 h-5" />
                  Debug Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Orders Count:</div>
                    <div className="text-blue-600">{orders.length}</div>
                  </div>
                  <div>
                    <div className="font-medium">Customers Count:</div>
                    <div className="text-blue-600">{customers.length}</div>
                  </div>
                  <div>
                    <div className="font-medium">Products Count:</div>
                    <div className="text-blue-600">{products.length}</div>
                  </div>
                  <div>
                    <div className="font-medium">Categories Count:</div>
                    <div className="text-blue-600">{categories.length}</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      console.log('Orders:', orders);
                      console.log('Customers:', customers);
                      console.log('Products:', products);
                      console.log('Categories:', categories);
                    }}
                  >
                    Log Data to Console
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      fetchOrders();
                      fetchCustomers();
                      fetchProducts();
                      fetchCategories();
                      toast.info('Data refreshed');
                    }}
                  >
                    Refresh Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-background border border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-serif font-medium text-foreground">
                        ₹{totalRevenue.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-green-500 mt-1">+12% from last month</p>
                    </div>
                    <ShoppingBag className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background border border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Products</p>
                      <p className="text-2xl font-serif font-medium text-foreground">{totalProducts}</p>
                      <p className="text-xs text-blue-500 mt-1">{products.filter(p => p.is_active).length} active</p>
                    </div>
                    <Package className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background border border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Orders</p>
                      <p className="text-2xl font-serif font-medium text-foreground">{totalOrders}</p>
                      <p className="text-xs text-orange-500 mt-1">{orders.filter(o => o.status === 'placed').length} placed</p>
                    </div>
                    <ShoppingBag className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background border border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Customers</p>
                      <p className="text-2xl font-serif font-medium text-foreground">{totalCustomers}</p>
                      <p className="text-xs text-green-500 mt-1">{customers.filter(c => c.status === 'active').length} active</p>
                    </div>
                    <Users className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Inventory Alerts */}
            <Card className="bg-background border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Inventory Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products.filter(p => p.stock < 10).length > 0 ? (
                    products.filter(p => p.stock < 10).map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-3 border border-yellow-500/30 rounded-lg bg-yellow-500">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">Low stock alert</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-yellow-600">{product.stock} left</div>
                          <Button size="sm" variant="outline" className="mt-1">
                            Reorder
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p>All products are well stocked!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card className="bg-background border border-border">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    Recent Orders
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('orders')}>
                    View All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-accent" />
                        </div>
                      <div>
                          <div className="font-medium">#{order.display_order_id}</div>
                          <div className="text-sm text-muted-foreground">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">₹{order.total.toLocaleString('en-IN')}</div>
                        <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                          {order.status}
                        </Badge>
                        <div className="mt-1">
                          <Badge className={`text-xs ${getPaymentStatusColor(order.payment_verified)}`}>
                            {order.payment_verified}
                        </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card className="bg-background border border-border">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Crown className="w-5 h-5" />
                    Top Customers
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('customers')}>
                    View All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {customers
                    .sort((a, b) => b.totalSpent - a.totalSpent)
                    .slice(0, 5)
                    .map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {customer.name}
                            {customer.is_admin && (
                              <Badge className="bg-accent text-accent-foreground text-xs">
                                ADMIN
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{customer.email}</div>
                          <div className="text-xs text-muted-foreground">
                            {customer.orderCount} orders
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">₹{customer.totalSpent.toLocaleString('en-IN')}</div>
                        <div className="text-sm text-muted-foreground">
                          ₹{customer.averageOrderValue.toLocaleString('en-IN')} avg
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            {/* Product Controls */}
            <Card className="bg-background border border-border">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Search products..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Select value={productStatusFilter} onValueChange={setProductStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={showProductDialog} onOpenChange={(isOpen) => {
                    if (isOpen) {
                      setShowProductDialog(true);
                    } else {
                      handleProductDialogClose();
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button className="bg-accent text-accent-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Product
                      </Button>
                    </DialogTrigger>
                <DialogContent className="bg-background border border-border max-w-4xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-serif text-center text-foreground">
                      {editingProduct ? 'Edit Product' : 'Add Product'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-muted-foreground">
                      Manage product details, pricing, and other attributes.
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="general">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="media">Media & SEO</TabsTrigger>
                      <TabsTrigger value="details">Details & Pricing</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="space-y-4 py-4">
                      <div>
                        <Label>Product Name</Label>
                        <Input value={productForm.name} onChange={(e) => {
                          const newName = e.target.value;
                          const newSlug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                          setProductForm(prev => ({ ...prev, name: newName, slug: newSlug }));
                        }} />
                      </div>
                      <div>
                        <Label>URL Slug</Label>
                        <Input value={productForm.slug} onChange={(e) => setProductForm(prev => ({ ...prev, slug: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Brand</Label>
                        <Input value={productForm.brand} onChange={(e) => setProductForm(prev => ({ ...prev, brand: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea value={productForm.description} onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))} rows={4} />
                      </div>
                      <div>
                        <Label>Categories</Label>
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          {categories.map(category => (
                            <div key={category.id} className="flex items-center space-x-2">
                              <Checkbox id={`category-${category.id}`} checked={productForm.category_ids.includes(category.id)} onCheckedChange={(checked: boolean | 'indeterminate') => {
                                const categoryId = category.id;
                                setProductForm(prev => ({ ...prev, category_ids: checked === true ? [...prev.category_ids, categoryId] : prev.category_ids.filter(id => id !== categoryId) }));
                              }} />
                              <Label htmlFor={`category-${category.id}`}>{category.name}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="media" className="space-y-4 py-4">
                      <div>
                        <Label>Product Images</Label>
                        <MultipleImageUpload 
                          imageUrls={productForm.gallery_images} 
                          onImageUrlsChange={(urls) => setProductForm(prev => ({ ...prev, gallery_images: urls }))}
                          showSelector={true}
                          title="Select Product Images"
                          description="Choose images from your library or upload new ones"
                        />
                        <p className="text-xs text-muted-foreground mt-2">The first image will be the main product image. You can drag to reorder.</p>
                      </div>
                      <div>
                        <Label>Image Alt Text</Label>
                        <Input value={productForm.image_alt_text} onChange={(e) => setProductForm(prev => ({ ...prev, image_alt_text: e.target.value }))} />
                      </div>
                      <Separator />
                      <h3 className="text-lg font-medium">SEO</h3>
                      <div>
                        <Label>Meta Title</Label>
                        <Input value={productForm.meta_title} onChange={(e) => setProductForm(prev => ({ ...prev, meta_title: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Meta Description</Label>
                        <Textarea value={productForm.meta_description} onChange={(e) => setProductForm(prev => ({ ...prev, meta_description: e.target.value }))} rows={2} />
                      </div>
                    </TabsContent>
                    <TabsContent value="details" className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Price (₹)</Label>
                          <Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <Label>Stock Quantity</Label>
                          <Input type="number" value={productForm.stock} onChange={(e) => setProductForm(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <Label>Rating (0-5)</Label>
                          <Input type="number" step="0.1" value={productForm.rating} onChange={(e) => setProductForm(prev => ({ ...prev, rating: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <Label>Review Count</Label>
                          <Input type="number" value={productForm.review_count} onChange={(e) => setProductForm(prev => ({ ...prev, review_count: parseInt(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <Label>Origin</Label>
                          <Input value={productForm.origin} onChange={(e) => setProductForm(prev => ({ ...prev, origin: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Strength</Label>
                          <Input value={productForm.strength} onChange={(e) => setProductForm(prev => ({ ...prev, strength: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Pack Size</Label>
                          <Input value={productForm.pack_size} onChange={(e) => setProductForm(prev => ({ ...prev, pack_size: e.target.value }))} />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label>Specifications</Label>
                        {productForm.specifications.map((spec, index) => (
                          <div key={index} className="flex items-center gap-2 mb-2">
                            <Input placeholder="Key (e.g., Length)" value={spec.key} onChange={(e) => {
                              const newSpecs = [...productForm.specifications];
                              newSpecs[index].key = e.target.value;
                              setProductForm(prev => ({ ...prev, specifications: newSpecs }));
                            }} />
                            <Input placeholder="Value (e.g., 84mm)" value={spec.value} onChange={(e) => {
                              const newSpecs = [...productForm.specifications];
                              newSpecs[index].value = e.target.value;
                              setProductForm(prev => ({ ...prev, specifications: newSpecs }));
                            }} />
                            <Button variant="ghost" size="icon" onClick={() => {
                              const newSpecs = productForm.specifications.filter((_, i) => i !== index);
                              setProductForm(prev => ({ ...prev, specifications: newSpecs }));
                            }}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => setProductForm(prev => ({ ...prev, specifications: [...prev.specifications, { key: '', value: '' }] }))}>Add Specification</Button>
                      </div>
                      <div>
                        <Label>Ingredients (one per line)</Label>
                        <Textarea value={productForm.ingredients} onChange={(e) => setProductForm(prev => ({ ...prev, ingredients: e.target.value }))} rows={4} />
                      </div>
                    </TabsContent>
                  </Tabs>
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={handleProductDialogClose}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveProduct} className="flex-1 bg-accent text-accent-foreground">
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </Button>
                    {editingProduct && (
                      <Button 
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${editingProduct.name}"? This action cannot be undone.`)) {
                            handleDeleteProduct(editingProduct.id);
                          }
                        }}
                        variant="destructive"
                        className="px-6 bg-red-600 hover:bg-red-700 text-white border-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Product
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedProducts.length > 0 && (
              <Card className="bg-background border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProducts([])}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Products Table */}
            <Card className="bg-background border border-border">
              <CardContent className="p-0">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="w-12 px-4 py-3 text-left font-medium text-sm text-muted-foreground">
                        <Checkbox
                          checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedProducts(filteredProducts.map(product => product.id));
                            } else {
                              setSelectedProducts([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Product</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Brand</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Price</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Stock</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow 
                        key={product.id} 
                        className="border-b border-border hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => {
                          setEditingProduct(product);
                          setShowProductDialog(true);
                        }}
                      >
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={(checked: boolean) => {
                              if (checked) {
                                setSelectedProducts(prev => [...prev, product.id]);
                              } else {
                                setSelectedProducts(prev => prev.filter(id => id !== product.id));
                              }
                            }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 overflow-hidden">
                              <ImageWithFallback
                                src={product.gallery_images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{product.name}</div>
                              <div className="text-sm text-muted-foreground">{product.slug}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm text-muted-foreground">{product.brand}</div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="font-medium text-accent">
                            ₹{product.price.toLocaleString('en-IN')}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm">
                            <Badge variant={product.stock < 10 ? 'destructive' : 'secondary'}>
                              {product.stock}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProductStatus(product.id);
                            }}
                          >
                            {product.is_active ? (
                              <ToggleRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {/* Order Controls */}
            <Card className="bg-background border border-border">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search orders by ID, customer name, or email..."
                        value={orderSearchTerm}
                        onChange={(e) => setOrderSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                      <SelectTrigger className="w-48 bg-background border border-border">
                        <SelectValue placeholder="Order Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="placed">Placed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                      <SelectTrigger className="w-48 bg-background border border-border">
                        <SelectValue placeholder="Payment Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="all">All Payments</SelectItem>
                        <SelectItem value="NO">Pending Payment</SelectItem>
                        <SelectItem value="YES">Payment Verified</SelectItem>
                        <SelectItem value="REJECTED">Payment Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedOrders.length > 0 && (
              <Card className="bg-background border border-border bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="w-5 h-5 text-accent" />
                      <span className="font-medium">
                        {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(value: string) => {
                        if (value === 'processing') {
                          selectedOrders.forEach(orderId => updateOrderStatus(orderId, 'processing'));
                        } else if (value === 'shipped') {
                          selectedOrders.forEach(orderId => updateOrderStatus(orderId, 'shipped'));
                        } else if (value === 'delivered') {
                          selectedOrders.forEach(orderId => updateOrderStatus(orderId, 'delivered'));
                        } else if (value === 'confirm_payment') {
                          selectedOrders.forEach(orderId => confirmPayment(orderId));
                        }
                        setSelectedOrders([]);
                      }}>
                        <SelectTrigger className="w-48 bg-background border border-border">
                          <SelectValue placeholder="Bulk Actions" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border z-50">
                          <SelectItem value="processing">Mark as Processing</SelectItem>
                          <SelectItem value="shipped">Mark as Shipped</SelectItem>
                          <SelectItem value="delivered">Mark as Delivered</SelectItem>
                          <SelectItem value="confirm_payment">Confirm Payment</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedOrders([])}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders Table */}
            <Card className="bg-background border border-border">
              <CardContent className="p-0">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="w-12 px-4 py-3 text-left font-medium text-sm text-muted-foreground">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedOrders(filteredOrders.map(order => order.id));
                            } else {
                              setSelectedOrders([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Order ID</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Customer</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Items</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Total</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Status</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Payment</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Date</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow 
                        key={order.id} 
                        className="border-b border-border hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => setShowOrderDetails(order.id)}
                      >
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={(checked: boolean) => {
                              if (checked) {
                                setSelectedOrders(prev => [...prev, order.id]);
                              } else {
                                setSelectedOrders(prev => prev.filter(id => id !== order.id));
                              }
                            }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="font-mono text-sm font-medium text-foreground">
                            #{order.display_order_id}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">{order.customerName}</div>
                            <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                            {order.customerPhone && (
                              <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm text-muted-foreground">
                            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm font-medium text-foreground">
                            ₹{order.total.toLocaleString('en-IN')}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge className={getPaymentStatusColor(order.payment_verified)}>
                            {order.payment_verified}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString('en-IN')}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setShowOrderDetails(order.id);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Order Details Dialog */}
            <Dialog open={showOrderDetails !== null} onOpenChange={() => setShowOrderDetails(null)}>
              <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto bg-background border-border">
                {showOrderDetails && (() => {
                  const order = orders.find(o => o.id === showOrderDetails);
                  if (!order) return null;
                  
                  return (
                    <>
                      <DialogHeader className="pb-4">
                        <DialogTitle className="text-2xl font-serif text-foreground text-center">
                          Order #{order.display_order_id}
                        </DialogTitle>
                        <DialogDescription className="text-center text-muted-foreground text-sm">
                          Order Details & Management
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6">
                        {/* Order Status & Actions */}
                        <div className="bg-accent rounded-lg p-4 border border-accent">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Badge className={`text-sm px-3 py-1 ${getStatusColor(order.status)}`}>
                                {order.status.toUpperCase()}
                              </Badge>
                              <Badge className={`text-sm px-3 py-1 ${getPaymentStatusColor(order.payment_verified)}`}>
                                PAYMENT: {order.payment_verified}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-medium text-accent">
                                ₹{order.total.toLocaleString('en-IN')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(order.createdAt).toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>
                    
                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-2">
                            {order.payment_verified === 'NO' && (
                              <Button
                                onClick={() => confirmPayment(order.id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Confirm Payment
                              </Button>
                            )}
                            {order.payment_verified === 'NO' && (
                              <Button
                                onClick={() => rejectPayment(order.id, 'Payment verification failed')}
                                variant="destructive"
                                size="sm"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject Payment
                              </Button>
                            )}
                            {order.status === 'placed' && (
                              <Button
                                onClick={() => updateOrderStatus(order.id, 'processing')}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Clock className="w-4 h-4 mr-1" />
                                Start Processing
                              </Button>
                            )}
                            {order.status === 'processing' && (
                              <Button
                                onClick={() => setShowShippingModal(order.id)}
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                <Truck className="w-4 h-4 mr-1" />
                                Mark Shipped
                              </Button>
                            )}
                            {order.status === 'shipped' && (
                              <Button
                                onClick={() => setShowDeliveryModal(order.id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Mark Delivered
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => setShowOrderDetails(null)}
                              size="sm"
                            >
                              Close
                            </Button>
                          </div>
                        </div>

                        {/* Customer & Shipping Information */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Customer Information */}
                          <Card className="bg-background border border-border">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-lg">
                                <UserIcon className="w-5 h-5 text-accent" />
                                Customer Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Name</Label>
                                <div className="text-sm font-medium">{order.customerName}</div>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                                <div className="text-sm">{order.customerEmail}</div>
                              </div>
                              {order.customerPhone && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                                  <div className="text-sm">{order.customerPhone}</div>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Shipping Information */}
                          <Card className="bg-background border border-border">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-lg">
                                <MapPin className="w-5 h-5 text-accent" />
                                Shipping Address
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                                <div className="text-sm">{order.shipping_address}</div>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">City</Label>
                                  <div className="text-sm">{order.shipping_city}</div>
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">State</Label>
                                  <div className="text-sm">{order.shipping_state}</div>
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">ZIP</Label>
                                  <div className="text-sm">{order.shipping_zip_code}</div>
                                </div>
                              </div>
                              {order.tracking_number && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Tracking Number</Label>
                                  <div className="text-sm font-mono bg-muted p-2 rounded">{order.tracking_number}</div>
                                </div>
                              )}
                              {order.shipping_company && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Shipping Company</Label>
                                  <div className="text-sm font-medium">{order.shipping_company}</div>
                                </div>
                              )}
                              {order.tracking_id && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Tracking ID</Label>
                                  <div className="text-sm font-mono bg-muted p-2 rounded">{order.tracking_id}</div>
                                </div>
                              )}
                              {order.tracking_link && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Tracking Link</Label>
                                  <a 
                                    href={order.tracking_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                  >
                                    Track Package <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                              {order.shipped_at && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Shipped At</Label>
                                  <div className="text-sm">{new Date(order.shipped_at).toLocaleString('en-IN')}</div>
                                </div>
                              )}
                              {order.delivered_at && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Delivered At</Label>
                                  <div className="text-sm">{new Date(order.delivered_at).toLocaleString('en-IN')}</div>
                                </div>
                              )}
                              {order.estimated_delivery && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Estimated Delivery</Label>
                                  <div className="text-sm">{new Date(order.estimated_delivery).toLocaleDateString('en-IN')}</div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Order Items */}
                        <Card className="bg-background border border-border">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Package className="w-5 h-5 text-accent" />
                              Order Items ({order.items.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                                  {item.image && (
                                    <ImageWithFallback
                                      src={item.image}
                                      alt={item.name}
                                      className="w-16 h-16 object-cover rounded-lg"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{item.name}</div>
                                    <div className="text-xs text-muted-foreground">{item.brand}</div>
                                    <div className="text-xs text-muted-foreground">Quantity: {item.quantity}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-medium">
                                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      ₹{item.price.toLocaleString('en-IN')} each
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                  </CardContent>
                </Card>

                        {/* Order Totals */}
                        <Card className="bg-background border border-border">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <DollarSign className="w-5 h-5 text-accent" />
                              Order Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Subtotal:</span>
                                <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Tax:</span>
                                <span>₹{order.tax.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Shipping:</span>
                                <span>₹{order.shipping.toLocaleString('en-IN')}</span>
                              </div>
                              {order.discount > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                  <span>Discount:</span>
                                  <span>-₹{order.discount.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              <Separator className="my-4" />
                              <div className="flex justify-between text-lg font-bold">
                                <span>Total:</span>
                                <span>₹{order.total.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  );
                })()}
              </DialogContent>
            </Dialog>

            {/* Shipping Tracking Modal */}
            <Dialog open={showShippingModal !== null} onOpenChange={() => setShowShippingModal(null)}>
              <DialogContent className="max-w-2xl bg-background border-border">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-serif text-foreground text-center">
                    Mark Order as Shipped
                  </DialogTitle>
                  <DialogDescription className="text-center text-muted-foreground">
                    Add shipping tracking details for the order
                  </DialogDescription>
                </DialogHeader>
                
                {showShippingModal && (() => {
                  const order = orders.find(o => o.id === showShippingModal);
                  if (!order) return null;
                  
                  return (
                    <div className="space-y-6">
                      {/* Order Info */}
                      <div className="bg-accent rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-2">Order #{order.display_order_id}</h3>
                        <p className="text-sm text-muted-foreground">
                          Customer: {order.customerName} | Total: ₹{order.total.toLocaleString('en-IN')}
                        </p>
                      </div>

                      {/* Shipping Form */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="shipping_company">Shipping Company</Label>
                            <Select 
                              value={shippingData.shipping_company} 
                              onValueChange={(value: string) => setShippingData(prev => ({ ...prev, shipping_company: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select shipping company" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Blue Dart">Blue Dart</SelectItem>
                                <SelectItem value="DTDC">DTDC</SelectItem>
                                <SelectItem value="FedEx">FedEx</SelectItem>
                                <SelectItem value="DHL">DHL</SelectItem>
                                <SelectItem value="India Post">India Post</SelectItem>
                                <SelectItem value="Delhivery">Delhivery</SelectItem>
                                <SelectItem value="Ecom Express">Ecom Express</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="shipping_method">Shipping Method</Label>
                            <Select 
                              value={shippingData.shipping_method} 
                              onValueChange={(value: string) => setShippingData(prev => ({ ...prev, shipping_method: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Standard">Standard</SelectItem>
                                <SelectItem value="Express">Express</SelectItem>
                                <SelectItem value="Overnight">Overnight</SelectItem>
                                <SelectItem value="Same Day">Same Day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="tracking_id">Tracking ID</Label>
                          <Input
                            id="tracking_id"
                            value={shippingData.tracking_id}
                            onChange={(e) => setShippingData(prev => ({ ...prev, tracking_id: e.target.value }))}
                            placeholder="Enter tracking ID from shipping company"
                          />
                        </div>

                        <div>
                          <Label htmlFor="tracking_link">Tracking Link</Label>
                          <Input
                            id="tracking_link"
                            value={shippingData.tracking_link}
                            onChange={(e) => setShippingData(prev => ({ ...prev, tracking_link: e.target.value }))}
                            placeholder="https://example.com/track/TRACKING_ID"
                          />
                        </div>

                        <div>
                          <Label htmlFor="shipping_notes">Shipping Notes</Label>
                          <Textarea
                            id="shipping_notes"
                            value={shippingData.shipping_notes}
                            onChange={(e) => setShippingData(prev => ({ ...prev, shipping_notes: e.target.value }))}
                            placeholder="Additional notes about shipping..."
                            rows={3}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowShippingModal(null);
                            setShippingData({
                              shipping_company: '',
                              tracking_id: '',
                              tracking_link: '',
                              shipping_method: 'Standard',
                              shipping_notes: ''
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            updateOrderStatus(order.id, 'shipped', user?.id, shippingData);
                            setShowShippingModal(null);
                            setShippingData({
                              shipping_company: '',
                              tracking_id: '',
                              tracking_link: '',
                              shipping_method: 'Standard',
                              shipping_notes: ''
                            });
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          Mark as Shipped
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </DialogContent>
            </Dialog>

            {/* Delivery Confirmation Modal */}
            <Dialog open={showDeliveryModal !== null} onOpenChange={() => setShowDeliveryModal(null)}>
              <DialogContent className="max-w-2xl bg-background border-border">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-serif text-foreground text-center">
                    Mark Order as Delivered
                  </DialogTitle>
                  <DialogDescription className="text-center text-muted-foreground">
                    Confirm delivery and add delivery details
                  </DialogDescription>
                </DialogHeader>
                
                {showDeliveryModal && (() => {
                  const order = orders.find(o => o.id === showDeliveryModal);
                  if (!order) return null;
                  
                  return (
                    <div className="space-y-6">
                      {/* Order Info */}
                      <div className="bg-accent rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-2">Order #{order.display_order_id}</h3>
                        <p className="text-sm text-muted-foreground">
                          Customer: {order.customerName} | Tracking: {order.tracking_id || 'N/A'}
                        </p>
                      </div>

                      {/* Delivery Form */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="delivery_notes">Delivery Notes</Label>
                          <Textarea
                            id="delivery_notes"
                            value={deliveryData.delivery_notes}
                            onChange={(e) => setDeliveryData(prev => ({ ...prev, delivery_notes: e.target.value }))}
                            placeholder="Delivery confirmation details, recipient info, etc..."
                            rows={3}
                          />
                        </div>

                        <div>
                          <Label htmlFor="delivery_proof_url">Delivery Proof URL</Label>
                          <Input
                            id="delivery_proof_url"
                            value={deliveryData.delivery_proof_url}
                            onChange={(e) => setDeliveryData(prev => ({ ...prev, delivery_proof_url: e.target.value }))}
                            placeholder="https://example.com/delivery-proof.jpg"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Optional: Link to delivery photo, signature, or other proof
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowDeliveryModal(null);
                            setDeliveryData({
                              delivery_notes: '',
                              delivery_proof_url: ''
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            updateOrderStatus(order.id, 'delivered', user?.id, deliveryData);
                            setShowDeliveryModal(null);
                            setDeliveryData({
                              delivery_notes: '',
                              delivery_proof_url: ''
                            });
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Delivered
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Variants Tab */}
          <TabsContent value="variants" className="space-y-4">
            {/* Variant Controls */}
            <Card className="bg-background border border-border">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search variants..."
                        value={variantSearchTerm}
                        onChange={(e) => setVariantSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button onClick={() => {
                      setEditingVariant(null);
                      setVariantForm({
                        product_id: '',
                        variant_name: '',
                        variant_description: '',
                        price: 0,
                        sku: '',
                        stock_quantity: 0,
                        is_active: true,
                        sort_order: 0,
                        images: [],
                      });
                      setShowVariantDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Variant
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variants Table */}
            <Card className="bg-background border border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedVariants.length === variants.length && variants.length > 0}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedVariants(variants.map(v => v.id));
                            } else {
                              setSelectedVariants([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Variant Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants
                      .filter(variant => 
                        variantSearchTerm === '' || 
                        variant.variant_name.toLowerCase().includes(variantSearchTerm.toLowerCase()) ||
                        variant.products?.name.toLowerCase().includes(variantSearchTerm.toLowerCase())
                      )
                      .map((variant) => (
                        <TableRow key={variant.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedVariants.includes(variant.id)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  setSelectedVariants(prev => [...prev, variant.id]);
                                } else {
                                  setSelectedVariants(prev => prev.filter(id => id !== variant.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              {variant.images && variant.images.length > 0 ? (
                                <img 
                                  src={variant.images[0].image_url} 
                                  alt={variant.variant_name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{variant.products?.name}</p>
                                <p className="text-sm text-muted-foreground">{variant.products?.brand}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{variant.variant_name}</p>
                              {variant.sku && (
                                <p className="text-sm text-muted-foreground">SKU: {variant.sku}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatINR(variant.price)}</TableCell>
                          <TableCell>{variant.stock_quantity || 0}</TableCell>
                          <TableCell>
                            <Badge variant={variant.is_active ? "default" : "secondary"}>
                              {variant.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingVariant(variant);
                                  setVariantForm({
                                    product_id: variant.product_id,
                                    variant_name: variant.variant_name,
                                    variant_description: variant.variant_description || '',
                                    price: variant.price,
                                    sku: variant.sku || '',
                                    stock_quantity: variant.stock_quantity || 0,
                                    is_active: variant.is_active,
                                    sort_order: variant.sort_order,
                                    images: variant.images?.map(img => img.image_url) || [],
                                  });
                                  setShowVariantDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete "${variant.variant_name}"?`)) {
                                    handleDeleteVariant(variant.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Combos Tab */}
          <TabsContent value="combos" className="space-y-4">
            {/* Combo Controls */}
            <Card className="bg-background border border-border">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search combos..."
                        value={comboSearchTerm}
                        onChange={(e) => setComboSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button onClick={() => {
                      setEditingCombo(null);
                      setComboForm({
                        name: '',
                        description: '',
                        combo_price: 0,
                        savings_amount: 0,
                        is_active: true,
                        sort_order: 0,
                        combo_items: [],
                      });
                      setShowComboDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Combo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Combos Table */}
            <Card className="bg-background border border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCombos.length === combos.length && combos.length > 0}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedCombos(combos.map(c => c.id));
                            } else {
                              setSelectedCombos([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Combo Name</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Combo Price</TableHead>
                      <TableHead>Savings</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combos
                      .filter(combo => 
                        comboSearchTerm === '' || 
                        combo.name.toLowerCase().includes(comboSearchTerm.toLowerCase())
                      )
                      .map((combo) => (
                        <TableRow key={combo.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedCombos.includes(combo.id)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  setSelectedCombos(prev => [...prev, combo.id]);
                                } else {
                                  setSelectedCombos(prev => prev.filter(id => id !== combo.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{combo.name}</p>
                              <p className="text-sm text-muted-foreground">{combo.description}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {(combo.combo_items || combo.items)?.slice(0, 2).map((item: any, index: number) => (
                                <div key={index} className="text-sm">
                                  <span className="font-medium">{item.products?.name}</span>
                                  {item.product_variants && (
                                    <span className="text-muted-foreground"> ({item.product_variants.variant_name})</span>
                                  )}
                                  <span className="text-muted-foreground"> x{item.quantity}</span>
                                </div>
                              ))}
                              {(combo.combo_items || combo.items) && (combo.combo_items || combo.items).length > 2 && (
                                <p className="text-xs text-muted-foreground">
                                  +{(combo.combo_items || combo.items).length - 2} more items
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatINR(combo.combo_price)}</TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium">
                              {formatINR(combo.savings_amount || (combo.original_price - combo.combo_price))}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={combo.is_active ? "default" : "secondary"}>
                              {combo.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingCombo(combo);
                                  setComboForm({
                                    name: combo.name,
                                    description: combo.description || '',
                                    combo_price: combo.combo_price,
                                    savings_amount: combo.savings_amount || (combo.original_price - combo.combo_price),
                                    is_active: combo.is_active,
                                    sort_order: combo.sort_order || 0,
                                    combo_items: (combo.combo_items || combo.items)?.map((item: any) => ({
                                      product_id: item.product_id,
                                      variant_id: item.variant_id,
                                      quantity: item.quantity,
                                    })) || [],
                                  });
                                  setShowComboDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete "${combo.name}"?`)) {
                                    handleDeleteCombo(combo.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discounts Tab */}
          <TabsContent value="discounts" className="space-y-4">
            {/* Discount Controls */}
            <Card className="bg-background border border-border">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search discounts..."
                        value={discountSearchTerm}
                        onChange={(e) => setDiscountSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button onClick={() => {
                      setEditingDiscount(null);
                      setDiscountForm({
                        discount_name: '',
                        discount_code: '',
                        discount_type: 'percentage',
                        discount_value: 0,
                        minimum_cart_value: 0,
                        maximum_discount_amount: 0,
                        usage_limit: 0,
                        usage_count: 0,
                        valid_from: '',
                        valid_until: '',
                        is_active: true,
                        applicable_products: [],
                        applicable_variants: [],
                        applicable_combos: [],
                      });
                      setShowDiscountDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Discount
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Discounts Table */}
            <Card className="bg-background border border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedDiscounts.length === discounts.length && discounts.length > 0}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedDiscounts(discounts.map(d => d.id));
                            } else {
                              setSelectedDiscounts([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Discount Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discounts
                      .filter(discount => 
                        discountSearchTerm === '' || 
                        (discount.name || discount.discount_name || '').toLowerCase().includes(discountSearchTerm.toLowerCase()) ||
                        (discount.code || discount.discount_code || '').toLowerCase().includes(discountSearchTerm.toLowerCase())
                      )
                      .map((discount) => (
                        <TableRow key={discount.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedDiscounts.includes(discount.id)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  setSelectedDiscounts(prev => [...prev, discount.id]);
                                } else {
                                  setSelectedDiscounts(prev => prev.filter(id => id !== discount.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{discount.name || discount.discount_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(discount.start_date || discount.valid_from || '').toLocaleDateString()} - {new Date(discount.end_date || discount.valid_until || '').toLocaleDateString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{discount.code || discount.discount_code}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {(discount.type || discount.discount_type || '').replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(discount.type || discount.discount_type) === 'percentage' 
                              ? `${discount.value || discount.discount_value}%`
                              : formatINR(discount.value || discount.discount_value || 0)
                            }
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{discount.usage_count} / {discount.usage_limit || '∞'}</p>
                              {(discount.min_cart_value || discount.minimum_cart_value) && (
                                <p className="text-muted-foreground">
                                  Min: {formatINR(discount.min_cart_value || discount.minimum_cart_value || 0)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={discount.is_active ? "default" : "secondary"}>
                              {discount.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingDiscount(discount);
                                  setDiscountForm({
                                    discount_name: discount.name || discount.discount_name || '',
                                    discount_code: discount.code || discount.discount_code || '',
                                    discount_type: discount.type || discount.discount_type || 'percentage',
                                    discount_value: discount.value || discount.discount_value || 0,
                                    minimum_cart_value: discount.min_cart_value || discount.minimum_cart_value || 0,
                                    maximum_discount_amount: discount.max_discount_amount || discount.maximum_discount_amount || 0,
                                    usage_limit: discount.usage_limit || 0,
                                    usage_count: discount.usage_count || 0,
                                    valid_from: discount.start_date || discount.valid_from || '',
                                    valid_until: discount.end_date || discount.valid_until || '',
                                    is_active: discount.is_active,
                                    applicable_products: discount.product_ids || discount.applicable_products || [],
                                    applicable_variants: discount.variant_ids || discount.applicable_variants || [],
                                    applicable_combos: discount.combo_ids || discount.applicable_combos || [],
                                  });
                                  setShowDiscountDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete "${discount.name || discount.discount_name}"?`)) {
                                    handleDeleteDiscount(discount.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            {/* Category Controls */}
            <Card className="bg-background border border-border">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Search categories..."
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="w-64"
                    />
                  </div>
                  <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-accent text-accent-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Category
                      </Button>
                    </DialogTrigger>
                <DialogContent className="bg-background border border-border max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-serif text-center text-foreground">
                      {editingCategory ? 'Edit Category' : 'Add New Category'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-muted-foreground">
                      Fill in the details below to {editingCategory ? 'update the' : 'add a new'} category.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Category Name</Label>
                      <Input
                        value={categoryForm.name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          const newSlug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                          setCategoryForm(prev => ({ ...prev, name: newName, slug: newSlug }));
                        }}
                        className="bg-input-background border-border"
                      />
                    </div>
                    <div>
                      <Label>URL Slug</Label>
                      <Input
                        value={categoryForm.slug}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, slug: e.target.value }))}
                        className="bg-input-background border-border"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                        className="bg-input-background border-border"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label>Image</Label>
                      <ImageUpload
                        imageUrl={categoryForm.image}
                        onImageUrlChange={(url) => setCategoryForm(prev => ({ ...prev, image: url || '' }))}
                      />
                    </div>
                    <div>
                      <Label>Image Alt Text</Label>
                      <Input
                        value={categoryForm.image_alt_text}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, image_alt_text: e.target.value }))}
                        className="bg-input-background border-border"
                      />
                    </div>
                    <div>
                      <Label>Products in Category (Drag to Reorder)</Label>
                      <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="products-in-category">
                          {(provided) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className="space-y-2 mt-2"
                            >
                              {categoryProductsOrder.map((product, index) => (
                                <Draggable key={product.id} draggableId={product.id} index={index}>
                                  {(provided) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="flex items-center space-x-3 p-2 border border-border rounded-md bg-background"
                                    >
                                      <ImageWithFallback
                                        src={product.gallery_images[0]}
                                        alt={product.name}
                                        className="w-8 h-8 object-cover rounded-sm"
                                      />
                                      <span className="flex-1 text-foreground">{product.name}</span>
                                      <Badge variant="secondary" className="text-xs">Order: {product.order}</Badge>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCategoryDialog(false);
                        setEditingCategory(null);
                        setCategoryForm({
                          name: '',
                          slug: '',
                          description: '',
                          image: '',
                          image_alt_text: '',
                        });
                        setCategoryProductsOrder([]); // Clear ordered products state
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveCategory} className="flex-1 bg-accent text-accent-foreground">
                      {editingCategory ? 'Update Category' : 'Add Category'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedCategories.length > 0 && (
              <Card className="bg-background border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {selectedCategories.length} categor{selectedCategories.length > 1 ? 'ies' : 'y'} selected
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCategories([])}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Categories Table */}
            <Card className="bg-background border border-border">
              <CardContent className="p-0">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="w-12 px-4 py-3 text-left font-medium text-sm text-muted-foreground">
                        <Checkbox
                          checked={selectedCategories.length === filteredCategories.length && filteredCategories.length > 0}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedCategories(filteredCategories.map(category => category.id));
                            } else {
                              setSelectedCategories([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Category</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Description</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Slug</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => (
                      <TableRow 
                        key={category.id} 
                        className="border-b border-border hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => {
                          setEditingCategory(category);
                          setShowCategoryDialog(true);
                        }}
                      >
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={selectedCategories.includes(category.id)}
                            onCheckedChange={(checked: boolean) => {
                              if (checked) {
                                setSelectedCategories(prev => [...prev, category.id]);
                              } else {
                                setSelectedCategories(prev => prev.filter(id => id !== category.id));
                              }
                            }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 overflow-hidden">
                              <ImageWithFallback
                                src={category.image}
                                alt={category.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{category.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
                            {category.description}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm text-muted-foreground font-mono">
                            {category.slug}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setEditingCategory(category);

                                // Fetch products associated with this category, including their order
                                const { data: categoryWithProducts, error: categoryProductsError } = await supabase
                                  .from('categories')
                                  .select(`
                                    id,
                                    products:product_categories(
                                      order,
                                      product_id,
                                      products (
                                        id,
                                        name,
                                        slug,
                                        brand,
                                        price,
                                        gallery_images
                                      )
                                    )
                                  `)
                                  .eq('id', category.id)
                                  .single();

                                if (categoryProductsError) {
                                  toast.error('Failed to fetch products for category');
                                  console.error('Fetch products for category error:', categoryProductsError);
                                  return;
                                }

                                const formattedProducts: CategoryProduct[] = categoryWithProducts.products
                                  .sort((a: any, b: any) => a.order - b.order) // Sort by the 'order' column
                                  .map((pc: any) => ({
                                    id: pc.products.id,
                                    name: pc.products.name,
                                    slug: pc.products.slug,
                                    brand: pc.products.brand,
                                    price: pc.products.price,
                                    gallery_images: pc.products.gallery_images,
                                    order: pc.order,
                                  }));
                                setCategoryProductsOrder(formattedProducts);

                                setCategoryForm({
                                    name: category.name,
                                    slug: category.slug,
                                    description: category.description,
                                    image: category.image,
                                    image_alt_text: category.image_alt_text,
                                  });
                                setShowCategoryDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const { error } = await supabase.from('categories').delete().eq('id', category.id);
                                if (error) {
                                  toast.error('Failed to delete category');
                                } else {
                                  toast.success('Category deleted successfully');
                                  fetchCategories();
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            {/* Customer Controls */}
            <Card className="bg-background border border-border">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search customers by name or email..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Select>
                      <SelectTrigger className="w-48 bg-background border border-border">
                        <SelectValue placeholder="Customer Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select>
                      <SelectTrigger className="w-48 bg-background border border-border">
                        <SelectValue placeholder="Sort By" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="total_spent">Total Spent</SelectItem>
                        <SelectItem value="order_count">Order Count</SelectItem>
                        <SelectItem value="last_order">Last Order</SelectItem>
                        <SelectItem value="created_at">Join Date</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-background border border-border">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Customers</p>
                      <p className="text-2xl font-serif font-medium text-foreground">{customers.length}</p>
                        </div>
                    <Users className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                        <div>
                      <p className="text-sm text-muted-foreground">Active Customers</p>
                      <p className="text-2xl font-serif font-medium text-foreground">
                        {customers.filter(c => c.status === 'active').length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Order Value</p>
                      <p className="text-2xl font-serif font-medium text-foreground">
                        ₹{customers.length > 0 ? Math.round(customers.reduce((sum, c) => sum + c.averageOrderValue, 0) / customers.length).toLocaleString('en-IN') : '0'}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-serif font-medium text-foreground">
                        ₹{customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <ShoppingBag className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bulk Actions */}
            {selectedCustomers.length > 0 && (
              <Card className="bg-background border border-border bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="w-5 h-5 text-accent" />
                      <span className="font-medium">
                        {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(value: string) => {
                        if (value === 'send_email') {
                          toast.info('Email functionality would be implemented here');
                        } else if (value === 'export') {
                          toast.info('Export functionality would be implemented here');
                        } else if (value === 'make_admin') {
                          toast.info('Make admin functionality would be implemented here');
                        }
                        setSelectedCustomers([]);
                      }}>
                        <SelectTrigger className="w-48 bg-background border border-border">
                          <SelectValue placeholder="Bulk Actions" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border z-50">
                          <SelectItem value="send_email">Send Email</SelectItem>
                          <SelectItem value="export">Export Data</SelectItem>
                          <SelectItem value="make_admin">Make Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedCustomers([])}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customers Table */}
            <Card className="bg-background border border-border">
              <CardContent className="p-0">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="w-12 px-4 py-3 text-left font-medium text-sm text-muted-foreground">
                        <Checkbox
                          checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedCustomers(filteredCustomers.map(customer => customer.id));
                            } else {
                              setSelectedCustomers([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Customer</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Contact</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Orders</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Total Spent</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Avg Order</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Last Order</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Status</TableHead>
                      <TableHead className="px-4 py-3 text-left font-medium text-sm text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow 
                        key={customer.id} 
                        className="border-b border-border hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => setShowCustomerDetails(customer.id)}
                      >
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={selectedCustomers.includes(customer.id)}
                            onCheckedChange={(checked: boolean) => {
                              if (checked) {
                                setSelectedCustomers(prev => [...prev, customer.id]);
                              } else {
                                setSelectedCustomers(prev => prev.filter(id => id !== customer.id));
                              }
                            }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                              <UserIcon className="w-5 h-5 text-accent-foreground" />
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {customer.name}
                                {customer.is_admin && (
                                  <Badge className="bg-accent text-accent-foreground text-xs">
                                    ADMIN
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Joined {new Date(customer.created_at).toLocaleDateString('en-IN')}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div>
                            <div className="text-sm">{customer.email}</div>
                            {customer.phone && (
                              <div className="text-xs text-muted-foreground">{customer.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-center">
                            <div className="font-medium">{customer.orderCount}</div>
                            <div className="text-xs text-muted-foreground">orders</div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="font-medium">
                            ₹{customer.totalSpent.toLocaleString('en-IN')}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm">
                            ₹{customer.averageOrderValue.toLocaleString('en-IN')}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-sm">
                            {customer.lastOrderDate 
                              ? new Date(customer.lastOrderDate).toLocaleDateString('en-IN')
                              : 'Never'
                            }
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge 
                            className={
                              customer.status === 'active' 
                                ? 'bg-green-500 text-green-100 border-green-500'
                                : customer.status === 'inactive'
                                ? 'bg-yellow-500 text-yellow-100 border-yellow-500'
                                : 'bg-red-500 text-red-100 border-red-500'
                            }
                          >
                            {customer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setShowCustomerDetails(customer.id);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Customer Details Dialog */}
            <Dialog open={showCustomerDetails !== null} onOpenChange={() => setShowCustomerDetails(null)}>
              <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-background border-border">
                {showCustomerDetails && (() => {
                  const customer = customers.find(c => c.id === showCustomerDetails);
                  if (!customer) return null;
                  
                  return (
                    <>
                      <DialogHeader className="pb-6">
                        <DialogTitle className="text-3xl font-serif text-foreground text-center">
                          {customer.name}
                        </DialogTitle>
                        <DialogDescription className="text-center text-muted-foreground text-lg">
                          Complete customer profile and management
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-8">
                        {/* Customer Status & Actions */}
                        <div className="bg-accent rounded-xl p-6 border border-accent/20">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center">
                                <UserIcon className="w-8 h-8 text-accent" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-2xl font-serif">{customer.name}</h3>
                                  {customer.is_admin && (
                                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 px-3 py-1">
                                      ADMIN
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-muted-foreground">{customer.email}</div>
                                {customer.phone && (
                                  <div className="text-muted-foreground">{customer.phone}</div>
                                )}
                        </div>
                      </div>
                      <div className="text-right">
                              <Badge 
                                className={`text-lg px-4 py-2 ${
                                  customer.status === 'active' 
                                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                    : customer.status === 'inactive'
                                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                                }`}
                              >
                                {customer.status.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-3">
                            <Button
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                            >
                              <Mail className="w-5 h-5 mr-2" />
                              Send Email
                            </Button>
                            <Button
                              variant="outline"
                              className="px-6 py-2"
                            >
                              <Edit className="w-5 h-5 mr-2" />
                              Edit Profile
                            </Button>
                            <Button
                              variant="destructive"
                              className="px-6 py-2"
                            >
                              <XCircle className="w-5 h-5 mr-2" />
                              Block Customer
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowCustomerDetails(null)}
                              className="px-6 py-2"
                            >
                              Close
                            </Button>
                          </div>
                        </div>

                        {/* Customer Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <Card className="bg-background border border-border text-center">
                            <CardContent className="p-6">
                              <div className="text-3xl font-serif text-accent mb-2">
                                {customer.orderCount}
                              </div>
                              <div className="text-sm text-muted-foreground">Total Orders</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-background border border-border text-center">
                            <CardContent className="p-6">
                              <div className="text-3xl font-serif text-accent mb-2">
                          ₹{customer.totalSpent.toLocaleString('en-IN')}
                      </div>
                              <div className="text-sm text-muted-foreground">Total Spent</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-background border border-border text-center">
                            <CardContent className="p-6">
                              <div className="text-3xl font-serif text-accent mb-2">
                                ₹{customer.averageOrderValue.toLocaleString('en-IN')}
                    </div>
                              <div className="text-sm text-muted-foreground">Avg Order Value</div>
                  </CardContent>
                </Card>
                          <Card className="bg-background border border-border text-center">
                            <CardContent className="p-6">
                              <div className="text-3xl font-serif text-accent mb-2">
                                {customer.lastOrderDate 
                                  ? new Date(customer.lastOrderDate).toLocaleDateString('en-IN')
                                  : 'Never'
                                }
            </div>
                              <div className="text-sm text-muted-foreground">Last Order</div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Customer Timeline */}
                        <Card className="bg-background border border-border">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                              <Calendar className="w-6 h-6 text-accent" />
                              Customer Timeline
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-4">
                              <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <div className="flex-1">
                                  <div className="text-lg font-medium">Account Created</div>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(customer.created_at).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              </div>
                              {customer.firstOrderDate && (
                                <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
                                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                  <div className="flex-1">
                                    <div className="text-lg font-medium">First Order</div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(customer.firstOrderDate).toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {customer.lastOrderDate && customer.lastOrderDate !== customer.firstOrderDate && (
                                <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
                                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                  <div className="flex-1">
                                    <div className="text-lg font-medium">Latest Order</div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(customer.lastOrderDate).toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Customer Contact Information */}
                        <Card className="bg-background border border-border">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                              <Mail className="w-6 h-6 text-accent" />
                              Contact Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                                <div className="text-lg">{customer.email}</div>
                              </div>
                              {customer.phone && (
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                                  <div className="text-lg">{customer.phone}</div>
                                </div>
                              )}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Account Status</Label>
                                <div className="text-lg capitalize">{customer.status}</div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
                                <div className="text-lg">{new Date(customer.created_at).toLocaleDateString('en-IN')}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  );
                })()}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Homepage Tab */}
          <TabsContent value="homepage">
            <HomepageManager />
          </TabsContent>

          {/* Blog Tab */}
          <TabsContent value="blog">
            <BlogManager />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SiteSettingsPage />
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets">
            <AssetManager 
              mode="manage"
            />
          </TabsContent>
        </Tabs>

        {/* Variant Dialog */}
        <Dialog open={showVariantDialog} onOpenChange={setShowVariantDialog}>
          <DialogContent className="max-w-2xl bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif text-foreground text-center">
                {editingVariant ? 'Edit Variant' : 'Add New Variant'}
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground">
                {editingVariant ? 'Update variant details' : 'Create a new product variant'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product</Label>
                  <Select value={variantForm.product_id} onValueChange={(value: string) => setVariantForm(prev => ({ ...prev, product_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Variant Name</Label>
                  <Input
                    value={variantForm.variant_name}
                    onChange={(e) => setVariantForm(prev => ({ ...prev, variant_name: e.target.value }))}
                    placeholder="e.g., Packet, Carton, Half Carton"
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={variantForm.variant_description}
                  onChange={(e) => setVariantForm(prev => ({ ...prev, variant_description: e.target.value }))}
                  placeholder="Variant description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={variantForm.price}
                    onChange={(e) => setVariantForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={variantForm.sku}
                    onChange={(e) => setVariantForm(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="SKU code"
                  />
                </div>
                
                <div>
                  <Label>Stock Quantity</Label>
                  <Input
                    type="number"
                    value={variantForm.stock_quantity}
                    onChange={(e) => setVariantForm(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={variantForm.sort_order}
                    onChange={(e) => setVariantForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="variant-active"
                    checked={variantForm.is_active}
                    onCheckedChange={(checked: boolean) => setVariantForm(prev => ({ ...prev, is_active: !!checked }))}
                  />
                  <Label htmlFor="variant-active">Active</Label>
                </div>
              </div>

              <div>
                <Label>Variant Images</Label>
                <MultipleImageUpload
                  imageUrls={variantForm.images}
                  onImageUrlsChange={(images: string[]) => setVariantForm(prev => ({ ...prev, images }))}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <Button variant="outline" onClick={() => setShowVariantDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveVariant}>
                {editingVariant ? 'Update Variant' : 'Create Variant'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Combo Dialog */}
        <Dialog open={showComboDialog} onOpenChange={setShowComboDialog}>
          <DialogContent className="max-w-3xl bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif text-foreground text-center">
                {editingCombo ? 'Edit Combo' : 'Add New Combo'}
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground">
                {editingCombo ? 'Update combo details' : 'Create a new product combo'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Combo Name</Label>
                  <Input
                    value={comboForm.name}
                    onChange={(e) => setComboForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Marlboro + Gold Flake Special"
                  />
                </div>
                
                <div>
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={comboForm.sort_order}
                    onChange={(e) => setComboForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={comboForm.description}
                  onChange={(e) => setComboForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Combo description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Combo Price</Label>
                  <Input
                    type="number"
                    value={comboForm.combo_price}
                    onChange={(e) => setComboForm(prev => ({ ...prev, combo_price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <Label>Savings Amount</Label>
                  <Input
                    type="number"
                    value={comboForm.savings_amount}
                    onChange={(e) => setComboForm(prev => ({ ...prev, savings_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="combo-active"
                    checked={comboForm.is_active}
                    onCheckedChange={(checked: boolean) => setComboForm(prev => ({ ...prev, is_active: !!checked }))}
                  />
                  <Label htmlFor="combo-active">Active</Label>
                </div>
              </div>

              <div>
                <Label>Combo Items</Label>
                <div className="space-y-3">
                  {comboForm.combo_items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border border-border rounded-lg">
                      <div className="flex-1">
                        <Select 
                          value={item.product_id} 
                          onValueChange={(value: string) => {
                            const newItems = [...comboForm.combo_items];
                            newItems[index].product_id = value;
                            setComboForm(prev => ({ ...prev, combo_items: newItems }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - {product.brand}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="w-24">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...comboForm.combo_items];
                            newItems[index].quantity = parseInt(e.target.value) || 1;
                            setComboForm(prev => ({ ...prev, combo_items: newItems }));
                          }}
                          placeholder="Qty"
                        />
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newItems = comboForm.combo_items.filter((_, i) => i !== index);
                          setComboForm(prev => ({ ...prev, combo_items: newItems }));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      setComboForm(prev => ({
                        ...prev,
                        combo_items: [...prev.combo_items, { product_id: '', quantity: 1 }]
                      }));
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <Button variant="outline" onClick={() => setShowComboDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCombo}>
                {editingCombo ? 'Update Combo' : 'Create Combo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Discount Dialog */}
        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
          <DialogContent className="max-w-2xl bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif text-foreground text-center">
                {editingDiscount ? 'Edit Discount' : 'Add New Discount'}
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground">
                {editingDiscount ? 'Update discount details' : 'Create a new discount'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount Name</Label>
                  <Input
                    value={discountForm.discount_name}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, discount_name: e.target.value }))}
                    placeholder="e.g., Summer Sale 20%"
                  />
                </div>
                
                <div>
                  <Label>Coupon Code</Label>
                  <Input
                    value={discountForm.discount_code}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, discount_code: e.target.value }))}
                    placeholder="e.g., SUMMER20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount Type</Label>
                  <Select value={discountForm.discount_type} onValueChange={(value: any) => setDiscountForm(prev => ({ ...prev, discount_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                      <SelectItem value="cart_value">Cart Value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Discount Value</Label>
                  <Input
                    type="number"
                    value={discountForm.discount_value}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Minimum Cart Value</Label>
                  <Input
                    type="number"
                    value={discountForm.minimum_cart_value}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, minimum_cart_value: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <Label>Maximum Discount Amount</Label>
                  <Input
                    type="number"
                    value={discountForm.maximum_discount_amount}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, maximum_discount_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Usage Limit</Label>
                  <Input
                    type="number"
                    value={discountForm.usage_limit}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, usage_limit: parseInt(e.target.value) || 0 }))}
                    placeholder="0 (unlimited)"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="discount-active"
                    checked={discountForm.is_active}
                    onCheckedChange={(checked: boolean) => setDiscountForm(prev => ({ ...prev, is_active: !!checked }))}
                  />
                  <Label htmlFor="discount-active">Active</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valid From</Label>
                  <Input
                    type="datetime-local"
                    value={discountForm.valid_from}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, valid_from: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label>Valid Until</Label>
                  <Input
                    type="datetime-local"
                    value={discountForm.valid_until}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, valid_until: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <Button variant="outline" onClick={() => setShowDiscountDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDiscount}>
                {editingDiscount ? 'Update Discount' : 'Create Discount'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
