// Typed references for convex/platform.ts. Written by hand because the
// generated api.d.ts lists modules only after `npx convex dev` codegen runs.
import { makeFunctionReference } from 'convex/server';
import type { Id } from '../../convex/_generated/dataModel';

export type Role = 'customer' | 'staff' | 'admin' | 'owner';

export interface StoreRow {
  _id: Id<'organizations'>;
  slug: string;
  name: string;
  active: boolean;
  upiVpa: string;
  bankEmailAlias: string;
  createdAt: number;
  domainCount: number;
  memberCount: number;
  primaryHost: string | null;
  primaryStatus: 'pending' | 'active' | 'disabled' | null;
}

export interface MemberRow {
  _id: Id<'memberships'>;
  userId: string;
  role: Role;
  phone: string | null;
  name: string | null;
  createdAt: number;
}

export const listStoresRef = makeFunctionReference<'query', { saToken: string }, StoreRow[]>(
  'platform:listStores',
);
export const createStoreRef = makeFunctionReference<
  'mutation',
  { saToken: string; slug: string; name: string; upiVpa?: string },
  Id<'organizations'>
>('platform:createStore');
export const setStoreActiveRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; active: boolean },
  Id<'organizations'>
>('platform:setStoreActive');
export const listMembersRef = makeFunctionReference<
  'query',
  { saToken: string; orgId: Id<'organizations'> },
  MemberRow[]
>('platform:listMembers');
export const addStoreAdminRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; phone: string; role: Role },
  { membershipId: Id<'memberships'>; userId: string }
>('platform:addStoreAdmin');
export const removeMemberRef = makeFunctionReference<
  'mutation',
  { saToken: string; membershipId: Id<'memberships'> },
  Id<'memberships'>
>('platform:removeMember');

// convex/domains.ts (super-admin variants). Typed by hand: the generated api
// may predate the module.
export interface DomainRow {
  _id: Id<'orgDomains'>;
  orgId: Id<'organizations'>;
  hostname: string;
  kind: 'primary' | 'alias';
  status: 'pending' | 'active' | 'disabled';
  verifiedAt?: number;
}

export const listDomainsRef = makeFunctionReference<
  'query',
  { saToken: string; orgId: Id<'organizations'> },
  DomainRow[]
>('domains:listDomains');
export const addDomainRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; hostname: string; kind: 'primary' | 'alias' },
  Id<'orgDomains'>
>('domains:addDomain');
export const setDomainStatusRef = makeFunctionReference<
  'mutation',
  { saToken: string; domainId: Id<'orgDomains'>; status: 'pending' | 'active' | 'disabled' },
  Id<'orgDomains'>
>('domains:setDomainStatus');
export const removeDomainRef = makeFunctionReference<
  'mutation',
  { saToken: string; domainId: Id<'orgDomains'> },
  Id<'orgDomains'>
>('domains:removeDomain');
