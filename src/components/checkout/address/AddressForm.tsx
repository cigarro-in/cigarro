import { useState, useEffect, useRef, useId } from 'react';
import { MapPin, Loader2, Home, Building2, GraduationCap, Hotel, Check } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useInlineStatus, InlineStatus } from '../../common/InlineStatus';
import { Address } from './AddressCard';
import { cn } from '../../ui/utils';
import { cleanPersonName, personNameError, realNameOrEmpty } from '../../../lib/profile/personName';

interface AddressFormProps {
  initialData?: Address | null;
  defaultValues?: Partial<Address>;
  userId: string;
  onSave: (address: Address) => Promise<void>;
  onCancel: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const addressSuggestions = [
  { id: 'home', label: 'Home', icon: <Home className="h-4 w-4 shrink-0" /> },
  { id: 'work', label: 'Work', icon: <Building2 className="h-4 w-4 shrink-0" /> },
  { id: 'pg', label: 'PG', icon: <GraduationCap className="h-4 w-4 shrink-0" /> },
  { id: 'hotel', label: 'Hotel', icon: <Hotel className="h-4 w-4 shrink-0" /> },
  { id: 'other', label: 'Other', icon: <MapPin className="h-4 w-4 shrink-0" /> }
];

const FIELD_HEIGHT = 'h-10 rounded-md';
const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-foreground/80';
const ERROR_CLASS = 'mt-1.5 text-xs text-destructive';

export function AddressForm({ initialData, defaultValues, userId, onSave, onCancel }: AddressFormProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [customLabel, setCustomLabel] = useState('');
  const pincodeLookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  const [formData, setFormData] = useState<Address>({
    // Prefill only with a real saved name; placeholders such as "Customer" start empty.
    full_name: realNameOrEmpty(defaultValues?.full_name),
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
  const { status: opStatus, setError: setOpError } = useInlineStatus();

  // Prefill fills EMPTY name/phone fields only: profile data arriving late
  // (async) must never wipe what the customer already typed. Editing an
  // existing address always wins over defaults.
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
        full_name: prev.full_name || realNameOrEmpty(defaultValues.full_name) || prev.full_name,
        phone: prev.phone || defaultValues.phone || prev.phone
      }));
    }
  }, [initialData, defaultValues]);

  // Back to idle a moment after a successful save (the parent normally
  // closes the form first, in which case this never runs).
  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = setTimeout(() => setSaveState('idle'), 1500);
    return () => clearTimeout(t);
  }, [saveState]);

  useEffect(() => () => {
    if (pincodeLookupTimeout.current) clearTimeout(pincodeLookupTimeout.current);
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const nameProblem = personNameError(formData.full_name);
    if (nameProblem) newErrors.full_name = nameProblem;
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
    setSaveState('saving');

    try {
      const finalLabel = formData.label === 'other' ? customLabel :
        addressSuggestions.find(s => s.id === formData.label)?.label || 'Home';

      await onSave({
        ...formData,
        full_name: cleanPersonName(formData.full_name),
        label: finalLabel
      });
      setSaveState('saved');
    } catch (error) {
      console.error('Error saving address:', error);
      setOpError('Failed to save address');
      setSaveState('error');
    }
  };

  // Pincode lookup via India Post public API (no key, no Supabase).
  const fetchLocationFromPincode = async (pincode: string) => {
    if (pincode.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const body = await res.json().catch(() => null);
        const office = Array.isArray(body) ? body[0]?.PostOffice?.[0] : null;
        if (!office) return;

        setFormData(prev => ({
          ...prev,
          city: prev.city || office.District || prev.city,
          state: prev.state || office.State || prev.state,
          country: prev.country || office.Country || prev.country
        }));
        setErrors(prev => ({ ...prev, pincode: '', city: '', state: '' }));
      } catch (error) {
        console.error('Pincode lookup error:', error);
      }
    }
  };

  const saveLabel = {
    idle: 'Save address',
    saving: 'Saving',
    saved: 'Saved',
    error: 'Try again',
  }[saveState];

  return (
    <div className="space-y-5 py-2">
      <InlineStatus status={opStatus} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={id('name')} className={LABEL_CLASS}>Full name</label>
          <Input
            id={id('name')}
            value={formData.full_name}
            onChange={e => {
              setFormData({ ...formData, full_name: e.target.value });
              if (errors.full_name) setErrors(prev => ({ ...prev, full_name: '' }));
            }}
            placeholder="Enter your full name"
            autoComplete="name"
            maxLength={60}
            required
            aria-invalid={!!errors.full_name}
            className={FIELD_HEIGHT}
          />
          {errors.full_name && <p className={ERROR_CLASS}>{errors.full_name}</p>}
        </div>

        <div>
          <label htmlFor={id('phone')} className={LABEL_CLASS}>Phone number</label>
          <div
            className={cn(
              'flex h-10 overflow-hidden rounded-md border border-input bg-input-background transition-[color,box-shadow]',
              'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
              errors.phone && 'border-destructive',
            )}
          >
            <span className="flex shrink-0 select-none items-center border-r border-input bg-muted/40 px-3 text-sm text-muted-foreground">
              +91
            </span>
            <input
              id={id('phone')}
              value={formData.phone}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, phone: val });
              }}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              aria-invalid={!!errors.phone}
              className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none md:text-sm"
            />
          </div>
          {errors.phone && <p className={ERROR_CLASS}>{errors.phone}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={id('address')} className={LABEL_CLASS}>House no., building, street</label>
        <Input
          id={id('address')}
          value={formData.address}
          onChange={e => setFormData({ ...formData, address: e.target.value })}
          autoComplete="address-line1"
          aria-invalid={!!errors.address}
          className={FIELD_HEIGHT}
        />
        {errors.address && <p className={ERROR_CLASS}>{errors.address}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={id('pincode')} className={LABEL_CLASS}>Pincode</label>
          <Input
            id={id('pincode')}
            value={formData.pincode}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setFormData({ ...formData, pincode: val });

              if (pincodeLookupTimeout.current) clearTimeout(pincodeLookupTimeout.current);
              if (val.length === 6) {
                pincodeLookupTimeout.current = setTimeout(() => fetchLocationFromPincode(val), 500);
              }
            }}
            type="tel"
            inputMode="numeric"
            autoComplete="postal-code"
            aria-invalid={!!errors.pincode}
            className={FIELD_HEIGHT}
          />
          {errors.pincode && <p className={ERROR_CLASS}>{errors.pincode}</p>}
        </div>
        <div>
          <label htmlFor={id('city')} className={LABEL_CLASS}>City</label>
          <Input
            id={id('city')}
            value={formData.city}
            onChange={e => setFormData({ ...formData, city: e.target.value })}
            autoComplete="address-level2"
            aria-invalid={!!errors.city}
            className={FIELD_HEIGHT}
          />
          {errors.city && <p className={ERROR_CLASS}>{errors.city}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={id('state')} className={LABEL_CLASS}>State</label>
        <Input
          id={id('state')}
          value={formData.state}
          onChange={e => setFormData({ ...formData, state: e.target.value })}
          autoComplete="address-level1"
          aria-invalid={!!errors.state}
          className={FIELD_HEIGHT}
        />
        {errors.state && <p className={ERROR_CLASS}>{errors.state}</p>}
      </div>

      <div>
        <span id={id('save-as')} className={LABEL_CLASS}>Save as</span>
        <div role="radiogroup" aria-labelledby={id('save-as')} className="flex flex-wrap gap-2">
          {addressSuggestions.map((s) => {
            const selected = formData.label === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setFormData({ ...formData, label: s.id });
                  if (s.id !== 'other') setCustomLabel('');
                }}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-foreground/80 hover:border-foreground/30',
                )}
              >
                {s.icon}
                {s.label}
              </button>
            );
          })}
        </div>
        {formData.label === 'other' && (
          <Input
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            aria-label="Custom label"
            placeholder="Name this address"
            className={cn(FIELD_HEIGHT, 'mt-2')}
            autoFocus
          />
        )}
        {errors.label && <p className={ERROR_CLASS}>{errors.label}</p>}
      </div>

      {/* Spacer so the focused field stays above the on-screen keyboard (phone) */}
      <div className="h-24 md:hidden" />

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-4 md:pt-2 md:shadow-none md:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 rounded-md border-border md:flex-none md:min-w-32"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={cn(
            'h-11 flex-1 rounded-md bg-accent text-accent-foreground shadow-none hover:bg-accent/90 md:flex-none md:min-w-32',
            saveState === 'error' && 'bg-destructive hover:bg-destructive/90',
          )}
          onClick={handleSave}
          disabled={saveState === 'saving'}
          aria-busy={saveState === 'saving'}
        >
          {saveState === 'saving' && <Loader2 className="animate-spin" />}
          {saveState === 'saved' && <Check />}
          <span role="status">{saveLabel}</span>
        </Button>
      </div>
    </div>
  );
}
