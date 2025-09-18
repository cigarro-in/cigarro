import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Mail, Clock, Send, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

export function ContactSupport() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      toast.success('Message sent successfully! We\'ll get back to you within 24 hours.');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 2000);
  };

  const contactMethods = [
    {
      icon: Phone,
      title: 'Call Us',
      description: 'Speak with our tobacco specialists',
      contact: '+91 98765 43210',
      availability: 'Mon-Sat, 9 AM - 8 PM'
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Get detailed assistance via email',
      contact: 'support@cigarro.com',
      availability: 'Response within 24 hours'
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Instant help from our experts',
      contact: 'Start Chat',
      availability: 'Available now'
    }
  ];

  return (
    <section className="py-12 bg-creme min-h-screen flex items-center">
      <div className="main-container w-full">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="suptitle text-canyon mb-6">Need Assistance?</div>
          <h2 className="medium-title text-dark mb-8 max-w-4xl mx-auto">
            Can't Find What You're Looking For?
          </h2>
          <p className="text text-dark/80 max-w-3xl mx-auto leading-relaxed">
            Our tobacco experts are here to help you discover the perfect products for your taste. 
            Whether you need recommendations, have questions about our collection, or need assistance with your order.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">
          {/* Contact Methods */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div>
              <h3 className="font-serif text-2xl text-dark mb-6">
                Get In Touch
              </h3>
              <p className="text text-dark/70 leading-relaxed mb-8">
                Choose the method that works best for you. Our knowledgeable team is ready to assist 
                with product recommendations, order support, and any questions about our premium collection.
              </p>
            </div>

            <div className="space-y-6">
              {contactMethods.map((method, index) => (
                <motion.div
                  key={method.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="group"
                >
                  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-500 group-hover:scale-[1.02]">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-canyon/10 rounded-full flex items-center justify-center group-hover:bg-canyon group-hover:text-creme-light transition-all duration-300">
                          <method.icon className="w-6 h-6 text-canyon group-hover:text-creme-light" />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-medium text-dark text-lg mb-2 group-hover:text-canyon transition-colors">
                          {method.title}
                        </h4>
                        <p className="text-dark/70 text-sm leading-relaxed mb-3">
                          {method.description}
                        </p>
                        <div className="space-y-1">
                          <div className="font-medium text-dark">
                            {method.contact}
                          </div>
                          <div className="flex items-center space-x-2 text-dark/60 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>{method.availability}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Additional Support Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="bg-canyon/5 rounded-xl p-6 border border-canyon/20"
            >
              <div className="flex items-start space-x-4">
                <CheckCircle className="w-6 h-6 text-canyon flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-medium text-dark mb-2">Expert Recommendations</h4>
                  <p className="text-dark/70 text-sm leading-relaxed">
                    Our team includes certified tobacco specialists who can help you find products 
                    based on your taste preferences, experience level, and specific requirements.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <h3 className="font-serif text-2xl text-dark mb-6">
                Send Us a Message
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-dark font-medium mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-coyote/30 rounded-lg focus:outline-none focus:border-canyon transition-colors bg-creme/30"
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-dark font-medium mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-coyote/30 rounded-lg focus:outline-none focus:border-canyon transition-colors bg-creme/30"
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-dark font-medium mb-2">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-coyote/30 rounded-lg focus:outline-none focus:border-canyon transition-colors bg-creme/30"
                  >
                    <option value="">Select a topic</option>
                    <option value="product-recommendation">Product Recommendation</option>
                    <option value="order-inquiry">Order Inquiry</option>
                    <option value="product-question">Product Question</option>
                    <option value="shipping">Shipping & Delivery</option>
                    <option value="return">Returns & Exchanges</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-dark font-medium mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border border-coyote/30 rounded-lg focus:outline-none focus:border-canyon transition-colors resize-vertical bg-creme/30"
                    placeholder="Tell us how we can help you..."
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-canyon text-creme-light hover:bg-dark transition-all duration-300 h-12 text-lg font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-creme-light/30 border-t-creme-light rounded-full animate-spin mr-3" />
                      Sending Message...
                    </>
                  ) : (
                    <>
                      <Send className="mr-3 w-5 h-5" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>

              {/* Response Time Notice */}
              <div className="mt-6 p-4 bg-creme/50 rounded-lg border border-coyote/20">
                <p className="text-dark/70 text-sm leading-relaxed">
                  <strong>Response Time:</strong> We typically respond to all inquiries within 24 hours during business days. 
                  For urgent matters, please call us directly.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
