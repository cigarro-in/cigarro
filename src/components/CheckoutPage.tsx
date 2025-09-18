import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CreditCard, MapPin, Package, CheckCircle, Crown, Shield, Navigation, Plus, Truck, Clock, Zap, ArrowLeft, Smartphone, Monitor, Copy, RefreshCw, Mail, MessageSquare, Tag, Percent, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../utils/currency';
import { calculateDiscount, applyDiscountToCart, validateCouponCode } from '../utils/discounts';
import { AuthDialog } from './AuthDialog';
import { validateEmail, validatePhone, validateName, validatePincode, validateAddress, validateFormData } from '../utils/validation';
import QRCode from 'qrcode';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart, getCartItemPrice } = useCart();
  const { user, isLoading: authLoading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: shipping, 2: review, 3: payment
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<string>('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [preloadedQRCode, setPreloadedQRCode] = useState<string>('');
  const [currentLocationData, setCurrentLocationData] = useState<{lat: number, lng: number} | null>(null);
  const [hasInitializedForm, setHasInitializedForm] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [paymentLinkEmail, setPaymentLinkEmail] = useState<string>('');
  const [paymentLinkPhone, setPaymentLinkPhone] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [showAddressSelection, setShowAddressSelection] = useState(false);
  const [isNewAddress, setIsNewAddress] = useState(true);
  const [pincodeLookupTimeout, setPincodeLookupTimeout] = useState<NodeJS.Timeout | null>(null);
  const addressesLoadedRef = useRef(false);
  
  // Discount-related state
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [discountError, setDiscountError] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    paymentMethod: 'upi',
    shippingMethod: 'standard',
  });

  // Generate random discount between 0.01 and 0.99 rupees
  const [randomDiscount] = useState(() => {
    // Generate random integer between 1 and 99 (representing paise)
    const paise = Math.floor(Math.random() * 99) + 1;
    // Convert to rupees (divide by 100)
    const discount = paise / 100;
    // Ensure it's exactly between 0.01 and 0.99
    return Math.max(0.01, Math.min(0.99, discount));
  });

  // Handle successful authentication
  const handleAuthSuccess = () => {
    setShowAuthDialog(false);
    // User data will be updated automatically via useAuth hook
  };

  // Auto-show auth dialog for non-authenticated users after a brief delay to prevent flicker
  useEffect(() => {
    if (!user && !authLoading) {
      const timer = setTimeout(() => {
        setShowAuthDialog(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading]);

  // Load saved addresses and preload QR code on component mount
  useEffect(() => {
    if (user && !addressesLoadedRef.current) {
      loadSavedAddresses();
      preloadQRCode();
      // Auto-fill user details if available
      setFormData(prev => ({
        ...prev,
        fullName: user.name || prev.fullName,
        email: user.email || prev.email,
      }));
      addressesLoadedRef.current = true;
    } else if (!user) {
      // Reset when user logs out
      addressesLoadedRef.current = false;
    }
  }, [user]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pincodeLookupTimeout) {
        clearTimeout(pincodeLookupTimeout);
      }
    };
  }, [pincodeLookupTimeout]);

  // Update payment link fields when form data changes
  useEffect(() => {
    setPaymentLinkEmail(formData.email);
    setPaymentLinkPhone(formData.phone);
  }, [formData.email, formData.phone]);


  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication dialog for non-authenticated users
  if (!user) {

    return (
      <div className="min-h-screen bg-creme flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-6">
            Please sign in or create an account to proceed with checkout
          </p>
          <div className="space-y-3">
            <Button 
              onClick={() => setShowAuthDialog(true)}
              className="w-full"
              size="lg"
            >
              Sign In / Sign Up
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/products')}
              className="w-full"
              size="lg"
            >
              I'm Just Browsing
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            You can continue shopping and sign in when you're ready to checkout
          </p>
        </div>
        <AuthDialog 
          open={showAuthDialog} 
          onOpenChange={setShowAuthDialog}
          onAuthSuccess={handleAuthSuccess}
          context="checkout"
        />
      </div>
    );
  }

  const shipping = {
    standard: { name: 'Standard Shipping', price: 0, time: '5-7 business days', icon: Truck },
    express: { name: 'Express Shipping', price: 150, time: '2-3 business days', icon: Clock },
    overnight: { name: 'Overnight Delivery', price: 300, time: 'Next business day', icon: Zap }
  };

  const shippingCost = shipping[formData.shippingMethod as keyof typeof shipping].price;
  
  // Calculate totals with discounts
  const subtotalWithShipping = totalPrice + shippingCost;
  const couponDiscountAmount = appliedDiscount?.discount_amount || 0;
  const totalDiscountAmount = randomDiscount + couponDiscountAmount;
  const finalTotal = subtotalWithShipping - totalDiscountAmount;

  // Handle coupon code application
  const handleApplyCoupon = async () => {
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
      setDiscountError('Failed to validate coupon code');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(null);
    setCouponCode('');
    setDiscountError('');
    toast.success('Coupon removed');
  };

  const preloadQRCode = async () => {
    try {
      // Generate a temporary transaction ID for QR code preloading
      const tempTransactionId = `TXN${Date.now().toString().slice(-8)}`;
      
      // Import QRCode dynamically
      const QRCode = await import('qrcode');
      
      // Create UPI payment URL with estimated amount
      const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${finalTotal}&tid=${tempTransactionId}&tn=${tempTransactionId}`;
      
      // Generate QR code
      const qrDataURL = await QRCode.toDataURL(upiURL, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setPreloadedQRCode(qrDataURL);
    } catch (error) {
      console.error('Error preloading QR code:', error);
    }
  };

  const loadSavedAddresses = async (skipAutoFill = false) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading saved addresses:', error);
    } else {
      setSavedAddresses(data || []);
      
      // Only auto-fill with primary address on initial load, not on every reload
      if (!skipAutoFill) {
        const primaryAddress = data?.find(addr => addr.is_default);
        if (primaryAddress && !hasInitializedForm && !formData.address) {
          setFormData(prev => ({
            ...prev,
            fullName: primaryAddress.full_name || prev.fullName,
            phone: primaryAddress.phone?.replace(/^\+91\s*/, '') || prev.phone,
            address: primaryAddress.address,
            city: primaryAddress.city,
            state: primaryAddress.state,
            pincode: primaryAddress.pincode,
            country: primaryAddress.country,
          }));
          setIsNewAddress(false);
          setHasInitializedForm(true);
        }
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Mark form as initialized to prevent auto-fill interference
    if (!hasInitializedForm) {
      setHasInitializedForm(true);
    }
  };

  const validateForm = () => {
    const validationRules = {
      fullName: (value: string) => validateName(value, 'Full name'),
      email: (value: string) => validateEmail(value),
      phone: (value: string) => validatePhone(value, countryCode),
      address: (value: string) => validateAddress(value),
      pincode: (value: string) => validatePincode(value),
      city: (value: string) => validateName(value, 'City'),
      state: (value: string) => validateName(value, 'State'),
    };
    
    const result = validateFormData(formData, validationRules);
    setValidationErrors(result.errors);
    
    if (result.isValid) {
      // Update form data with sanitized values
      setFormData(prev => ({ ...prev, ...result.sanitizedData }));
    }
    
    return result.isValid;
  };

  const fetchLocationFromPincode = async (pincode: string) => {
    if (pincode.length === 6) {
      try {
        // Query our local pincodes database
        const { data, error } = await supabase
          .from('pincode_lookup')
          .select('*')
          .eq('pincode', pincode)
          .single();
        
        if (error) {
          console.log('PIN code not found in database:', error.message);
          // Show warning that PIN code is not servicable
          setValidationErrors(prev => ({
            ...prev,
            pincode: 'This PIN code is not servicable'
          }));
          return;
        }
        
        if (data) {
          setFormData(prev => ({
            ...prev,
            city: data.city,
            state: data.state,
            country: data.country
          }));
          
          // Set country code to +91 for Indian PIN codes (only if not already set)
          if (countryCode !== '+91') {
            setCountryCode('+91');
          }
          
          // Clear validation errors for auto-filled fields
          setValidationErrors(prev => ({
            ...prev,
            city: '',
            state: '',
            pincode: ''
          }));
          
          // Update shipping method based on PIN code
          if (data.shipping_method && data.shipping_method !== 'standard') {
            setFormData(prev => ({
              ...prev,
              shippingMethod: data.shipping_method
            }));
          }
          
          // Show success message
          toast.success(`Location found: ${data.city}, ${data.state}`);
          
        } else {
          console.log('PIN code not found or not servicable');
          setValidationErrors(prev => ({
            ...prev,
            pincode: 'This PIN code is not servicable'
          }));
        }
      } catch (error) {
        console.error('Error fetching location from pincode:', error);
        setValidationErrors(prev => ({
          ...prev,
          pincode: 'Error checking PIN code'
        }));
      }
    }
  };

  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setCurrentLocationData({ lat: latitude, lng: longitude });
          
          // Use a free reverse geocoding service
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          
          if (data && data.address) {
            const addr = data.address;
            const fullAddress = data.display_name;
            
            // Extract address components
            const houseNumber = addr.house_number || '';
            const road = addr.road || addr.street || '';
            const suburb = addr.suburb || addr.neighbourhood || '';
            const city = addr.city || addr.town || addr.village || addr.municipality || '';
            const state = addr.state || '';
            const pincode = addr.postcode || '';
            
            // Build address string
            const addressParts = [houseNumber, road, suburb].filter(Boolean);
            const formattedAddress = addressParts.join(', ');
            
            // Update form data and clear validation errors
            setFormData(prev => ({
              ...prev,
              address: formattedAddress || fullAddress,
              city: city,
              state: state,
              pincode: pincode
            }));
            
            // Clear validation errors for auto-filled fields
            setValidationErrors(prev => ({
              ...prev,
              address: '',
              city: '',
              state: '',
              pincode: ''
            }));
            
            toast.success('Location detected and address filled!');
          } else {
            toast.error('Unable to get address from location');
          }
        } catch (error) {
          console.error('Error getting address from coordinates:', error);
          toast.error('Unable to get address from location');
        }
        setIsLoadingLocation(false);
      },
      (error) => {
        console.log('Geolocation error (handled gracefully):', error);
        let errorMessage = 'Unable to get your location';
        if (error.code === 1) { // PERMISSION_DENIED
          errorMessage = 'Location permission denied. Please enable location access in your browser settings and try again.';
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          errorMessage = 'Location service unavailable. Please check your internet connection and try again.';
        } else if (error.code === 3) { // TIMEOUT
          errorMessage = 'Location request timed out. Please try again with a stronger internet connection.';
        }
        toast.info(errorMessage);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  const saveCurrentLocationAddress = async (addressData: any) => {
    if (!user) return;
    
    // Ensure phone number includes country code when saving
    const phoneWithCountryCode = addressData.phone.startsWith('+') 
      ? addressData.phone 
      : `${countryCode} ${addressData.phone}`;
    
    const { error } = await supabase
      .from('saved_addresses')
      .insert({
        user_id: user.id,
        label: 'Current Location',
        full_name: addressData.fullName,
        phone: phoneWithCountryCode,
        address: addressData.address,
        user_provided_address: addressData.userProvidedAddress || addressData.address,
        city: addressData.city,
        state: addressData.state,
        pincode: addressData.pincode,
        country: addressData.country,
        latitude: currentLocationData?.lat,
        longitude: currentLocationData?.lng,
        is_default: false
      });
    
    if (!error) {
      loadSavedAddresses(true); // Skip auto-fill when saving new address
      toast.success('Address saved successfully!');
    } else {
      console.error('Error saving address:', error);
    }
  };

  const selectSavedAddress = (addressId: string) => {
    const address = savedAddresses.find(addr => addr.id === addressId);
    if (address) {
      setFormData(prev => ({
        ...prev,
        fullName: address.full_name,
        email: prev.email, // Keep current email
        phone: address.phone?.replace(/^\+91\s*/, '') || '', // Remove +91 prefix if present
        address: address.address,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country
      }));
      setSelectedSavedAddress(addressId);
      setIsNewAddress(false);
      setShowAddressSelection(false);
      // Don't set hasInitializedForm here - allow users to click saved addresses anytime
    }
  };

  const setPrimaryAddress = async (addressId: string) => {
    if (!user) return;
    
    try {
      // First, remove primary status from all addresses
      await supabase
        .from('saved_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
      
      // Then set the selected address as primary
      await supabase
        .from('saved_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('user_id', user.id);
      
      // Reload addresses
      await loadSavedAddresses(true); // Skip auto-fill when updating primary address
      toast.success('Primary address updated');
    } catch (error) {
      console.error('Error setting primary address:', error);
      toast.error('Failed to set primary address');
    }
  };

  const editSavedAddress = (addressId: string) => {
    selectSavedAddress(addressId);
    // Clear selection to show that we're editing
    setSelectedSavedAddress('');
  };

  const deleteSavedAddress = async (addressId: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('saved_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', user.id);
    
    if (!error) {
      toast.success('Address deleted successfully');
      loadSavedAddresses(true); // Skip auto-fill when deleting address
      // Clear selection if this address was selected
      if (selectedSavedAddress === addressId) {
        setSelectedSavedAddress('');
      }
    } else {
      toast.error('Failed to delete address');
    }
  };

  const checkForDuplicateAddress = async () => {
    if (!user) return false;
    
    const { data, error } = await supabase
      .from('saved_addresses')
      .select('id')
      .eq('user_id', user.id)
      .eq('address', formData.address)
      .eq('pincode', formData.pincode)
      .limit(1);
    
    if (error) {
      console.error('Error checking for duplicates:', error);
      return false;
    }
    
    return data && data.length > 0;
  };

  const saveAddressOnOrderSuccess = async () => {
    if (!user) return;
    
    // Check for duplicates first
    const isDuplicate = await checkForDuplicateAddress();
    if (isDuplicate) return;
    
    try {
      // Ensure phone number includes country code when saving
      const phoneWithCountryCode = formData.phone.startsWith('+') 
        ? formData.phone 
        : `${countryCode} ${formData.phone}`;
      
      const { error } = await supabase
        .from('saved_addresses')
        .insert({
          user_id: user.id,
          label: 'Order Address',
          full_name: formData.fullName,
          phone: phoneWithCountryCode,
          address: formData.address,
          user_provided_address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          country: formData.country,
          latitude: currentLocationData?.lat,
          longitude: currentLocationData?.lng,
          is_default: savedAddresses.length === 0 // Set as default if it's the first address
        });
      
      if (!error) {
        console.log('Address saved successfully on order completion');
      }
    } catch (error) {
      console.error('Error saving address on order success:', error);
    }
  };

  const saveCurrentAddress = async () => {
    if (!user || !validateForm()) return;
    
    // Check for duplicates
    const isDuplicate = await checkForDuplicateAddress();
    if (isDuplicate) {
      toast.info('This address is already saved');
      return;
    }
    
    // Ensure phone number includes country code when saving
    const phoneWithCountryCode = formData.phone.startsWith('+') 
      ? formData.phone 
      : `${countryCode} ${formData.phone}`;
    
    const { error } = await supabase
      .from('saved_addresses')
      .insert({
        user_id: user.id,
        label: 'Home',
        full_name: formData.fullName,
        phone: phoneWithCountryCode,
        address: formData.address,
        user_provided_address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        country: formData.country,
        latitude: currentLocationData?.lat,
        longitude: currentLocationData?.lng,
        is_default: false
      });
    
    if (!error) {
      toast.success('Address saved successfully');
      loadSavedAddresses(true); // Skip auto-fill when saving current address
    } else {
      toast.error('Failed to save address');
    }
  };

  // Don't auto-save at payment step, just generate QR code
  const handleStepChange = async (newStep: number) => {
    if (newStep === 3 && currentStep === 2) {
      // Generate QR code for payment
      await generatePaymentQRCode();
    }
    setCurrentStep(newStep);
  };

  const generatePaymentQRCode = async () => {
    try {
      const transactionId = `TXN${Date.now().toString().slice(-8)}`;
      const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${finalTotal}&tid=${transactionId}&tn=${transactionId}`;
      
      const qrDataURL = await QRCode.toDataURL(upiURL, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeDataURL(qrDataURL);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handlePaymentConfirmation = async () => {
    if (!user) {
      toast.error('Please log in to complete your order');
      return;
    }
    
    console.log('Starting payment confirmation...');
    setIsProcessingPayment(true);
    
    try {
      // Generate transaction ID for UPI reference
      const transactionId = `TXN${Date.now().toString().slice(-8)}`;
      console.log('Generated transaction ID:', transactionId);
      
      // Create order in database (UUID will be auto-generated, display_order_id will be auto-generated via trigger)
      const orderData = {
        user_id: user.id,
        status: 'placed',
        // Store amounts as decimal values
        subtotal: totalPrice,
        tax: 0,
        shipping: shippingCost,
        total: finalTotal,
        discount: totalDiscountAmount,
        discount_id: appliedDiscount?.discount_id || null,
        discount_code: appliedDiscount?.discount_code || null,
        payment_method: 'UPI',
        payment_confirmed: true,
        payment_confirmed_at: new Date().toISOString(),
        payment_verified: 'NO', // Requires admin verification
        transaction_id: transactionId,
        shipping_name: formData.fullName,
        shipping_address: formData.address,
        shipping_city: formData.city,
        shipping_state: formData.state,
        shipping_zip_code: formData.pincode,
        shipping_country: formData.country,
        shipping_phone: `${countryCode} ${formData.phone}`,
        estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        // Log payment link details
        payment_link_email: paymentLinkEmail || null,
        payment_link_phone: paymentLinkPhone || null,
      };
      
      console.log('Order data:', orderData);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_brand: item.brand,
        product_price: getCartItemPrice(item),
        product_image: item.gallery_images?.[0] || item.image,
        quantity: item.quantity,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        combo_id: item.combo_id,
        combo_name: item.combo_name,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Save address if it's new and user wants to save it
      if (isNewAddress && user) {
        await saveAddressOnOrderSuccess();
      }

      // Clear cart
      await clearCart();

      setCompletedOrder(order);
      setOrderComplete(true);
      toast.success(`Order #${order.display_order_id} confirmed! Your order is now being processed.`);
      
      // Redirect to orders page after 5 seconds
      setTimeout(() => {
        navigate('/orders');
      }, 5000);

    } catch (error) {
      console.error('Failed to process order:', error);
      toast.error('Failed to process order. Please contact support.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const sendPaymentLink = async (method: 'email' | 'sms') => {
    const contact = method === 'email' ? paymentLinkEmail : paymentLinkPhone;
    if (!contact) {
      toast.error(`Please enter ${method === 'email' ? 'email address' : 'phone number'}`);
      return;
    }
    
    // In a real app, you would send the payment link via email/SMS
    // For now, we'll just copy the UPI link to clipboard
    const transactionId = `TXN${Date.now().toString().slice(-8)}`;
    const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${finalTotal}&tid=${transactionId}&tn=${transactionId}`;
    
    try {
      await navigator.clipboard.writeText(upiURL);
      toast.success(`Payment link copied to clipboard! Share it via ${method}.`);
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy payment link');
    }
  };

  const handleProcessOrder = async () => {
    // Validate required fields
    if (!validateForm()) {
      return;
    }

    // Generate transaction ID for UPI reference
    const transactionId = `TXN${Date.now().toString().slice(-8)}`;
    
    // Prepare payment data
    const paymentData = {
      transactionId,
      amount: finalTotal,
      originalAmount: subtotalWithShipping,
      discount: randomDiscount,
      items,
      shippingInfo: formData,
      preloadedQRCode: preloadedQRCode // Pass preloaded QR code
    };
    
    // Navigate to UPI payment page
    navigate('/payment', { state: { paymentData } });
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-serif-premium text-3xl text-foreground mb-4">Order Confirmed</h1>
            <p className="font-sans-premium text-muted-foreground mb-8">
              Thank you for your purchase. Your order has been confirmed and will be shipped shortly.
            </p>
            <div className="glass-card p-6 mb-8">
              <div className="flex items-center justify-between text-sm">
                <span className="font-sans-premium text-muted-foreground">Order Number</span>
                <span className="font-sans-premium text-foreground">#{completedOrder?.display_order_id || 'Loading...'}</span>
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-sans-premium text-muted-foreground">Total Paid</span>
                <span className="font-serif-premium text-xl text-accent">{formatINR(completedOrder?.total)}</span>
              </div>
            </div>
            <Button onClick={() => navigate('/')} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-16">
          {/* Left Sidebar - Progress Steps */}
          <div className="w-32 flex-shrink-0 pl-2">
            <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-10">
              <div className="flex flex-col items-center space-y-8">
                {[
                  { step: 1, label: 'Shipping', icon: MapPin },
                  { step: 2, label: 'Review', icon: Package },
                  { step: 3, label: 'Payment', icon: CreditCard }
                ].map(({ step, label, icon: Icon }, index) => (
                  <div key={step} className="flex flex-col items-center">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        step <= currentStep 
                          ? 'bg-accent border-accent text-accent-foreground shadow-lg' 
                          : 'border-border text-muted-foreground bg-background'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="mt-2 text-center">
                      <div 
                        className={`font-sans-premium text-sm font-medium transition-colors ${
                          step <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {label}
                      </div>
                      {step < currentStep && (
                        <div className="text-xs text-accent font-medium mt-1">✓ Done</div>
                      )}
                      {step === currentStep && (
                        <div className="text-xs text-accent font-medium mt-1 animate-pulse">● Now</div>
                      )}
                    </div>
                    {/* Connecting Line */}
                    {index < 2 && (
                      <div className="mt-4 mb-4">
                        <div 
                          className={`w-0.5 h-12 rounded-full transition-all duration-300 ${
                            step < currentStep ? 'bg-accent shadow-sm' : 'bg-border'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {currentStep === 1 && (
              <Card className="glass-card border-border/20">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 font-serif-premium">
                    <MapPin className="w-5 h-5 text-accent" />
                    <span>Shipping Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Address Selection Section */}
                  {savedAddresses.length > 0 && !showAddressSelection && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="font-sans-premium">Delivery Address</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowAddressSelection(true);
                            setIsNewAddress(true);
                          }}
                          className="text-xs"
                        >
                          Change Address
                        </Button>
                      </div>
                      
                      {/* Show current selected address */}
                      <div className="p-4 rounded-lg border border-accent bg-accent/10 mb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-sans-premium font-medium text-sm">
                              {formData.fullName} 
                              {savedAddresses.find(addr => addr.full_name === formData.fullName && addr.address === formData.address)?.is_default && (
                                <Badge variant="secondary" className="ml-2 text-xs">Primary</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{formData.address}</p>
                            <p className="text-xs text-muted-foreground">{formData.city}, {formData.state} - {formData.pincode}</p>
                            <p className="text-xs text-muted-foreground">{formData.phone}</p>
                          </div>
                        </div>
                      </div>
                      <Separator className="my-4" />
                    </div>
                  )}

                  {/* Address Selection Modal */}
                  {showAddressSelection && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="font-sans-premium">Choose Address</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddressSelection(false)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3 mb-4">
                        {/* New Address Option */}
                        <div
                          onClick={() => {
                            setIsNewAddress(true);
                            setFormData(prev => ({
                              ...prev,
                              address: '',
                              city: '',
                              state: '',
                              pincode: '',
                              country: 'India'
                            }));
                          }}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                            isNewAddress
                              ? 'border-accent bg-accent/10'
                              : 'border-border/20 hover:border-accent/50'
                          }`}
                        >
                          <p className="font-sans-premium font-medium text-sm">+ Add New Address</p>
                          <p className="text-xs text-muted-foreground">Enter a new delivery address</p>
                        </div>

                        {/* Existing Addresses */}
                        {savedAddresses.map((address) => (
                          <div
                            key={address.id}
                            className={`p-4 rounded-lg border transition-colors ${
                              selectedSavedAddress === address.id
                                ? 'border-accent bg-accent/10'
                                : 'border-border/20 hover:border-accent/50'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-sans-premium font-medium text-sm">{address.full_name}</p>
                                    {address.is_default && (
                                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{address.address}</p>
                                  <p className="text-xs text-muted-foreground">{address.city}, {address.state}</p>
                                  <p className="text-xs text-muted-foreground">PIN: {address.pincode}</p>
                                </div>
                                {address.latitude && address.longitude && (
                                  <Navigation className="w-3 h-3 text-accent flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => selectSavedAddress(address.id)}
                                  className="flex-1 text-xs h-7"
                                >
                                  Use This
                                </Button>
                                {!address.is_default && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPrimaryAddress(address.id)}
                                    className="text-xs h-7 px-2"
                                  >
                                    Set Primary
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteSavedAddress(address.id)}
                                  className="text-xs h-7 px-2 text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-4" />
                    </div>
                  )}

                  {/* Current Location Button */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={getCurrentLocation}
                      disabled={isLoadingLocation}
                      className="flex-1"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      {isLoadingLocation ? 'Getting Location...' : 'Use Current Location'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={saveCurrentAddress}
                      className="flex-none"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Save Address
                    </Button>
                  </div>

                  {/* Form Fields - Show when no address selected or when adding new address */}
                  {(savedAddresses.length === 0 || showAddressSelection || isNewAddress) && (
                    <div>
                    <Label htmlFor="fullName" className="font-sans-premium">Full Name *</Label>
                      <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className={`mt-1 bg-input-background ${validationErrors.fullName ? 'border-red-500' : 'border-border/20'}`}
                    />
                    {validationErrors.fullName && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.fullName}</p>
                    )}
                  </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="font-sans-premium">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="your@email.com"
                        className={`mt-1 bg-input-background ${validationErrors.email ? 'border-red-500' : 'border-border/20'}`}
                      />
                      {validationErrors.email && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone" className="font-sans-premium">Phone Number *</Label>
                      <div className="flex mt-1">
                        <Select 
                          value={countryCode} 
                          onValueChange={setCountryCode}
                        >
                          <SelectTrigger className={`w-24 rounded-r-none bg-input-background border-r-0 ${validationErrors.phone ? 'border-red-500' : 'border-border/20'}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border shadow-lg max-h-60 overflow-y-auto">
                            <SelectItem value="+971">🇦🇪 +971</SelectItem>
                            <SelectItem value="+61">🇦🇺 +61</SelectItem>
                            <SelectItem value="+880">🇧🇩 +880</SelectItem>
                            <SelectItem value="+55">🇧🇷 +55</SelectItem>
                            <SelectItem value="+1">🇨🇦 +1</SelectItem>
                            <SelectItem value="+86">🇨🇳 +86</SelectItem>
                            <SelectItem value="+49">🇩🇪 +49</SelectItem>
                            <SelectItem value="+20">🇪🇬 +20</SelectItem>
                            <SelectItem value="+33">🇫🇷 +33</SelectItem>
                            <SelectItem value="+44">🇬🇧 +44</SelectItem>
                            <SelectItem value="+91">🇮🇳 +91</SelectItem>
                            <SelectItem value="+62">🇮🇩 +62</SelectItem>
                            <SelectItem value="+98">🇮🇷 +98</SelectItem>
                            <SelectItem value="+39">🇮🇹 +39</SelectItem>
                            <SelectItem value="+81">🇯🇵 +81</SelectItem>
                            <SelectItem value="+60">🇲🇾 +60</SelectItem>
                            <SelectItem value="+52">🇲🇽 +52</SelectItem>
                            <SelectItem value="+31">🇳🇱 +31</SelectItem>
                            <SelectItem value="+64">🇳🇿 +64</SelectItem>
                            <SelectItem value="+92">🇵🇰 +92</SelectItem>
                            <SelectItem value="+63">🇵🇭 +63</SelectItem>
                            <SelectItem value="+48">🇵🇱 +48</SelectItem>
                            <SelectItem value="+7">🇷🇺 +7</SelectItem>
                            <SelectItem value="+966">🇸🇦 +966</SelectItem>
                            <SelectItem value="+65">🇸🇬 +65</SelectItem>
                            <SelectItem value="+27">🇿🇦 +27</SelectItem>
                            <SelectItem value="+82">🇰🇷 +82</SelectItem>
                            <SelectItem value="+34">🇪🇸 +34</SelectItem>
                            <SelectItem value="+46">🇸🇪 +46</SelectItem>
                            <SelectItem value="+41">🇨🇭 +41</SelectItem>
                            <SelectItem value="+66">🇹🇭 +66</SelectItem>
                            <SelectItem value="+90">🇹🇷 +90</SelectItem>
                            <SelectItem value="+380">🇺🇦 +380</SelectItem>
                            <SelectItem value="+1">🇺🇸 +1</SelectItem>
                            <SelectItem value="+84">🇻🇳 +84</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder={countryCode === '+91' ? '10-digit mobile number' : 'Mobile number'}
                          className={`flex-1 rounded-l-none bg-input-background ${validationErrors.phone ? 'border-red-500' : 'border-border/20'}`}
                        />
                      </div>
                      {validationErrors.phone && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address" className="font-sans-premium">Address *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="House/Flat No., Street, Area"
                      className={`mt-1 bg-input-background ${validationErrors.address ? 'border-red-500' : 'border-border/20'}`}
                    />
                    {validationErrors.address && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.address}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="pincode" className="font-sans-premium">PIN Code *</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) => {
                          handleInputChange('pincode', e.target.value);
                          
                          // Debounce PIN code lookup to prevent unnecessary calls
                          if (pincodeLookupTimeout) {
                            clearTimeout(pincodeLookupTimeout);
                          }
                          
                          const timeout = setTimeout(() => {
                            fetchLocationFromPincode(e.target.value);
                          }, 500); // 500ms delay
                          
                          setPincodeLookupTimeout(timeout);
                        }}
                        placeholder="6 digit PIN code"
                        maxLength={6}
                        className={`mt-1 bg-input-background ${validationErrors.pincode ? 'border-red-500' : 'border-border/20'}`}
                      />
                      {validationErrors.pincode && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.pincode}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="city" className="font-sans-premium">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        className={`mt-1 bg-input-background ${validationErrors.city ? 'border-red-500' : 'border-border/20'}`}
                      />
                      {validationErrors.city && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.city}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="state" className="font-sans-premium">State *</Label>
                      <Select 
                        value={formData.state} 
                        onValueChange={(value: string) => handleInputChange('state', value)}
                      >
                        <SelectTrigger className={`mt-1 bg-input-background ${validationErrors.state ? 'border-red-500' : 'border-border/20'}`}>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border shadow-lg max-h-60 overflow-y-auto">
                          <SelectItem value="Andhra Pradesh">Andhra Pradesh</SelectItem>
                          <SelectItem value="Delhi">Delhi</SelectItem>
                          <SelectItem value="Goa">Goa</SelectItem>
                          <SelectItem value="Gujarat">Gujarat</SelectItem>
                          <SelectItem value="Haryana">Haryana</SelectItem>
                          <SelectItem value="Karnataka">Karnataka</SelectItem>
                          <SelectItem value="Kerala">Kerala</SelectItem>
                          <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                          <SelectItem value="Punjab">Punjab</SelectItem>
                          <SelectItem value="Rajasthan">Rajasthan</SelectItem>
                          <SelectItem value="Tamil Nadu">Tamil Nadu</SelectItem>
                          <SelectItem value="Telangana">Telangana</SelectItem>
                          <SelectItem value="Uttar Pradesh">Uttar Pradesh</SelectItem>
                          <SelectItem value="West Bengal">West Bengal</SelectItem>
                        </SelectContent>
                      </Select>
                      {validationErrors.state && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.state}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="font-sans-premium mb-2 block">Shipping Method *</Label>
                    <div className="space-y-2">
                      {Object.entries(shipping).map(([key, option]) => {
                        const IconComponent = option.icon;
                        return (
                          <div
                            key={key}
                            onClick={() => handleInputChange('shippingMethod', key)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              formData.shippingMethod === key
                                ? 'border-accent bg-accent/10'
                                : 'border-border/20 hover:border-accent/50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <IconComponent className="w-4 h-4 text-accent" />
                          <div className="flex-1">
                                <p className="font-sans-premium font-medium text-sm">{option.name}</p>
                                <p className="text-xs text-muted-foreground">{option.time}</p>
                          </div>
                              <span className="font-serif-premium text-sm text-accent">
                                {option.price === 0 ? 'Free' : formatINR(option.price)}
                              </span>
                        </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3">
                  <Button 
                      variant="outline"
                      onClick={() => navigate(-1)}
                      className="flex items-center gap-2"
                  >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                  </Button>
                    <Button 
                      onClick={() => {
                        if (validateForm()) {
                          setCurrentStep(2);
                        }
                      }}
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      Continue to Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card className="glass-card border-border/20">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 font-serif-premium">
                    <Package className="w-5 h-5 text-accent" />
                    <span>Review Your Order</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Order Items */}
                  <div className="space-y-4">
                    {items.map((item, index) => {
                      const itemPrice = getCartItemPrice(item);
                      const itemKey = `${item.id}-${item.variant_id || 'base'}-${item.combo_id || 'none'}-${index}`;
                      
                      return (
                        <div key={itemKey} className="flex items-center space-x-4 p-4 border border-border/20 rounded-lg">
                          <img 
                            src={item.gallery_images?.[0] || item.image} 
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div className="flex-1">
                            <h3 className="font-serif-premium text-foreground">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">{item.brand}</p>
                            
                            {/* Variant/Combo Info */}
                            {item.variant_name && (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  <Package className="w-3 h-3 mr-1" />
                                  {item.variant_name}
                                </Badge>
                              </div>
                            )}
                            
                            {item.combo_name && (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="default" className="text-xs bg-accent text-accent-foreground">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Combo Pack
                                </Badge>
                              </div>
                            )}
                            
                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                          <span className="font-serif-premium text-accent">{formatINR(itemPrice * item.quantity)}</span>
                        </div>
                      );
                    })}
                    </div>

                  {/* Shipping Information Summary */}
                  <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                    <h4 className="font-sans-premium font-medium text-foreground mb-3">Shipping Details</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Name:</strong> {formData.fullName}</p>
                      <p><strong>Phone:</strong> {formData.phone}</p>
                      <p><strong>Address:</strong> {formData.address}</p>
                      <p><strong>City:</strong> {formData.city}, {formData.state} - {formData.pincode}</p>
                      <p><strong>Shipping Method:</strong> {shipping[formData.shippingMethod as keyof typeof shipping].name}</p>
                      </div>
                    </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep(1)}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </Button>
                    <Button 
                      onClick={() => handleStepChange(3)}
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      Proceed to Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card className="glass-card border-border/20">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 font-serif-premium">
                    <CreditCard className="w-5 h-5 text-accent" />
                    <span>UPI Payment</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Payment Methods */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Mobile Payment */}
                    <Card className="border-border/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center space-x-2 text-base">
                          <Smartphone className="w-4 h-4 text-accent" />
                          <span>Pay with UPI App</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Click to open your UPI app and complete payment.
                        </p>
                        <Button 
                          onClick={() => {
                            const transactionId = `TXN${Date.now().toString().slice(-8)}`;
                            const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${finalTotal}&tid=${transactionId}&tn=${transactionId}`;
                            window.location.href = upiURL;
                          }}
                          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                          <Smartphone className="w-4 h-4 mr-2" />
                          Open UPI App
                        </Button>
                        <div className="text-xs text-muted-foreground text-center">
                          Works with Google Pay, PhonePe, Paytm
                        </div>
                      </CardContent>
                    </Card>

                    {/* QR Code */}
                    <Card className="border-border/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center space-x-2 text-base">
                          <Monitor className="w-4 h-4 text-accent" />
                          <span>Scan QR Code</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Scan with any UPI app on your phone.
                        </p>
                        <div className="flex justify-center">
                          {qrCodeDataURL ? (
                            <div className="p-3 bg-white rounded-lg border">
                              <img src={qrCodeDataURL} alt="UPI Payment QR Code" className="w-32 h-32" />
                            </div>
                          ) : (
                            <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            const transactionId = `TXN${Date.now().toString().slice(-8)}`;
                            const upiURL = `upi://pay?pa=hrejuh@upi&pn=Cigarro&am=${finalTotal}&tid=${transactionId}&tn=${transactionId}`;
                            navigator.clipboard.writeText(upiURL);
                            toast.success('UPI link copied to clipboard');
                          }}
                          className="w-full"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy UPI Link
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payment Link Section */}
                  <div className="bg-muted/20 p-4 rounded-lg border border-border/20">
                    <h4 className="font-sans-premium font-medium text-foreground mb-3">Send Payment Link</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Email Address</Label>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            placeholder={formData.fullName ? `${formData.fullName.toLowerCase().replace(' ', '.')}@email.com` : 'Enter email'}
                            value={paymentLinkEmail}
                            onChange={(e) => setPaymentLinkEmail(e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => sendPaymentLink('email')}
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Phone Number</Label>
                        <div className="flex gap-2">
                          <Input
                            type="tel"
                            placeholder={formData.phone || 'Enter phone number'}
                            value={paymentLinkPhone}
                            onChange={(e) => setPaymentLinkPhone(e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => sendPaymentLink('sms')}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep(2)}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </Button>
                    <Button 
                      onClick={handlePaymentConfirmation}
                      disabled={isProcessingPayment}
                      className="flex-1 bg-green-600 text-white hover:bg-green-700"
                    >
                      {isProcessingPayment ? (
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Confirming...</span>
                        </div>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Payment Done - Confirm Order
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="text-xs text-center text-muted-foreground">
                    Click "Payment Done" after completing payment in your UPI app
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="glass-card border-border/20 sticky top-24">
              <CardHeader>
                <CardTitle className="font-serif-premium">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const itemKey = `${item.id}-${item.variant_id || 'base'}-${item.combo_id || 'none'}-${index}`;
                    return (
                    <div key={itemKey} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-sans-premium text-sm text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-serif-premium text-sm text-accent">{formatINR(item.price * item.quantity)}</span>
                    </div>
                    );
                  })}
                </div>

                <Separator className="bg-border/20" />

                {/* Coupon Code Section */}
                <div className="space-y-4">
                  <h4 className="font-sans-premium font-medium text-foreground">Discount Code</h4>
                  
                  {!appliedDiscount ? (
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleApplyCoupon}
                        disabled={isValidatingCoupon || !couponCode.trim()}
                        variant="outline"
                        size="sm"
                      >
                        {isValidatingCoupon ? 'Applying...' : 'Apply'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Tag className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          {appliedDiscount.discount_name} applied
                        </span>
                        <span className="text-xs text-green-600">
                          -{formatINR(appliedDiscount.discount_amount)}
                        </span>
                      </div>
                      <Button 
                        onClick={handleRemoveCoupon}
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-800"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  
                  {discountError && (
                    <p className="text-sm text-red-600">{discountError}</p>
                  )}
                </div>

                <Separator className="bg-border/20" />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-sans-premium text-muted-foreground">Subtotal</span>
                    <span className="font-sans-premium text-foreground">{formatINR(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-sans-premium text-muted-foreground">Shipping</span>
                    <span className="font-sans-premium text-foreground">{shippingCost === 0 ? 'Free' : formatINR(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-sans-premium text-muted-foreground">Lucky Discount</span>
                    <span className="font-sans-premium text-green-600">-{formatINR(randomDiscount)}</span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between text-sm">
                      <span className="font-sans-premium text-muted-foreground">Coupon Discount</span>
                      <span className="font-sans-premium text-green-600">-{formatINR(appliedDiscount.discount_amount)}</span>
                    </div>
                  )}
                </div>

                <Separator className="bg-border/20" />

                <div className="flex justify-between">
                  <span className="font-serif-premium text-lg text-foreground">Total</span>
                  <span className="font-serif-premium text-xl text-accent">{formatINR(finalTotal)}</span>
                </div>

                <div className="mt-6 p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-accent" />
                    <span className="font-sans-premium text-sm text-foreground">Premium Benefits</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>• Free returns within 30 days</li>
                    <li>• Authenticity guarantee</li>
                    <li>• White-glove customer service</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
