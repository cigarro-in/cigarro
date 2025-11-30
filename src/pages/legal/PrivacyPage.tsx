import React from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { Lock, Shield, Mail, CheckCircle, Database } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

export function PrivacyPage() {
  const location = useLocation();
  const privacySections = [
    {
      title: '1. Information We Collect',
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
      title: '2. How We Use Your Information',
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
      title: '3. Data Security',
      content: {
        intro: 'We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All payment processing is handled by secure, PCI-compliant providers. We use industry-standard encryption and security protocols to safeguard your data.',
        items: []
      }
    },
    {
      title: '4. Cookies and Tracking',
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
      title: '5. Information Sharing',
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
      title: '6. Your Rights',
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
      title: '7. Marketing Communications',
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
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['privacy policy', 'data protection', 'user privacy', 'cigarro privacy']}
      />
      
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Minimal Header */}
        <div className="bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4 pt-4">
            <div className="text-center">
              <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-foreground">
                Privacy Policy
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* Privacy Intro - Standardized Card */}
            <Card className="border-2 border-accent/20 bg-accent/5 shadow-sm">
              <CardContent className="p-6 flex items-start gap-4">
                <Shield className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-sans text-lg font-bold text-foreground mb-2">Your Privacy Matters</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    At Cigarro, we are committed to protecting your privacy and ensuring the security of your personal information. 
                    This policy explains how we collect, use, and safeguard your data when you use our services.
                  </p>
                  <div className="flex items-center gap-6 mt-4 text-xs text-accent font-medium">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>Secure Encryption</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>GDPR Compliant</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Sections */}
            <div className="space-y-6">
              {privacySections.map((section, index) => (
                <div key={index} className="p-6 rounded-lg border-2 border-border/40 bg-card">
                  <h3 className="font-sans text-xl font-bold text-foreground mb-3">
                    {section.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    {section.content.intro}
                  </p>
                  {section.content.items.length > 0 && (
                    <ul className="space-y-2 ml-4">
                      {section.content.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* Contact Information */}
            <div className="pt-8 border-t border-border/20">
              <h3 className="font-sans text-2xl text-foreground mb-6 text-center">Privacy Questions?</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { title: "Privacy Officer", email: "privacy@cigarro.com", icon: Lock },
                  { title: "Data Requests", email: "data@cigarro.com", icon: Database },
                  { title: "General Support", email: "support@cigarro.com", icon: Mail }
                ].map((item, i) => (
                  <div key={i} className="text-center p-4 rounded-lg bg-muted/20 border border-border/20">
                    <item.icon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                    <div className="font-medium text-foreground">{item.title}</div>
                    <div className="text-sm text-accent mt-1">{item.email}</div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>
    </>
  );
}

