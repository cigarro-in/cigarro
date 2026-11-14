import { readStoredPreference, writeStoredPreference } from '../../lib/browserStorage';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Shield, MapPin, FileText, AlertCircle, Crown } from 'lucide-react';
import { DEFAULT_AGE_GATE, ageRuleLabel, type StoreSettings } from '../../lib/storeSettings';
import { siteConfig } from '../../config/site';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Full-screen age-gate overlay. The page underneath stays mounted (crawlers
 * and humans get the same DOM); the caller marks the app content `inert` while
 * this is shown. This component owns the dialog semantics: focus trap, Escape
 * ignored, body scroll lock (scrollbar width compensated so nothing shifts),
 * and focus restore on close. It never changes layout: it is position:fixed.
 */
export function AgeGateOverlay({ label, children }: { label: string; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Deliberately inert: the gate can only be passed by confirming.
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !active || !dialog.contains(active);
      if (e.shiftKey) {
        if (outside || active === first || active === dialog) {
          e.preventDefault();
          last.focus();
        }
      } else if (outside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="fixed inset-0 z-[9999] bg-creme outline-none"
    >
      {children}
    </div>
  );
}

interface AgeVerificationProps {
  onVerify: () => void;
  ageGate?: StoreSettings['ageGate'];
  siteName?: string;
}

export function AgeVerification({
  onVerify,
  ageGate = DEFAULT_AGE_GATE,
  siteName = siteConfig.name,
}: AgeVerificationProps) {
  const rule = ageRuleLabel(ageGate);
  const [isExiting, setIsExiting] = useState(false);

  const handleVerify = () => {
    if (isExiting) return;
    // Store age verification in local storage (persistent)
    writeStoredPreference('ageVerified', 'true');
    
    // Also set cookie consent as implied by using the site if needed
    if (!readStoredPreference('cookie_consent')) {
        writeStoredPreference('cookie_consent', JSON.stringify({
            necessary: true,
            analytics: true,
            marketing: true,
            timestamp: new Date().toISOString()
        }));
    }

    setIsExiting(true);
    setTimeout(onVerify, 300);
  };

  return (
    // Plain CSS fade on exit (opacity only, compositor-friendly). The gate is
    // visible from the server markup on: no entrance animation to wait for.
    <div
      className={`fixed inset-0 z-[100] bg-creme overflow-y-auto scrollbar-hide transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="min-h-full flex items-center justify-center p-4 md:p-8">
        <div
          className="w-full max-w-2xl bg-creme-light border border-coyote shadow-[0_2px_0_rgba(67,60,53,0.1)] rounded-xl overflow-hidden relative z-10"
        >
          {/* Header - Warning */}
          <div className="bg-canyon/10 p-6 border-b border-canyon/20 text-center">
              <div className="flex justify-center mb-4">
                  <Crown className="w-10 h-10 text-canyon" strokeWidth={1.5} />
              </div>
              <h2 className="text-canyon font-serif text-2xl md:text-3xl leading-tight mb-2">
                  Smoking is injurious to health.
              </h2>
              <p className="text-canyon font-sans text-sm uppercase tracking-wider font-bold">
                  {siteName} does not promote tobacco use.
              </p>
          </div>

          {/* Content Body */}
          <div className="p-6 md:p-10">
              <p className="text-dark font-serif text-lg md:text-xl text-center mb-8 leading-relaxed">
                  By entering this marketplace, I <span className="font-bold underline decoration-canyon/30 underline-offset-4">confirm and agree</span> to the following:
              </p>

              <div className="space-y-6">
                  {/* Item 1 - Age */}
                  <div className="flex gap-5 items-start group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-creme border border-coyote flex items-center justify-center font-serif font-bold text-canyon text-sm group-hover:bg-canyon group-hover:text-creme-light transition-colors duration-300">
                          {ageGate.minAge}+
                      </div>
                      <p className="text-dark/80 font-sans text-sm md:text-base leading-relaxed pt-1">
                          I am over the age of {rule} years and am not purchasing tobacco products for anyone underage, understanding that doing so is a criminal offense.
                      </p>
                  </div>

                  {/* Item 2 - Location */}
                  <div className="flex gap-5 items-start group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-creme border border-coyote flex items-center justify-center text-dark group-hover:bg-dark group-hover:text-creme-light transition-colors duration-300">
                          <MapPin size={18} strokeWidth={1.5} />
                      </div>
                      <p className="text-dark/80 font-sans text-sm md:text-base leading-relaxed pt-1">
                          I confirm that the delivery location is not within 100m away from any educational premises, and I am fully responsible for ensuring this.
                      </p>
                  </div>

                  {/* Item 3 - ID Proof */}
                  <div className="flex gap-5 items-start group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-creme border border-coyote flex items-center justify-center text-dark group-hover:bg-dark group-hover:text-creme-light transition-colors duration-300">
                          <Shield size={18} strokeWidth={1.5} />
                      </div>
                      <p className="text-dark/80 font-sans text-sm md:text-base leading-relaxed pt-1">
                          I acknowledge that the delivery executive may request valid age proof to confirm I am over {rule}, and I will comply.
                      </p>
                  </div>

                  {/* Item 4 - Transgressions */}
                  <div className="flex gap-5 items-start group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-creme border border-coyote flex items-center justify-center text-canyon group-hover:bg-canyon group-hover:text-creme-light transition-colors duration-300">
                          <AlertCircle size={18} strokeWidth={1.5} />
                      </div>
                      <p className="text-dark/80 font-sans text-sm md:text-base leading-relaxed pt-1">
                          {siteName} reserves the right to report my account in case of any transgressions.
                      </p>
                  </div>

                  {/* Item 5 - T&C */}
                  <div className="flex gap-5 items-start group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-creme border border-coyote flex items-center justify-center text-dark group-hover:bg-dark group-hover:text-creme-light transition-colors duration-300">
                          <FileText size={18} strokeWidth={1.5} />
                      </div>
                      <p className="text-dark/80 font-sans text-sm md:text-base leading-relaxed pt-1">
                          I have read the <a href="/terms" className="text-canyon font-bold hover:underline">Terms & Conditions</a> and acknowledge my compliance with them.
                      </p>
                  </div>
              </div>
          </div>

          {/* Footer Button */}
          <div className="p-6 md:p-10 border-t border-coyote/20 bg-creme/30">
              <p className="text-center text-dark/60 font-sans text-xs md:text-sm leading-relaxed mb-4">
                  Proceeding confirms you are {ageGate.minAge}+ and accept our use of cookies. <a href="/privacy" className="underline underline-offset-2">Privacy</a>
              </p>
              <Button
                  onClick={handleVerify}
                  disabled={isExiting}
                  className="w-full bg-dark text-creme-light hover:bg-canyon hover:text-creme-light py-6 md:py-7 rounded-full font-sans font-medium text-base md:text-lg tracking-wide uppercase transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                  Confirm and Proceed
              </Button>
          </div>
        </div>
      </div>
      
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-50">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-canyon/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-canyon/5 to-transparent" />
      </div>
    </div>
  );
}
