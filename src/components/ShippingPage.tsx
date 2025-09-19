import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Truck, Package, Clock, MapPin, Shield, AlertTriangle, CheckCircle, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export function ShippingPage() {
  return (
    <>
      <Helmet>
        <title>Shipping Policy - Cigarro</title>
        <meta name="description" content="Shipping Policy for Cigarro Premium Marketplace - Information about delivery, shipping costs, and delivery times." />
      </Helmet>
      
      <div className="min-h-screen bg-creme pt-24 pb-12">
        <div className="main-container">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="main-title text-dark mb-6 max-w-4xl mx-auto">
              Shipping Policy
            </h1>
          </div>

          <div className="max-w-4xl mx-auto">
            
            {/* Free Shipping Notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-canyon/10 border-2 border-canyon/20 rounded-xl p-8 mb-12"
            >
              <div className="flex items-start space-x-4">
                <Truck className="w-8 h-8 text-canyon flex-shrink-0 mt-1" />
                <div>
                  <h2 className="medium-title text-dark mb-4">Free Shipping on All Orders</h2>
                  <p className="text text-dark/80 leading-relaxed">
                    We offer free shipping on all orders within India. Your premium tobacco products will be delivered 
                    safely and securely to your doorstep with full tracking and insurance coverage.
                  </p>
                  <div className="flex items-center space-x-2 text-canyon font-medium mt-4">
                    <CheckCircle className="w-5 h-5" />
                    <span>Free shipping on all orders</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Shipping Content */}
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
                    <MapPin className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">1. Delivery Areas</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    We currently deliver to all major cities and towns across India. Our delivery network covers:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>All metropolitan cities (Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad, Pune)</li>
                    <li>State capitals and major district headquarters</li>
                    <li>Most tier-2 and tier-3 cities</li>
                    <li>Remote areas (delivery times may vary)</li>
                  </ul>
                  <p className="text text-dark/80 leading-relaxed mt-4">
                    If you're unsure about delivery to your location, please contact our customer support team before placing your order.
                  </p>
                </div>
              </div>

              {/* Section 2 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">2. Delivery Times</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    Standard delivery times vary by location:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li><strong>Metro cities:</strong> 2-3 business days</li>
                    <li><strong>Tier-2 cities:</strong> 3-5 business days</li>
                    <li><strong>Tier-3 cities and towns:</strong> 5-7 business days</li>
                    <li><strong>Remote areas:</strong> 7-10 business days</li>
                  </ul>
                  <p className="text text-dark/80 leading-relaxed mt-4">
                    Delivery times are calculated from the date of dispatch, not the order date. 
                    Processing time is typically 1-2 business days.
                  </p>
                </div>
              </div>

              {/* Section 3 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">3. Packaging and Handling</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    All tobacco products are packaged with the utmost care to ensure freshness and quality:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Premium packaging materials to protect products</li>
                    <li>Temperature-controlled storage and transport</li>
                    <li>Discrete packaging for privacy</li>
                    <li>Proper labeling and handling instructions</li>
                    <li>Insurance coverage for all shipments</li>
                  </ul>
                </div>
              </div>

              {/* Section 4 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">4. Age Verification and Delivery</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    Due to legal requirements, all tobacco product deliveries require age verification:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Recipient must be 18 years or older</li>
                    <li>Valid government-issued ID required at delivery</li>
                    <li>Delivery cannot be left unattended</li>
                    <li>Someone of legal age must be present to receive the package</li>
                    <li>Failed age verification will result in package return</li>
                  </ul>
                </div>
              </div>

              {/* Section 5 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-canyon" />
                  </div>
                  <h2 className="medium-title text-dark">5. Delivery Issues and Returns</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    If you experience any issues with your delivery:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Contact our customer support immediately</li>
                    <li>We will investigate and resolve the issue promptly</li>
                    <li>Damaged or incorrect items will be replaced at no cost</li>
                    <li>Failed deliveries due to age verification are non-refundable</li>
                    <li>All returns must be initiated within 7 days of delivery</li>
                  </ul>
                </div>
              </div>

              {/* Section 6 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Globe className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">6. International Shipping</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    Currently, we only ship within India. International shipping is not available due to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Complex international tobacco regulations</li>
                    <li>Customs and import restrictions</li>
                    <li>Age verification requirements vary by country</li>
                    <li>Shipping and handling complexities</li>
                  </ul>
                  <p className="text text-dark/80 leading-relaxed mt-4">
                    We are evaluating international shipping options for the future. 
                    Please contact us if you're interested in international delivery.
                  </p>
                </div>
              </div>

              {/* Section 7 */}
              <div className="bg-white rounded-xl p-8 shadow-lg border border-coyote/20">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-dark/10 rounded-lg flex items-center justify-center">
                    <Truck className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="medium-title text-dark">7. Tracking Your Order</h2>
                </div>
                <div className="space-y-4">
                  <p className="text text-dark/80 leading-relaxed">
                    Once your order is dispatched, you will receive:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text text-dark/80">
                    <li>Email confirmation with tracking number</li>
                    <li>SMS updates on delivery status</li>
                    <li>Real-time tracking through our website</li>
                    <li>Delivery notifications and estimated arrival time</li>
                    <li>Contact information for the delivery partner</li>
                  </ul>
                </div>
              </div>

            </motion.div>

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-dark/5 rounded-xl p-8 mt-12"
            >
              <h2 className="medium-title text-dark mb-6">Shipping Questions?</h2>
              <p className="text text-dark/80 leading-relaxed mb-6">
                If you have any questions about shipping, delivery, or need to track your order, 
                our customer support team is here to help.
              </p>
              <div className="space-y-3">
                <p className="text-dark font-medium">
                  <span className="text-coyote">Shipping Support:</span> shipping@cigarro.com
                </p>
                <p className="text-dark font-medium">
                  <span className="text-coyote">General Support:</span> support@cigarro.com
                </p>
                <p className="text-dark font-medium">
                  <span className="text-coyote">Phone:</span> +91 98765 43210
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
