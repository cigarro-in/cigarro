import React from 'react';
import { SEOHead } from '../../components/seo/SEOHead';
import { Truck, Package, Clock, MapPin, Shield, AlertTriangle, CheckCircle, Globe, Sparkles, Crown, Heart, Star, Users, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

export function ShippingPage() {
  return (
    <>
      <SEOHead
        title="Shipping Policy - Delivery Information"
        description="Shipping Policy for Cigarro Premium Marketplace - Information about delivery, shipping costs, and delivery times across India."
        url="/shipping"
        type="website"
        keywords={['shipping policy', 'delivery information', 'shipping costs', 'delivery times India']}
      />
      
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
              <Truck className="w-6 h-6 text-canyon animate-pulse" />
              <span className="text-dark font-medium tracking-wide">Free Shipping Nationwide</span>
              <Package className="w-6 h-6 text-canyon animate-pulse" />
            </motion.div>
            
            <h1 className="main-title text-dark mb-8 max-w-4xl mx-auto">
              Shipping Policy
            </h1>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="h-1 bg-gradient-to-r from-transparent via-canyon to-transparent max-w-md mx-auto mb-8"
            ></motion.div>
            
            <p className="text-xl text-dark/60 max-w-2xl mx-auto leading-relaxed">
              Fast, secure, and free delivery of your premium tobacco products
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto">
            
            {/* Enhanced Free Shipping Notice */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="glass-card rounded-3xl p-12 backdrop-blur-xl border border-white/20 shadow-2xl mb-20"
            >
              <div className="flex items-start space-x-6">
                <div className="w-16 h-16 bg-gradient-to-br from-canyon/20 to-sunflower/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Truck className="w-8 h-8 text-canyon" />
                </div>
                <div className="flex-1">
                  <h2 className="medium-title text-dark mb-6">Free Shipping on All Orders</h2>
                  <p className="text text-dark/80 leading-relaxed mb-6">
                    We offer free shipping on all orders within India. Your premium tobacco products will be delivered 
                    safely and securely to your doorstep with full tracking and insurance coverage.
                  </p>
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 text-canyon font-medium">
                    <CheckCircle className="w-5 h-5" />
                    <span>Free shipping on all orders</span>
                    </div>
                    <div className="w-1 h-1 bg-canyon rounded-full"></div>
                    <div className="flex items-center space-x-2 text-canyon font-medium">
                      <Shield className="w-5 h-5" />
                      <span>Fully insured delivery</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Enhanced Shipping Content */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="space-y-12 mb-20"
            >
              {[
                {
                  icon: MapPin,
                  title: "1. Delivery Areas",
                  gradient: "from-canyon/20 to-sunflower/20",
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
                  gradient: "from-sunflower/20 to-coyote/20",
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
                  gradient: "from-coyote/20 to-dark/20",
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
                  gradient: "from-dark/20 to-canyon/20",
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
                  gradient: "from-canyon/20 to-sunflower/20",
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
                  gradient: "from-sunflower/20 to-coyote/20",
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
                  gradient: "from-coyote/20 to-dark/20",
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
                        <h2 className="medium-title text-dark mb-6 group-hover:text-canyon transition-colors duration-300">
                          {section.title}
                        </h2>
                        
                        <div className="w-16 h-1 bg-gradient-to-r from-canyon to-sunflower mb-6 group-hover:w-24 transition-all duration-300"></div>
                        
                        <p className="text text-dark/80 leading-relaxed group-hover:text-dark/90 transition-colors duration-300 mb-6">
                          {section.content}
                  </p>
                </div>
              </div>

                    {section.items && (
                      <div className="ml-22">
                        <ul className="space-y-3">
                          {section.items.map((item, itemIndex) => (
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
                    
                    {section.note && (
                      <div className="mt-6 ml-22">
                        <p className="text text-dark/70 leading-relaxed group-hover:text-dark/80 transition-colors duration-300">
                          {section.note}
                        </p>
                </div>
                    )}
                    
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
                    <Truck className="w-5 h-5 text-canyon" />
                    <span className="text-dark font-medium">Shipping Questions</span>
                  </motion.div>
                  
                  <h2 className="medium-title text-dark mb-8">Shipping Questions?</h2>
                  
                  <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-8"></div>
                  
                  <p className="text text-dark/80 leading-relaxed mb-10 max-w-3xl mx-auto">
                    If you have any questions about shipping, delivery, or need to track your order, 
                    our customer support team is here to help.
                  </p>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="grid md:grid-cols-4 gap-8 mb-10"
                  >
                    {[
                      {
                        icon: Truck,
                        title: "Shipping Support",
                        contact: "shipping@cigarro.com",
                        description: "Delivery & tracking"
                      },
                      {
                        icon: Users,
                        title: "General Support",
                        contact: "support@cigarro.com",
                        description: "24/7 assistance"
                      },
                      {
                        icon: Phone,
                        title: "Phone Support",
                        contact: "+91 98765 43210",
                        description: "Direct contact"
                      },
                      {
                        icon: Heart,
                        title: "Last Updated",
                        contact: "January 2025",
                        description: "Current policy"
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
