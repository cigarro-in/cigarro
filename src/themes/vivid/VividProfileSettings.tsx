import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2 } from 'lucide-react';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { useAuth } from '../../hooks/useAuth';
import { useMyProfile } from '../../hooks/data/useMyProfile';
import { SEOHead } from '../../components/seo/SEOHead';

export function VividProfileSettings() {
  const { user } = useAuth();
  const { updateDisplayName } = useMyProfile();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

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
      // Theme files must not touch Supabase: display name lives in Convex
      // (Phase 1 spine) via useMyProfile. Email is read-only here (contact
      // support to change), mirroring the classic settings page.
      await updateDisplayName(name || undefined);
      setOpOk('Profile updated');
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to update');
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
          <InlineStatus status={opStatus} />
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
              disabled
              className="vv-input bg-[var(--vv-bg-inset)] text-[var(--vv-fg-muted)] cursor-not-allowed"
              placeholder="you@example.com"
            />
            <p className="text-xs text-[var(--vv-fg-subtle)] mt-1.5">
              For order receipts. To change email, please contact support.
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
