import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';
import { AddressForm } from '../../../components/checkout/address/AddressForm';
import type { Address } from '../../../components/checkout/address/AddressCard';
import { InlineStatus, useInlineStatus } from '../../../components/common/InlineStatus';
import { useAddresses } from '../../../lib/convex/useAddresses';
import { useMyProfile } from '../../../hooks/data/useMyProfile';
import { realNameOrEmpty } from '../../../lib/profile/personName';
import { cn } from '../../../components/ui/utils';
import { Section } from './Section';
import type { CheckoutModel } from './useCheckoutModel';

// Delivery address step. Saved addresses as a selectable grid; add and edit
// open the shared AddressForm in place (the mobile page uses the same form
// inside AddressDrawer, and saves the same way).
export function AddressSection({ model }: { model: CheckoutModel }) {
  const { user, savedAddresses, addressesLoading, selectedAddress, selectAddress, addressAttention } = model;
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const { saveAddress } = useAddresses(user);
  const { profileName, profilePhone10 } = useMyProfile();
  const { status, setError } = useInlineStatus();
  const sectionRef = useRef<HTMLDivElement>(null);

  const newAddressDefaults = useMemo(
    () => ({ full_name: realNameOrEmpty(profileName), phone: profilePhone10 || '' }),
    [profileName, profilePhone10],
  );

  // Pay pressed without a usable address: bring this step into view.
  useEffect(() => {
    if (addressAttention === 0) return;
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // No address: list stays (or the form shows when the book is empty).
    // Address without a real name: open that address for editing when it is
    // in the book, otherwise start a new one.
    if (!selectedAddress) setEditing(savedAddresses.length === 0 ? 'new' : null);
    else setEditing(savedAddresses.find((a) => a.id === selectedAddress.id) ?? 'new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressAttention]);

  const handleSave = async (data: Address) => {
    try {
      const saved = await saveAddress({
        id: data.id,
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
        pincode: data.pincode,
        city: data.city,
        state: data.state,
        country: data.country,
        label: data.label,
        is_default: data.is_default,
      });
      selectAddress({ ...data, ...saved } as Address);
      setEditing(null);
    } catch (err) {
      console.error('Error saving address:', err);
      setError('Failed to save address');
    }
  };

  const showSkeleton = addressesLoading && savedAddresses.length === 0 && !selectedAddress;
  const noSaved = !addressesLoading && savedAddresses.length === 0;
  // A retry keeps its original address even when it is not in the book.
  const extraSelected = selectedAddress && !savedAddresses.some((a) => a.id === selectedAddress.id)
    ? selectedAddress
    : null;

  return (
    <div ref={sectionRef} className="scroll-mt-24">
      <Section
        step={1}
        title="Delivery address"
        action={!editing && !noSaved && !showSkeleton ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline underline-offset-4"
          >
            <Plus className="h-4 w-4" /> Add address
          </button>
        ) : null}
      >
        {status.kind && <div className="mb-3"><InlineStatus status={status} /></div>}

        {editing || noSaved ? (
          <div className="rounded-lg bg-creme px-4 pt-4">
            <AddressForm
              key={editing === 'new' || !editing ? 'new' : editing.id}
              userId={user?.id ?? ''}
              initialData={editing && editing !== 'new' ? editing : null}
              defaultValues={newAddressDefaults}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : showSkeleton ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-[104px] bg-muted" />
            <Skeleton className="h-[104px] bg-muted" />
          </div>
        ) : (
          <div role="radiogroup" aria-label="Delivery address" className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {[...(extraSelected ? [extraSelected] : []), ...savedAddresses].map((addr) => {
              const selected = selectedAddress?.id === addr.id && (addr.id !== undefined || addr === selectedAddress);
              return (
                <div
                  key={addr.id ?? 'retry-address'}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onClick={() => selectAddress(addr)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectAddress(addr);
                    }
                  }}
                  className={cn(
                    'group relative cursor-pointer rounded-lg border p-4 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    selected ? 'border-accent bg-accent/5' : 'border-border hover:border-foreground/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                        selected ? 'border-accent bg-accent text-accent-foreground' : 'border-foreground/30',
                      )}
                      aria-hidden="true"
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{addr.full_name || 'Name missing'}</span>
                        {addr.label && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                            {addr.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {addr.address}, {addr.city}, {addr.state} {addr.pincode}
                      </p>
                      {addr.phone && <p className="mt-1 text-sm text-muted-foreground">{addr.phone}</p>}
                    </div>
                    {addr.id && addr !== extraSelected && (
                      <button
                        type="button"
                        aria-label={`Edit ${addr.label || 'address'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(addr);
                        }}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
