import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Shield, FileText, Eye, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function LegalPage() {
  return (
    <>
      <Helmet>
        <title>Legal Information - Cigarro Premium Marketplace</title>
        <meta name="description" content="Terms of Service, Privacy Policy, and Legal Disclaimers for Cigarro Premium Marketplace" />
      </Helmet>
      
      <div className="min-h-screen bg-creme">
        {/* Hero Section */}
        <section className="section bg-gradient-to-b from-creme-light to-creme">
          <div className="main-container">
            <div className="text-center max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-dark/10 rounded-full mb-6">
                  <Shield className="w-10 h-10 text-dark" />
                </div>
                <h1 className="font-serif text-dark text-[clamp(3rem,6000vw/1440,6rem)] lg:text-[clamp(4rem,8000vw/1440,8rem)] font-normal leading-tight mb-6">
                  Legal Information
                </h1>
                <p className="text-dark/80 text-xl lg:text-2xl leading-relaxed max-w-3xl mx-auto">
                  Important information about our terms of service, privacy policy, and legal disclaimers for responsible tobacco commerce.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Content Sections */}
        <section className="section bg-creme">
          <div className="main-container">
            <div className="max-w-4xl mx-auto">
              
              {/* Age Verification Notice */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-canyon/10 border-2 border-canyon/20 rounded-xl p-8 mb-12"
              >
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="w-8 h-8 text-canyon flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="font-serif text-dark text-3xl font-normal mb-4">Age Verification Required</h2>
                    <p className="text-dark/80 text-lg leading-relaxed mb-4">
                      You must be 18 years or older to purchase tobacco products from our marketplace. 
                      By using our services, you confirm that you are of legal smoking age in your jurisdiction.
                    </p>
                    <div className="flex items-center space-x-2 text-canyon font-medium">
                      <CheckCircle className="w-5 h-5" />
                      <span>Age verification is required for all purchases</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Terms of Service */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-16"
              >
                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="font-serif text-dark text-4xl font-normal">Terms of Service</h2>
                </div>
                
                <div className="prose prose-lg max-w-none">
                  <div className="space-y-8">
                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">1. Acceptance of Terms</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        By accessing and using Cigarro Premium Marketplace, you accept and agree to be bound by the terms and provision of this agreement. 
                        If you do not agree to abide by the above, please do not use this service.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">2. Product Information</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        All product descriptions, images, and specifications are provided for informational purposes. 
                        We strive for accuracy but cannot guarantee that all information is complete, reliable, or error-free.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">3. Health Disclaimer</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        <strong className="text-canyon">Important:</strong> Tobacco products are harmful to your health and may cause serious health conditions including cancer, 
                        heart disease, and respiratory problems. Smoking is addictive and can be fatal. 
                        We strongly advise against tobacco use and encourage smoking cessation.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">4. Age Restrictions</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        You must be at least 18 years old to purchase tobacco products. We reserve the right to request age verification 
                        and refuse service to anyone who cannot provide adequate proof of age.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">5. Limitation of Liability</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        Cigarro Premium Marketplace shall not be liable for any direct, indirect, incidental, special, or consequential damages 
                        resulting from the use or inability to use our services or products.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Privacy Policy */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-16"
              >
                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Lock className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="font-serif text-dark text-4xl font-normal">Privacy Policy</h2>
                </div>
                
                <div className="prose prose-lg max-w-none">
                  <div className="space-y-8">
                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">Information We Collect</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        We collect information you provide directly to us, such as when you create an account, make a purchase, 
                        or contact us for support. This may include your name, email address, shipping address, and payment information.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">How We Use Your Information</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        We use the information we collect to process transactions, provide customer support, 
                        improve our services, and comply with legal requirements. We do not sell your personal information to third parties.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">Data Security</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        We implement appropriate security measures to protect your personal information against unauthorized access, 
                        alteration, disclosure, or destruction. All payment processing is handled by secure, PCI-compliant providers.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-sans text-dark text-2xl font-medium mb-4">Cookies and Tracking</h3>
                      <p className="text-dark/80 text-lg leading-relaxed">
                        We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, 
                        and personalize content. You can control cookie settings through your browser preferences.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Contact Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-dark/5 rounded-xl p-8"
              >
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Eye className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="font-serif text-dark text-3xl font-normal">Questions or Concerns?</h2>
                </div>
                <p className="text-dark/80 text-lg leading-relaxed mb-6">
                  If you have any questions about these terms, our privacy practices, or need assistance with your account, 
                  please don't hesitate to contact us.
                </p>
                <div className="space-y-3">
                  <p className="text-dark font-medium">
                    <span className="text-coyote">Email:</span> legal@cigarro.com
                  </p>
                  <p className="text-dark font-medium">
                    <span className="text-coyote">Support:</span> support@cigarro.com
                  </p>
                  <p className="text-dark font-medium">
                    <span className="text-coyote">Last Updated:</span> January 2025
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
