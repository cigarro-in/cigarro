import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMyProfile } from '../../hooks/data/useMyProfile';
import { SEOHead } from '../../components/seo/SEOHead';
import { useActionFeedback } from './useActionFeedback';

export function VividProfileSettings() {
  const { user } = useAuth();
  const { updateDisplayName } = useMyProfile();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const save = useActionFeedback();
  const saving = save.busy;

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    setName(user.name || '');
    setEmail(user.email || '');
  }, [user, navigate]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    // Display name lives in Convex (Phase 1 spine) via useMyProfile. Email is read-only here (contact
    // support to change), mirroring the classic settings page.
    void save.run(() => updateDisplayName(name || undefined), 'Could not save. Try again.');
  };

  return (
    <>
      <SEOHead title="Settings" description="Account settings" url="/profile/settings" type="website" />

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

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={saving}
              aria-live="polite"
              className={`vv-btn-primary w-full ${save.state === 'done' ? '!bg-[var(--vv-success)] !border-[var(--vv-success)]' : ''} ${save.state === 'error' ? '!bg-[var(--vv-danger)] !border-[var(--vv-danger)]' : ''}`}
            >
              {save.state === 'pending' && <Loader2 className="w-4 h-4 animate-spin" />}
              {save.state === 'done' && <Check className="w-4 h-4" strokeWidth={3} />}
              {(save.state === 'idle' || save.state === 'error') && <Save className="w-4 h-4" />}
              {save.state === 'pending' ? 'Saving...' : save.state === 'done' ? 'Saved' : save.state === 'error' ? 'Try again' : 'Save changes'}
            </button>
            {save.error && (
              <p role="alert" className="text-sm text-[var(--vv-danger)] text-center">{save.error}</p>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
