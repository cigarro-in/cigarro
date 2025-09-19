import React from 'react';
import { motion } from 'framer-motion';
import { Award, Users, Globe, Heart, Shield, Star, Leaf, Coffee } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export function AboutPage() {
  const values = [
    {
      icon: Award,
      title: 'Excellence',
      description: 'We are committed to providing only the finest tobacco products, carefully curated from the world\'s most respected producers.'
    },
    {
      icon: Heart,
      title: 'Passion',
      description: 'Our love for tobacco craftsmanship drives us to share the rich heritage and artistry behind every product we offer.'
    },
    {
      icon: Shield,
      title: 'Authenticity',
      description: 'Every product in our collection is guaranteed authentic, sourced directly from authorized distributors and manufacturers.'
    },
    {
      icon: Users,
      title: 'Community',
      description: 'We believe in building lasting relationships with our customers, sharing knowledge and fostering a community of enthusiasts.'
    }
  ];

  const milestones = [
    {
      year: '2015',
      title: 'Founded',
      description: 'Cigarro was established with a vision to bring premium tobacco products to discerning customers in India.'
    },
    {
      year: '2017',
      title: 'First Store',
      description: 'Opened our flagship store in Mumbai, offering an immersive experience for tobacco enthusiasts.'
    },
    {
      year: '2019',
      title: 'Online Platform',
      description: 'Launched our e-commerce platform, making premium tobacco products accessible nationwide.'
    },
    {
      year: '2021',
      title: 'International Partnerships',
      description: 'Established direct partnerships with renowned tobacco houses from Cuba, Dominican Republic, and Nicaragua.'
    },
    {
      year: '2023',
      title: 'Expert Team',
      description: 'Assembled a team of certified tobacco specialists to provide expert guidance and recommendations.'
    },
    {
      year: '2024',
      title: 'Innovation',
      description: 'Introduced advanced storage solutions and personalized curation services for our premium customers.'
    }
  ];

  const team = [
    {
      name: 'Rajesh Kumar',
      role: 'Founder & CEO',
      image: '/images/team/rajesh.jpg',
      description: 'With over 15 years in the tobacco industry, Rajesh founded Cigarro to share his passion for premium tobacco products.'
    },
    {
      name: 'Maria Santos',
      role: 'Head of Curation',
      image: '/images/team/maria.jpg',
      description: 'Maria brings her expertise from Cuban tobacco farms, ensuring every product meets our exacting standards.'
    },
    {
      name: 'David Chen',
      role: 'Customer Experience Director',
      image: '/images/team/david.jpg',
      description: 'David leads our customer service team, ensuring every interaction exceeds expectations.'
    },
    {
      name: 'Elena Vasquez',
      role: 'Quality Assurance Manager',
      image: '/images/team/elena.jpg',
      description: 'Elena oversees our quality control processes, guaranteeing authenticity and freshness of every product.'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Happy Customers' },
    { number: '500+', label: 'Premium Products' },
    { number: '50+', label: 'International Brands' },
    { number: '99%', label: 'Customer Satisfaction' }
  ];

  return (
    <>
      <Helmet>
        <title>About Us - Cigarro</title>
        <meta name="description" content="Learn about Cigarro's commitment to excellence in premium tobacco products, our heritage, values, and the expert team behind our curated collection." />
      </Helmet>

      <div className="min-h-screen bg-creme pt-24 pb-12">
        <div className="main-container">
          {/* Page Header */}
          <div className="text-center mb-16">
            <h1 className="main-title text-dark mb-6 max-w-4xl mx-auto">
              About Cigarro
            </h1>
          </div>

          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <div className="max-w-4xl mx-auto">
              <p className="text text-dark/80 leading-relaxed mb-8">
                At Cigarro, we are passionate about bringing the world's finest tobacco products to discerning customers. 
                Our journey began with a simple belief: that everyone deserves access to authentic, premium tobacco products 
                that represent the pinnacle of craftsmanship and tradition.
              </p>
              <p className="text text-dark/80 leading-relaxed">
                From our humble beginnings to becoming India's premier destination for premium tobacco, we have remained 
                committed to excellence, authenticity, and the rich heritage that makes each product in our collection truly special.
              </p>
            </div>
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20"
          >
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-serif text-canyon mb-2">
                  {stat.number}
                </div>
                <div className="text-dark/70 text-sm font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Values Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="medium-title text-dark mb-6">
                Our Values
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-canyon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-8 h-8 text-canyon" />
                  </div>
                  <h3 className="font-medium text-dark text-lg mb-3">{value.title}</h3>
                  <p className="text-dark/70 text-sm leading-relaxed">{value.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Timeline Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="medium-title text-dark mb-6">
                Our Journey
              </h2>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-coyote/30"></div>
              
              <div className="space-y-12">
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={milestone.year}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.6 }}
                    className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}
                  >
                    <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                      <div className="bg-white rounded-xl p-6 shadow-lg">
                        <div className="text-canyon font-bold text-2xl mb-2">{milestone.year}</div>
                        <h3 className="font-medium text-dark text-lg mb-2">{milestone.title}</h3>
                        <p className="text-dark/70 text-sm leading-relaxed">{milestone.description}</p>
                      </div>
                    </div>
                    
                    {/* Timeline dot */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-canyon rounded-full border-4 border-creme"></div>
                    
                    <div className="w-1/2"></div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Team Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="medium-title text-dark mb-6">
                Meet Our Team
              </h2>
              <p className="text text-dark/80 max-w-3xl mx-auto leading-relaxed">
                Our expert team brings together decades of experience in the tobacco industry, 
                ensuring that every product we offer meets the highest standards of quality and authenticity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="text-center"
                >
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <div className="w-24 h-24 bg-coyote/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Users className="w-12 h-12 text-coyote" />
                    </div>
                    <h3 className="font-medium text-dark text-lg mb-1">{member.name}</h3>
                    <div className="text-canyon text-sm font-medium mb-3">{member.role}</div>
                    <p className="text-dark/70 text-sm leading-relaxed">{member.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Mission Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-canyon/5 rounded-xl p-8 border border-canyon/20 text-center"
          >
            <div className="max-w-4xl mx-auto">
              <h2 className="medium-title text-dark mb-6">
                Our Mission
              </h2>
              <p className="text text-dark/80 leading-relaxed mb-6">
                To be India's most trusted destination for premium tobacco products, where authenticity meets excellence, 
                and where every customer discovers products that reflect their refined taste and appreciation for quality craftsmanship.
              </p>
              <div className="flex items-center justify-center space-x-2 text-canyon">
                <Leaf className="w-5 h-5" />
                <span className="font-medium">Committed to Excellence Since 2015</span>
                <Leaf className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
