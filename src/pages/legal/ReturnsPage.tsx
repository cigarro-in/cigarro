import React from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { Truck, Shield, CheckCircle, MapPin, Clock, Package, AlertTriangle, Globe, Users, Phone, Heart, RotateCcw, XCircle, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

export function ReturnsPage() {
  const location = useLocation();
  
  return (
    <>
      <SEOHead
        title="Returns Policy - Cigarro"
        description="Returns and refunds policy for Cigarro Premium Marketplace. Tobacco products are non-returnable due to health regulations. Damaged or incorrect items will be replaced."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['returns policy', 'refund policy', 'tobacco returns', 'damaged items replacement']}
      />
      
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <div className="bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4 pt-4">
            <div className="text-center">
              <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-foreground">
                Returns & Refunds Policy
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          
          <Card className="border-2 border-red-500/20 bg-red-50/50 shadow-sm">
            <CardContent className="p-6 flex items-start gap-4">
              <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-sans text-lg font-bold text-foreground mb-2">Important: Tobacco Products Are Non-Returnable</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Due to health regulations and the nature of consumable products, we cannot accept returns or exchanges 
                  on any tobacco products once they have been dispatched. This is for your safety and compliance with 
                  Indian law. Please review your order carefully before confirming.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {[
              {
                icon: RotateCcw,
                title: "1. When We Accept Returns",
                content: "We only accept returns in the following limited circumstances:",
                items: [
                  "Damaged in transit: Products that arrive physically damaged (crushed, broken, leaking)",
                  "Incorrect items: You received a different product than what you ordered",
                  "Manufacturing defects: Sealed products with visible manufacturing flaws"
                ],
                note: "All claims must be reported within 48 hours of delivery with clear photos of the issue."
              },
              {
                icon: ShieldCheck,
                title: "2. What We'll Do Instead of a Return",
                content: "We don't do traditional returns on consumables. Here's how we handle issues:",
                items: [
                  "Damaged items: We'll send a replacement at no cost, no need to return the damaged goods",
                  "Wrong items: We'll ship the correct product and you keep what arrived (or donate it)",
                  "Defective products: Full replacement shipped immediately"
                ],
                note: "No return shipping labels, no restocking fees, no hassle. We just make it right."
              },
              {
                icon: AlertTriangle,
                title: "3. What We Cannot Accept",
                content: "The following are not eligible for any replacement or refund:",
                items: [
                  "Change of mind or taste preference",
                  "Opened or partially used products",
                  "Products stored improperly after delivery",
                  "Failed age verification at delivery (package returned to us)",
                  "Delivery address errors provided by customer",
                  "Natural variations in tobacco products (leaf color, draw, burn)"
                ]
              },
              {
                icon: Clock,
                title: "4. How to Report an Issue",
                content: "If your order qualifies under section 1, here's the process:",
                items: [
                  "Take clear photos of the issue within 48 hours of delivery",
                  "Email returns@cigarro.com with your order number and photos",
                  "Our team reviews within 24 hours",
                  "Approved replacements ship next business day",
                  "You'll receive new tracking info via email/SMS"
                ]
              },
              {
                icon: Shield,
                title: "5. Refunds (Rare Cases Only)",
                content: "Refunds are only issued when:",
                items: [
                  "We cannot fulfill a replacement (product discontinued/out of stock long-term)",
                  "Repeated shipping failures to your address after 3 attempts",
                  "Legal or regulatory requirement mandates a refund"
                ],
                note: "Refunds process to original payment method within 5-7 business days. We'll always offer a replacement first."
              },
              {
                icon: Package,
                title: "6. Rolling Papers & Accessories",
                content: "Non-tobacco accessories (rolling papers, filters, lighters) follow a more flexible policy:",
                items: [
                  "Unopened, unused items: 14-day return window",
                  "Customer covers return shipping unless our error",
                  "Refund issued upon receipt and inspection",
                  "Same process: email returns@cigarro.com with photos"
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

          <div className="pt-8 border-t border-border/20">
            <h3 className="font-sans text-2xl text-foreground mb-6 text-center">Questions About Returns?</h3>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { title: "Returns Support", contact: "returns@cigarro.com", icon: RotateCcw },
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