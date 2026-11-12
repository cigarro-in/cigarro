import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAdminStores } from './hooks/useAdminStores';

const STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

/**
 * admin.<root>/ with no store in the path. Signed in: lists the stores this
 * number administers. Signed out: asks for the store ID, then that store's
 * own sign-in page takes over (the login must be scoped to one store).
 */
export function StorePicker() {
  const { user, isLoading, signOut } = useAuth();
  const { stores, loading } = useAdminStores();
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return null;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug = storeId.trim().toLowerCase();
    if (!STORE_SLUG_RE.test(slug)) {
      setError('Enter the store ID from your admin link.');
      return;
    }
    window.location.assign(`/${slug}/`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-creme px-4">
      <div className="w-full max-w-sm space-y-4">
        <p className="font-bold text-lg text-center">Cigarro Admin</p>

        {!user && (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-sm text-muted-foreground" htmlFor="store-id">
              Store ID
            </label>
            <input
              id="store-id"
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                setError(null);
              }}
              autoComplete="organization"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. smokeshop"
              className="h-11 w-full rounded-xl border px-3 text-base bg-background"
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-canyon text-creme font-semibold text-base"
            >
              Continue
            </button>
          </form>
        )}

        {user && loading && <p className="text-sm text-center text-muted-foreground">Loading stores...</p>}

        {user && !loading && stores.length === 0 && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {user.phone || 'This number'} is not an admin of any store.
            </p>
            <button
              onClick={() => void signOut()}
              className="h-11 px-6 rounded-xl border font-semibold text-base"
            >
              Sign out
            </button>
          </div>
        )}

        {user && !loading && stores.length > 0 && (
          <ul className="space-y-2">
            {stores.map((store) => (
              <li key={store.slug}>
                <a
                  href={`/${store.slug}/`}
                  className="flex h-11 items-center justify-between rounded-xl border bg-background px-4 font-semibold text-base"
                >
                  <span className="truncate">{store.name}</span>
                  <span className="text-xs text-muted-foreground">{store.slug}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
