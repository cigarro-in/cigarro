import { useState, useEffect } from 'react';
import { MapPin, Plus, Edit3, Check, Loader2, X, Navigation, Home, Building2, Hotel, GraduationCap, MapPin as MapPinIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';

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
}

interface AddressManagerProps {
  user: any;
  selectedAddress: Address | null;
  onAddressSelect: (address: Address) => void;
  showDialog: boolean;
  onDialogChange: (show: boolean) => void;
  showInlineSelector?: boolean; // New prop for inline display
  savedAddresses?: Address[]; // Pre-loaded addresses from parent
}

const addressSuggestions = [
  { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
  { id: 'work', label: 'Work', icon: <Building2 className="w-4 h-4" /> },
  { id: 'pg', label: 'PG', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'hotel', label: 'Hotel', icon: <Hotel className="w-4 h-4" /> },
  { id: 'hostel', label: 'Hostel', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'other', label: 'Other', icon: <MapPinIcon className="w-4 h-4" /> }
];

export function AddressManager({ 
  user, 
  selectedAddress, 
  onAddressSelect, 
  showDialog, 
  onDialogChange,
  showInlineSelector = false,
  savedAddresses: propSavedAddresses
}: AddressManagerProps) {
  const [savedAddresses, setSavedAddresses] = useState<Address[]>(propSavedAddresses || []);
  const [showAddNewDialog, setShowAddNewDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [pincodeLookupTimeout, setPincodeLookupTimeout] = useState<NodeJS.Timeout | null>(null);

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
  const [pincodeLookup, setPincodeLookup] = useState<{[key: string]: { city: string; state: string } | null}>({});

  // Update savedAddresses when prop changes
  useEffect(() => {
    if (propSavedAddresses) {
      setSavedAddresses(propSavedAddresses);
    }
  }, [propSavedAddresses]);

  // Load saved addresses
  const loadSavedAddresses = async () => {
    if (!user) return;
    
    // If addresses are provided via props, use them
    if (propSavedAddresses && propSavedAddresses.length > 0) {
      setSavedAddresses(propSavedAddresses);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSavedAddresses(data);
        if (data.length > 0 && !selectedAddress) {
          // Select the most recent address
          onAddressSelect(data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  // Pincode lookup functionality
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

  // Current location functionality
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    
    try {
      if (!navigator.geolocation) {
        toast.error('Location services not supported on this device');
        return;
      }

      // Request location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      const { latitude, longitude } = position.coords;
      toast.info('📍 Found location, fetching address...');

      // Use Nominatim for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch address details');
      }

      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        
        // Extract components
        const pincode = addr.postcode || '';
        
        // Construct address line
        const addressParts = [];
        if (addr.house_number) addressParts.push(addr.house_number);
        if (addr.building) addressParts.push(addr.building);
        if (addr.road) addressParts.push(addr.road);
        if (addr.suburb) addressParts.push(addr.suburb);
        if (addr.neighbourhood) addressParts.push(addr.neighbourhood);
        
        const formattedAddress = addressParts.join(', ');

        // Update form
        setAddressForm(prev => ({
          ...prev,
          address: formattedAddress,
          pincode: pincode,
          // Clear city/state to be filled by pincode lookup
          city: '', 
          state: ''
        }));

        // Trigger pincode lookup to fill city/state automatically
        if (pincode && pincode.length === 6) {
          await fetchLocationFromPincode(pincode);
        }

        toast.success('📍 Location details found!');
      } else {
        throw new Error('Incomplete address data received');
      }

    } catch (error: any) {
      console.error('Location error:', error);
      let errorMessage = 'Failed to get location';
      
      if (error.code === 1) errorMessage = 'Location permission denied';
      if (error.code === 2) errorMessage = 'Location unavailable';
      if (error.code === 3) errorMessage = 'Location request timed out';
      
      toast.error(errorMessage);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Handle edit address
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
      label: address.label.toLowerCase() === 'home' ? 'home' : 
             address.label.toLowerCase() === 'work' ? 'work' : 'other'
    });
    if (address.label.toLowerCase() !== 'home' && address.label.toLowerCase() !== 'work') {
      setCustomLabel(address.label);
    }
    setShowAddNewDialog(true);
  };

  // Handle delete address
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
        onAddressSelect(null as any);
      }

      toast.success('Address deleted successfully');
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('Failed to delete address');
    }
  };

  // Validate address form
  const validateAddressForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!addressForm.full_name.trim()) errors.full_name = 'Full name is required';
    if (!addressForm.phone.trim()) errors.phone = 'Phone number is required';
    if (!addressForm.address.trim()) errors.address = 'Address is required';
    if (!addressForm.pincode.trim()) errors.pincode = 'Pincode is required';
    if (!addressForm.city.trim()) errors.city = 'City is required';
    if (!addressForm.state.trim()) errors.state = 'State is required';
    
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save address
  const saveAddress = async () => {
    if (!user || !validateAddressForm()) return;

    setIsSavingAddress(true);
    try {
      const finalLabel = addressForm.label === 'other' ? customLabel : 
        addressSuggestions.find(s => s.id === addressForm.label)?.label || 'My Address';

      const addressData = {
        user_id: user.id,
        full_name: addressForm.full_name.trim(),
        phone: addressForm.phone.trim(),
        address: addressForm.address.trim(),
        pincode: addressForm.pincode.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        country: addressForm.country,
        label: finalLabel
      };

      let data, error;

      if (editingAddress) {
        const result = await supabase
          .from('saved_addresses')
          .update(addressData)
          .eq('id', editingAddress.id)
          .eq('user_id', user.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('saved_addresses')
          .insert(addressData)
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (editingAddress) {
        setSavedAddresses(prev => prev.map(addr => 
          addr.id === editingAddress.id ? data : addr
        ));
      } else {
        setSavedAddresses(prev => [data, ...prev]);
      }

      onAddressSelect(data);
      setShowAddNewDialog(false);
      resetForm();
      
      toast.success(editingAddress ? '✅ Address updated!' : '✅ Address saved!');
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Reset form
  const resetForm = () => {
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
  };

  // Load addresses on mount
  useEffect(() => {
    if (user) {
      loadSavedAddresses();
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

  // Inline Address Display Component (from AddressSelector)
  const AddressDisplay = () => (
    <div className="space-y-3">
      {/* Selected Address Display */}
      {selectedAddress ? (
        <Card className="border-2 border-canyon/30 bg-canyon/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <MapPin className="w-5 h-5 text-canyon mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-dark text-sm">{selectedAddress.full_name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-canyon/20 text-canyon rounded-full uppercase font-medium">
                      {selectedAddress.label}
                    </span>
                  </div>
                  <p className="text-sm text-dark/80 mb-1">{selectedAddress.phone}</p>
                  <p className="text-sm text-dark/70 leading-relaxed">
                    {selectedAddress.address}, {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditAddress(selectedAddress)}
                className="flex-shrink-0 ml-2"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed border-coyote/50">
          <CardContent className="p-6 text-center">
            <MapPin className="w-8 h-8 text-coyote mx-auto mb-3" />
            <p className="text-dark/60 text-sm mb-3">No delivery address selected</p>
            <Button onClick={() => onDialogChange(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Address
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Address Selection */}
      {savedAddresses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-dark/60 uppercase tracking-wide font-medium">Quick Select</p>
          <div className="grid grid-cols-1 gap-2">
            {savedAddresses.slice(0, 3).map((address) => (
              <button
                key={address.id}
                onClick={() => onAddressSelect(address)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  selectedAddress?.id === address.id
                    ? 'border-canyon bg-canyon/5'
                    : 'border-coyote/30 hover:border-canyon/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{address.full_name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-coyote/20 text-dark/70 rounded uppercase">
                    {address.label}
                  </span>
                </div>
                <p className="text-xs text-dark/60 truncate">
                  {address.address}, {address.city} - {address.pincode}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Return inline display if requested
  if (showInlineSelector) {
    return <AddressDisplay />;
  }

  return (
    <>
      {/* Address Selection Dialog - Replicated from original */}
      <Dialog open={showDialog} onOpenChange={onDialogChange}>
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
                          onAddressSelect(address);
                          onDialogChange(false);
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
                      onDialogChange(false);
                      setShowAddNewDialog(true);
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
                    onDialogChange(false);
                    setShowAddNewDialog(true);
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

      {/* Add/Edit Address Dialog */}
      <Dialog open={showAddNewDialog} onOpenChange={setShowAddNewDialog}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit Address' : 
               savedAddresses.length > 0 ? 'Add New Address' : 'Add Your First Address'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Full Name */}
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

            {/* Phone */}
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

            {/* Address with Current Location button */}
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

            {/* Pincode and City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={addressForm.pincode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAddressForm(prev => ({ ...prev, pincode: value }));
                    
                    if (pincodeLookupTimeout) {
                      clearTimeout(pincodeLookupTimeout);
                    }
                    
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

            {/* State */}
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

            {/* Address Label */}
            <div>
              <Label>Save as</Label>
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

            {/* Save Button */}
            <Button
              onClick={saveAddress}
              disabled={isSavingAddress}
              className="w-full"
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
        </DialogContent>
      </Dialog>
    </>
  );
}
