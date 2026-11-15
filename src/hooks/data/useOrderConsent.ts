import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { CONSENT_TEXT_VERSION } from '../../lib/consent/texts';

// One-time order declaration for the signed-in customer in this store.
// needed: true when the customer must confirm before a first order;
// undefined while the status is still loading. Themes never call Convex here.
export function useOrderConsent(orgId: Id<'organizations'> | undefined, enabled: boolean) {
  const status = useQuery(
    api.consent.orderConsentStatus,
    enabled && orgId ? { orgId } : 'skip',
  );
  const mutation = useMutation(api.consent.confirmOrderConsent);

  const confirm = useCallback(() => {
    if (!orgId) return Promise.reject(new Error('STORE_NOT_READY'));
    return mutation({
      orgId,
      textVersion: CONSENT_TEXT_VERSION.orderSheet,
      pagePath: window.location.pathname,
    });
  }, [orgId, mutation]);

  return { needed: status?.needed, confirm };
}
