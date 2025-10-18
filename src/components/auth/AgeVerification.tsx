import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';
import { Crown, Shield, AlertCircle, FileText, Lock, AlertTriangle, Cookie } from 'lucide-react';

interface AgeVerificationProps {
  onVerify: () => void;
}

export function AgeVerification({ onVerify }: AgeVerificationProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [acceptedCookies, setAcceptedCookies] = useState(false);

  useEffect(() => {
    // Check if user has already verified in this session
    const sessionVerified = sessionStorage.getItem('ageVerified');
    const cookieConsent = localStorage.getItem('cookie_consent');
    if (sessionVerified === 'true' && cookieConsent) {
      onVerify();
    }
  }, [onVerify]);

  const handleVerify = () => {
    if (!acceptedCookies) {
      // Store cookie consent
      localStorage.setItem('cookie_consent', JSON.stringify({
        necessary: true,
        analytics: true,
        marketing: true,
        timestamp: new Date().toISOString()
      }));
    }
    
    // Store age verification in session storage
    sessionStorage.setItem('ageVerified', 'true');
    setIsExiting(true);
    setTimeout(onVerify, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 bg-creme flex items-center justify-center p-4 sm:p-8"
    >
      <div className="text-center max-w-md sm:max-w-lg lg:max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="space-y-6 sm:space-y-8"
        >
          {/* Logo/Brand */}
          <div className="mb-8 sm:mb-12">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, duration: 0.6, type: "spring" }}
              className="flex flex-col sm:flex-row items-center justify-center mb-4 sm:mb-6"
            >
              <Crown className="w-8 h-8 sm:w-12 sm:h-12 text-canyon mb-2 sm:mb-0 sm:mr-4" />
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-6xl text-dark font-normal">
                Cigarro
              </h1>
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "6rem" }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="h-px bg-canyon mx-auto"
            ></motion.div>
            <p className="text-coyote text-lg sm:text-xl mt-3 sm:mt-4 font-sans">
              Premium Tobacco Marketplace
            </p>
          </div>

          {/* Welcome Content */}
          <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-8 lg:p-10 rounded-xl border border-coyote/20 shadow-xl">
            <div className="flex flex-col sm:flex-row items-center justify-center mb-4 sm:mb-6">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-canyon mb-2 sm:mb-0 sm:mr-3" />
              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-dark font-normal text-center sm:text-left">
                Welcome to Cigarro
              </h2>
            </div>

            <p className="font-sans text-dark/80 text-base sm:text-lg leading-relaxed mb-6 sm:mb-8 text-center sm:text-left">
              You must be of legal smoking age in your jurisdiction to access our premium tobacco marketplace.
            </p>

            <div className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 border-t border-coyote/20">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-canyon flex-shrink-0 mt-1" />
                <div className="text-left">
                  <h3 className="font-sans text-dark text-base sm:text-lg font-medium mb-2">Important Health Notice</h3>
                  <p className="font-sans text-dark/70 text-sm sm:text-base leading-relaxed">
                    Tobacco products are harmful to your health and may cause serious health conditions including cancer,
                    heart disease, and respiratory problems. Smoking is addictive and can be fatal.
                  </p>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <p className="font-sans text-dark text-sm sm:text-base font-medium text-center sm:text-left">
                  By entering, you confirm that you are:
                </p>
                <ul className="font-sans text-dark space-y-2 sm:space-y-3 text-left">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-canyon rounded-full mr-3 sm:mr-4"></div>
                    <span className="text-sm sm:text-base">18 years of age or older (or 21+ in US jurisdictions)</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-canyon rounded-full mr-3 sm:mr-4"></div>
                    <span className="text-sm sm:text-base">Of legal smoking age in your location</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-canyon rounded-full mr-3 sm:mr-4"></div>
                    <span className="text-sm sm:text-base">Aware of the health risks associated with tobacco use</span>
                  </li>
                </ul>
              </div>

              {/* Cookie Consent Section */}
              <div className="flex items-start space-x-3 sm:space-x-4 pt-4 border-t border-coyote/20">
                <Cookie className="w-5 h-5 sm:w-6 sm:h-6 text-canyon flex-shrink-0 mt-1" />
                <div className="text-left">
                  <h3 className="font-sans text-dark text-base sm:text-lg font-medium mb-2">Cookie Policy</h3>
                  <p className="font-sans text-dark/70 text-sm sm:text-base leading-relaxed mb-3">
                    We use cookies to enhance your browsing experience, analyze site traffic, and serve personalized content.
                    By entering, you consent to our use of cookies.
                  </p>
                  <label className="flex items-start space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acceptedCookies}
                      onChange={(e) => setAcceptedCookies(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-coyote/30 text-canyon focus:ring-canyon focus:ring-offset-0"
                    />
                    <span className="text-sm text-dark/80 group-hover:text-dark transition-colors">
                      I accept the use of cookies for analytics and personalized content (optional)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col space-y-3 sm:space-y-4 pt-4 sm:pt-6">
            <Button
              onClick={handleVerify}
              className="bg-dark text-creme-light font-sans font-medium text-lg sm:text-xl py-3 sm:py-4 px-8 sm:px-12 rounded-lg hover:bg-creme-light hover:text-dark transition-all duration-300 group shadow-lg hover:shadow-xl w-full"
              size="lg"
            >
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 group-hover:rotate-12 transition-transform" />
              <span className="text-sm sm:text-base lg:text-lg">I AM OF LEGAL AGE - ENTER SITE</span>
            </Button>

            <button
              onClick={() => window.close()}
              className="font-sans text-base sm:text-lg text-coyote hover:text-dark transition-colors underline underline-offset-4 py-2"
            >
              I am not of legal age - Exit
            </button>
          </div>

          {/* Legal disclaimer */}
          <div className="pt-6 sm:pt-8 border-t border-coyote/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 text-left">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-coyote flex-shrink-0 mt-0.5" />
              <div className="text-sm sm:text-base lg:text-lg">
                <p className="text-coyote leading-relaxed mb-2 sm:mb-3">
                  By continuing, you agree to our{' '}
                  <a href="/terms" className="text-canyon hover:underline font-medium">
                    Terms of Service
                  </a>
                  ,{' '}
                  <a href="/privacy" className="text-canyon hover:underline font-medium">
                    Privacy Policy
                  </a>
                  , and{' '}
                  <a href="/privacy#cookies" className="text-canyon hover:underline font-medium">
                    Cookie Policy
                  </a>
                  .
                </p>
                <p className="text-coyote/80 leading-relaxed">
                  Age verification is valid for this browser session only. Cookie preferences can be changed anytime in your browser settings.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
