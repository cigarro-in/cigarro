import { useState } from 'react';
import { ShieldCheck, Cigarette } from 'lucide-react';

interface Props {
  onVerify: () => void;
}

export function VividAgeVerification({ onVerify }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleYes = () => {
    setConfirming(true);
    localStorage.setItem('ageVerified', 'true');
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
        <div className="h-1 w-full bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#ff4b34]" />
        <div className="p-7 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#eff6ff] text-[#2563eb] grid place-items-center">
            <Cigarette className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-[#0f0f12] mb-1">
            Cigarro
          </h1>
          <p className="text-xs uppercase tracking-[0.12em] text-[#6b7280] mb-6">
            Premium tobacco marketplace
          </p>

          <h2 className="text-lg font-bold text-[#0f0f12] mb-2">Are you 18 or older?</h2>
          <p className="text-sm text-[#585966] leading-relaxed mb-6">
            This site sells tobacco products. Entry is restricted to adults of legal age
            per Indian law. By continuing you confirm you meet this requirement.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleNo}
              className="h-11 rounded-[10px] border border-[#e7e8ec] text-[#0f0f12] font-semibold text-sm hover:bg-[#f1f2f4] transition"
            >
              I'm under 18
            </button>
            <button
              onClick={handleYes}
              disabled={confirming}
              className="h-11 rounded-[10px] bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
            >
              Yes, I am 18+
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-[#e7e8ec] flex items-center justify-center gap-2 text-[11px] text-[#8a8b95]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Your answer is stored locally only
          </div>
        </div>
      </div>
    </div>
  );
}
