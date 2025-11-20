import React from 'react';
import { MapPin, Phone, Edit3, Check, Home, Building2, GraduationCap, Hotel } from 'lucide-react';
import { cn } from '../../ui/utils';
import { Badge } from '../../ui/badge';

export interface Address {
  id?: string;
  full_name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
  label: string;
  is_default?: boolean;
}

interface AddressCardProps {
  address: Address;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
}

export function AddressCard({ address, isSelected, onSelect, onEdit }: AddressCardProps) {
  const getIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l === 'home') return <Home className="w-4 h-4" />;
    if (l === 'work') return <Building2 className="w-4 h-4" />;
    if (l === 'pg' || l === 'hostel') return <GraduationCap className="w-4 h-4" />;
    if (l === 'hotel') return <Hotel className="w-4 h-4" />;
    return <MapPin className="w-4 h-4" />;
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer",
        isSelected 
          ? "border-canyon bg-canyon/5 shadow-sm" 
          : "border-coyote/30 bg-creme-light hover:border-coyote hover:shadow-sm"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Label/Tag with icon and check */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isSelected ? "bg-canyon text-creme-light" : "bg-coyote/20 text-dark/70"
          )}>
            {getIcon(address.label)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-dark text-sm capitalize">
                {address.label}
              </span>
              {isSelected && <Check className="w-4 h-4 text-canyon flex-shrink-0" />}
            </div>
            <p className="text-xs text-dark/60 leading-snug line-clamp-1">
              {address.address}, {address.city} - {address.pincode}
            </p>
          </div>
        </div>

        {/* Edit Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(e);
          }}
          className="text-xs font-medium text-canyon px-2.5 py-1.5 rounded-lg bg-canyon/10 hover:bg-canyon/20 transition-colors flex items-center gap-1 flex-shrink-0"
        >
          <Edit3 className="w-3 h-3" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>
    </div>
  );
}
