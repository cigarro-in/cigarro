import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import { useSa } from '../SuperGate';
import { saErrorMessage } from '../session';
import { createStoreRef, listStoresRef, setStoreActiveRef, type StoreRow } from '../refs';

export function StoresPage() {
  const { token, writeOpen } = useSa();
  const stores = useQuery(listStoresRef, { saToken: token });
  const createStore = useMutation(createStoreRef);
  const setActive = useMutation(setStoreActiveRef);
  const status = useInlineStatus();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [busy, setBusy] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createStore({ saToken: token, slug, name, upiVpa: upiVpa || undefined });
      status.setOk(`Created store "${slug}". Add its domain and members next.`);
      setSlug('');
      setName('');
      setUpiVpa('');
    } catch (err) {
      status.setError(saErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (store: StoreRow) => {
    try {
      await setActive({ saToken: token, orgId: store._id, active: !store.active });
      status.setOk(store.active ? `Deactivated ${store.slug}.` : `Activated ${store.slug}.`);
    } catch (err) {
      status.setError(saErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Stores</h1>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Create store</h2>
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-4 items-end">
          <div>
            <Label htmlFor="sa-slug">Slug</Label>
            <Input id="sa-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-store" required disabled={!writeOpen} />
          </div>
          <div>
            <Label htmlFor="sa-name">Name</Label>
            <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={!writeOpen} />
          </div>
          <div>
            <Label htmlFor="sa-vpa">UPI VPA (optional)</Label>
            <Input id="sa-vpa" value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="store@ybl" disabled={!writeOpen} />
          </div>
          <Button type="submit" disabled={!writeOpen || busy}>{busy ? 'Creating...' : 'Create store'}</Button>
        </form>
        <InlineStatus status={status.status} />
      </section>

      {stores === undefined ? (
        <p className="text-sm text-muted-foreground">Loading stores...</p>
      ) : stores.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stores yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Primary host</TableHead>
              <TableHead>Domains</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map((s) => (
              <TableRow key={s._id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{s.slug}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {s.primaryHost ?? '-'}
                  {s.primaryStatus && <span className="text-muted-foreground"> ({s.primaryStatus})</span>}
                </TableCell>
                <TableCell>{s.domainCount}</TableCell>
                <TableCell>{s.memberCount}</TableCell>
                <TableCell>
                  <Badge variant={s.active ? 'default' : 'secondary'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Link to={`/sa/stores/${s._id}`} className="underline text-sm">Manage</Link>
                  <Button variant="secondary" size="sm" disabled={!writeOpen} onClick={() => void onToggle(s)}>
                    {s.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
