import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FileText, AlertTriangle, CheckCircle, Shield, Users, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

export function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service - Cigarro</title>
        <meta name="description" content="Terms of Service for Cigarro Premium Marketplace - Important legal information about using our platform." />
      </Helmet>
      
      <div className="min-h-screen bg-creme pt-24 pb-12">
        <div className="main-container">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="main-title text-dark mb-6 max-w-4xl mx-auto">
              Terms of Service
            </h1>
          </div>

          <div className="max-w-4xl mx-auto">
            
            {/* Age Verification Notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-canyon/10 border-2 border-canyon/20 rounded-xl p-8 mb-12"
            >
              <div className="flex items-start space-x-4">
                <AlertTriangle className="w-8 h-8 text-canyon flex-shrink-0 mt-1" />
                <div>
                  <h2 className="medium-title text-dark mb-4">Age Verification Required</h2>
                  <p className="text text-dark/80 leading-relaxed mb-4">
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

            {/* Terms Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-12"
            >
              
              {/* Section 1 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">1. Acceptance of Terms</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  By accessing and using Cigarro Premium Marketplace, you accept and agree to be bound by the terms and provision of this agreement. 
                  If you do not agree to abide by the above, please do not use this service.
                </p>
              </div>

              {/* Section 2 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">2. Product Information</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  All product descriptions, images, and specifications are provided for informational purposes. 
                  We strive for accuracy but cannot guarantee that all information is complete, reliable, or error-free.
                </p>
              </div>

              {/* Section 3 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-canyon" />
                  </div>
                  <h2 className="medium-title text-dark">3. Health Disclaimer</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  <strong className="text-canyon">Important:</strong> Tobacco products are harmful to your health and may cause serious health conditions including cancer, 
                  heart disease, and respiratory problems. Smoking is addictive and can be fatal. 
                  We strongly advise against tobacco use and encourage smoking cessation.
                </p>
              </div>

              {/* Section 4 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">4. Age Restrictions</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  You must be at least 18 years old to purchase tobacco products. We reserve the right to request age verification 
                  and refuse service to anyone who cannot provide adequate proof of age.
                </p>
              </div>

              {/* Section 5 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">5. Payment and Billing</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  All payments are processed securely through our payment partners. Prices are subject to change without notice. 
                  We reserve the right to refuse or cancel orders at our discretion.
                </p>
              </div>

              {/* Section 6 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">6. Limitation of Liability</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  Cigarro Premium Marketplace shall not be liable for any direct, indirect, incidental, special, or consequential damages 
                  resulting from the use or inability to use our services or products.
                </p>
              </div>

              {/* Section 7 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">7. Modifications to Terms</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. 
                  Your continued use of our services constitutes acceptance of the modified terms.
                </p>
              </div>

            </motion.div>

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-dark/5 rounded-xl p-8 mt-12"
            >
              <h2 className="medium-title text-dark mb-6">Questions About These Terms?</h2>
              <p className="text text-dark/80 leading-relaxed mb-6">
                If you have any questions about these terms of service, please don't hesitate to contact us.
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
      </div>
    </>
  );
}
