import { writeStoredPreference } from '../../lib/browserStorage';
import { useState } from 'react';
import { ShieldCheck, Cigarette } from 'lucide-react';
import { DEFAULT_AGE_GATE, type StoreSettings } from '../../lib/storeSettings';
import { siteConfig } from '../../config/site';

interface Props {
  onVerify: () => void;
  ageGate?: StoreSettings['ageGate'];
  siteName?: string;
}

// Same key the index.html inline script reads before first paint (data-ageok).
const AGE_KEY = 'ageVerified';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Remember the confirmation for a year: localStorage plus a long-lived cookie. Never throws. */
function rememberAgeVerified(): void {
  writeStoredPreference(AGE_KEY, 'true');
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${AGE_KEY}=true; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked: localStorage (above) still remembers the visitor.
  }
}

export function VividAgeVerification({
  onVerify,
  ageGate = DEFAULT_AGE_GATE,
  siteName = siteConfig.name,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleYes = () => {
    if (confirming) return;
    setConfirming(true);
    rememberAgeVerified();
    setTimeout(onVerify, 200);
  };

  const handleNo = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center p-4"
      style={{ background: '#0f0f12' }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white shadow-2xl">
        <div className="h-1 w-full bg-[#2563eb]" />
        <div className="p-6 sm:p-7 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#eff6ff] text-[#2563eb] grid place-items-center">
            <Cigarette className="w-6 h-6" />
          </div>

          {/* Not an h1: the page's own heading is the single h1 (SSR keeps one per page). */}
          <p className="text-xl font-bold tracking-tight text-[#0f0f12] mb-1">
            {siteName}
          </p>
          <p className="text-xs uppercase tracking-[0.12em] text-[#6b7280] mb-6">
            Premium tobacco marketplace
          </p>

          <h2 className="text-lg font-bold text-[#0f0f12] mb-2">Are you {ageGate.minAge} or older?</h2>
          <p className="text-sm text-[#585966] leading-relaxed mb-6">
            This site sells tobacco products. Entry is restricted to adults of legal age
            per Indian law. By continuing you confirm you meet this requirement.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleNo}
              className="min-h-[44px] rounded-[10px] border border-[#e7e8ec] text-[#0f0f12] font-semibold text-sm hover:bg-[#f1f2f4] transition"
            >
              I'm under {ageGate.minAge}
            </button>
            <button
              type="button"
              onClick={handleYes}
              disabled={confirming}
              className="min-h-[44px] rounded-[10px] bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] active:scale-[0.98] transition-all disabled:opacity-70"
            >
              Yes, I am {ageGate.minAge}+
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-[#e7e8ec] flex items-center justify-center gap-2 text-[11px] text-[#5f6068]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Your answer is remembered on this device for a year
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[#5f6068]">
            Continuing confirms you are {ageGate.minAge}+ and accept our use of cookies.{' '}
            <a href="/privacy" className="underline underline-offset-2">Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
