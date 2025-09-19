import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Lock, Eye, Shield, Database, Cookie, Mail, Users, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

export function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy - Cigarro</title>
        <meta name="description" content="Privacy Policy for Cigarro Premium Marketplace - How we collect, use, and protect your personal information." />
      </Helmet>
      
      <div className="min-h-screen bg-creme pt-24 pb-12">
        <div className="main-container">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="main-title text-dark mb-6 max-w-4xl mx-auto">
              Privacy Policy
            </h1>
          </div>

          <div className="max-w-4xl mx-auto">
            
            {/* Introduction */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-canyon/10 border-2 border-canyon/20 rounded-xl p-8 mb-12"
            >
              <div className="flex items-start space-x-4">
                <Lock className="w-8 h-8 text-canyon flex-shrink-0 mt-1" />
                <div>
                  <h2 className="medium-title text-dark mb-4">Your Privacy Matters</h2>
                  <p className="text text-dark/80 leading-relaxed">
                    At Cigarro, we are committed to protecting your privacy and ensuring the security of your personal information. 
                    This policy explains how we collect, use, and safeguard your data when you use our services.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Privacy Content */}
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
                    <Database className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">1. Information We Collect</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    We collect information you provide directly to us, such as when you create an account, make a purchase, 
                    or contact us for support. This may include:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Name and contact information (email, phone, address)</li>
                    <li>Payment and billing information</li>
                    <li>Account credentials and preferences</li>
                    <li>Communication history and support requests</li>
                    <li>Purchase history and product preferences</li>
                  </ul>
                </div>
              </div>

              {/* Section 2 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Settings className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">2. How We Use Your Information</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    We use the information we collect to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Process transactions and fulfill orders</li>
                    <li>Provide customer support and respond to inquiries</li>
                    <li>Improve our services and user experience</li>
                    <li>Send important updates about your account or orders</li>
                    <li>Comply with legal requirements and regulations</li>
                    <li>Prevent fraud and ensure platform security</li>
                  </ul>
                </div>
              </div>

              {/* Section 3 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">3. Data Security</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  We implement appropriate security measures to protect your personal information against unauthorized access, 
                  alteration, disclosure, or destruction. All payment processing is handled by secure, PCI-compliant providers. 
                  We use industry-standard encryption and security protocols to safeguard your data.
                </p>
              </div>

              {/* Section 4 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Cookie className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">4. Cookies and Tracking</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, 
                    and personalize content. You can control cookie settings through your browser preferences.
                  </p>
                  <p className="text text-dark/80 leading-relaxed">
                    Types of cookies we use:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li><strong>Essential cookies:</strong> Required for basic website functionality</li>
                    <li><strong>Analytics cookies:</strong> Help us understand how visitors use our site</li>
                    <li><strong>Preference cookies:</strong> Remember your settings and preferences</li>
                    <li><strong>Marketing cookies:</strong> Used to deliver relevant advertisements</li>
                  </ul>
                </div>
              </div>

              {/* Section 5 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">5. Information Sharing</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>With service providers who assist in our operations (shipping, payment processing)</li>
                    <li>When required by law or to protect our rights and safety</li>
                    <li>In connection with a business transfer or acquisition</li>
                    <li>With your explicit consent</li>
                  </ul>
                </div>
              </div>

              {/* Section 6 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Eye className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">6. Your Rights</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    You have the right to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Access and review your personal information</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of your personal information</li>
                    <li>Opt-out of marketing communications</li>
                    <li>Data portability (receive your data in a structured format)</li>
                    <li>Withdraw consent for data processing</li>
                  </ul>
                </div>
              </div>

              {/* Section 7 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Mail className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">7. Marketing Communications</h2>
                </div>
                <p className="text text-dark/80 leading-relaxed">
                  We may send you marketing communications about our products and services. You can opt-out of these communications 
                  at any time by clicking the unsubscribe link in our emails or by contacting us directly. 
                  We will still send you important transactional and account-related communications.
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
              <h2 className="medium-title text-dark mb-6">Questions About Your Privacy?</h2>
              <p className="text text-dark/80 leading-relaxed mb-6">
                If you have any questions about this privacy policy or how we handle your personal information, 
                please don't hesitate to contact us.
              </p>
              <div className="space-y-3">
                <p className="text-dark font-medium">
                  <span className="text-coyote">Privacy Officer:</span> privacy@cigarro.com
                </p>
                <p className="text-dark font-medium">
                  <span className="text-coyote">General Support:</span> support@cigarro.com
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
