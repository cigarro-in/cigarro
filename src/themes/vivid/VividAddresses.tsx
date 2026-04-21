import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Pencil, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { SEOHead } from '../../components/seo/SEOHead';
import { AddressForm } from '../../components/checkout/address/AddressForm';
import type { Address } from '../../components/checkout/address/AddressCard';

export function VividAddresses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Address | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetch() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load addresses');
    setAddresses((data as any) || []);
    setLoading(false);
  }

  async function save(data: Address) {
    if (!user) return;
    const payload = {
      user_id: user.id,
      full_name: data.full_name,
      phone: data.phone,
      address: data.address,
      pincode: data.pincode,
      city: data.city,
      state: data.state,
      country: data.country,
      label: data.label,
      is_default: data.is_default,
    };
    const { error } = data.id
      ? await supabase.from('saved_addresses').update(payload).eq('id', data.id)
      : await supabase.from('saved_addresses').insert(payload);
    if (error) return toast.error('Failed to save');
    toast.success(data.id ? 'Address updated' : 'Address added');
    await fetch();
    setView('list');
    setEditing(null);
  }

  async function remove(id?: string) {
    if (!id || !user) return;
    if (!confirm('Delete this address?')) return;
    const { error } = await supabase.from('saved_addresses').delete().eq('id', id).eq('user_id', user.id);
    if (error) return toast.error('Failed to delete');
    toast.success('Address deleted');
    fetch();
  }

  return (
    <>
      <SEOHead title="Addresses" description="Saved delivery addresses" url="https://cigarro.in/addresses" type="website" />

      <div className="max-w-[720px] mx-auto px-4 py-6">
        <header className="vv-page-header flex items-start justify-between gap-4">
          <div>
            <h1 className="vv-page-title">Addresses</h1>
            <p className="vv-page-subtitle">Where should we deliver your orders?</p>
          </div>
          {view === 'list' && (
            <button
              onClick={() => {
                setEditing(null);
                setView('form');
              }}
              className="vv-btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add new</span>
            </button>
          )}
        </header>

        {view === 'form' ? (
          <div className="vv-surface p-5">
            <h2 className="text-lg font-bold text-[var(--vv-fg)] mb-4">
              {editing ? 'Edit address' : 'New address'}
            </h2>
            <AddressForm
              userId={user?.id || ''}
              initialData={editing}
              defaultValues={{
                full_name: user?.name || '',
                phone: user?.phone || '',
              }}
              onSave={save}
              onCancel={() => {
                setView('list');
                setEditing(null);
              }}
            />
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="vv-card p-4 space-y-2">
                <div className="h-4 w-1/3 vv-skeleton" />
                <div className="h-3 w-2/3 vv-skeleton" />
                <div className="h-3 w-1/2 vv-skeleton" />
              </div>
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <div className="vv-empty">
            <div className="vv-empty-icon"><MapPin className="w-6 h-6" /></div>
            <p className="vv-empty-title">No saved addresses</p>
            <p className="text-sm">Add one to speed up checkout.</p>
            <button onClick={() => setView('form')} className="vv-btn-primary mt-5 inline-flex">
              Add new address
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((a) => (
              <div key={a.id} className="vv-card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--vv-fg)] font-semibold text-sm">{a.full_name}</span>
                    {a.label && (
                      <span className="vv-badge vv-badge--neutral">{a.label}</span>
                    )}
                    {a.is_default && (
                      <span className="vv-badge vv-badge--success">
                        <Check className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditing(a);
                        setView('form');
                      }}
                      className="w-8 h-8 rounded-md text-[var(--vv-fg-muted)] hover:bg-[var(--vv-bg-inset)] grid place-items-center"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(a.id)}
                      className="w-8 h-8 rounded-md text-[var(--vv-fg-muted)] hover:bg-[var(--vv-danger-soft)] hover:text-[var(--vv-danger)] grid place-items-center"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-[var(--vv-fg-muted)] leading-snug">
                  {a.address}, {a.city}, {a.state} — {a.pincode}
                </p>
                <p className="text-xs text-[var(--vv-fg-subtle)] mt-1">{a.phone}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
