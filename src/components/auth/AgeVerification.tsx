import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';
import { Shield, MapPin, FileText, AlertCircle, Crown } from 'lucide-react';

interface AgeVerificationProps {
  onVerify: () => void;
}

export function AgeVerification({ onVerify }: AgeVerificationProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Check if user has already verified permanently (first ever visit check)
    const hasVerified = localStorage.getItem('ageVerified');
    if (hasVerified === 'true') {
      onVerify();
    }
  }, [onVerify]);

  const handleVerify = () => {
    // Store age verification in local storage (persistent)
    localStorage.setItem('ageVerified', 'true');
    
    // Also set cookie consent as implied by using the site if needed
    if (!localStorage.getItem('cookie_consent')) {
        localStorage.setItem('cookie_consent', JSON.stringify({
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] bg-creme overflow-y-auto scrollbar-hide"
    >
      <div className="min-h-full flex items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
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
              <p className="text-canyon/80 font-sans text-sm uppercase tracking-wider font-bold">
                  Cigarro does not promote tobacco use.
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
                          18+
                      </div>
                      <p className="text-dark/80 font-sans text-sm md:text-base leading-relaxed pt-1">
                          I am over the age of 18 years (21 for Karnataka) and am not purchasing tobacco products for anyone underage, understanding that doing so is a criminal offense.
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
                          I acknowledge that the delivery executive may request valid age proof to confirm I am over 18 (21 for Karnataka), and I will comply.
                      </p>
                  </div>

                  {/* Item 4 - Transgressions */}
                  <div className="flex gap-5 items-start group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-creme border border-coyote flex items-center justify-center text-canyon group-hover:bg-canyon group-hover:text-creme-light transition-colors duration-300">
                          <AlertCircle size={18} strokeWidth={1.5} />
                      </div>
                      <p className="text-dark/80 font-sans text-sm md:text-base leading-relaxed pt-1">
                          Cigarro reserves the right to report my account in case of any transgressions.
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
              <Button 
                  onClick={handleVerify}
                  className="w-full bg-dark text-creme-light hover:bg-canyon hover:text-creme-light py-6 md:py-7 rounded-full font-sans font-medium text-base md:text-lg tracking-wide uppercase transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                  Confirm and Proceed
              </Button>
          </div>
        </motion.div>
      </div>
      
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-50">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-canyon/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-canyon/5 to-transparent" />
      </div>
    </motion.div>
  );
}
