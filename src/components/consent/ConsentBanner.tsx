import { useState } from 'react';
import { getConsent, setConsent } from '../../lib/analytics/ga';

// Analytics consent banner (DPDP-safe): analytics stays OFF until the
// visitor explicitly accepts. Choice persists in localStorage.
export function ConsentBanner() {
  const [visible, setVisible] = useState(() => getConsent() === null);
  if (!visible) return null;

  const choose = (choice: 'granted' | 'denied') => {
    setConsent(choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed bottom-0 inset-x-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-2xl rounded-xl bg-dark text-creme shadow-2xl border border-coyote/30 p-4 sm:p-5">
        <p className="text-sm leading-relaxed">
          We use privacy-friendly analytics to understand which products and
          guides are useful. No ads, no cross-site tracking. Accept to help us
          improve — see our <a href="/privacy" className="underline underline-offset-2">privacy policy</a>.
        </p>
        <div className="mt-3 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="rounded-full px-5 py-2 text-sm font-medium border border-creme/40 hover:bg-creme/10 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="rounded-full px-5 py-2 text-sm font-semibold bg-creme text-dark hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
