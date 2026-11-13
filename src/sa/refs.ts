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
  primaryStatus: DomainStatus | null;
}

export interface MemberRow {
  _id: Id<'memberships'>;
  userId: string;
  role: Role;
  phone: string | null;
  name: string | null;
  createdAt: number;
}

export interface MigrationRow {
  _id: Id<'migrations'>;
  name: string;
  status: 'done' | 'failed';
  result: string | null;
  runs: number;
  updatedAt: number;
}

export const listMigrationsRef = makeFunctionReference<
  'query',
  { saToken: string },
  MigrationRow[]
>('platform:listMigrations');
export const runPendingMigrationsRef = makeFunctionReference<
  'action',
  { saToken: string },
  Record<string, string>
>('platform:runPendingMigrations');

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
export interface DnsInstructions {
  cnameTarget: string;
  txtRecords: { name: string; value: string }[];
}

// Derived from Cloudflare only. "disabled" is a legacy value.
export type DomainStatus = 'pending' | 'active' | 'disabled' | 'error';

export interface DomainStatusChange {
  status: DomainStatus;
  at: number;
  cfStatus?: string;
}

export interface DomainRow {
  _id: Id<'orgDomains'>;
  orgId: Id<'organizations'>;
  hostname: string;
  kind: 'primary' | 'alias';
  status: DomainStatus;
  verifiedAt?: number;
  // Platform-generated <slug>.<platform root> row.
  managed?: boolean;
  // True when Cloudflare Pages registration applies (false for cigarro.in, www).
  cfManaged: boolean;
  cfStatus?: string;
  cfError?: string;
  cfCheckedAt?: number;
  lastActiveAt?: number;
  statusHistory?: DomainStatusChange[];
  dnsInstructions?: DnsInstructions;
}

export interface AllDomainRow extends DomainRow {
  storeName: string;
  storeSlug: string;
  storeActive: boolean;
}

export interface ProvisionSubdomainResult {
  created: boolean;
  hostname: string | null;
  reason: string | null;
}

export const listDomainsRef = makeFunctionReference<
  'query',
  { saToken: string; orgId: Id<'organizations'> },
  DomainRow[]
>('domains:listDomains');
export const addDomainRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; hostname: string },
  Id<'orgDomains'>
>('domains:addDomain');
export const listAllDomainsRef = makeFunctionReference<
  'query',
  { saToken: string },
  AllDomainRow[]
>('domains:listAllDomains');
export const provisionSubdomainRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'> },
  ProvisionSubdomainResult
>('domains:provisionSubdomain');
export const setPrimaryRef = makeFunctionReference<
  'mutation',
  { saToken: string; domainId: Id<'orgDomains'> },
  Id<'orgDomains'>
>('domains:setPrimary');
export const refreshDomainStatusRef = makeFunctionReference<
  'action',
  { saToken: string; domainId: Id<'orgDomains'> },
  { cfStatus: string }
>('domains:refreshDomainStatus');
export const removeDomainRef = makeFunctionReference<
  'action',
  { saToken: string; domainId: Id<'orgDomains'> },
  Id<'orgDomains'>
>('domains:removeDomain');

// ---- Catalog import (convex/storeImport.ts). Batches are sent one at a time by StoreImportPage.
import type {
  BlogItem,
  CategoryItem,
  HeroSlideItem,
  ProductItem,
  SiteSettingsPatch,
} from '../lib/storeImport/dukaan';

export const importCategoriesRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; items: CategoryItem[] },
  { created: number; updated: number }
>('storeImport:importCategories');
export const importProductsRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; items: ProductItem[] },
  {
    products: { created: number; updated: number };
    variants: { created: number; updated: number };
    links: number;
  }
>('storeImport:importProducts');
export const importHeroSlidesRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; items: HeroSlideItem[] },
  { replaced: number; created: number }
>('storeImport:importHeroSlides');
export const importBlogPostsRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'>; items: BlogItem[] },
  { created: number; updated: number }
>('storeImport:importBlogPosts');
export const importSiteSettingsRef = makeFunctionReference<
  'mutation',
  { saToken: string; orgId: Id<'organizations'> } & SiteSettingsPatch,
  { updated: boolean }
>('storeImport:importSiteSettings');
