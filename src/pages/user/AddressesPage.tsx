import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { Address } from '../../components/checkout/address/AddressCard';
import { AddressForm } from '../../components/checkout/address/AddressForm';
import { AddressCard } from '../../components/checkout/address/AddressCard';

export function AddressesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAddress = async (addressData: Address) => {
    if (!user) return;

    try {
      const dbData = {
        user_id: user.id,
        full_name: addressData.full_name,
        phone: addressData.phone,
        address: addressData.address,
        pincode: addressData.pincode,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        label: addressData.label,
        is_default: addressData.is_default
      };

      let error;

      if (addressData.id) {
        const { error: updateError } = await supabase
          .from('saved_addresses')
          .update(dbData)
          .eq('id', addressData.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('saved_addresses')
          .insert(dbData);
        error = insertError;
      }

      if (error) throw error;

      toast.success(addressData.id ? 'Address updated' : 'Address added');
      await fetchAddresses();
      setView('list');
      setEditingAddress(null);
    } catch (err) {
      console.error('Error saving address:', err);
      toast.error('Failed to save address');
    }
  };

  const handleDeleteAddress = async (id: string) => {
      if (!confirm('Are you sure you want to delete this address?')) return;
      
      try {
          const { error } = await supabase
            .from('saved_addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', user!.id);
            
          if (error) throw error;
          
          toast.success('Address deleted');
          fetchAddresses();
      } catch (error) {
          console.error('Error deleting address:', error);
          toast.error('Failed to delete address');
      }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Addresses - Cigarro</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Header */}
        <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-2xl md:text-3xl">My Addresses</h1>
              {view === 'list' && (
                <Button onClick={() => {
                  setEditingAddress(null);
                  setView('form');
                }} className="bg-dark text-creme-light hover:bg-canyon">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {view === 'list' ? (
            <>
              {addresses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-serif text-xl mb-2">No saved addresses</h3>
                  <p className="text-muted-foreground mb-6">
                    Add a delivery address to speed up your checkout.
                  </p>
                  <Button onClick={() => setView('form')} className="bg-dark text-creme-light hover:bg-canyon">
                    Add New Address
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="relative group">
                        <AddressCard
                          address={addr}
                          isSelected={false}
                          onSelect={() => {}}
                          onEdit={() => {
                            setEditingAddress(addr);
                            setView('form');
                          }}
                        />
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (addr.id) handleDeleteAddress(addr.id);
                            }}
                            className="absolute top-3 right-14 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 font-medium"
                        >
                            Delete
                        </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Card className="border-2 border-border/40">
              <CardContent className="p-6">
                <div className="mb-6">
                   <h2 className="font-serif text-xl">{editingAddress ? 'Edit Address' : 'Add New Address'}</h2>
                </div>
                <AddressForm
                  userId={user?.id || ''}
                  initialData={editingAddress}
                  defaultValues={{
                    full_name: (user as any)?.user_metadata?.full_name || '',
                    phone: (user as any)?.user_metadata?.phone || ''
                  }}
                  onSave={handleSaveAddress}
                  onCancel={() => {
                    setView('list');
                    setEditingAddress(null);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
