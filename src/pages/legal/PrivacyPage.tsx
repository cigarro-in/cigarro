import React from 'react';
import { SEOHead } from '../../components/seo/SEOHead';
import { Lock, Eye, Shield, Database, Cookie, Mail, Users, Settings, Sparkles, Crown, CheckCircle, Globe, Heart, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export function PrivacyPage() {
  const privacySections = [
    {
      icon: Database,
      title: '1. Information We Collect',
      gradient: 'from-canyon/20 to-sunflower/20',
      content: {
        intro: 'We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This may include:',
        items: [
          'Name and contact information (email, phone, address)',
          'Payment and billing information',
          'Account credentials and preferences',
          'Communication history and support requests',
          'Purchase history and product preferences'
        ]
      }
    },
    {
      icon: Settings,
      title: '2. How We Use Your Information',
      gradient: 'from-sunflower/20 to-coyote/20',
      content: {
        intro: 'We use the information we collect to:',
        items: [
          'Process transactions and fulfill orders',
          'Provide customer support and respond to inquiries',
          'Improve our services and user experience',
          'Send important updates about your account or orders',
          'Comply with legal requirements and regulations',
          'Prevent fraud and ensure platform security'
        ]
      }
    },
    {
      icon: Shield,
      title: '3. Data Security',
      gradient: 'from-coyote/20 to-dark/20',
      content: {
        intro: 'We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All payment processing is handled by secure, PCI-compliant providers. We use industry-standard encryption and security protocols to safeguard your data.',
        items: []
      }
    },
    {
      icon: Cookie,
      title: '4. Cookies and Tracking',
      gradient: 'from-dark/20 to-canyon/20',
      content: {
        intro: 'We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookie settings through your browser preferences.',
        items: [
          'Essential cookies: Required for basic website functionality',
          'Analytics cookies: Help us understand how visitors use our site',
          'Preference cookies: Remember your settings and preferences',
          'Marketing cookies: Used to deliver relevant advertisements'
        ]
      }
    },
    {
      icon: Users,
      title: '5. Information Sharing',
      gradient: 'from-canyon/20 to-sunflower/20',
      content: {
        intro: 'We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:',
        items: [
          'With service providers who assist in our operations (shipping, payment processing)',
          'When required by law or to protect our rights and safety',
          'In connection with a business transfer or acquisition',
          'With your explicit consent'
        ]
      }
    },
    {
      icon: Eye,
      title: '6. Your Rights',
      gradient: 'from-sunflower/20 to-coyote/20',
      content: {
        intro: 'You have the right to:',
        items: [
          'Access and review your personal information',
          'Request correction of inaccurate data',
          'Request deletion of your personal information',
          'Opt-out of marketing communications',
          'Data portability (receive your data in a structured format)',
          'Withdraw consent for data processing'
        ]
      }
    },
    {
      icon: Mail,
      title: '7. Marketing Communications',
      gradient: 'from-coyote/20 to-dark/20',
      content: {
        intro: 'We may send you marketing communications about our products and services. You can opt-out of these communications at any time by clicking the unsubscribe link in our emails or by contacting us directly. We will still send you important transactional and account-related communications.',
        items: []
      }
    }
  ];

  return (
    <>
      <SEOHead
        title="Privacy Policy - Data Protection"
        description="Privacy Policy for Cigarro Premium Marketplace - How we collect, use, and protect your personal information."
        url="/privacy"
        type="website"
        keywords={['privacy policy', 'data protection', 'user privacy', 'cigarro privacy']}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-creme via-creme-light to-creme pt-24 pb-12 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 left-16 w-80 h-80 bg-gradient-to-r from-canyon/5 to-sunflower/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-gradient-to-l from-coyote/5 to-canyon/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-transparent via-dark/[0.02] to-transparent rounded-full"></div>
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
              <Shield className="w-6 h-6 text-canyon animate-pulse" />
              <span className="text-dark font-medium tracking-wide">Protecting Your Privacy</span>
              <Lock className="w-6 h-6 text-canyon animate-pulse" />
            </motion.div>
            
            <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl text-dark mb-8 leading-tight">
              <span className="inline-block hover-lift">Privacy</span>{' '}
              <span className="inline-block text-shimmer font-bold">Policy</span>
            </h1>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="h-1 bg-gradient-to-r from-transparent via-canyon to-transparent max-w-md mx-auto mb-8"
            ></motion.div>
            
            <p className="text-xl text-dark/60 max-w-2xl mx-auto leading-relaxed">
              Your trust is our foundation. Learn how we protect and respect your personal information.
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto">
            
            {/* Enhanced Introduction */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="glass-card rounded-3xl p-12 backdrop-blur-xl border border-white/20 shadow-2xl mb-20"
            >
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6">
                      <Crown className="w-5 h-5 text-canyon" />
                      <span className="text-dark font-medium">Privacy First</span>
                    </div>
                    
                    <h2 className="font-serif text-4xl text-dark mb-6 leading-tight">
                      Your Privacy
                      <span className="text-canyon block">Matters to Us</span>
                    </h2>
                    
                    <div className="w-16 h-1 bg-gradient-to-r from-canyon to-sunflower mb-6"></div>
                  </motion.div>

                  <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="text-lg text-dark/80 leading-relaxed mb-6"
                  >
                    At Cigarro, we are committed to protecting your privacy and ensuring the security of your personal information. 
                    This policy explains how we collect, use, and safeguard your data when you use our services.
                  </motion.p>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="flex items-center space-x-6"
                  >
                    {[
                      { icon: Shield, label: "Secure" },
                      { icon: CheckCircle, label: "GDPR Compliant" },
                      { icon: Lock, label: "Encrypted" }
                    ].map((item, i) => (
                      <div key={item.label} className="flex items-center space-x-2 text-canyon">
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                    ))}
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className="relative"
                >
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-canyon via-sunflower to-canyon rounded-3xl blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
                    <div className="relative bg-gradient-to-br from-white to-creme-light rounded-3xl p-8 border border-white/40 backdrop-blur-sm">
                      <div className="grid grid-cols-2 gap-6">
                        {[
                          { icon: Database, label: "Data Protection", value: "100%" },
                          { icon: Users, label: "User Control", value: "Full" },
                          { icon: Globe, label: "Compliance", value: "Global" },
                          { icon: Heart, label: "Trust Rating", value: "5★" }
                        ].map((item, i) => (
                          <motion.div
                            key={item.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.6 + i * 0.1 }}
                            className="text-center group/stat"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-canyon/20 to-sunflower/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover/stat:scale-110 transition-transform duration-300">
                              <item.icon className="w-6 h-6 text-canyon" />
                            </div>
                            <div className="font-serif text-lg text-dark font-bold mb-1">{item.value}</div>
                            <div className="text-xs text-dark/60 font-medium">{item.label}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Premium Privacy Sections */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="space-y-12 mb-20"
            >
              {privacySections.map((section, index) => (
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
                    className="glass-card rounded-2xl p-10 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500"
                  >
                    <div className="flex items-start space-x-6 mb-8">
                      <div className={`w-16 h-16 bg-gradient-to-br ${section.gradient} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                        <section.icon className="w-8 h-8 text-canyon relative z-10" />
                      </div>
                      
                      <div className="flex-1">
                        <h2 className="font-serif text-3xl text-dark font-bold mb-4 group-hover:text-canyon transition-colors duration-300">
                          {section.title}
                        </h2>
                        
                        <div className="w-16 h-1 bg-gradient-to-r from-canyon to-sunflower mb-6 group-hover:w-24 transition-all duration-300"></div>
                        
                        <p className="text-lg text-dark/80 leading-relaxed group-hover:text-dark/90 transition-colors duration-300">
                          {section.content.intro}
                        </p>
                      </div>
                    </div>
                    
                    {section.content.items.length > 0 && (
                      <div className="ml-22">
                        <ul className="space-y-3">
                          {section.content.items.map((item, itemIndex) => (
                            <motion.li
                              key={itemIndex}
                              initial={{ opacity: 0, x: -20 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: index * 0.1 + itemIndex * 0.05, duration: 0.6 }}
                              className="flex items-center space-x-3 text-dark/70 group-hover:text-dark/80 transition-colors duration-300"
                            >
                              <div className="w-2 h-2 bg-gradient-to-r from-canyon to-sunflower rounded-full flex-shrink-0"></div>
                              <span className="leading-relaxed">{item}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="mt-8 flex items-center justify-between">
                      <div className="flex space-x-2">
                        {[1,2,3].map((dot) => (
                          <div key={dot} className="w-2 h-2 bg-canyon/30 rounded-full group-hover:bg-canyon transition-colors duration-300"></div>
                        ))}
                      </div>
                      <div className="text-canyon text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Section {index + 1} of {privacySections.length}
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
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute top-0 left-0 w-full h-full">
                    <div className="grid grid-cols-8 gap-4 h-full opacity-30">
                      {[...Array(32)].map((_, i) => (
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
                    <Mail className="w-5 h-5 text-canyon" />
                    <span className="text-dark font-medium">Privacy Questions</span>
                  </motion.div>
                  
                  <h2 className="font-serif text-4xl md:text-5xl text-dark mb-8 leading-tight">
                    Questions About
                    <span className="text-canyon block">Your Privacy?</span>
                  </h2>
                  
                  <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-8"></div>
                  
                  <p className="text-xl text-dark/80 leading-relaxed mb-10 max-w-3xl mx-auto">
                    If you have any questions about this privacy policy or how we handle your personal information, 
                    our dedicated privacy team is here to help.
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
                        icon: Shield,
                        title: "Privacy Officer",
                        contact: "privacy@cigarro.com",
                        description: "Dedicated privacy protection"
                      },
                      {
                        icon: Users,
                        title: "General Support",
                        contact: "support@cigarro.com",
                        description: "24/7 customer assistance"
                      },
                      {
                        icon: Heart,
                        title: "Data Requests",
                        contact: "data@cigarro.com",
                        description: "Access & deletion requests"
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
                          <h3 className="font-serif text-lg text-dark font-bold mb-2">{contact.title}</h3>
                          <p className="text-dark/60 text-sm mb-3">{contact.description}</p>
                          <p className="text-canyon font-medium text-sm">{contact.contact}</p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="flex flex-wrap items-center justify-center gap-8 text-canyon"
                  >
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">GDPR Compliant</span>
                    </div>
                    <div className="w-2 h-2 bg-canyon rounded-full"></div>
                    <div className="flex items-center space-x-2">
                      <Lock className="w-5 h-5" />
                      <span className="font-medium">Secure & Private</span>
                    </div>
                    <div className="w-2 h-2 bg-canyon rounded-full"></div>
                    <div className="flex items-center space-x-2">
                      <Star className="w-5 h-5" />
                      <span className="font-medium">Last Updated: January 2025</span>
                    </div>
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
