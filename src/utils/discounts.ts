// Discount Calculation System (Convex-backed; display-side only —
// order totals are always recomputed from catalog prices at createOrder).
import { convex } from '../lib/convex/client';
import { api } from '../../convex/_generated/api';
import { Discount, DiscountResult, CartItemWithVariant } from '../types/variants';

// Boundary: Convex ms timestamps → ISO strings the Discount type speaks.
const toDiscount = (d: any): Discount => ({
  id: d._id,
  name: d.name,
  code: d.code,
  type: d.type,
  value: d.value,
  min_cart_value: d.min_cart_value,
  max_discount_amount: d.max_discount_amount,
  applicable_to: d.applicable_to,
  product_ids: d.product_ids,
  combo_ids: d.combo_ids,
  variant_ids: d.variant_ids,
  start_date: d.start_date ? new Date(d.start_date).toISOString() : undefined,
  end_date: d.end_date ? new Date(d.end_date).toISOString() : undefined,
  usage_limit: d.usage_limit,
  usage_count: d.usage_count ?? 0,
  is_active: d.is_active,
  created_at: d.createdAt ? new Date(d.createdAt).toISOString() : '',
  updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : '',
});

// Calculate discount for cart items
export const calculateDiscount = async (
  cartItems: CartItemWithVariant[],
  couponCode?: string
): Promise<DiscountResult | null> => {
  if (!cartItems.length) return null;

  try {
    // Active + in-window only (server-filtered, mirrors old RLS policy).
    const rows = await convex.query(api.discounts.listActiveDiscounts, {});
    const discounts: Discount[] = (rows || []).map(toDiscount);

    // Calculate cart totals
    const cartTotal = cartItems.reduce((sum, item) => {
      const price = item.variant_price || item.combo_price || item.price;
      return sum + (price * item.quantity);
    }, 0);

    // Find applicable discount
    let applicableDiscount: Discount | null = null;

    if (couponCode) {
      // Look for coupon code discount first (case-insensitive)
      applicableDiscount = discounts?.find(d => 
        d.code?.toLowerCase() === couponCode.toLowerCase() &&
        isDiscountApplicable(d, cartItems, cartTotal)
      ) || null;
    }

    // If no coupon code or coupon not found, look for automatic discounts
    if (!applicableDiscount) {
      applicableDiscount = discounts?.find(d => 
        !d.code && isDiscountApplicable(d, cartItems, cartTotal)
      ) || null;
    }

    if (!applicableDiscount) return null;

    // Calculate discount amount
    const discountAmount = calculateDiscountAmount(applicableDiscount, cartTotal);
    
    // Check usage limits
    if (applicableDiscount.usage_limit && 
        applicableDiscount.usage_count >= applicableDiscount.usage_limit) {
      return {
        discount_id: applicableDiscount.id,
        discount_name: applicableDiscount.name,
        discount_code: applicableDiscount.code,
        discount_type: applicableDiscount.type,
        discount_value: applicableDiscount.value,
        discount_amount: 0,
        original_amount: cartTotal,
        final_amount: cartTotal,
        is_applicable: false,
        reason: 'Discount usage limit reached'
      };
    }

    return {
      discount_id: applicableDiscount.id,
      discount_name: applicableDiscount.name,
      discount_code: applicableDiscount.code,
      discount_type: applicableDiscount.type,
      discount_value: applicableDiscount.value,
      discount_amount: discountAmount,
      original_amount: cartTotal,
      final_amount: cartTotal - discountAmount,
      is_applicable: true
    };

  } catch (error) {
    console.error('Discount calculation error:', error);
    return null;
  }
};

// Check if discount is applicable to cart
const isDiscountApplicable = (
  discount: Discount, 
  cartItems: CartItemWithVariant[], 
  cartTotal: number
): boolean => {
  // Check minimum cart value
  if (discount.min_cart_value && cartTotal < discount.min_cart_value) {
    return false;
  }

  // Check applicable_to field
  switch (discount.applicable_to) {
    case 'all':
      return true;
    
    case 'products':
      return cartItems.some(item => 
        !item.combo_id && 
        discount.product_ids?.includes(item.id)
      );
    
    case 'combos':
      return cartItems.some(item => 
        item.combo_id && 
        discount.combo_ids?.includes(item.combo_id)
      );
    
    case 'variants':
      return cartItems.some(item => 
        item.variant_id && 
        discount.variant_ids?.includes(item.variant_id)
      );
    
    default:
      return false;
  }
};

// Calculate actual discount amount
const calculateDiscountAmount = (discount: Discount, cartTotal: number): number => {
  let discountAmount = 0;

  switch (discount.type) {
    case 'percentage':
      discountAmount = (cartTotal * discount.value) / 100;
      break;
    
    case 'fixed_amount':
      discountAmount = discount.value;
      break;
    
    case 'cart_value':
      // Cart value discounts are typically tiered
      // For now, simple implementation
      discountAmount = discount.value;
      break;
  }

  // Apply maximum discount cap
  if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
    discountAmount = discount.max_discount_amount;
  }

  // Ensure discount doesn't exceed cart total
  return Math.min(discountAmount, cartTotal);
};

// Apply discount to cart
export const applyDiscountToCart = async (
  cartItems: CartItemWithVariant[],
  couponCode?: string
): Promise<{
  items: CartItemWithVariant[];
  subtotal: number;
  discount?: DiscountResult;
  total: number;
  total_items: number;
}> => {
  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.variant_price || item.combo_price || item.price;
    return sum + (price * item.quantity);
  }, 0);

  const total_items = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const discount = await calculateDiscount(cartItems, couponCode);

  return {
    items: cartItems,
    subtotal,
    discount: discount?.is_applicable ? discount : undefined,
    total: discount?.is_applicable ? discount.final_amount : subtotal,
    total_items
  };
};

// Validate coupon code
export const validateCouponCode = async (code: string): Promise<{
  isValid: boolean;
  discount?: Discount;
  message?: string;
}> => {
  if (!code.trim()) {
    return { isValid: false, message: 'Please enter a coupon code' };
  }

  try {
    const row = await convex.query(api.discounts.getDiscountByCode, { code });
    if (!row) {
      return { isValid: false, message: 'Invalid coupon code' };
    }
    const discount = toDiscount(row);

    if (!discount.is_active) {
      return { isValid: false, message: 'Invalid coupon code' };
    }

    // Check if discount is expired
    const now = new Date();
    if (discount.end_date && new Date(discount.end_date) < now) {
      return { isValid: false, message: 'Coupon code has expired' };
    }

    // Check if discount has started
    if (discount.start_date && new Date(discount.start_date) > now) {
      return { isValid: false, message: 'Coupon code is not yet active' };
    }

    // Check usage limits
    if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
      return { isValid: false, message: 'Coupon code usage limit reached' };
    }

    return { isValid: true, discount };

  } catch (error) {
    console.error('Coupon validation error:', error);
    return { isValid: false, message: 'Error validating coupon code' };
  }
};

// Get available discounts for display
export const getAvailableDiscounts = async (): Promise<Discount[]> => {
  try {
    const rows = await convex.query(api.discounts.listActiveDiscounts, {});
    return (rows || []).map(toDiscount);
  } catch (error) {
    console.error('Get available discounts error:', error);
    return [];
  }
};

// Format discount display text
export const formatDiscountText = (discount: Discount): string => {
  switch (discount.type) {
    case 'percentage':
      return `${discount.value}% off`;
    
    case 'fixed_amount':
      return `₹${discount.value} off`;
    
    case 'cart_value':
      return `₹${discount.value} off on orders above ₹${discount.min_cart_value || 0}`;
    
    default:
      return 'Discount available';
  }
};

// Get discount eligibility message
export const getDiscountEligibilityMessage = (
  discount: Discount, 
  cartTotal: number
): string => {
  if (discount.min_cart_value && cartTotal < discount.min_cart_value) {
    return `Add ₹${discount.min_cart_value - cartTotal} more to get this discount`;
  }
  
  if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
    return 'This discount has reached its usage limit';
  }
  
  return 'Discount available';
};
