import React from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { AlertTriangle, CalendarDays, Mail } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

export function TermsPage() {
  const location = useLocation();
  return (
    <>
      <SEOHead
        title="Terms of Service | Cigarro"
        description="Read the terms that apply when you browse, create an account or place an order with Cigarro."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['terms of service', 'legal terms', 'user agreement', 'cigarro terms']}
      />
      
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Minimal Header */}
        <div className="bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4 pt-4">
            <div className="text-center">
              <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-foreground">
                Terms of Service
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* Age Verification Notice - Standardized Card */}
            <Card className="border-2 border-accent/20 bg-accent/5 shadow-sm">
              <CardContent className="p-6 flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-sans text-lg font-bold text-foreground mb-2">Age Verification Required</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You must be 18 years or older to purchase tobacco products from Cigarro.
                    By using our services, you confirm that you are of legal smoking age in your jurisdiction.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Terms Sections */}
            <div className="space-y-6">
              {[
                {
                  title: "1. Acceptance of Terms",
                  content: "By accessing or using Cigarro, you agree to these terms. If you do not agree, please do not use the website or place an order."
                },
                {
                  title: "2. Product Information",
                  content: "All product descriptions, images, and specifications are provided for informational purposes. We strive for accuracy but cannot guarantee that all information is complete, reliable, or error-free."
                },
                {
                  title: "3. Health Disclaimer",
                  content: "Important: Tobacco products are harmful to your health and may cause serious health conditions including cancer, heart disease, and respiratory problems. Smoking is addictive and can be fatal. We strongly advise against tobacco use and encourage smoking cessation.",
                  highlight: true
                },
                {
                  title: "4. Age Restrictions",
                  content: "You must be at least 18 years old to purchase tobacco products. We reserve the right to request age verification and refuse service to anyone who cannot provide adequate proof of age."
                },
                {
                  title: "5. Payment and Billing",
                  content: "Prices and availability can change. Payment instructions and the final payable amount are shown during checkout. We may refuse or cancel an order when we cannot lawfully or operationally fulfil it."
                },
                {
                  title: "6. Limitation of Liability",
                  content: "To the extent permitted by applicable law, Cigarro is not liable for indirect, incidental or consequential loss resulting from use of the website or products. Nothing in these terms excludes a right that cannot lawfully be excluded."
                },
                {
                  title: "7. Modifications to Terms",
                  content: "We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Your continued use of our services constitutes acceptance of the modified terms."
                }
              ].map((section, index) => (
                <div key={index} className={`p-6 rounded-lg border-2 ${section.highlight ? 'border-red-500/20 bg-red-50/50' : 'border-border/40 bg-card'}`}>
                  <h3 className="font-sans text-xl font-bold text-foreground mb-3">
                    {section.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Contact Information */}
            <div className="pt-8 border-t border-border/20">
              <h3 className="font-sans text-2xl text-foreground mb-6 text-center">Questions?</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: "Questions", email: "support@cigarro.in", icon: Mail },
                  { title: "Last updated", email: "20 September 2026", icon: CalendarDays }
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
