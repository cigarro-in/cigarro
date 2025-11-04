import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, Users, Globe, Heart, Shield, Star, Leaf, Coffee, Sparkles, Trophy, Target, Crown } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { getTeamImageUrl } from '../../utils/supabase/storage';

export function AboutPage() {
  const location = useLocation();
  const values = [
    {
      icon: Award,
      title: 'Excellence',
      description: 'We are committed to providing only the finest tobacco products, carefully curated from the world\'s most respected producers.',
      gradient: 'from-canyon/20 to-sunflower/20'
    },
    {
      icon: Heart,
      title: 'Passion',
      description: 'Our love for tobacco craftsmanship drives us to share the rich heritage and artistry behind every product we offer.',
      gradient: 'from-canyon/20 to-coyote/20'
    },
    {
      icon: Shield,
      title: 'Authenticity',
      description: 'Every product in our collection is guaranteed authentic, sourced directly from authorized distributors and manufacturers.',
      gradient: 'from-dark/20 to-canyon/20'
    },
    {
      icon: Users,
      title: 'Community',
      description: 'We believe in building lasting relationships with our customers, sharing knowledge and fostering a community of enthusiasts.',
      gradient: 'from-coyote/20 to-sunflower/20'
    }
  ];

  const milestones = [
    {
      year: '2015',
      title: 'Founded',
      description: 'Cigarro was established with a vision to bring quality tobacco products to discerning customers in India.',
      icon: Star,
      achievement: 'Birth of Excellence'
    },
    {
      year: '2017',
      title: 'First Store',
      description: 'Opened our flagship store in Mumbai, offering an immersive experience for tobacco enthusiasts.',
      icon: Trophy,
      achievement: 'Physical Presence'
    },
    {
      year: '2019',
      title: 'Online Platform',
      description: 'Launched our e-commerce platform, making authentic tobacco products accessible nationwide.',
      icon: Globe,
      achievement: 'Digital Revolution'
    },
    {
      year: '2021',
      title: 'International Partnerships',
      description: 'Established direct partnerships with renowned tobacco houses from Cuba, Dominican Republic, and Nicaragua.',
      icon: Sparkles,
      achievement: 'Global Network'
    },
    {
      year: '2023',
      title: 'Expert Team',
      description: 'Assembled a team of certified tobacco specialists to provide expert guidance and recommendations.',
      icon: Users,
      achievement: 'Knowledge Hub'
    },
    {
      year: '2024',
      title: 'Innovation',
      description: 'Introduced advanced storage solutions and personalized curation services for our esteemed customers.',
      icon: Crown,
      achievement: 'Exceptional Experience'
    }
  ];

  const team = [
    {
      name: 'Rajesh Kumar',
      role: 'Founder & CEO',
      image: getTeamImageUrl('rajesh.jpg'),
      description: 'With over 15 years in the tobacco industry, Rajesh founded Cigarro to share his passion for fine tobacco products.',
      expertise: 'Industry Pioneer',
      gradient: 'from-canyon to-dark'
    },
    {
      name: 'Maria Santos',
      role: 'Head of Curation',
      image: getTeamImageUrl('maria.jpg'),
      description: 'Maria brings her expertise from Cuban tobacco farms, ensuring every product meets our exacting standards.',
      expertise: 'Quality Master',
      gradient: 'from-sunflower to-canyon'
    },
    {
      name: 'David Chen',
      role: 'Customer Experience Director',
      image: getTeamImageUrl('david.jpg'),
      description: 'David leads our customer service team, ensuring every interaction exceeds expectations.',
      expertise: 'Experience Architect',
      gradient: 'from-coyote to-dark'
    },
    {
      name: 'Elena Vasquez',
      role: 'Quality Assurance Manager',
      image: getTeamImageUrl('elena.jpg'),
      description: 'Elena oversees our quality control processes, guaranteeing authenticity and freshness of every product.',
      expertise: 'Excellence Guardian',
      gradient: 'from-dark to-coyote'
    }
  ];

  const stats = [
    { 
      number: '10,000+', 
      label: 'Happy Customers',
      icon: Users,
      description: 'Satisfied enthusiasts worldwide'
    },
    { 
      number: '500+', 
      label: 'Quality Products',
      icon: Award,
      description: 'Curated collection of finest tobacco'
    },
    { 
      number: '50+', 
      label: 'International Brands',
      icon: Globe,
      description: 'Global partnerships & heritage'
    },
    { 
      number: '99%', 
      label: 'Customer Satisfaction',
      icon: Heart,
      description: 'Exceptional service rating'
    }
  ];

  return (
    <>
      <SEOHead
        title="About Us - Premium Tobacco Marketplace"
        description="Learn about Cigarro's commitment to excellence in premium tobacco products, our heritage, values, and the expert team behind our curated collection."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['about cigarro', 'premium tobacco company', 'cigarette marketplace India', 'tobacco heritage', 'authentic cigarettes']}
      />

      <div className="min-h-screen bg-gradient-to-br from-creme via-creme-light to-creme pt-24 pb-12 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-canyon/5 to-sunflower/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-l from-coyote/5 to-canyon/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-transparent via-dark/[0.02] to-transparent rounded-full"></div>
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
              <Sparkles className="w-6 h-6 text-canyon animate-pulse" />
              <span className="text-dark font-medium tracking-wide">Crafting Excellence Since 2015</span>
              <Sparkles className="w-6 h-6 text-canyon animate-pulse" />
            </motion.div>
            
            <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl text-dark mb-8 leading-tight">
              <span className="inline-block hover-lift">About</span>{' '}
              <span className="inline-block text-shimmer font-bold">Cigarro</span>
            </h1>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="h-1 bg-gradient-to-r from-transparent via-canyon to-transparent max-w-md mx-auto mb-8"
            ></motion.div>
            
            <p className="text-xl text-dark/60 max-w-2xl mx-auto leading-relaxed">
              Where passion meets perfection in the world of fine tobacco
            </p>
          </motion.div>

          {/* Enhanced Hero Story */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative mb-24"
          >
            <div className="glass-card rounded-3xl p-12 backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    <h2 className="font-serif text-4xl text-dark mb-6 leading-tight">
                      Our Story of 
                      <span className="text-canyon block">Passionate Excellence</span>
                    </h2>
                    <div className="w-16 h-1 bg-gradient-to-r from-canyon to-sunflower mb-6"></div>
                  </motion.div>

                  <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="text-lg text-dark/80 leading-relaxed"
                  >
                    At Cigarro, we are passionate about bringing the world's finest tobacco products to discerning customers. 
                    Our journey began with a simple belief: that everyone deserves access to authentic, quality tobacco products 
                    that represent the pinnacle of craftsmanship and tradition.
                  </motion.p>
                  
                  <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="text-lg text-dark/70 leading-relaxed"
                  >
                    From our humble beginnings to becoming India's premier destination for fine tobacco, we have remained 
                    committed to excellence, authenticity, and the rich heritage that makes each product in our collection truly special.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="flex items-center space-x-4 pt-6"
                  >
                    <div className="flex -space-x-3">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="w-12 h-12 rounded-full bg-gradient-to-br from-canyon to-coyote border-3 border-white flex items-center justify-center">
                          <Crown className="w-6 h-6 text-white" />
                        </div>
                      ))}
                    </div>
                    <div className="text-dark/70">
                      <div className="font-medium">Trusted by 10,000+ customers</div>
                      <div className="text-sm">across India and beyond</div>
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className="relative"
                >
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-canyon via-sunflower to-canyon rounded-3xl blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
                    <div className="relative bg-gradient-to-br from-white to-creme-light rounded-3xl p-8 border border-white/40 backdrop-blur-sm">
                      <div className="grid grid-cols-2 gap-6">
                        {stats.slice(0, 4).map((stat, i) => (
                          <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.5 + i * 0.1 }}
                            className="text-center group/stat"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-canyon/20 to-sunflower/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover/stat:scale-110 transition-transform duration-300">
                              <stat.icon className="w-6 h-6 text-canyon" />
                            </div>
                            <div className="font-serif text-2xl text-dark font-bold mb-1">{stat.number}</div>
                            <div className="text-xs text-dark/60 font-medium">{stat.label}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Premium Values Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="mb-32"
          >
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6"
              >
                <Heart className="w-5 h-5 text-canyon" />
                <span className="text-dark font-medium">Core Values</span>
              </motion.div>
              
              <h2 className="font-serif text-5xl md:text-6xl text-dark mb-6 leading-tight">
                What Drives
                <span className="text-canyon block">Our Excellence</span>
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-6"></div>
              
              <p className="text-xl text-dark/60 max-w-3xl mx-auto leading-relaxed">
                These principles guide every decision we make and every relationship we build
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15, duration: 0.8 }}
                  className="group"
                >
                  <div className="glass-card rounded-2xl p-8 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500">
                    <div className={`bg-gradient-to-br ${value.gradient} rounded-2xl p-6 mb-6 group-hover:scale-105 transition-transform duration-500`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-14 h-14 bg-white/80 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors duration-300">
                          <value.icon className="w-7 h-7 text-canyon group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        <div className="text-right">
                          <div className="text-canyon/70 text-sm font-medium">Core Value</div>
                          <div className="text-dark/80 text-xs">#{index + 1}</div>
                        </div>
                      </div>
                      
                      <h3 className="font-serif text-2xl text-dark font-bold mb-3 group-hover:text-canyon transition-colors duration-300">
                        {value.title}
                      </h3>
                    </div>
                    
                    <p className="text-dark/70 leading-relaxed group-hover:text-dark/80 transition-colors duration-300">
                      {value.description}
                    </p>
                    
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex space-x-1">
                        {[1,2,3,4,5].map((star) => (
                          <Star key={star} className="w-4 h-4 text-sunflower fill-current" />
                        ))}
                      </div>
                      <div className="text-canyon text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Learn More →
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Cinematic Timeline Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="mb-32"
          >
            <div className="text-center mb-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6"
              >
                <Globe className="w-5 h-5 text-canyon" />
                <span className="text-dark font-medium">Our Journey</span>
              </motion.div>
              
              <h2 className="font-serif text-5xl md:text-6xl text-dark mb-6 leading-tight">
                A Legacy of
                <span className="text-canyon block">Innovation</span>
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-6"></div>
              
              <p className="text-xl text-dark/60 max-w-3xl mx-auto leading-relaxed">
                From humble beginnings to industry leadership - discover the milestones that shaped our story
              </p>
            </div>

            <div className="relative max-w-6xl mx-auto">
              {/* Enhanced Timeline line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-canyon via-sunflower to-canyon opacity-30"></div>
              
              <div className="space-y-16">
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={milestone.year}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.8 }}
                    className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'} group`}
                  >
                    <div className={`w-1/2 ${index % 2 === 0 ? 'pr-12 text-right' : 'pl-12 text-left'}`}>
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.3 }}
                        className="glass-card rounded-2xl p-8 border border-white/30 backdrop-blur-sm group-hover:shadow-2xl transition-all duration-500"
                      >
                        <div className={`flex items-center mb-6 ${index % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                          <div className="w-12 h-12 bg-gradient-to-br from-canyon to-sunflower rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                            <milestone.icon className="w-6 h-6 text-white" />
                          </div>
                          <div className={`${index % 2 === 0 ? 'text-right' : 'text-left'}`}>
                            <div className="text-canyon/70 text-sm font-medium">{milestone.achievement}</div>
                            <div className="font-serif text-3xl text-dark font-bold">{milestone.year}</div>
                          </div>
                        </div>
                        
                        <h3 className="font-serif text-2xl text-dark font-bold mb-4 group-hover:text-canyon transition-colors duration-300">
                          {milestone.title}
                        </h3>
                        
                        <p className="text-dark/70 leading-relaxed group-hover:text-dark/80 transition-colors duration-300">
                          {milestone.description}
                        </p>
                        
                        <div className={`mt-6 flex items-center ${index % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                          <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-canyon rounded-full"></div>
                            <div className="w-2 h-2 bg-sunflower rounded-full"></div>
                            <div className="w-2 h-2 bg-coyote rounded-full"></div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                    
                    {/* Enhanced Timeline dot */}
                    <motion.div 
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                      className="absolute left-1/2 transform -translate-x-1/2 z-10"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-canyon to-sunflower rounded-full border-4 border-white shadow-lg group-hover:scale-125 transition-transform duration-300"></div>
                        <div className="absolute inset-0 w-8 h-8 bg-gradient-to-br from-canyon to-sunflower rounded-full animate-ping opacity-20"></div>
                      </div>
                    </motion.div>
                    
                    <div className="w-1/2"></div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Elite Team Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="mb-32"
          >
            <div className="text-center mb-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-6"
              >
                <Users className="w-5 h-5 text-canyon" />
                <span className="text-dark font-medium">Elite Team</span>
              </motion.div>
              
              <h2 className="font-serif text-5xl md:text-6xl text-dark mb-6 leading-tight">
                Masters of
                <span className="text-canyon block">Their Craft</span>
              </h2>
              
              <div className="w-24 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-6"></div>
              
              <p className="text-xl text-dark/60 max-w-3xl mx-auto leading-relaxed">
                Meet the passionate experts who ensure every product we offer exceeds the highest standards
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.8 }}
                  className="group"
                >
                  <motion.div 
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="glass-card rounded-2xl p-6 border border-white/30 backdrop-blur-sm hover-lift group-hover:shadow-2xl transition-all duration-500 h-full"
                  >
                    <div className="relative mb-6">
                      <div className={`w-20 h-20 bg-gradient-to-br ${member.gradient} rounded-2xl mx-auto flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                        <Users className="w-10 h-10 text-white relative z-10" />
                      </div>
                      
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-sunflower to-canyon rounded-full flex items-center justify-center">
                        <Crown className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    
                    <div className="text-center space-y-3">
                      <div className="bg-gradient-to-r from-canyon/10 to-sunflower/10 px-3 py-1 rounded-full">
                        <span className="text-canyon text-xs font-medium">{member.expertise}</span>
                      </div>
                      
                      <h3 className="font-serif text-xl text-dark font-bold group-hover:text-canyon transition-colors duration-300">
                        {member.name}
                      </h3>
                      
                      <div className="text-dark/60 text-sm font-medium mb-4">{member.role}</div>
                      
                      <p className="text-dark/70 text-sm leading-relaxed group-hover:text-dark/80 transition-colors duration-300">
                        {member.description}
                      </p>
                      
                      <div className="pt-4 flex items-center justify-center space-x-1">
                        {[1,2,3,4,5].map((star) => (
                          <Star key={star} className="w-3 h-3 text-sunflower fill-current" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Cinematic Mission Statement */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="glass-card rounded-3xl p-12 backdrop-blur-xl border border-white/20 shadow-2xl text-center relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 left-0 w-full h-full">
                  <div className="grid grid-cols-6 gap-4 h-full opacity-30">
                    {[...Array(24)].map((_, i) => (
                      <div key={i} className="bg-gradient-to-br from-canyon to-sunflower rounded-lg"></div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="relative z-10 max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-canyon/10 to-sunflower/10 px-6 py-3 rounded-full mb-8"
                >
                  <Target className="w-5 h-5 text-canyon" />
                  <span className="text-dark font-medium">Our Mission</span>
                </motion.div>
                
                <h2 className="font-serif text-4xl md:text-5xl text-dark mb-8 leading-tight">
                  Redefining Excellence in
                  <span className="text-canyon block">Fine Tobacco</span>
                </h2>
                
                <div className="w-32 h-1 bg-gradient-to-r from-canyon via-sunflower to-canyon mx-auto mb-8"></div>
                
                <p className="text-xl text-dark/80 leading-relaxed mb-8 max-w-4xl mx-auto">
                  To be India's most trusted destination for quality tobacco products, where authenticity meets excellence, 
                  and where every customer discovers products that reflect their refined taste and appreciation for quality craftsmanship.
                </p>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="flex flex-wrap items-center justify-center gap-8 text-canyon"
                >
                  <div className="flex items-center space-x-2">
                    <Leaf className="w-5 h-5" />
                    <span className="font-medium">Crafting Excellence</span>
                  </div>
                  <div className="w-2 h-2 bg-canyon rounded-full"></div>
                  <div className="flex items-center space-x-2">
                    <Heart className="w-5 h-5" />
                    <span className="font-medium">Since 2015</span>
                  </div>
                  <div className="w-2 h-2 bg-canyon rounded-full"></div>
                  <div className="flex items-center space-x-2">
                    <Crown className="w-5 h-5" />
                    <span className="font-medium">Premium Heritage</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
