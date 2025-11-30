import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Phone, Mail, Clock, Send, CheckCircle, MapPin, Users, Award, Shield, Sparkles, Zap, Globe } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { SEOHead } from '../../components/seo/SEOHead';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export function ContactPage() {
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      subject: value
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
      feature: 'Premium Experience',
      priority: 'premium'
    }
  ];

  const supportFeatures = [
    {
      icon: Users,
      title: 'Expert Team',
      description: 'Our certified tobacco specialists have years of experience helping customers find the perfect products.',
      badge: 'Certified Experts'
    },
    {
      icon: Award,
      title: 'Premium Service',
      description: 'We provide personalized recommendations and exceptional customer service for every interaction.',
      badge: 'Award-Winning'
    },
    {
      icon: Shield,
      title: 'Quality Guarantee',
      description: 'All our products are authentic and backed by our satisfaction guarantee.',
      badge: '100% Authentic'
    }
  ];

  return (
    <>
      <SEOHead
        title="Contact Us - Get Expert Tobacco Advice"
        description="Get in touch with our tobacco experts for product recommendations, order support, and any questions about our premium collection. Available Mon-Sat, 9 AM - 8 PM."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['contact cigarro', 'tobacco experts', 'customer support', 'cigarette help', 'order support India']}
      />
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Minimal Header */}
        <div className="bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4 pt-4">
            <div className="text-center">
              <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-foreground">
                Contact Us
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          
          {/* Intro */}
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-xl text-muted-foreground leading-relaxed">
              Connect with our experts for personalized guidance, product recommendations, and premium support for your tobacco journey.
            </p>
          </div>

          {/* Support Features */}
          <div>
            <h2 className="font-serif text-3xl text-foreground text-center mb-8">Why Choose Our Support</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {supportFeatures.map((feature, index) => (
                <Card key={index} className="border-2 border-border/40 bg-card hover:border-accent/40 transition-colors">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center mx-auto mb-4">
                      <feature.icon className="w-6 h-6 text-accent" />
                    </div>
                    <div className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold mb-3 uppercase tracking-wide">
                      {feature.badge}
                    </div>
                    <h3 className="font-sans text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Methods */}
            <div className="space-y-8">
              <div>
                <h2 className="font-serif text-3xl text-foreground mb-4">Get in Touch</h2>
                <p className="text-muted-foreground">
                  Choose your preferred way to connect with our team. We're here to help you with any questions or requests.
                </p>
              </div>

              <div className="space-y-4">
                {contactMethods.map((method, index) => (
                  <Card key={index} className="border-2 border-border/40 bg-card hover:border-accent/40 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                          <method.icon className="w-6 h-6 text-accent" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-sans text-lg font-bold text-foreground">{method.title}</h3>
                            {method.priority === 'high' && (
                              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">Fast</span>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm mb-3">{method.description}</p>
                          <div className="flex items-center gap-2 text-foreground font-medium mb-1">
                            {method.contact}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {method.availability}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0 mt-1">
                          {method.action}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-2 border-accent/20 bg-accent/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-sans text-lg font-bold text-foreground mb-2">Expert Recommendations</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Our team includes certified tobacco specialists who can help you find products 
                        based on your taste preferences, experience level, and specific requirements.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div>
              <Card className="border-2 border-border/40 bg-card h-full">
                <CardContent className="p-8">
                  <div className="mb-8">
                    <h2 className="font-serif text-3xl text-foreground mb-2">Send a Message</h2>
                    <p className="text-muted-foreground">
                      Share your requirements and we'll provide personalized recommendations.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Your Name</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Full Name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="name@example.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Select onValueChange={handleSelectChange} value={formData.subject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a topic" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product-recommendation">🏆 Product Recommendation</SelectItem>
                          <SelectItem value="order-inquiry">📦 Order Inquiry</SelectItem>
                          <SelectItem value="product-question">❓ Product Question</SelectItem>
                          <SelectItem value="shipping">🚚 Shipping & Delivery</SelectItem>
                          <SelectItem value="return">↩️ Returns & Exchanges</SelectItem>
                          <SelectItem value="partnership">🤝 Business Partnership</SelectItem>
                          <SelectItem value="feedback">💭 Feedback & Suggestions</SelectItem>
                          <SelectItem value="other">📋 Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        placeholder="Tell us how we can help you..."
                        rows={6}
                        required
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-dark text-creme-light hover:bg-canyon h-12 text-base"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                          Sending...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Send Message
                        </span>
                      )}
                    </Button>
                  </form>

                  <div className="mt-6 flex items-start gap-3 p-4 bg-muted/20 rounded-lg text-xs text-muted-foreground">
                    <Clock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Response Guarantee:</strong> We typically respond within 24 hours during business days. 
                      For urgent matters, please call us directly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="pt-12 border-t border-border/20">
            <h2 className="font-serif text-3xl text-foreground text-center mb-8">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-6">
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
                },
                {
                  question: "How can I track my order?",
                  answer: "You'll receive a tracking number via email once your order ships. You can also check your order status in your account dashboard.",
                  icon: Users
                }
              ].map((faq, index) => (
                <Card key={index} className="border-2 border-border/40 bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                        <faq.icon className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-sans text-lg font-bold text-foreground mb-2">{faq.question}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
