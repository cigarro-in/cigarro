import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { getAnonymousId } from '../../lib/consent/anonymousId';

// Consent log access for pages and the age gate. Themes never call Convex for
// consent; they reach it through this hook. See convex/consent.ts.
export function useConsent() {
  const linkMutation = useMutation(api.consent.linkAnonymous);
  const checkoutMutation = useMutation(api.consent.recordCheckoutConsent);

  // Age gate confirm. Goes through the same-origin endpoint so the edge can add
  // the client IP. Fire-and-forget: the gate never waits on, or fails with, logging.
  const recordAgeConfirmation = useCallback((textVersion: string) => {
    const anonymousId = getAnonymousId();
    if (!anonymousId) return;
    fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({
        anonymousId,
        kind: 'age_confirmation',
        granted: true,
        textVersion,
        pagePath: window.location.pathname,
      }),
    }).catch(() => {});
  }, []);

  // Signed-in: copy this visitor's age-gate rows onto the user. Safe to repeat.
  const linkAnonymousConsent = useCallback(
    (orgId: Id<'organizations'>) => {
      const anonymousId = getAnonymousId();
      if (!anonymousId) return Promise.resolve({ linked: 0 });
      return linkMutation({ orgId, anonymousId });
    },
    [linkMutation],
  );

  // Checkout checkbox ("18+ and accept the Terms"). Must succeed before the order is created.
  const recordCheckoutConsent = useCallback(
    (orgId: Id<'organizations'>, textVersion: string) =>
      checkoutMutation({ orgId, textVersion, pagePath: window.location.pathname }),
    [checkoutMutation],
  );

  return { recordAgeConfirmation, linkAnonymousConsent, recordCheckoutConsent };
}
