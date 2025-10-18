import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FileText, AlertTriangle, CheckCircle, Shield, Users, CreditCard, Crown, Sparkles, Globe, Heart, Star, Scale } from 'lucide-react';
import { motion } from 'framer-motion';

export function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service - Cigarro</title>
        <meta name="description" content="Terms of Service for Cigarro Premium Marketplace - Important legal information about using our platform." />
        <link rel="canonical" href="https://cigarro.in/terms" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-creme via-creme-light to-creme pt-24 pb-12 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 left-16 w-80 h-80 bg-gradient-to-r from-canyon/5 to-sunflower/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-gradient-to-l from-coyote/5 to-canyon/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="main-container relative z-10">
          {/* Cinematic Header */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center mb-20"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.2 }}
              className="inline-flex items-center space-x-3 bg-gradient-to-r from-canyon/10 via-sunflower/10 to-canyon/10 px-8 py-4 rounded-full backdrop-blur-sm border border-canyon/20 mb-8"
            >
              <Scale className="w-6 h-6 text-canyon animate-pulse" />
              <span className="text-dark font-medium tracking-wide">Legal Terms</span>
              <FileText className="w-6 h-6 text-canyon animate-pulse" />
            </motion.div>
            
            <h1 className="main-title text-dark mb-8 max-w-4xl mx-auto">
              Terms of Service
            </h1>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="h-1 bg-gradient-to-r from-transparent via-canyon to-transparent max-w-md mx-auto mb-8"
            ></motion.div>
            
            <p className="text-xl text-dark/60 max-w-2xl mx-auto leading-relaxed">
              Important legal information about using our premium tobacco marketplace
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto">
            
            {/* Enhanced Age Verification Notice */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="glass-card rounded-3xl p-12 backdrop-blur-xl border border-white/20 shadow-2xl mb-20"
            >
              <div className="flex items-start space-x-6">
                <div className="w-16 h-16 bg-gradient-to-br from-canyon/20 to-sunflower/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-8 h-8 text-canyon" />
                </div>
                <div className="flex-1">
                  <h2 className="medium-title text-dark mb-6">Age Verification Required</h2>
                  <p className="text text-dark/80 leading-relaxed mb-6">
                    You must be 18 years or older to purchase tobacco products from our marketplace. 
                    By using our services, you confirm that you are of legal smoking age in your jurisdiction.
                  </p>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-canyon font-medium">
                      <CheckCircle className="w-5 h-5" />
                      <span>Age verification is required for all purchases</span>
                    </div>
                    <div className="w-1 h-1 bg-canyon rounded-full"></div>
                    <div className="flex items-center space-x-2 text-canyon font-medium">
                      <Shield className="w-5 h-5" />
                      <span>Legal compliance mandatory</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Enhanced Terms Content */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="space-y-12 mb-20"
            >
              {[
                {
                  icon: FileText,
                  title: "1. Acceptance of Terms",
                  gradient: "from-canyon/20 to-sunflower/20",
                  content: "By accessing and using Cigarro Premium Marketplace, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service."
                },
                {
                  icon: Shield,
                  title: "2. Product Information",
                  gradient: "from-sunflower/20 to-coyote/20",
                  content: "All product descriptions, images, and specifications are provided for informational purposes. We strive for accuracy but cannot guarantee that all information is complete, reliable, or error-free."
                },
                {
                  icon: AlertTriangle,
                  title: "3. Health Disclaimer",
                  gradient: "from-coyote/20 to-dark/20",
                  content: "Important: Tobacco products are harmful to your health and may cause serious health conditions including cancer, heart disease, and respiratory problems. Smoking is addictive and can be fatal. We strongly advise against tobacco use and encourage smoking cessation.",
                  highlight: true
                },
                {
                  icon: Users,
                  title: "4. Age Restrictions",
                  gradient: "from-dark/20 to-canyon/20",
                  content: "You must be at least 18 years old to purchase tobacco products. We reserve the right to request age verification and refuse service to anyone who cannot provide adequate proof of age."
                },
                {
                  icon: CreditCard,
                  title: "5. Payment and Billing",
                  gradient: "from-canyon/20 to-sunflower/20",
                  content: "All payments are processed securely through our payment partners. Prices are subject to change without notice. We reserve the right to refuse or cancel orders at our discretion."
                },
                {
                  icon: Shield,
                  title: "6. Limitation of Liability",
                  gradient: "from-sunflower/20 to-coyote/20",
                  content: "Cigarro Premium Marketplace shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use our services or products."
                },
                {
                  icon: FileText,
                  title: "7. Modifications to Terms",
                  gradient: "from-coyote/20 to-dark/20",
                  content: "We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Your continued use of our services constitutes acceptance of the modified terms."
                }
              ].map((section, index) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.8 }}
                  className="group"
                >
                  <motion.div 
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.3 }}
                    className={`glass-card rounded-2xl p-10 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500 ${section.highlight ? 'ring-2 ring-canyon/20' : ''}`}
                  >
                    <div className="flex items-start space-x-6">
                      <div className={`w-16 h-16 bg-gradient-to-br ${section.gradient} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                        <section.icon className="w-8 h-8 text-canyon relative z-10" />
                      </div>
                      
                      <div className="flex-1">
                        <h2 className="medium-title text-dark mb-6 group-hover:text-canyon transition-colors duration-300">
                          {section.title}
                        </h2>
                        
                        <div className="w-16 h-1 bg-gradient-to-r from-canyon to-sunflower mb-6 group-hover:w-24 transition-all duration-300"></div>
                        
                        <p className={`text leading-relaxed group-hover:text-dark/90 transition-colors duration-300 ${section.highlight ? 'text-dark/90' : 'text-dark/80'}`}>
                          {section.content}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-8 flex items-center justify-between">
                      <div className="flex space-x-2">
                        {[1,2,3].map((dot) => (
                          <div key={dot} className="w-2 h-2 bg-canyon/30 rounded-full group-hover:bg-canyon transition-colors duration-300"></div>
                        ))}
                      </div>
                      <div className="text-canyon text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Section {index + 1} of 7
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>

            {/* Enhanced Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="relative"
            >
              <div className="glass-card rounded-3xl p-12 backdrop-blur-xl border border-white/20 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="grid grid-cols-6 gap-4 h-full opacity-30">
                      {[...Array(24)].map((_, i) => (
                        <div key={i} className="bg-gradient-to-br from-canyon to-sunflower rounded-lg"></div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 max-w-4xl mx-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-8"
                  >
                    <FileText className="w-5 h-5 text-canyon" />
                    <span className="text-dark font-medium">Legal Questions</span>
                  </motion.div>
                  
                  <h2 className="medium-title text-dark mb-8">Questions About These Terms?</h2>
                  
                  <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-8"></div>
                  
                  <p className="text text-dark/80 leading-relaxed mb-10 max-w-3xl mx-auto">
                    If you have any questions about these terms of service, our legal team is here to help.
                  </p>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="grid md:grid-cols-3 gap-8 mb-10"
                  >
                    {[
                      {
                        icon: Scale,
                        title: "Legal Team",
                        contact: "legal@cigarro.com",
                        description: "Terms & legal matters"
                      },
                      {
                        icon: Users,
                        title: "General Support",
                        contact: "support@cigarro.com",
                        description: "General assistance"
                      },
                      {
                        icon: Heart,
                        title: "Last Updated",
                        contact: "January 2025",
                        description: "Current version"
                      }
                    ].map((contact, i) => (
                      <motion.div
                        key={contact.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                        className="group"
                      >
                        <div className="bg-white/50 rounded-2xl p-6 backdrop-blur-sm border border-white/30 group-hover:bg-white/70 transition-all duration-300">
                          <div className="w-12 h-12 bg-gradient-to-br from-canyon/20 to-sunflower/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                            <contact.icon className="w-6 h-6 text-canyon" />
                          </div>
                          <h3 className="font-medium text-dark mb-2">{contact.title}</h3>
                          <p className="text-dark/60 text-sm mb-3">{contact.description}</p>
                          <p className="text-canyon font-medium text-sm">{contact.contact}</p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
