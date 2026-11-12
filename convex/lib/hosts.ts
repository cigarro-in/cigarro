// Pure hostname routing rules. No Convex imports so this is unit-testable
// with plain node (see convex/domains.ts for the Convex wrappers).

export const RESERVED_LABELS: ReadonlySet<string> = new Set([
  "www",
  "admin",
  "auth",
  "api",
  "cdn",
  "pay",
  "mail",
  "app",
  "static",
]);

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type HostOrg<Id extends string> = {
  _id: Id;
  slug: string;
  name: string;
  active: boolean;
};

export type HostDomain<Id extends string> = {
  orgId: Id;
  hostname: string;
  kind: "primary" | "alias";
  status: "pending" | "active" | "disabled";
};

export type HostLookups<Id extends string> = {
  domainByHost(hostname: string): Promise<HostDomain<Id> | null> | HostDomain<Id> | null;
  activePrimaryHost(orgId: Id): Promise<string | null> | string | null;
  orgBySlug(slug: string): Promise<HostOrg<Id> | null> | HostOrg<Id> | null;
  orgById(orgId: Id): Promise<HostOrg<Id> | null> | HostOrg<Id> | null;
};

export type HostConfig = {
  platformRoot: string;
  defaultOrgSlug: string;
};

export type ResolvedHost<Id extends string> = {
  orgId: Id;
  slug: string;
  name: string;
  primaryHost: string;
  isPrimary: boolean;
  redirectTo: string | null;
};

// Lowercase, trim, strip a trailing :port and any trailing dots.
export function normalizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.+$/, "");
}

export function isValidHostname(host: string): boolean {
  return HOSTNAME_RE.test(host);
}

// "reserved" = never assignable to any org (internal labels, localhost, pages.dev).
// "platform" = under the platform root (bare root or *.root); only aliases allowed.
// "none"     = a customer-owned host.
export function hostRestriction(
  host: string,
  platformRoot: string,
): "none" | "reserved" | "platform" {
  const root = normalizeHost(platformRoot);
  if (host === "localhost" || host === "127.0.0.1") return "reserved";
  if (host === "pages.dev" || host.endsWith(".pages.dev")) return "reserved";
  if (!root) return "none";
  if (host === root) return "platform";
  if (host.endsWith("." + root)) {
    const label = host.slice(0, -(root.length + 1));
    return RESERVED_LABELS.has(label) ? "reserved" : "platform";
  }
  return "none";
}

// Pure resolution decision. Order: exact active domain -> platform subdomain
// -> local/preview hosts -> null. Returns only public fields.
export async function resolveHostDecision<Id extends string>(
  rawHost: string,
  lookups: HostLookups<Id>,
  config: HostConfig,
): Promise<ResolvedHost<Id> | null> {
  const host = normalizeHost(rawHost);
  if (!host) return null;
  const root = normalizeHost(config.platformRoot);

  // (a) exact match on an active orgDomains row.
  const exact = await lookups.domainByHost(host);
  if (exact && exact.status === "active") {
    const org = await lookups.orgById(exact.orgId);
    if (!org || !org.active) return null;
    if (exact.kind === "primary") {
      return {
        orgId: org._id,
        slug: org.slug,
        name: org.name,
        primaryHost: host,
        isPrimary: true,
        redirectTo: null,
      };
    }
    const primary = await lookups.activePrimaryHost(org._id);
    return {
      orgId: org._id,
      slug: org.slug,
      name: org.name,
      primaryHost: primary ?? host,
      isPrimary: false,
      redirectTo: primary && primary !== host ? primary : null,
    };
  }

  // (b) <label>.<platform root>, label not reserved.
  if (root && host.endsWith("." + root)) {
    const label = host.slice(0, -(root.length + 1));
    if (LABEL_RE.test(label) && !RESERVED_LABELS.has(label)) {
      const org = await lookups.orgBySlug(label);
      if (!org || !org.active) return null;
      const primary = await lookups.activePrimaryHost(org._id);
      if (primary && primary !== host) {
        return {
          orgId: org._id,
          slug: org.slug,
          name: org.name,
          primaryHost: primary,
          isPrimary: false,
          redirectTo: primary,
        };
      }
      return {
        orgId: org._id,
        slug: org.slug,
        name: org.name,
        primaryHost: host,
        isPrimary: true,
        redirectTo: null,
      };
    }
  }

  // (b2) the platform root itself (and www.<root>) with no orgDomains row:
  // serve the default org so the platform host never 404s before any
  // orgDomains rows exist. www redirects to the apex.
  if (root && (host === root || host === "www." + root)) {
    const org = await lookups.orgBySlug(config.defaultOrgSlug);
    if (!org || !org.active) return null;
    const isApex = host === root;
    return {
      orgId: org._id,
      slug: org.slug,
      name: org.name,
      primaryHost: root,
      isPrimary: isApex,
      redirectTo: isApex ? null : root,
    };
  }

  // (c) local development and Cloudflare Pages preview hosts.
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".pages.dev")) {
    const org = await lookups.orgBySlug(config.defaultOrgSlug);
    if (!org || !org.active) return null;
    return {
      orgId: org._id,
      slug: org.slug,
      name: org.name,
      primaryHost: host,
      isPrimary: true,
      redirectTo: null,
    };
  }

  // (d) unknown host.
  return null;
}

// ---------- Canonical URL classification (pure) ----------
// Storefront routes that a canonicalUrl can point at (src/config/routes.ts).
// Brands/categories carry no canonicalUrl field, so only these two apply.
export type CanonicalRef = { type: "product" | "blog"; slug: string };

export type ParsedCanonical =
  | { kind: "invalid" } // not an absolute https URL with a valid host
  | { kind: "external" } // absolute https URL on a host this store does not own
  | { kind: "store"; ref: CanonicalRef | null }; // store host; ref null = unroutable path

// Hosts that serve this org's storefront: active orgDomains rows, the
// <slug>.<platform root> subdomain, and (for the default org) the platform
// root and www.<root>.
export function storeHostSet(opts: {
  orgSlug: string;
  activeHostnames: string[];
  platformRoot: string;
  defaultOrgSlug: string;
}): Set<string> {
  const hosts = new Set(opts.activeHostnames.map(normalizeHost));
  const root = normalizeHost(opts.platformRoot);
  if (root) {
    hosts.add(`${opts.orgSlug}.${root}`);
    if (opts.orgSlug === opts.defaultOrgSlug) {
      hosts.add(root);
      hosts.add(`www.${root}`);
    }
  }
  return hosts;
}

export function parseCanonicalUrl(
  raw: string,
  storeHosts: ReadonlySet<string>,
): ParsedCanonical {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { kind: "invalid" };
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    return { kind: "invalid" };
  }
  const host = normalizeHost(url.hostname);
  if (!isValidHostname(host)) return { kind: "invalid" };
  if (!storeHosts.has(host)) return { kind: "external" };

  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length !== 2) return { kind: "store", ref: null };
  let slug: string;
  try {
    slug = decodeURIComponent(segs[1]);
  } catch {
    return { kind: "store", ref: null };
  }
  if (!slug) return { kind: "store", ref: null };
  if (segs[0] === "product") return { kind: "store", ref: { type: "product", slug } };
  if (segs[0] === "blog") return { kind: "store", ref: { type: "blog", slug } };
  return { kind: "store", ref: null };
}
