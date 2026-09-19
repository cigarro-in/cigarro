import React from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { Shield, Clock, Package, AlertTriangle, CalendarDays, Mail, RotateCcw, XCircle, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

export function ReturnsPage() {
  const location = useLocation();
  
  return (
    <>
      <SEOHead
        title="Returns and Refunds Policy | Cigarro"
        description="Read Cigarro's policy for non-returnable tobacco products and how to report a damaged, defective or incorrect item within 48 hours."
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
                  Because tobacco products are consumable goods, we do not accept change-of-mind returns
                  or exchanges after dispatch. Please review the product, variant and quantity before ordering.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {[
              {
                icon: RotateCcw,
                title: "1. When to Report a Problem",
                content: "Contact us if an order arrives with one of these issues:",
                items: [
                  "Damaged in transit: Products that arrive physically damaged (crushed, broken, leaking)",
                  "Incorrect items: You received a different product than what you ordered",
                  "Manufacturing defects: Sealed products with visible manufacturing flaws"
                ],
                note: "All claims must be reported within 48 hours of delivery with clear photos of the issue."
              },
              {
                icon: ShieldCheck,
                title: "2. How We Resolve Eligible Claims",
                content: "We review the order details and evidence before confirming a resolution. Depending on the issue and availability, we may:",
                items: [
                  "Replace the damaged, defective or incorrect item",
                  "Refund the affected item when a suitable replacement is unavailable",
                  "Ask for further information needed to assess the claim"
                ],
                note: "Do not dispose of an affected item until support confirms that it is no longer required for review."
              },
              {
                icon: AlertTriangle,
                title: "3. What We Cannot Accept",
                content: "The following are not eligible for any replacement or refund:",
                items: [
                  "Change of mind or taste preference",
                  "Opened or partially used products",
                  "Products stored improperly after delivery",
                  "A delivery refused because age verification could not be completed",
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
                  "Email support@cigarro.in with your order number and photos",
                  "Keep the item and its packaging while the claim is reviewed",
                  "Wait for support to confirm the available resolution",
                  "If a replacement ships, tracking information will be shared when available"
                ]
              },
              {
                icon: Shield,
                title: "5. Refunds",
                content: "A refund may be approved when:",
                items: [
                  "An eligible item cannot be replaced",
                  "An order is cancelled before fulfilment and payment has already been received",
                  "A refund is required by applicable law"
                ],
                note: "The available refund method and expected processing time will be confirmed when the refund is approved."
              },
              {
                icon: Package,
                title: "6. Rolling Papers & Accessories",
                content: "For a damaged, defective or incorrect non-tobacco accessory:",
                items: [
                  "Report the issue within 48 hours of delivery",
                  "Keep the item unused and in its original packaging",
                  "Email support@cigarro.in with the order number and clear photos",
                  "Support will confirm whether a replacement, return or refund applies"
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
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: "Returns support", contact: "support@cigarro.in", icon: Mail },
                { title: "Last updated", contact: "20 September 2026", icon: CalendarDays }
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
