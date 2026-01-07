import React from 'react';
import { Plus, MapPin } from 'lucide-react';
import { Button } from '../../ui/button';
import { Address, AddressCard } from './AddressCard';

interface AddressListProps {
  addresses: Address[];
  selectedId?: string;
  onSelect: (address: Address) => void;
  onEdit: (address: Address) => void;
  onAddNew: () => void;
}

export function AddressList({ addresses, selectedId, onSelect, onEdit, onAddNew }: AddressListProps) {

  if (addresses.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="w-16 h-16 bg-coyote/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-coyote" />
        </div>
        <h3 className="font-serif text-xl text-dark mb-2">No saved addresses</h3>
        <p className="text-dark/60 text-sm mb-6">
          Add a delivery address to proceed with your order.
        </p>
        <Button
          onClick={onAddNew}
          className="w-full bg-dark hover:bg-canyon text-creme-light h-12 rounded-full text-base"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add New Address
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24"> {/* Extra padding for sticky footer */}
      <div className="space-y-3">
        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            isSelected={selectedId === address.id}
            onSelect={() => onSelect(address)}
            onEdit={(e) => {
              e.stopPropagation();
              onEdit(address);
            }}
          />
        ))}
      </div>

      {/* Sticky Add Button Container */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-creme border-t border-coyote/20 safe-area-bottom">
        <Button
          onClick={onAddNew}
          className="w-full bg-dark hover:bg-canyon text-creme-light h-12 rounded-full text-base shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add New Address
        </Button>
      </div>
    </div>
  );
}
