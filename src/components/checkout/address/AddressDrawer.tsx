import { useState } from 'react';
import { memo } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription
} from '../../ui/drawer';
import { AddressList } from './AddressList';
import { AddressForm } from './AddressForm';
import { Address } from './AddressCard';
import { useAddresses } from '../../../lib/convex/useAddresses';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../ui/utils';

interface AddressDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  selectedAddress: Address | null;
  onAddressSelect: (address: Address) => void;
  savedAddresses: Address[];
  onAddressesUpdate: () => Promise<void>;
}

export const AddressDrawer = memo(function AddressDrawer({
  open,
  onOpenChange,
  user,
  selectedAddress,
  onAddressSelect,
  savedAddresses,
  onAddressesUpdate
}: AddressDrawerProps) {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const { saveAddress } = useAddresses(user);
  const handleSaveAddress = async (addressData: Address) => {
    if (!user) return;

    try {
      const saved = await saveAddress({
        id: addressData.id,
        full_name: addressData.full_name,
        phone: addressData.phone,
        address: addressData.address,
        pincode: addressData.pincode,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        label: addressData.label,
        is_default: (addressData as any).is_default,
      });
      const savedData = { ...addressData, ...saved } as Address;

      toast.success(addressData.id ? 'Address updated' : 'Address added');

      await onAddressesUpdate();

      onAddressSelect(savedData);

      setView('list');
      setEditingAddress(null);
    } catch (err) {
      console.error('Error saving address:', err);
      toast.error('Failed to save address');
    }
  };

  const handleBack = () => {
    if (view === 'form') {
      setView('list');
      setEditingAddress(null);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o: boolean) => {
      if (!o) {
        // Reset view on close after delay
        setTimeout(() => {
          setView('list');
          setEditingAddress(null);
        }, 300);
      }
      onOpenChange(o);
    }}>
      <DrawerContent className={cn(
        "bg-creme flex flex-col",
        view === 'form' ? "max-h-[85vh] min-h-[60vh]" : "max-h-[50vh] min-h-[25vh]"
      )}>
        <DrawerHeader className="border-b border-coyote/20 pb-4">
          <div className="flex items-center gap-2">
            {view === 'form' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={handleBack}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div>
              <DrawerTitle className="font-serif text-xl">
                {view === 'list' ? 'Select Address' : (editingAddress ? 'Edit Address' : 'Add New Address')}
              </DrawerTitle>
              <DrawerDescription className="hidden">
                Manage your delivery addresses
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="p-4 overflow-y-auto flex-1 bg-creme">
          {view === 'list' ? (
            <AddressList
              addresses={savedAddresses}
              selectedId={selectedAddress?.id}
              onSelect={(addr) => {
                onAddressSelect(addr);
                onOpenChange(false);
              }}
              onEdit={(addr) => {
                setEditingAddress(addr);
                setView('form');
              }}
              onAddNew={() => {
                setEditingAddress(null);
                setView('form');
              }}
            />
          ) : (
            <AddressForm
              userId={user?.id}
              initialData={editingAddress}
              defaultValues={{
                full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0],
                phone: user?.user_metadata?.phone || ''
              }}
              onSave={handleSaveAddress}
              onCancel={handleBack}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
});
