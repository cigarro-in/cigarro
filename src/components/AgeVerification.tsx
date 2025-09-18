import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { Crown, Shield, AlertCircle, FileText, Lock, AlertTriangle } from 'lucide-react';

interface AgeVerificationProps {
  onVerify: () => void;
}

export function AgeVerification({ onVerify }: AgeVerificationProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Check if user has already verified in this session
    const sessionVerified = sessionStorage.getItem('ageVerified');
    if (sessionVerified === 'true') {
      onVerify();
    }
  }, [onVerify]);

  const handleVerify = () => {
    // Store verification in session storage
    sessionStorage.setItem('ageVerified', 'true');
    setIsExiting(true);
    setTimeout(onVerify, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 bg-creme flex items-center justify-center"
    >
      <div className="text-center max-w-2xl mx-auto px-8">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="space-y-8"
        >
          {/* Logo/Brand */}
          <div className="mb-12">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, duration: 0.6, type: "spring" }}
              className="flex items-center justify-center mb-6"
            >
              <Crown className="w-12 h-12 text-canyon mr-4" />
              <h1 className="font-serif text-6xl text-dark font-normal">
                Cigarro
              </h1>
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "8rem" }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="h-px bg-canyon mx-auto"
            ></motion.div>
            <p className="text-coyote text-xl mt-4 font-sans">
              Premium Tobacco Marketplace
            </p>
          </div>

          {/* Welcome Content */}
          <div className="bg-white/80 backdrop-blur-sm p-10 rounded-xl border border-coyote/20 shadow-xl">
            <div className="flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-canyon mr-3" />
              <h2 className="font-serif text-4xl text-dark font-normal">
                Welcome to Cigarro
              </h2>
            </div>
            
            <p className="font-sans text-dark/80 text-lg leading-relaxed mb-8">
              You must be of legal smoking age in your jurisdiction to access our premium tobacco marketplace.
            </p>

            <div className="space-y-6 pt-6 border-t border-coyote/20">
              <div className="flex items-start space-x-4">
                <AlertTriangle className="w-6 h-6 text-canyon flex-shrink-0 mt-1" />
                <div className="text-left">
                  <h3 className="font-sans text-dark text-lg font-medium mb-2">Important Health Notice</h3>
                  <p className="font-sans text-dark/70 text-base leading-relaxed">
                    Tobacco products are harmful to your health and may cause serious health conditions including cancer, 
                    heart disease, and respiratory problems. Smoking is addictive and can be fatal.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="font-sans text-dark text-base font-medium">
                  By entering, you confirm that you are:
                </p>
                <ul className="font-sans text-dark space-y-3 text-left">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-canyon rounded-full mr-4"></div>
                    18 years of age or older (or 21+ in US jurisdictions)
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-canyon rounded-full mr-4"></div>
                    Of legal smoking age in your location
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-canyon rounded-full mr-4"></div>
                    Aware of the health risks associated with tobacco use
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col space-y-4 pt-6">
            <Button
              onClick={handleVerify}
              className="bg-dark text-creme-light font-sans font-medium text-xl py-4 px-12 rounded-lg hover:bg-creme-light hover:text-dark transition-all duration-300 group shadow-lg hover:shadow-xl"
              size="lg"
            >
              <Shield className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
              I AM OF LEGAL AGE - ENTER SITE
            </Button>
            
            <button
              onClick={() => window.close()}
              className="font-sans text-lg text-coyote hover:text-dark transition-colors underline underline-offset-4"
            >
              I am not of legal age - Exit
            </button>
          </div>

          {/* Legal disclaimer */}
          <div className="pt-8 border-t border-coyote/20">
            <div className="flex items-start space-x-3 text-left">
              <FileText className="w-5 h-5 text-coyote mt-1 flex-shrink-0" />
              <div>
                <p className="font-sans text-sm text-coyote leading-relaxed mb-2">
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
                <p className="font-sans text-xs text-coyote/80 leading-relaxed">
                  This verification is valid for this browser session only. You may be asked to verify again in future visits.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}