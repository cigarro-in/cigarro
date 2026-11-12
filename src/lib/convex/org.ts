// Deprecated module-level snapshot of the store identity. Kept so admin
// (client-only) code and App.tsx keep working. It is evaluated once at import
// time on the client, so it must NOT be used by anything that can render on a
// server. Storefront components and hooks use useOrgInfo() from
// src/lib/org/OrgContext.tsx instead.

import { getClientOrgInfo } from '../org/OrgContext';

const CLIENT_ORG = getClientOrgInfo();

/** @deprecated — use useOrgInfo() */
export const IS_SA: boolean = CLIENT_ORG.isSa;

/** @deprecated — use useOrgInfo() */
export const IS_ADMIN_HOST: boolean = CLIENT_ORG.isAdminHost;

/** @deprecated — use useOrgInfo() (store slug from the admin path, if any, is folded into `slug`) */
export const ADMIN_PATH_STORE: string | null =
  CLIENT_ORG.isAdminHost && CLIENT_ORG.basename ? CLIENT_ORG.basename.slice(1) : null;

/** @deprecated — use useOrgInfo().basename */
export const APP_BASENAME: string = CLIENT_ORG.basename;

/** @deprecated — use useOrgInfo().slug */
export const ORG_SLUG: string = CLIENT_ORG.slug;

/** @deprecated — use useOrgInfo().primaryHost */
export const ORG_PRIMARY_HOST: string = CLIENT_ORG.primaryHost;
