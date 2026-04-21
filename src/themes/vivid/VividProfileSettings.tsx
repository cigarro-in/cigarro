import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';
import { SEOHead } from '../../components/seo/SEOHead';

export function VividProfileSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    setName(user.name || '');
    setEmail(user.email || '');
  }, [user, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { name, full_name: name } });
      await supabase.from('profiles').update({ name, email: email || null }).eq('id', user.id);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SEOHead title="Settings" description="Account settings" url="https://cigarro.in/profile/settings" type="website" />

      <div className="max-w-[560px] mx-auto px-4 py-6">
        <header className="vv-page-header">
          <h1 className="vv-page-title">Settings</h1>
          <p className="vv-page-subtitle">Update your personal details.</p>
        </header>

        <form onSubmit={handleSave} className="vv-surface p-5 space-y-5">
          <div>
            <label className="vv-label">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              className="vv-input"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="vv-label">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              className="vv-input"
              placeholder="you@example.com"
            />
            <p className="text-xs text-[var(--vv-fg-subtle)] mt-1.5">
              For order receipts. Phone is your primary identifier.
            </p>
          </div>

          <div>
            <label className="vv-label">Phone</label>
            <input
              type="tel"
              value={user?.phone || ''}
              disabled
              className="vv-input bg-[var(--vv-bg-inset)] text-[var(--vv-fg-muted)] cursor-not-allowed"
            />
            <p className="text-xs text-[var(--vv-fg-subtle)] mt-1.5">
              Contact support to change your phone number.
            </p>
          </div>

          <button type="submit" disabled={saving} className="vv-btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
        </form>
      </div>
    </>
  );
}
