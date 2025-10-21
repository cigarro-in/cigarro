import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Mail, Clock, Send, CheckCircle, MapPin, Users, Award, Shield, Sparkles, Zap, Heart, Star, Globe, Crown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';

export function ContactPage() {
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
      availability: 'Mon-Sat, 9 AM - 8 PM',
      action: 'Call Now',
      gradient: 'from-canyon/20 to-sunflower/20',
      feature: 'Instant Response',
      priority: 'high'
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Get detailed assistance via email',
      contact: 'support@cigarro.com',
      availability: 'Response within 24 hours',
      action: 'Send Email',
      gradient: 'from-coyote/20 to-canyon/20',
      feature: 'Detailed Guidance',
      priority: 'medium'
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Instant help from our experts',
      contact: 'Start Chat',
      availability: 'Available now',
      action: 'Start Chat',
      gradient: 'from-sunflower/20 to-coyote/20',
      feature: 'Real-time Help',
      priority: 'high'
    },
    {
      icon: MapPin,
      title: 'Visit Our Store',
      description: 'Experience our collection in person',
      contact: '123 Tobacco Lane, Mumbai',
      availability: 'Mon-Sat, 10 AM - 9 PM',
      action: 'Get Directions',
      gradient: 'from-dark/20 to-canyon/20',
      feature: 'Premium Experience',
      priority: 'premium'
    }
  ];

  const supportFeatures = [
    {
      icon: Users,
      title: 'Expert Team',
      description: 'Our certified tobacco specialists have years of experience helping customers find the perfect products.',
      gradient: 'from-canyon/10 to-sunflower/10',
      badge: 'Certified Experts'
    },
    {
      icon: Award,
      title: 'Premium Service',
      description: 'We provide personalized recommendations and exceptional customer service for every interaction.',
      gradient: 'from-sunflower/10 to-coyote/10',
      badge: 'Award-Winning'
    },
    {
      icon: Shield,
      title: 'Quality Guarantee',
      description: 'All our products are authentic and backed by our satisfaction guarantee.',
      gradient: 'from-coyote/10 to-dark/10',
      badge: '100% Authentic'
    }
  ];

  return (
    <>
      <Helmet>
        <title>Contact Us - Cigarro</title>
        <meta name="description" content="Get in touch with our tobacco experts for product recommendations, order support, and any questions about our premium collection." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://cigarro.in/contact" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-creme via-creme-light to-creme pt-24 pb-12 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 left-16 w-80 h-80 bg-gradient-to-r from-canyon/5 to-sunflower/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-gradient-to-l from-coyote/5 to-canyon/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-gradient-to-br from-sunflower/3 to-transparent rounded-full blur-2xl"></div>
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
              <MessageCircle className="w-6 h-6 text-canyon animate-pulse" />
              <span className="text-dark font-medium tracking-wide">Expert Support Available</span>
              <Sparkles className="w-6 h-6 text-canyon animate-pulse" />
            </motion.div>
            
            <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl text-dark mb-8 leading-tight">
              <span className="inline-block hover-lift">Get in</span>{' '}
              <span className="inline-block text-shimmer font-bold">Touch</span>
            </h1>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="h-1 bg-gradient-to-r from-transparent via-canyon to-transparent max-w-md mx-auto mb-8"
            ></motion.div>
            
            <p className="text-xl text-dark/60 max-w-2xl mx-auto leading-relaxed">
              Connect with our experts for personalized guidance and premium service
            </p>
          </motion.div>

          {/* Premium Support Features */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="mb-24"
          >
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6"
              >
                <Crown className="w-5 h-5 text-canyon" />
                <span className="text-dark font-medium">Why Choose Our Support</span>
              </motion.div>
              
              <h2 className="font-serif text-4xl md:text-5xl text-dark mb-6 leading-tight">
                Excellence in
                <span className="text-canyon block">Customer Care</span>
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {supportFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15, duration: 0.8 }}
                  className="group"
                >
                  <motion.div 
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="glass-card rounded-2xl p-8 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500 h-full text-center"
                  >
                    <div className="relative mb-6">
                      <div className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-2xl mx-auto flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                        <feature.icon className="w-10 h-10 text-canyon relative z-10" />
                      </div>
                      
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-canyon to-sunflower px-3 py-1 rounded-full">
                        <span className="text-white text-xs font-medium">{feature.badge}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-serif text-2xl text-dark font-bold mb-4 group-hover:text-canyon transition-colors duration-300">
                      {feature.title}
                    </h3>
                    
                    <p className="text-dark/70 leading-relaxed group-hover:text-dark/80 transition-colors duration-300">
                      {feature.description}
                    </p>
                    
                    <div className="mt-6 flex items-center justify-center space-x-1">
                      {[1,2,3,4,5].map((star) => (
                        <Star key={star} className="w-4 h-4 text-sunflower fill-current" />
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
            {/* Enhanced Contact Methods */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="space-y-10"
            >
              <div className="text-center lg:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6"
                >
                  <Phone className="w-5 h-5 text-canyon" />
                  <span className="text-dark font-medium">Multiple Ways to Connect</span>
                </motion.div>
                
                <h2 className="font-serif text-4xl md:text-5xl text-dark mb-6 leading-tight">
                  Choose Your
                  <span className="text-canyon block">Preferred Method</span>
                </h2>
                
                <div className="w-16 h-1 bg-gradient-to-r from-canyon to-sunflower mb-6 lg:mx-0 mx-auto"></div>
                
                <p className="text-lg text-dark/70 leading-relaxed">
                  Our expert team is ready to assist with product recommendations, order support, 
                  and personalized guidance for your premium tobacco journey.
                </p>
              </div>

              <div className="space-y-6">
                {contactMethods.map((method, index) => (
                  <motion.div
                    key={method.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.8 }}
                    className="group"
                  >
                    <motion.div 
                      whileHover={{ scale: 1.02, y: -4 }}
                      transition={{ duration: 0.3 }}
                      className="glass-card rounded-2xl p-6 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500 relative overflow-hidden"
                    >
                      {/* Priority Badge */}
                      {method.priority === 'high' && (
                        <div className="absolute top-4 right-4 bg-gradient-to-r from-canyon to-sunflower px-3 py-1 rounded-full">
                          <span className="text-white text-xs font-medium">High Priority</span>
                        </div>
                      )}
                      {method.priority === 'premium' && (
                        <div className="absolute top-4 right-4 bg-gradient-to-r from-dark to-canyon px-3 py-1 rounded-full">
                          <span className="text-white text-xs font-medium flex items-center space-x-1">
                            <Crown className="w-3 h-3" />
                            <span>Premium</span>
                          </span>
                        </div>
                      )}

                      <div className="flex items-start space-x-6">
                        <div className="flex-shrink-0">
                          <div className={`w-16 h-16 bg-gradient-to-br ${method.gradient} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <method.icon className="w-8 h-8 text-canyon relative z-10" />
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-serif text-xl text-dark font-bold group-hover:text-canyon transition-colors duration-300">
                              {method.title}
                            </h4>
                            <div className="bg-gradient-to-r from-canyon/10 to-sunflower/10 px-3 py-1 rounded-full">
                              <span className="text-canyon text-xs font-medium">{method.feature}</span>
                            </div>
                          </div>
                          
                          <p className="text-dark/70 leading-relaxed mb-4 group-hover:text-dark/80 transition-colors duration-300">
                            {method.description}
                          </p>
                          
                          <div className="space-y-2 mb-4">
                            <div className="font-medium text-dark text-lg">
                              {method.contact}
                            </div>
                            <div className="flex items-center space-x-2 text-dark/60">
                              <Clock className="w-4 h-4" />
                              <span className="text-sm">{method.availability}</span>
                            </div>
                          </div>
                          
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-canyon to-sunflower text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
                          >
                            <span>{method.action}</span>
                            <Zap className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* Enhanced Support Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="glass-card rounded-2xl p-8 border border-white/30 backdrop-blur-sm"
              >
                <div className="flex items-start space-x-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-canyon to-sunflower rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-serif text-xl text-dark font-bold mb-3">Expert Recommendations</h4>
                    <p className="text-dark/70 leading-relaxed mb-4">
                      Our team includes certified tobacco specialists who can help you find products 
                      based on your taste preferences, experience level, and specific requirements.
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-canyon">
                      <div className="flex items-center space-x-1">
                        <Heart className="w-4 h-4" />
                        <span>Personalized Service</span>
                      </div>
                      <div className="w-1 h-1 bg-canyon rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <Globe className="w-4 h-4" />
                        <span>Global Expertise</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Premium Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <div className="glass-card rounded-3xl p-10 border border-white/30 backdrop-blur-sm shadow-2xl">
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6"
                  >
                    <Mail className="w-5 h-5 text-canyon" />
                    <span className="text-dark font-medium">Send Message</span>
                  </motion.div>
                  
                  <h2 className="font-serif text-3xl md:text-4xl text-dark mb-4 leading-tight">
                    Let's Start a
                    <span className="text-canyon block">Conversation</span>
                  </h2>
                  
                  <div className="w-16 h-1 bg-gradient-to-r from-canyon to-sunflower mx-auto mb-4"></div>
                  
                  <p className="text-dark/60 leading-relaxed">
                    Share your requirements and we'll provide personalized recommendations
                  </p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                    >
                      <label htmlFor="name" className="block text-dark font-medium mb-3 flex items-center space-x-2">
                        <Users className="w-4 h-4 text-canyon" />
                        <span>Your Name</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-6 py-4 border border-white/30 rounded-xl focus:outline-none focus:border-canyon focus:ring-2 focus:ring-canyon/20 transition-all bg-white/50 backdrop-blur-sm"
                        placeholder="Enter your full name"
                      />
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    >
                      <label htmlFor="email" className="block text-dark font-medium mb-3 flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-canyon" />
                        <span>Email Address</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-6 py-4 border border-white/30 rounded-xl focus:outline-none focus:border-canyon focus:ring-2 focus:ring-canyon/20 transition-all bg-white/50 backdrop-blur-sm"
                        placeholder="your.email@example.com"
                      />
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    <label htmlFor="subject" className="block text-dark font-medium mb-3 flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-canyon" />
                      <span>Subject</span>
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      className="w-full px-6 py-4 border border-white/30 rounded-xl focus:outline-none focus:border-canyon focus:ring-2 focus:ring-canyon/20 transition-all bg-white/50 backdrop-blur-sm"
                    >
                      <option value="">Select a topic</option>
                      <option value="product-recommendation">🏆 Product Recommendation</option>
                      <option value="order-inquiry">📦 Order Inquiry</option>
                      <option value="product-question">❓ Product Question</option>
                      <option value="shipping">🚚 Shipping & Delivery</option>
                      <option value="return">↩️ Returns & Exchanges</option>
                      <option value="partnership">🤝 Business Partnership</option>
                      <option value="feedback">💭 Feedback & Suggestions</option>
                      <option value="other">📋 Other</option>
                    </select>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    <label htmlFor="message" className="block text-dark font-medium mb-3 flex items-center space-x-2">
                      <MessageCircle className="w-4 h-4 text-canyon" />
                      <span>Message</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      rows={6}
                      className="w-full px-6 py-4 border border-white/30 rounded-xl focus:outline-none focus:border-canyon focus:ring-2 focus:ring-canyon/20 transition-all resize-vertical bg-white/50 backdrop-blur-sm"
                      placeholder="Tell us how we can help you... Share your preferences, experience level, or specific requirements."
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                  >
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-canyon to-sunflower text-white hover:from-dark hover:to-canyon transition-all duration-500 h-14 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                          Sending Message...
                        </>
                      ) : (
                        <>
                          <Send className="mr-3 w-6 h-6" />
                          Send Message
                          <Sparkles className="ml-3 w-6 h-6" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Enhanced Response Time Notice */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="mt-8 glass-card p-6 rounded-2xl border border-white/20 backdrop-blur-sm"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-canyon to-sunflower rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-dark mb-2">Response Guarantee</h4>
                      <p className="text-dark/70 text-sm leading-relaxed">
                        We typically respond within <strong>24 hours</strong> during business days. For urgent matters, 
                        please call us directly for immediate assistance.
                      </p>
                      <div className="flex items-center space-x-4 mt-3 text-xs text-canyon">
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Expert Response</span>
                        </div>
                        <div className="w-1 h-1 bg-canyon rounded-full"></div>
                        <div className="flex items-center space-x-1">
                          <Shield className="w-3 h-3" />
                          <span>Secure & Private</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Premium FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="mt-32"
          >
            <div className="text-center mb-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6"
              >
                <MessageCircle className="w-5 h-5 text-canyon" />
                <span className="text-dark font-medium">Quick Answers</span>
              </motion.div>
              
              <h2 className="font-serif text-4xl md:text-5xl text-dark mb-6 leading-tight">
                Frequently Asked
                <span className="text-canyon block">Questions</span>
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-6"></div>
              
              <p className="text-xl text-dark/60 max-w-3xl mx-auto leading-relaxed">
                Find instant answers to common questions about our products and services
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                {[
                  {
                    question: "How do I choose the right tobacco product?",
                    answer: "Our experts can help you select products based on your taste preferences, experience level, and specific requirements. Contact us for personalized recommendations.",
                    icon: Award
                  },
                  {
                    question: "What is your return policy?",
                    answer: "We offer a 30-day return policy for unopened products. Contact our support team for assistance with returns and exchanges.",
                    icon: Shield
                  },
                  {
                    question: "Do you ship internationally?",
                    answer: "Currently, we ship within India. International shipping options are being evaluated for future expansion.",
                    icon: Globe
                  }
                ].map((faq, index) => (
                  <motion.div
                    key={faq.question}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.8 }}
                    className="group"
                  >
                    <motion.div 
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.3 }}
                      className="glass-card rounded-2xl p-8 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-canyon/20 to-sunflower/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                          <faq.icon className="w-6 h-6 text-canyon" />
                        </div>
                        <div>
                          <h3 className="font-serif text-xl text-dark font-bold mb-4 group-hover:text-canyon transition-colors duration-300">
                            {faq.question}
                          </h3>
                          <p className="text-dark/70 leading-relaxed group-hover:text-dark/80 transition-colors duration-300">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              <div className="space-y-6">
                {[
                  {
                    question: "How can I track my order?",
                    answer: "You'll receive a tracking number via email once your order ships. You can also check your order status in your account dashboard.",
                    icon: Users
                  },
                  {
                    question: "Are your products authentic?",
                    answer: "Yes, all our products are 100% authentic and sourced directly from authorized distributors and manufacturers.",
                    icon: CheckCircle
                  },
                  {
                    question: "Do you offer bulk discounts?",
                    answer: "Yes, we offer special pricing for bulk orders and business partnerships. Contact us to discuss your requirements.",
                    icon: Heart
                  }
                ].map((faq, index) => (
                  <motion.div
                    key={faq.question}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (index + 3) * 0.1, duration: 0.8 }}
                    className="group"
                  >
                    <motion.div 
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.3 }}
                      className="glass-card rounded-2xl p-8 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-coyote/20 to-dark/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                          <faq.icon className="w-6 h-6 text-canyon" />
                        </div>
                        <div>
                          <h3 className="font-serif text-xl text-dark font-bold mb-4 group-hover:text-canyon transition-colors duration-300">
                            {faq.question}
                          </h3>
                          <p className="text-dark/70 leading-relaxed group-hover:text-dark/80 transition-colors duration-300">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}

