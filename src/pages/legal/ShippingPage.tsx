import React from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { Truck, Shield, CheckCircle, MapPin, Clock, Package, AlertTriangle, Globe, Users, Phone, Heart } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

export function ShippingPage() {
  const location = useLocation();
  
  return (
    <>
      <SEOHead
        title="Shipping Policy - Delivery Information"
        description="Shipping Policy for Cigarro Premium Marketplace - Information about delivery, shipping costs, and delivery times across India."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['shipping policy', 'delivery information', 'shipping costs', 'delivery times India']}
      />
      
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Minimal Header */}
        <div className="bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4 pt-4">
            <div className="text-center">
              <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-foreground">
                Shipping Policy
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* Free Shipping Notice - Standardized Card */}
            <Card className="border-2 border-accent/20 bg-accent/5 shadow-sm">
              <CardContent className="p-6 flex items-start gap-4">
                <Truck className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-sans text-lg font-bold text-foreground mb-2">Free Shipping on All Orders</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We offer free shipping on all orders within India. Your premium tobacco products will be delivered 
                    safely and securely to your doorstep with full tracking and insurance coverage.
                  </p>
                  <div className="flex items-center gap-6 mt-4 text-xs text-accent font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Nationwide Delivery</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>Fully Insured</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Sections */}
            <div className="space-y-6">
              {[
                {
                  icon: MapPin,
                  title: "1. Delivery Areas",
                  content: "We currently deliver to all major cities and towns across India. Our delivery network covers:",
                  items: [
                    "All metropolitan cities (Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad, Pune)",
                    "State capitals and major district headquarters",
                    "Most tier-2 and tier-3 cities",
                    "Remote areas (delivery times may vary)"
                  ],
                  note: "If you're unsure about delivery to your location, please contact our customer support team before placing your order."
                },
                {
                  icon: Clock,
                  title: "2. Delivery Times",
                  content: "Standard delivery times vary by location:",
                  items: [
                    "Metro cities: 2-3 business days",
                    "Tier-2 cities: 3-5 business days",
                    "Tier-3 cities and towns: 5-7 business days",
                    "Remote areas: 7-10 business days"
                  ],
                  note: "Delivery times are calculated from the date of dispatch, not the order date. Processing time is typically 1-2 business days."
                },
                {
                  icon: Package,
                  title: "3. Packaging and Handling",
                  content: "All tobacco products are packaged with the utmost care to ensure freshness and quality:",
                  items: [
                    "Premium packaging materials to protect products",
                    "Temperature-controlled storage and transport",
                    "Discrete packaging for privacy",
                    "Proper labeling and handling instructions",
                    "Insurance coverage for all shipments"
                  ]
                },
                {
                  icon: Shield,
                  title: "4. Age Verification and Delivery",
                  content: "Due to legal requirements, all tobacco product deliveries require age verification:",
                  items: [
                    "Recipient must be 18 years or older",
                    "Valid government-issued ID required at delivery",
                    "Delivery cannot be left unattended",
                    "Someone of legal age must be present to receive the package",
                    "Failed age verification will result in package return"
                  ]
                },
                {
                  icon: AlertTriangle,
                  title: "5. Delivery Issues and Returns",
                  content: "If you experience any issues with your delivery:",
                  items: [
                    "Contact our customer support immediately",
                    "We will investigate and resolve the issue promptly",
                    "Damaged or incorrect items will be replaced at no cost",
                    "Failed deliveries due to age verification are non-refundable",
                    "All returns must be initiated within 7 days of delivery"
                  ]
                },
                {
                  icon: Globe,
                  title: "6. International Shipping",
                  content: "Currently, we only ship within India. International shipping is not available due to:",
                  items: [
                    "Complex international tobacco regulations",
                    "Customs and import restrictions",
                    "Age verification requirements vary by country",
                    "Shipping and handling complexities"
                  ],
                  note: "We are evaluating international shipping options for the future. Please contact us if you're interested in international delivery."
                },
                {
                  icon: Truck,
                  title: "7. Tracking Your Order",
                  content: "Once your order is dispatched, you will receive:",
                  items: [
                    "Email confirmation with tracking number",
                    "SMS updates on delivery status",
                    "Real-time tracking through our website",
                    "Delivery notifications and estimated arrival time",
                    "Contact information for the delivery partner"
                  ]
                }
              ].map((section, index) => (
                <div key={index} className="p-6 rounded-lg border-2 border-border/40 bg-card">
                  <h3 className="font-sans text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <section.icon className="w-5 h-5 text-muted-foreground" />
                    {section.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    {section.content}
                  </p>
                  {section.items && (
                    <ul className="space-y-2 ml-4 mb-4">
                      {section.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.note && (
                    <p className="text-sm text-accent/80 italic border-l-2 border-accent/30 pl-3 py-1">
                      Note: {section.note}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Contact Information */}
            <div className="pt-8 border-t border-border/20">
              <h3 className="font-sans text-2xl text-foreground mb-6 text-center">Shipping Questions?</h3>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { title: "Shipping Support", contact: "shipping@cigarro.com", icon: Truck },
                  { title: "General Support", contact: "support@cigarro.com", icon: Users },
                  { title: "Phone Support", contact: "+91 98765 43210", icon: Phone },
                  { title: "Last Updated", contact: "January 2025", icon: Heart }
                ].map((item, i) => (
                  <div key={i} className="text-center p-4 rounded-lg bg-muted/20 border border-border/20">
                    <item.icon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                    <div className="font-medium text-foreground">{item.title}</div>
                    <div className="text-sm text-accent mt-1">{item.contact}</div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>
    </>
  );
}
