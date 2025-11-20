import { useState } from 'react';
import { Truck, Save, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';

interface ShippingModalProps {
  order: any;
  onSave: () => void;
  onCancel: () => void;
}

export function ShippingModal({ order, onSave, onCancel }: ShippingModalProps) {
  const [shippingData, setShippingData] = useState({
    shipping_company: order.shipping_company || '',
    tracking_id: order.tracking_id || '',
    tracking_link: order.tracking_link || '',
    shipping_method: order.shipping_method || 'Standard',
    shipping_notes: order.shipping_notes || '',
    estimated_delivery: order.estimated_delivery || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {
        ...shippingData,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        shipped_by: 'admin' // You might want to use actual admin user ID
      };

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;
      
      toast.success('Order shipped successfully');
      onSave();
    } catch (error) {
      console.error('Error updating shipping info:', error);
      toast.error('Failed to update shipping information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="shipping_company">Shipping Company *</Label>
          <Select
            value={shippingData.shipping_company}
            onValueChange={(value: string) => setShippingData(prev => ({ ...prev, shipping_company: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select shipping company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BlueDart">BlueDart</SelectItem>
              <SelectItem value="DTDC">DTDC</SelectItem>
              <SelectItem value="FedEx">FedEx</SelectItem>
              <SelectItem value="Delhivery">Delhivery</SelectItem>
              <SelectItem value="India Post">India Post</SelectItem>
              <SelectItem value="Ecom Express">Ecom Express</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="shipping_method">Shipping Method</Label>
          <Select
            value={shippingData.shipping_method}
            onValueChange={(value: string) => setShippingData(prev => ({ ...prev, shipping_method: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="Express">Express</SelectItem>
              <SelectItem value="Overnight">Overnight</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="tracking_id">Tracking ID *</Label>
        <Input
          id="tracking_id"
          value={shippingData.tracking_id}
          onChange={(e) => setShippingData(prev => ({ ...prev, tracking_id: e.target.value }))}
          placeholder="Enter tracking ID"
          required
        />
      </div>

      <div>
        <Label htmlFor="tracking_link">Tracking Link</Label>
        <Input
          id="tracking_link"
          type="url"
          value={shippingData.tracking_link}
          onChange={(e) => setShippingData(prev => ({ ...prev, tracking_link: e.target.value }))}
          placeholder="https://..."
        />
      </div>

      <div>
        <Label htmlFor="estimated_delivery">Estimated Delivery Date</Label>
        <Input
          id="estimated_delivery"
          type="date"
          value={shippingData.estimated_delivery}
          onChange={(e) => setShippingData(prev => ({ ...prev, estimated_delivery: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="shipping_notes">Shipping Notes</Label>
        <Textarea
          id="shipping_notes"
          value={shippingData.shipping_notes}
          onChange={(e) => setShippingData(prev => ({ ...prev, shipping_notes: e.target.value }))}
          placeholder="Any special instructions or notes..."
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          <Truck className="mr-2 h-4 w-4" />
          {loading ? 'Shipping...' : 'Ship Order'}
        </Button>
      </div>
    </form>
  );
}
