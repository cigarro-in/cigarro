import { useState, useEffect } from 'react';
import { MapPin, Loader2, Navigation, Home, Building2, GraduationCap, Hotel, Check } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { Address } from './AddressCard';
import { cn } from '../../ui/utils';

interface AddressFormProps {
  initialData?: Address | null;
  defaultValues?: Partial<Address>;
  userId: string;
  onSave: (address: Address) => Promise<void>;
  onCancel: () => void;
}

const addressSuggestions = [
  { id: 'home', label: 'Home', icon: <Home className="w-3.5 h-3.5" /> },
  { id: 'work', label: 'Work', icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: 'pg', label: 'PG', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { id: 'hotel', label: 'Hotel', icon: <Hotel className="w-3.5 h-3.5" /> },
  { id: 'other', label: 'Other', icon: <MapPin className="w-3.5 h-3.5" /> }
];

export function AddressForm({ initialData, defaultValues, userId, onSave, onCancel }: AddressFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [pincodeLookupTimeout, setPincodeLookupTimeout] = useState<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState<Address>({
    full_name: defaultValues?.full_name || '',
    phone: defaultValues?.phone || '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    label: 'home',
    is_default: false,
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      if (!addressSuggestions.some(s => s.id === initialData.label.toLowerCase())) {
        setFormData(prev => ({ ...prev, label: 'other' }));
        setCustomLabel(initialData.label);
      } else {
        setFormData(prev => ({ ...prev, label: initialData.label.toLowerCase() }));
      }
    } else if (defaultValues) {
      setFormData(prev => ({
        ...prev,
        full_name: defaultValues.full_name || prev.full_name,
        phone: defaultValues.phone || prev.phone
      }));
    }
  }, [initialData, defaultValues]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.phone.match(/^\d{10}$/)) newErrors.phone = 'Enter a valid 10-digit number';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
    if (formData.pincode.length !== 6) newErrors.pincode = 'Enter valid 6-digit pincode';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    
    if (formData.label === 'other' && !customLabel.trim()) {
      newErrors.label = 'Custom label is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);

    try {
      const finalLabel = formData.label === 'other' ? customLabel : 
        addressSuggestions.find(s => s.id === formData.label)?.label || 'Home';

      await onSave({
        ...formData,
        label: finalLabel
      });
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  // Location Logic
  const fetchLocationFromPincode = async (pincode: string) => {
    if (pincode.length === 6) {
      try {
        const { data, error } = await supabase
          .from('pincode_lookup')
          .select('*')
          .eq('pincode', pincode)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setFormData(prev => ({
            ...prev,
            city: data.city,
            state: data.state,
            country: data.country
          }));
          setErrors(prev => ({ ...prev, pincode: '', city: '', state: '' }));
        }
      } catch (error) {
        console.error('Pincode lookup error:', error);
      }
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      if (!navigator.geolocation) throw new Error('Location not supported');

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true, 
          timeout: 10000 
        });
      });

      const { latitude, longitude } = position.coords;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );

      if (!response.ok) throw new Error('Geocoding failed');
      const data = await response.json();

      if (data?.address) {
        const addr = data.address;
        const parts = [
          addr.house_number,
          addr.building,
          addr.road,
          addr.suburb,
          addr.neighbourhood
        ].filter(Boolean);

        setFormData(prev => ({
          ...prev,
          address: parts.join(', '),
          pincode: addr.postcode || prev.pincode,
          city: addr.city || addr.town || addr.village || '',
          state: addr.state || '',
          country: 'India' // Force India as per business logic
        }));

        if (addr.postcode) fetchLocationFromPincode(addr.postcode);
        toast.success('Location updated!');
      }
    } catch (error) {
      console.error('Location error:', error);
      toast.error('Could not fetch location');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* Use Current Location Button */}
      <Button
        type="button"
        variant="outline"
        onClick={getCurrentLocation}
        disabled={isLoadingLocation}
        className="w-full border-canyon/30 text-canyon hover:bg-canyon/5 h-12"
      >
        {isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2" />}
        Use Current Location
      </Button>

      <div className="space-y-4">
        <div>
          <Label>Full Name</Label>
          <Input 
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Enter your full name"
            className={cn("mt-1.5 bg-creme-light/50", errors.full_name && "border-red-500")}
          />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
        </div>

        <div>
          <Label>Phone Number</Label>
          <div className="flex mt-1.5">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-coyote bg-creme-light text-dark/60 text-sm">
              +91
            </span>
            <Input 
              value={formData.phone}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, phone: val });
              }}
              className={cn("rounded-l-none bg-creme-light/50", errors.phone && "border-red-500")}
              type="tel"
            />
          </div>
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <Label>Address (House No, Building, Street)</Label>
          <Input 
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className={cn("mt-1.5", errors.address && "border-red-500")}
          />
          {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Pincode</Label>
            <Input 
              value={formData.pincode}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setFormData({ ...formData, pincode: val });
                
                if (pincodeLookupTimeout) clearTimeout(pincodeLookupTimeout);
                if (val.length === 6) {
                  setPincodeLookupTimeout(setTimeout(() => fetchLocationFromPincode(val), 500));
                }
              }}
              className={cn("mt-1.5", errors.pincode && "border-red-500")}
              type="tel"
            />
            {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
          </div>
          <div>
            <Label>City</Label>
            <Input 
              value={formData.city}
              onChange={e => setFormData({ ...formData, city: e.target.value })}
              className={cn("mt-1.5 bg-creme-light/50", errors.city && "border-red-500")}
            />
          </div>
        </div>

        <div>
          <Label>State</Label>
          <Input 
            value={formData.state}
            onChange={e => setFormData({ ...formData, state: e.target.value })}
            className={cn("mt-1.5 bg-creme-light/50", errors.state && "border-red-500")}
          />
        </div>

        {/* Label Selection - Full Width Grid */}
        <div>
          <Label>Save As</Label>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {addressSuggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, label: s.id });
                  if (s.id !== 'other') setCustomLabel('');
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs transition-all",
                  formData.label === s.id
                    ? "border-canyon bg-canyon/10 text-canyon font-medium shadow-sm"
                    : "border-coyote/30 bg-creme-light hover:border-canyon/30"
                )}
              >
                {s.icon}
                <span className="truncate w-full text-center">{s.label}</span>
              </button>
            ))}
          </div>
          {formData.label === 'other' && (
            <Input 
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              className="mt-2"
              autoFocus
            />
          )}
          {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label}</p>}
        </div>
      </div>

      {/* Spacer to ensure content is visible above keyboard */}
      <div className="h-48 md:h-0" />

      <div className="pt-4 flex gap-3 sticky bottom-0 bg-creme py-4 border-t border-coyote/10 -mx-4 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1 h-12 border-coyote/30 rounded-full"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button 
          type="button" 
          className="flex-1 h-12 bg-dark hover:bg-canyon text-creme-light rounded-full shadow-lg"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Address'}
        </Button>
      </div>
    </div>
  );
}
