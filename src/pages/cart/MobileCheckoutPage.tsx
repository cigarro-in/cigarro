import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Minus, 
  MapPin, 
  Truck, 
  Clock, 
  Zap, 
  ChevronRight, 
  CreditCard, 
  Smartphone, 
  QrCode, 
  ExternalLink,
  X,
  Check,
  Home,
  Building2,
  Hotel,
  GraduationCap,
  MapPinIcon,
  Edit3,
  Navigation,
  Loader2,
  Tag,
  Copy
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { validatePhone, validatePincode, validateAddress, validateName, validateEmail, validateFormData } from '../../utils/validation';
import { calculateDiscount, applyDiscountToCart, validateCouponCode } from '../../utils/discounts';

interface Address {
  id?: string;
  full_name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
  label: string;
  is_primary?: boolean;
}

interface ShippingOption {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: string;
  icon: React.ReactNode;
}

const shippingOptions: ShippingOption[] = [
  {
    id: 'standard',
    name: 'Standard Delivery',
    description: 'Free delivery',
    price: 0,
    estimatedDays: '5-7 days',
    icon: <Truck className="w-5 h-5" />
  },
  {
    id: 'express',
    name: 'Express Delivery',
    description: 'Faster delivery',
    price: 99,
    estimatedDays: '2-3 days',
    icon: <Clock className="w-5 h-5" />
  },
  {
    id: 'priority',
    name: 'Priority Delivery',
    description: 'Next day delivery',
    price: 199,
    estimatedDays: '1 day',
    icon: <Zap className="w-5 h-5" />
  }
];

const addressSuggestions = [
  { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
  { id: 'work', label: 'Work', icon: <Building2 className="w-4 h-4" /> },
  { id: 'pg', label: 'PG', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'hotel', label: 'Hotel', icon: <Hotel className="w-4 h-4" /> },
  { id: 'hostel', label: 'Hostel', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'other', label: 'Other', icon: <MapPinIcon className="w-4 h-4" /> }
];

export function MobileCheckoutPage() {
  const navigate = useNavigate();
  const { items: cartItems, updateQuantity, removeFromCart, totalPrice: cartTotalPrice, clearCart } = useCart();
  const { user } = useAuth();

  // Check for Buy Now flow
  const isBuyNow = sessionStorage.getItem('isBuyNow') === 'true';
  const buyNowItemData = sessionStorage.getItem('buyNowItem');
  const buyNowItem = isBuyNow && buyNowItemData ? JSON.parse(buyNowItemData) : null;

  // Use Buy Now item or cart items
  const items = isBuyNow && buyNowItem ? [buyNowItem] : cartItems;
  const totalPrice = isBuyNow && buyNowItem 
    ? (buyNowItem.variant_price || buyNowItem.price) * buyNowItem.quantity 
    : cartTotalPrice;

  // State management
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [showAddNewAddressDialog, setShowAddNewAddressDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [pincodeLookupTimeout, setPincodeLookupTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [orderId, setOrderId] = useState('');
  const [paymentStage, setPaymentStage] = useState<'processing' | 'verifying' | 'confirmed' | 'pending'>('processing');
  const [transactionId, setTransactionId] = useState('');
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);

  // Address form state
  const [addressForm, setAddressForm] = useState({
    full_name: user?.name || '',
    phone: '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    label: 'home'
  });
  const [customLabel, setCustomLabel] = useState('');
  const [addressErrors, setAddressErrors] = useState<{[key: string]: string}>({});

  // Coupon and discount state
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [discountError, setDiscountError] = useState('');

  // Lucky discount (same as desktop)
  const [randomDiscount] = useState(() => {
    const paise = Math.floor(Math.random() * 99) + 1;
    const discount = paise / 100;
    return Math.max(0.01, Math.min(0.99, discount));
  });

  useEffect(() => {
    if (user) {
      loadSavedAddresses();
    }
  }, [user]);

  useEffect(() => {
    // Only redirect to cart if items are empty AND payment is not completed
    if (items.length === 0 && !isPaymentCompleted) {
      console.log('🛒 Cart is empty, redirecting to cart page');
      navigate('/cart');
    }
  }, [items, navigate, isPaymentCompleted]);

  const loadSavedAddresses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }); // Most recent first

      if (!error && data) {
        setSavedAddresses(data);
        
        // Auto-select the most recently used address (first in the list)
        if (data.length > 0) {
          setSelectedAddress(data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  // Pincode lookup functionality (same as desktop)
  const fetchLocationFromPincode = async (pincode: string) => {
    if (pincode.length === 6) {
      try {
        const { data, error } = await supabase
          .from('pincode_lookup')
          .select('*')
          .eq('pincode', pincode)
          .single();
        
        if (error) {
          setAddressErrors(prev => ({
            ...prev,
            pincode: 'This PIN code is not serviceable'
          }));
          return;
        }
        
        if (data) {
          setAddressForm(prev => ({
            ...prev,
            city: data.city,
            state: data.state,
            country: data.country
          }));
          
          setAddressErrors(prev => ({
            ...prev,
            city: '',
            state: '',
            pincode: ''
          }));
        }
      } catch (error) {
        console.error('Pincode lookup error:', error);
      }
    }
  };

  // Fresh implementation of current location functionality
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    
    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        toast.error('Location services not supported on this device');
        return;
      }

      // Check permissions first
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          if (permission.state === 'denied') {
            toast.error('Location access denied. Please enable location in your browser settings.');
            return;
          }
        } catch (permError) {
          console.log('Permission API not available, proceeding with location request');
        }
      }

      // Get current position with proper error handling
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Location request timed out'));
        }, 15000); // 15 second timeout

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeoutId);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timeoutId);
            reject(err);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // Accept 1 minute old location
          }
        );
      });

      const { latitude, longitude } = position.coords;
      console.log('✅ Location obtained:', { latitude, longitude });
      toast.info('📍 Processing location data...');

      // Use multiple geocoding services for better reliability
      let addressData = null;
      
      // Try OpenStreetMap Nominatim first
      try {
        const nominatimResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`,
          {
            headers: {
              'User-Agent': 'Cigarro-Mobile-Checkout/1.0'
            }
          }
        );

        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();
          if (nominatimData && nominatimData.address) {
            addressData = nominatimData;
            console.log('✅ Nominatim data:', nominatimData);
          }
        }
      } catch (nominatimError) {
        console.log('Nominatim failed, trying alternative service');
      }

      // Fallback to a simpler service if Nominatim fails
      if (!addressData) {
        try {
          const geocodeResponse = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );

          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            if (geocodeData) {
              // Convert to Nominatim-like format
              addressData = {
                address: {
                  house_number: '',
                  road: geocodeData.locality || '',
                  suburb: geocodeData.localityInfo?.administrative?.[3]?.name || '',
                  city: geocodeData.city || geocodeData.locality || '',
                  state: geocodeData.principalSubdivision || '',
                  postcode: geocodeData.postcode || '',
                  country: geocodeData.countryName || 'India'
                }
              };
              console.log('✅ BigDataCloud data:', geocodeData);
            }
          }
        } catch (fallbackError) {
          console.log('Fallback geocoding also failed');
        }
      }

      if (addressData && addressData.address) {
        const addr = addressData.address;
        
        // Extract address components with better fallbacks
        const road = addr.road || addr.street || addr.pedestrian || '';
        const suburb = addr.suburb || addr.neighbourhood || addr.quarter || '';
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const state = addr.state || addr.province || addr.region || '';
        const pincode = addr.postcode || '';
        const country = addr.country || 'India';
        
        // Build formatted address
        const addressParts = [];
        if (road) addressParts.push(road);
        if (suburb && suburb !== city) addressParts.push(suburb);
        
        const formattedAddress = addressParts.length > 0 
          ? addressParts.join(', ')
          : `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        
        console.log('📝 Updating form with:', {
          address: formattedAddress,
          city,
          state,
          pincode,
          country
        });
        
        // Update form with detected location
        setAddressForm(prev => {
          const updated = {
            ...prev,
            address: formattedAddress,
            city: city || prev.city,
            state: state || prev.state,
            pincode: pincode || prev.pincode,
            country: country
          };
          console.log('✅ Form updated:', updated);
          return updated;
        });
        
        // Clear any previous errors for auto-filled fields
        setAddressErrors(prev => ({
          ...prev,
          address: '',
          city: city ? '' : prev.city,
          state: state ? '' : prev.state,
          pincode: pincode ? '' : prev.pincode
        }));
        
        toast.success(`📍 Location filled! ${city ? city + ', ' + state : 'Please verify details'}`);
        
        // Auto-save the location-detected address if user info is complete
        if (user && addressForm.full_name && addressForm.phone) {
          try {
            const locationAddressData = {
              user_id: user.id,
              full_name: addressForm.full_name.trim(),
              phone: addressForm.phone.trim(),
              address: formattedAddress,
              pincode: pincode || addressForm.pincode,
              city: city || addressForm.city,
              state: state || addressForm.state,
              country: country,
              label: 'Current Location',
              latitude: latitude,
              longitude: longitude
            };
            
            const { data: savedAddr, error: saveError } = await supabase
              .from('saved_addresses')
              .insert([locationAddressData])
              .select()
              .single();
            
            if (!saveError && savedAddr) {
              setSavedAddresses(prev => [savedAddr, ...prev]);
              setSelectedAddress(savedAddr);
              toast.success('✅ Location saved to your addresses!');
            }
          } catch (saveErr) {
            console.log('Could not auto-save location:', saveErr);
            // Non-critical error, location is still filled in form
          }
        }
        
      } else {
        // If geocoding fails, just use coordinates
        const coordinateAddress = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
        console.log('⚠️ Geocoding failed, using coordinates:', coordinateAddress);
        setAddressForm(prev => ({
          ...prev,
          address: coordinateAddress
        }));
        
        toast.warning('📍 Location detected, but address details unavailable. Please fill manually.');
      }

    } catch (error) {
      console.error('Location error:', error);
      
      // Provide specific error messages
      if (error instanceof GeolocationPositionError || (error as any).code) {
        const geoError = error as GeolocationPositionError;
        switch (geoError.code) {
          case 1: // PERMISSION_DENIED
            toast.error('Location access denied. Please enable location permissions.');
            break;
          case 2: // POSITION_UNAVAILABLE
            toast.error('Location information unavailable. Please enter address manually.');
            break;
          case 3: // TIMEOUT
            toast.error('Location request timed out. Please try again.');
            break;
          default:
            toast.error('Unable to get location. Please enter address manually.');
        }
      } else if (error instanceof Error && error.message.includes('timeout')) {
        toast.error('Location request timed out. Please try again or enter address manually.');
      } else {
        toast.error('Unable to detect location. Please enter address manually.');
      }
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const validateAddressForm = () => {
    const validationRules = {
      full_name: (value: string) => validateName(value, 'Full name'),
      phone: (value: string) => validatePhone(value),
      address: (value: string) => validateAddress(value),
      pincode: (value: string) => validatePincode(value),
      city: (value: string) => validateName(value, 'City'),
      state: (value: string) => validateName(value, 'State'),
    };
    
    const result = validateFormData(addressForm, validationRules);
    setAddressErrors(result.errors);
    return result.isValid;
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      full_name: address.full_name,
      phone: address.phone,
      address: address.address,
      pincode: address.pincode,
      city: address.city,
      state: address.state,
      country: address.country,
      label: addressSuggestions.find(s => s.label === address.label)?.id || 'other'
    });
    
    if (!addressSuggestions.find(s => s.label === address.label)) {
      setCustomLabel(address.label);
    }
    
    setShowAddressDialog(false);
    setShowAddNewAddressDialog(true);
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', user!.id);

      if (error) throw error;

      // Remove from local state
      setSavedAddresses(prev => prev.filter(addr => addr.id !== addressId));
      
      // If deleted address was selected, clear selection
      if (selectedAddress?.id === addressId) {
        setSelectedAddress(null);
      }

      toast.success('Address deleted successfully');
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('Failed to delete address');
    }
  };

  const handleSaveAddress = async () => {
    if (!validateAddressForm()) return;

    setIsSavingAddress(true);
    try {
      const finalLabel = addressForm.label === 'other' ? customLabel : 
        addressSuggestions.find(s => s.id === addressForm.label)?.label || 'My Address';

      const addressData = {
        user_id: user!.id,
        full_name: addressForm.full_name.trim(),
        phone: addressForm.phone.trim(),
        address: addressForm.address.trim(),
        pincode: addressForm.pincode.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        country: addressForm.country,
        label: finalLabel
      };

      console.log('Saving address:', addressData);

      let data, error;

      if (editingAddress) {
        // Update existing address
        const result = await supabase
          .from('saved_addresses')
          .update(addressData)
          .eq('id', editingAddress.id)
          .eq('user_id', user!.id)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      } else {
        // Create new address
        const result = await supabase
          .from('saved_addresses')
          .insert([addressData])
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Address saved successfully:', data);

      if (editingAddress) {
        // Update existing address in list
        setSavedAddresses(prev => prev.map(addr => 
          addr.id === editingAddress.id ? data : addr
        ));
      } else {
        // Add new address at the beginning
        setSavedAddresses(prev => [data, ...prev]);
      }
      
      // Select the saved address
      setSelectedAddress(data);
      
      // Close dialogs and reset form
      setShowAddressDialog(false);
      setShowAddNewAddressDialog(false);
      setAddressForm({
        full_name: user?.name || '',
        phone: '',
        address: '',
        pincode: '',
        city: '',
        state: '',
        country: 'India',
        label: 'home'
      });
      setCustomLabel('');
      setAddressErrors({});
      setEditingAddress(null);
      
      toast.success(editingAddress ? '✅ Address updated and selected!' : '✅ Address saved and selected!');
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      setDiscountError('Please enter a coupon code');
      return;
    }

    setIsValidatingCoupon(true);
    setDiscountError('');

    try {
      const validation = await validateCouponCode(couponCode);
      
      if (!validation.isValid) {
        setDiscountError(validation.message || 'Invalid coupon code');
        return;
      }

      const discount = await calculateDiscount(items, couponCode);
      
      if (discount && discount.is_applicable) {
        setAppliedDiscount(discount);
        toast.success(`Coupon applied! You saved ${formatINR(discount.discount_amount)}`);
      } else {
        setDiscountError(discount?.reason || 'Coupon not applicable');
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      setDiscountError('Failed to validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedDiscount(null);
    setCouponCode('');
    setDiscountError('');
    toast.info('Coupon removed');
  };

  const getShippingCost = () => {
    const option = shippingOptions.find(opt => opt.id === selectedShipping);
    return option?.price || 0;
  };

  const getFinalTotal = () => {
    const shippingCost = getShippingCost();
    const couponDiscountAmount = appliedDiscount?.discount_amount || 0;
    const totalDiscountAmount = randomDiscount + couponDiscountAmount;
    return totalPrice + shippingCost - totalDiscountAmount;
  };

  const handlePaymentSuccess = () => {
    // Generate a unique order ID
    const newOrderId = `ORD${Date.now().toString().slice(-8)}`;
    setOrderId(newOrderId);
    
    // Start countdown from 10 seconds
    let count = 10;
    setCountdown(count);
    
    const timer = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count <= 0) {
        clearInterval(timer);
        // Navigate to success page with a small random delay (0-3 seconds)
        const randomDelay = Math.floor(Math.random() * 3000);
        const finalAmount = getFinalTotal();
        const itemCount = items.length;
        
        console.log('📦 Navigating to order success:', { orderId: newOrderId, amount: finalAmount, items: itemCount });
        
        setTimeout(() => {
          navigate('/order-success', { 
            state: { 
              message: 'Order placed successfully!',
              orderId: newOrderId,
              amount: finalAmount,
              itemCount: itemCount
            } 
          });
        }, randomDelay);
      }
    }, 1000);
  };

  const saveOrderToDatabase = async (transactionId: string, status = 'pending') => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!selectedAddress) {
      throw new Error('Shipping address is required');
    }

    const amount = getFinalTotal();
    const couponDiscountAmount = appliedDiscount?.discount_amount || 0;
    const totalDiscountAmount = randomDiscount + couponDiscountAmount;
    
    const orderData = {
      user_id: user.id,
      transaction_id: transactionId,
      status: status,
      total: amount,
      subtotal: totalPrice,
      tax: 0,
      shipping: getShippingCost(),
      discount: totalDiscountAmount,
      discount_code: appliedDiscount?.discount_code || null,
      discount_id: appliedDiscount?.discount_id || null,
      payment_method: selectedPaymentMethod || 'upi',
      shipping_name: selectedAddress.full_name,
      shipping_address: selectedAddress.address,
      shipping_city: selectedAddress.city,
      shipping_state: selectedAddress.state,
      shipping_zip_code: selectedAddress.pincode,
      shipping_country: selectedAddress.country || 'India',
      shipping_phone: selectedAddress.phone,
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    // First, create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Error saving order:', orderError);
      throw new Error('Failed to save order');
    }

    // Then, create order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      product_brand: item.brand || 'Premium',
      product_price: item.variant_price || item.price,
      product_image: item.image || (item.gallery_images && item.gallery_images[0]) || '',
      quantity: item.quantity,
      variant_id: item.variant_id,
      variant_name: item.variant_name
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error saving order items:', itemsError);
      throw new Error('Failed to save order items');
    }

    return order;
  };

  const handleUPIPayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Generate transaction ID for UPI reference
      const txnId = `TXN${Date.now().toString().slice(-8)}`;
      setTransactionId(txnId);
      const amount = getFinalTotal();
      
      // Save order to database with 'pending' status first
      await saveOrderToDatabase(txnId, 'pending');
      
      // Create UPI payment link with dynamic amount
      const upiId = 'hrejuh@upi'; // UPI ID
      const merchantName = 'Cigarro';
      const note = `Order ${transactionId}`;
      
      const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}` +
        `&pn=${encodeURIComponent(merchantName)}` +
        `&am=${amount}` +
        `&tn=${encodeURIComponent(note)}` +
        '&cu=INR';
      
      // Show payment processing dialog
      setPaymentStage('processing');
      setIsConfirmingPayment(true);
      
      // Open UPI app
      window.location.href = upiLink;
      
      // Wait for user to return and complete payment (give them time)
      // Show a message asking them to return after payment
      setTimeout(async () => {
        // Change to verifying stage
        setPaymentStage('verifying');
        
        // Now start verification
        try {
          console.log('🔍 Starting payment verification...');
          toast.info('Verifying your payment... This may take up to 60 seconds.');
          
          const verificationResponse = await fetch('/payment-email-webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_WEBHOOK_SECRET || 'default-secret'}`
            },
            body: JSON.stringify({
              orderId: txnId,
              transactionId: txnId,
              amount: amount,
              timestamp: new Date().toISOString()
            })
          });
          
          if (!verificationResponse.ok) {
            throw new Error(`Verification failed: ${verificationResponse.status}`);
          }
          
          const result = await verificationResponse.json();
          console.log('Verification result:', result);
          
          if (result.verified) {
            // Payment verified successfully!
            console.log('✅ Payment verified automatically!');
            setPaymentStage('confirmed');
            setIsPaymentCompleted(true);
            await clearCart();
            toast.success('Payment verified successfully!');
          } else {
            // Verification failed or timed out
            console.log('⏰ Auto-verification timed out, order saved as pending');
            setPaymentStage('pending');
            toast.info('Order saved! We\'ll verify your payment shortly.');
            // Redirect to orders page after 3 seconds
            setTimeout(() => {
              navigate('/orders');
            }, 3000);
          }
        } catch (error) {
          console.error('❌ Verification error:', error);
          // Show error and keep order as pending
          setPaymentStage('pending');
          toast.error('Could not verify payment automatically. Order saved as pending.');
          // Redirect to orders page after 3 seconds
          setTimeout(() => {
            navigate('/orders');
          }, 3000);
        } finally {
          setIsProcessing(false);
        }
      }, 60000); // Wait 60 seconds (1 minute) for user to complete payment in UPI app
      
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process payment');
      setIsProcessing(false);
      setIsConfirmingPayment(false);
    }
  };

  const handleQRPayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    try {
      // Generate transaction ID and QR code
      const txnId = `TXN${Date.now().toString().slice(-8)}`;
      setTransactionId(txnId);
      const amount = getFinalTotal();
      
      // Create UPI payment URL
      const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${amount}&tn=Order ${txnId}&cu=INR`;
      
      // Generate QR code
      const qrDataURL = await QRCodeLib.toDataURL(upiURL, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeDataURL(qrDataURL);
      setShowQRDialog(true);
      
      // Save order to database
      await saveOrderToDatabase(txnId, 'pending');
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  const handleQRPaymentDone = async () => {
    setShowQRDialog(false);
    setPaymentStage('processing');
    setIsConfirmingPayment(true);
    
    // Wait for user to complete payment (give them time)
    setTimeout(async () => {
      // Change to verifying stage
      setPaymentStage('verifying');
      
      // Now start verification
      try {
        console.log('🔍 Starting payment verification...');
        toast.info('Verifying your payment... This may take up to 60 seconds.');
        
        const verificationResponse = await fetch('/payment-email-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_WEBHOOK_SECRET || 'default-secret'}`
          },
          body: JSON.stringify({
            orderId: transactionId,
            transactionId: transactionId,
            amount: getFinalTotal(),
            timestamp: new Date().toISOString()
          })
        });
        
        if (!verificationResponse.ok) {
          throw new Error(`Verification failed: ${verificationResponse.status}`);
        }
        
        const result = await verificationResponse.json();
        console.log('Verification result:', result);
        
        if (result.verified) {
          // Payment verified successfully!
          console.log('✅ Payment verified automatically!');
          setPaymentStage('confirmed');
          setIsPaymentCompleted(true);
          await clearCart();
          toast.success('Payment verified successfully!');
        } else {
          // Verification failed or timed out
          console.log('⏰ Auto-verification timed out, order saved as pending');
          setPaymentStage('pending');
          toast.info('Order saved! We\'ll verify your payment shortly.');
          // Redirect to orders page after 3 seconds
          setTimeout(() => {
            navigate('/orders');
          }, 3000);
        }
      } catch (error) {
        console.error('❌ Verification error:', error);
        // Show error and keep order as pending
        setPaymentStage('pending');
        toast.error('Could not verify payment automatically. Order saved as pending.');
        // Redirect to orders page after 3 seconds
        setTimeout(() => {
          navigate('/orders');
        }, 3000);
      } finally {
        setIsProcessing(false);
      }
    }, 60000); // Wait 60 seconds (1 minute) for user to complete payment
  };

  const handleProcessOrder = async () => {
    if (selectedPaymentMethod === 'upi') {
      await handleUPIPayment();
    } else {
      // Handle other payment methods if needed
      toast.error('Please select a payment method');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-8">
            <h2 className="text-xl font-serif mb-4">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">Please sign in to continue with checkout</p>
            <Button onClick={() => navigate('/')}>Back to Store</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4">
          <div className="text-center">
            <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
              Checkout
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Items List */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <h3 className="font-serif text-lg mb-4">Order Items ({items.length})</h3>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={`${item.id}-${item.variant_id || 'default'}`} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border/20">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted/20 flex-shrink-0">
                    <img
                      src={item.image || item.gallery_images?.[0] || '/placeholder-product.jpg'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.name}{item.variant_name && ` (${item.variant_name})`}</h4>
                    <p className="text-sm font-semibold text-foreground">
                      {formatINR(item.variant_price || item.price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="w-8 h-8 rounded-lg border-2 border-coyote/30 bg-background text-dark hover:bg-dark hover:text-creme-light hover:border-dark transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1), item.variant_id)}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                    <button
                      className="w-8 h-8 rounded-lg border-2 border-coyote/30 bg-background text-dark hover:bg-dark hover:text-creme-light hover:border-dark transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant_id)}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Options */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <h3 className="font-serif text-lg mb-4">Shipping Options</h3>
            <div className="space-y-3">
              {shippingOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedShipping(option.id)}
                  className={`w-full p-3 rounded-lg border-2 transition-all ${
                    selectedShipping === option.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border/30 hover:border-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selectedShipping === option.id ? 'bg-accent text-white' : 'bg-muted'
                      }`}>
                        {option.icon}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">{option.name}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {option.price === 0 ? 'Free' : formatINR(option.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">{option.estimatedDays}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Price Breakdown */}
        <Card className="border-2 border-border/40 bg-card shadow-md">
          <CardContent className="p-4">
            <h3 className="font-serif text-lg mb-4">Price Details</h3>
            
            {/* Coupon Section */}
            <div className="mb-4">
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setDiscountError('');
                  }}
                  className={`flex-1 ${discountError ? 'border-red-500' : ''}`}
                />
                <Button 
                  onClick={applyCoupon} 
                  variant="outline" 
                  size="sm"
                  disabled={isValidatingCoupon}
                >
                  {isValidatingCoupon ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Tag className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {discountError && (
                <p className="text-xs text-red-500">{discountError}</p>
              )}
              {appliedDiscount && (
                <div className="flex items-center justify-between text-xs text-green-600">
                  <span>✓ {appliedDiscount.discount_name || 'Coupon'} applied</span>
                  <button onClick={removeCoupon} className="text-red-500 hover:text-red-700">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal ({items.length} items)</span>
                <span>{formatINR(totalPrice)}</span>
              </div>
              
              <div className="flex justify-between text-sm text-green-600">
                <span>Lucky Discount</span>
                <span>-{formatINR(randomDiscount)}</span>
              </div>
              
              {appliedDiscount && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{appliedDiscount.discount_name || 'Coupon Discount'}</span>
                  <span>-{formatINR(appliedDiscount.discount_amount)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>{getShippingCost() === 0 ? 'Free' : formatINR(getShippingCost())}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatINR(getFinalTotal())}</span>
              </div>
            </div>

            {/* Policy Links */}
            <div className="mt-4 pt-3 border-t border-border/20">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button className="text-accent hover:text-accent/80 text-left">
                  Shipping Policy
                </button>
                <button className="text-accent hover:text-accent/80 text-left">
                  Return Policy
                </button>
                <button className="text-accent hover:text-accent/80 text-left">
                  Cancellation Policy
                </button>
                <button className="text-accent hover:text-accent/80 text-left">
                  Privacy Policy
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Bottom Section */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border/40 z-50">
        {/* Address Row */}
        <div className="px-4 py-3 border-b border-border/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <MapPin className="w-5 h-5 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {selectedAddress ? (
                  <div>
                    <p className="text-sm font-medium truncate">{selectedAddress.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedAddress.address}, {selectedAddress.city}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No address selected</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddressDialog(true)}
              className="flex-shrink-0"
            >
              {selectedAddress ? 'Change' : 'Add Address'}
            </Button>
          </div>
        </div>

        {/* Payment Row */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Payment Method (1/3) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPaymentDialog(true)}
              className="flex items-center gap-2 flex-shrink-0"
            >
              {selectedPaymentMethod === 'upi' && <Smartphone className="w-4 h-4" />}
              {selectedPaymentMethod === 'qr' && <QrCode className="w-4 h-4" />}
              {selectedPaymentMethod === 'link' && <ExternalLink className="w-4 h-4" />}
              <span className="text-xs">
                {selectedPaymentMethod === 'upi' && 'UPI App'}
                {selectedPaymentMethod === 'qr' && 'QR Code'}
                {selectedPaymentMethod === 'link' && 'Send Link'}
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </Button>

            {/* Pay Button (2/3) */}
            <Button
              onClick={() => {
                if (!selectedAddress) {
                  toast.error('Please select a delivery address first');
                  setShowAddressDialog(true);
                  return;
                }
                if (selectedPaymentMethod === 'upi') {
                  handleUPIPayment();
                } else {
                  setShowPaymentDialog(true);
                }
              }}
              disabled={isProcessing}
              className="flex-1 bg-dark hover:bg-canyon text-creme-light font-semibold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                `Pay ${formatINR(getFinalTotal())}`
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery Address</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Saved Addresses */}
            {savedAddresses.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Your Addresses</h4>
                  <span className="text-xs text-muted-foreground">{savedAddresses.length} saved</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {savedAddresses.map((address) => (
                    <div key={address.id} className="border border-border/30 rounded-lg overflow-hidden">
                      <button
                        onClick={() => {
                          setSelectedAddress(address);
                          setShowAddressDialog(false);
                          toast.success(`📍 ${address.label} address selected`);
                        }}
                        className="w-full p-3 text-left hover:bg-muted/20 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{address.full_name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {address.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {address.address}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {address.phone}
                            </p>
                          </div>
                          {selectedAddress?.id === address.id && (
                            <Check className="w-4 h-4 text-accent flex-shrink-0" />
                          )}
                        </div>
                      </button>
                      
                      {/* Edit and Delete buttons */}
                      <div className="flex border-t border-border/20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAddress(address);
                          }}
                          className="flex-1 p-2 text-xs text-accent hover:bg-accent/10 transition-all flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                        <div className="w-px bg-border/20"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this address?')) {
                              handleDeleteAddress(address.id!);
                            }
                          }}
                          className="flex-1 p-2 text-xs text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddressDialog(false);
                      setShowAddNewAddressDialog(true);
                    }}
                    className="w-full border-dashed border-accent/50 text-accent hover:bg-accent/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Address
                  </Button>
                </div>
              </div>
            )}

            {/* No addresses message */}
            {savedAddresses.length === 0 && (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="font-medium text-sm mb-2">No saved addresses</h4>
                <p className="text-xs text-muted-foreground mb-4">Add your first delivery address to continue</p>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddressDialog(false);
                    setShowAddNewAddressDialog(true);
                  }}
                  className="bg-accent hover:bg-accent/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Address
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Address Dialog */}
      <Dialog open={showAddNewAddressDialog} onOpenChange={setShowAddNewAddressDialog}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit Address' : 
               savedAddresses.length > 0 ? 'Add New Address' : 'Add Your First Address'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={addressForm.full_name}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className={addressErrors.full_name ? 'border-red-500' : ''}
                />
                {addressErrors.full_name && (
                  <p className="text-xs text-red-500 mt-1">{addressErrors.full_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, phone: e.target.value }))}
                  className={addressErrors.phone ? 'border-red-500' : ''}
                />
                {addressErrors.phone && (
                  <p className="text-xs text-red-500 mt-1">{addressErrors.phone}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="address">Address</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={getCurrentLocation}
                    disabled={isLoadingLocation}
                    className="text-xs px-2 py-1 h-6"
                  >
                    {isLoadingLocation ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    <span className="ml-1">Current Location</span>
                  </Button>
                </div>
                <Input
                  id="address"
                  value={addressForm.address}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, address: e.target.value }))}
                  className={addressErrors.address ? 'border-red-500' : ''}
                  placeholder="Enter your complete address"
                />
                {addressErrors.address && (
                  <p className="text-xs text-red-500 mt-1">{addressErrors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={addressForm.pincode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAddressForm(prev => ({ ...prev, pincode: value }));
                      
                      // Clear previous timeout
                      if (pincodeLookupTimeout) {
                        clearTimeout(pincodeLookupTimeout);
                      }
                      
                      // Set new timeout for pincode lookup
                      if (value.length === 6) {
                        const timeout = setTimeout(() => {
                          fetchLocationFromPincode(value);
                        }, 500);
                        setPincodeLookupTimeout(timeout);
                      }
                    }}
                    className={addressErrors.pincode ? 'border-red-500' : ''}
                    placeholder="Enter 6-digit pincode"
                  />
                  {addressErrors.pincode && (
                    <p className="text-xs text-red-500 mt-1">{addressErrors.pincode}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                    className={addressErrors.city ? 'border-red-500' : ''}
                  />
                  {addressErrors.city && (
                    <p className="text-xs text-red-500 mt-1">{addressErrors.city}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={addressForm.state}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                  className={addressErrors.state ? 'border-red-500' : ''}
                />
                {addressErrors.state && (
                  <p className="text-xs text-red-500 mt-1">{addressErrors.state}</p>
                )}
              </div>

              {/* Address Label Suggestions */}
              <div>
                <Label>Address Label</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => {
                        setAddressForm(prev => ({ ...prev, label: suggestion.id }));
                        if (suggestion.id !== 'other') {
                          setCustomLabel('');
                        }
                      }}
                      className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1 transition-all ${
                        addressForm.label === suggestion.id
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border/30 hover:border-accent/50'
                      }`}
                    >
                      {suggestion.icon}
                      <span>{suggestion.label}</span>
                    </button>
                  ))}
                </div>
                
                {addressForm.label === 'other' && (
                  <Input
                    placeholder="Enter custom label"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              <Button 
                onClick={handleSaveAddress}
                className="w-full bg-accent hover:bg-accent/90 text-white"
                disabled={isSavingAddress}
              >
                {isSavingAddress ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingAddress ? 'Updating Address...' : 'Saving Address...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {editingAddress ? 'Update & Select Address' : 'Save & Select Address'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Full Screen Overlay */}
      {isConfirmingPayment && (
        <div className="fixed inset-0 z-[9999] bg-creme flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-md">
            {paymentStage === 'processing' || paymentStage === 'verifying' ? (
              /* Processing/Verifying Stage */
              <div className="text-center space-y-6 animate-slide-up-smooth">
                {/* Animated Loader */}
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 rounded-full border-4 border-canyon/30"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-canyon animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-canyon animate-pulse" />
                  </div>
                </div>

                {/* Status Text */}
                <div className="space-y-3">
                  <h2 className="text-2xl font-serif text-dark">
                    {paymentStage === 'verifying' ? 'Verifying Payment...' : 'Complete Payment in UPI App'}
                  </h2>
                  <p className="text-base text-dark/70 font-sans">
                    {paymentStage === 'verifying' 
                      ? 'Checking for payment confirmation. This may take up to 60 seconds.'
                      : 'Return here after completing payment. We\'ll verify automatically.'}
                  </p>
                </div>

                {/* Countdown Circle */}
                <div className="flex items-center justify-center gap-3">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-coyote/30"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 8)}`}
                        className="text-canyon transition-all duration-1000"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-dark">{countdown}</span>
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="bg-creme-light rounded-2xl p-5 border-2 border-coyote/20">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Amount</span>
                      <span className="text-lg font-bold text-dark">{formatINR(getFinalTotal())}</span>
                    </div>
                    <div className="h-px bg-coyote/20"></div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Transaction ID</span>
                      <span className="text-dark font-mono text-xs">{transactionId}</span>
                    </div>
                  </div>
                </div>

                {/* Loading Dots */}
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-canyon animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-canyon animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-canyon animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>

                <p className="text-xs text-dark/50 font-sans">
                  Do not close this window or press back
                </p>
              </div>
            ) : paymentStage === 'confirmed' ? (
              /* Confirmed Stage */
              <div className="text-center space-y-6 animate-scale-in">
                {/* Success Check */}
                <div className="relative mx-auto w-28 h-28">
                  <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping"></div>
                  <div className="relative w-28 h-28 rounded-full bg-green-500 flex items-center justify-center shadow-2xl animate-bounce-once">
                    <Check className="w-14 h-14 text-white" strokeWidth={3} />
                  </div>
                </div>

                {/* Success Text */}
                <div className="space-y-3">
                  <h2 className="text-3xl font-serif text-dark">
                    Payment Confirmed!
                  </h2>
                  <p className="text-base text-dark/70 font-sans">
                    Your order has been placed successfully
                  </p>
                </div>

                {/* Order Summary */}
                <div className="bg-creme-light rounded-2xl p-6 border-2 border-green-500/30">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-dark/60 font-medium">Order Total</span>
                      <span className="text-2xl font-bold text-green-600">{formatINR(getFinalTotal())}</span>
                    </div>
                    <div className="h-px bg-coyote/20"></div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Transaction ID</span>
                      <span className="text-dark font-mono text-xs">{transactionId}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Items</span>
                      <span className="text-dark font-semibold">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => navigate('/orders')}
                    className="w-full bg-dark text-creme-light py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 hover:bg-canyon"
                  >
                    View My Orders
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/products')}
                      className="flex-1 bg-creme-light border-2 border-coyote text-dark py-3 rounded-xl font-medium text-sm transition-all active:scale-95 hover:bg-creme"
                    >
                      Browse Products
                    </button>
                    <button
                      onClick={() => navigate('/cart')}
                      className="flex-1 bg-creme-light border-2 border-coyote text-dark py-3 rounded-xl font-medium text-sm transition-all active:scale-95 hover:bg-creme"
                    >
                      View Cart
                    </button>
                  </div>
                </div>

                <p className="text-xs text-green-600 font-medium">
                  ✓ Order confirmation sent to your email
                </p>
              </div>
            ) : (
              /* Pending Stage - Verification Failed */
              <div className="text-center space-y-6 animate-scale-in">
                {/* Warning Icon */}
                <div className="relative mx-auto w-28 h-28">
                  <div className="relative w-28 h-28 rounded-full bg-yellow-500 flex items-center justify-center shadow-2xl">
                    <Clock className="w-14 h-14 text-white" strokeWidth={3} />
                  </div>
                </div>

                {/* Status Text */}
                <div className="space-y-3">
                  <h2 className="text-3xl font-serif text-dark">
                    Order Saved!
                  </h2>
                  <p className="text-base text-dark/70 font-sans">
                    We'll verify your payment shortly
                  </p>
                </div>

                {/* Order Summary */}
                <div className="bg-creme-light rounded-2xl p-6 border-2 border-yellow-500/30">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-dark/60 font-medium">Order Total</span>
                      <span className="text-2xl font-bold text-dark">{formatINR(getFinalTotal())}</span>
                    </div>
                    <div className="h-px bg-coyote/20"></div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Transaction ID</span>
                      <span className="text-dark font-mono text-xs">{transactionId}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-dark/60 font-medium">Status</span>
                      <span className="text-yellow-600 font-semibold">Pending Verification</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-yellow-600 font-medium">
                  Redirecting to orders page...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Method Dialog - Improved */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm mx-auto p-0">
          {/* Header */}
          <div className="p-4 border-b border-border/20">
            <h3 className="text-lg font-serif text-dark text-center">Choose Payment Method</h3>
            <p className="text-xs text-dark/60 text-center mt-1">Select how you want to pay</p>
          </div>
          
          <div className="p-4 space-y-3">
            {/* UPI Apps Option */}
            <button
              onClick={() => {
                setSelectedPaymentMethod('upi');
                setShowPaymentDialog(false);
                handleUPIPayment();
              }}
              className="w-full p-4 bg-creme-light border-2 border-coyote/30 rounded-xl hover:border-canyon hover:bg-creme transition-all active:scale-95 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center flex-shrink-0 group-hover:bg-canyon transition-colors">
                  <Smartphone className="w-6 h-6 text-creme-light" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-dark text-sm">UPI Apps</p>
                  <p className="text-xs text-dark/60 mt-0.5">GPay, PhonePe, Paytm & more</p>
                </div>
                <ChevronRight className="w-5 h-5 text-dark/40 group-hover:text-canyon transition-colors" />
              </div>
            </button>

            {/* QR Code Option */}
            <button
              onClick={() => {
                setSelectedPaymentMethod('qr');
                setShowPaymentDialog(false);
                handleQRPayment();
              }}
              className="w-full p-4 bg-creme-light border-2 border-coyote/30 rounded-xl hover:border-canyon hover:bg-creme transition-all active:scale-95 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center flex-shrink-0 group-hover:bg-canyon transition-colors">
                  <QrCode className="w-6 h-6 text-creme-light" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-dark text-sm">QR Code</p>
                  <p className="text-xs text-dark/60 mt-0.5">Scan with any UPI app</p>
                </div>
                <ChevronRight className="w-5 h-5 text-dark/40 group-hover:text-canyon transition-colors" />
              </div>
            </button>

            {/* Payment Link Option */}
            <button
              onClick={() => {
                setSelectedPaymentMethod('link');
                setShowPaymentDialog(false);
                toast.info('Payment link feature coming soon');
              }}
              className="w-full p-4 bg-creme-light border-2 border-coyote/30 rounded-xl hover:border-canyon hover:bg-creme transition-all active:scale-95 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center flex-shrink-0 group-hover:bg-canyon transition-colors">
                  <ExternalLink className="w-6 h-6 text-creme-light" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-dark text-sm">Payment Link</p>
                  <p className="text-xs text-dark/60 mt-0.5">Send link to someone else</p>
                </div>
                <ChevronRight className="w-5 h-5 text-dark/40 group-hover:text-canyon transition-colors" />
              </div>
            </button>

            {/* Cancel Button */}
            <button
              onClick={() => setShowPaymentDialog(false)}
              className="w-full py-2.5 text-sm text-dark/60 hover:text-dark transition-colors"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Payment Dialog - Compact */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-sm mx-auto p-0">
          {/* Header with Back Button */}
          <div className="flex items-center gap-3 p-4 border-b border-border/20">
            <button
              onClick={() => setShowQRDialog(false)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h3 className="text-lg font-serif text-dark flex-1">Scan to Pay</h3>
          </div>
          
          <div className="space-y-4 p-4">
            {/* QR Code Display - Compact */}
            <div className="flex justify-center">
              {qrCodeDataURL ? (
                <div className="p-3 bg-white rounded-xl border-2 border-dark">
                  <img src={qrCodeDataURL} alt="Payment QR Code" className="w-48 h-48" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Payment Details - Compact */}
            <div className="bg-creme-light rounded-lg p-3 border border-coyote/20">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-dark/60 font-medium">Amount</span>
                  <span className="text-lg font-bold text-dark">{formatINR(getFinalTotal())}</span>
                </div>
                <div className="h-px bg-coyote/20"></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-dark/60">ID</span>
                  <span className="text-dark font-mono">{transactionId}</span>
                </div>
              </div>
            </div>

            {/* Instructions - Compact */}
            <div className="bg-canyon/10 rounded-lg p-3 border border-canyon/30">
              <p className="text-xs text-dark/70 leading-relaxed">
                Open any UPI app, scan the QR code, complete payment, and click "Payment Done" below.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleQRPaymentDone}
                className="w-full py-3 bg-dark text-creme-light rounded-lg font-semibold text-sm transition-all active:scale-95 hover:bg-canyon flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Payment Done
              </button>
              <button
                onClick={() => {
                  const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${getFinalTotal()}&tn=Order ${transactionId}&cu=INR`;
                  navigator.clipboard.writeText(upiURL);
                  setIsCopied(true);
                  toast.success('UPI link copied to clipboard');
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className={`w-full py-2.5 border rounded-lg font-medium text-xs transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isCopied 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : 'bg-creme-light border-coyote text-dark hover:bg-creme'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy UPI Link
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
