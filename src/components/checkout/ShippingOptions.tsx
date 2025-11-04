import { Truck, Clock, Zap } from 'lucide-react';
import { formatINR } from '../../utils/currency';

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

interface ShippingOptionsProps {
  selectedShipping: string;
  onSelectShipping: (optionId: string) => void;
}

export function ShippingOptions({ selectedShipping, onSelectShipping }: ShippingOptionsProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-dark">Delivery Options</h3>
      {shippingOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelectShipping(option.id)}
          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
            selectedShipping === option.id
              ? 'border-canyon bg-canyon/5'
              : 'border-coyote/30 hover:border-canyon/50'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              selectedShipping === option.id ? 'bg-canyon text-white' : 'bg-coyote/20 text-dark'
            }`}>
              {option.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-dark text-sm">{option.name}</h4>
                <span className="font-semibold text-dark">
                  {option.price === 0 ? 'Free' : formatINR(option.price)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-dark/60">{option.description}</p>
                <p className="text-xs text-dark/60">{option.estimatedDays}</p>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
