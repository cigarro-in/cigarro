import { Truck, Clock, Zap } from 'lucide-react';
import { formatINR } from '../../utils/currency';
import { useShippingMethods } from '../../hooks/data/useContent';

const icons: Record<string, React.ReactNode> = {
  standard: <Truck className="w-5 h-5" />,
  express: <Clock className="w-5 h-5" />,
  priority: <Zap className="w-5 h-5" />,
};

interface ShippingOptionsProps {
  selectedShipping: string;
  onSelectShipping: (optionId: string) => void;
}

export function ShippingOptions({ selectedShipping, onSelectShipping }: ShippingOptionsProps) {
  const { methods } = useShippingMethods();
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-dark">Delivery Options</h3>
      {methods.map((option) => (
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
              {icons[option.id]}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-dark text-sm">{option.label}</h4>
                <span className="font-semibold text-dark">
                  {option.priceRupees === 0 ? 'Free' : formatINR(option.priceRupees)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-dark/60">{option.priceRupees === 0 ? 'Free delivery' : 'Faster delivery'}</p>
                <p className="text-xs text-dark/60">{option.eta}</p>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
