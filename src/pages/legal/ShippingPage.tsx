import React from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { Truck, Shield, CheckCircle, MapPin, Clock, Package, AlertTriangle, Globe, CalendarDays, Mail } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { useShippingMethods } from '../../hooks/data/useContent';
import { formatINR } from '../../utils/currency';

export function ShippingPage() {
  const location = useLocation();
  // Live delivery options (same source as checkout) — the policy page can
  // never drift from what customers actually pay.
  const { methods } = useShippingMethods();
  const deliveryItems = methods.map((m) =>
    `${m.label}: ${m.eta}${m.priceRupees === 0 ? ', free' : `, ${formatINR(m.priceRupees)}`}`,
  );
  const allMethodsAreFree = methods.length > 0 && methods.every((m) => m.priceRupees === 0);

  return (
    <>
      <SEOHead
        title="Shipping and Delivery Policy | Cigarro"
        description="See how Cigarro delivery availability, shipping options, dispatch, tracking and age verification work for orders within India."
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
                  <h3 className="font-sans text-lg font-bold text-foreground mb-2">
                    {allMethodsAreFree
                      ? 'Free Shipping on All Orders'
                      : 'Delivery Options at Checkout'}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {allMethodsAreFree
                      ? 'The delivery methods currently available at checkout do not add a shipping charge. Availability still depends on the delivery pin code.'
                      : 'Available delivery methods, estimated times and any shipping charge are shown at checkout before you place the order.'}
                  </p>
                  <div className="flex items-center gap-6 mt-4 text-xs text-accent font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>India only</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>Tracked when available</span>
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
                  content: "We currently ship only within India. Serviceability depends on the delivery pin code and the available delivery partner.",
                  items: [
                    "Enter the complete address and pin code during checkout",
                    "Delivery options may differ by location",
                    "Some remote or restricted pin codes may not be serviceable",
                    "An order may be cancelled and refunded if delivery cannot be arranged"
                  ],
                  note: "If you're unsure about delivery to your location, please contact our customer support team before placing your order."
                },
                {
                  icon: Clock,
                  title: "2. Delivery Times",
                  content: "Choose a delivery speed at checkout — same options, same prices as below:",
                  items: [
                    ...deliveryItems,
                    "The estimate begins after the order is confirmed for fulfilment",
                    "Tracking information is shared when the delivery partner provides it"
                  ],
                  note: "Delivery dates are estimates, not guarantees. Carrier delays and service interruptions can affect them."
                },
                {
                  icon: Package,
                  title: "3. Packaging and Handling",
                  content: "Orders are packed for transport using the product and order information available to us:",
                  items: [
                    "Protective outer packaging is used where appropriate",
                    "The shipping label contains the information required for delivery",
                    "Check the parcel and items promptly after delivery",
                    "Report damage or an incorrect item within 48 hours"
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
                    "We will review the order details and evidence",
                    "An eligible damaged or incorrect item may be replaced or refunded",
                    "Failed deliveries due to age verification are non-refundable",
                    "Damage or an incorrect item must be reported within 48 hours of delivery"
                  ]
                },
                {
                  icon: Globe,
                  title: "6. International Shipping",
                  content: "Cigarro does not currently offer international shipping.",
                  items: [
                    "Orders require an Indian delivery address",
                    "International forwarding is not supported",
                    "We cannot advise on customs or import requirements outside India"
                  ],
                  note: "The website will be updated if this policy changes."
                },
                {
                  icon: Truck,
                  title: "7. Tracking Your Order",
                  content: "Once your order is dispatched, you will receive:",
                  items: [
                    "A dispatch update when the order leaves for delivery",
                    "A tracking number or link when supplied by the delivery partner",
                    "Carrier updates and an estimated arrival date where available",
                    "Order status in your Cigarro account"
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
            <div className="grid md:grid-cols-2 gap-4">
              {[
                  { title: "Shipping support", contact: "support@cigarro.in", icon: Mail },
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
