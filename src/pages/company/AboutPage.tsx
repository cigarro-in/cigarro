import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, Users, Globe, Heart, Shield, Star, Leaf, Sparkles, Trophy, Target, Crown } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { getTeamImageUrl } from '../../lib/supabase/storage';
import { Card, CardContent } from '../../components/ui/card';

export function AboutPage() {
  const location = useLocation();
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
      expertise: 'Industry Pioneer'
    },
    {
      name: 'Maria Santos',
      role: 'Head of Curation',
      image: getTeamImageUrl('maria.jpg'),
      description: 'Maria brings her expertise from Cuban tobacco farms, ensuring every product meets our exacting standards.',
      expertise: 'Quality Master'
    },
    {
      name: 'David Chen',
      role: 'Customer Experience Director',
      image: getTeamImageUrl('david.jpg'),
      description: 'David leads our customer service team, ensuring every interaction exceeds expectations.',
      expertise: 'Experience Architect'
    },
    {
      name: 'Elena Vasquez',
      role: 'Quality Assurance Manager',
      image: getTeamImageUrl('elena.jpg'),
      description: 'Elena oversees our quality control processes, guaranteeing authenticity and freshness of every product.',
      expertise: 'Excellence Guardian'
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

      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Minimal Header */}
        <div className="bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4 pt-4">
            <div className="text-center">
              <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-foreground">
                About Cigarro
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          
          {/* Hero Story */}
          <Card className="border-2 border-border/40 bg-card">
            <CardContent className="p-8 md:p-12">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div>
                    <h2 className="font-sans text-2xl font-bold text-foreground mb-2">Our Story</h2>
                    <div className="w-16 h-1 bg-accent rounded-full"></div>
                  </div>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    At Cigarro, we are passionate about bringing the world's finest tobacco products to discerning customers. 
                    Our journey began with a simple belief: that everyone deserves access to authentic, quality tobacco products 
                    that represent the pinnacle of craftsmanship and tradition.
                  </p>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    From our humble beginnings to becoming India's premier destination for fine tobacco, we have remained 
                    committed to excellence, authenticity, and the rich heritage that makes each product in our collection truly special.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {stats.map((stat, i) => (
                    <div key={i} className="text-center p-4 rounded-lg bg-muted/20 border border-border/20">
                      <stat.icon className="w-8 h-8 text-accent mx-auto mb-3" />
                      <div className="font-serif text-2xl font-bold text-foreground mb-1">{stat.number}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Core Values */}
          <div>
            <h2 className="font-serif text-3xl text-foreground text-center mb-8">Our Values</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index} className="border-2 border-border/40 bg-card hover:border-accent/40 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                        <value.icon className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-sans text-xl font-bold text-foreground mb-2">{value.title}</h3>
                        <p className="text-muted-foreground leading-relaxed">{value.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h2 className="font-serif text-3xl text-foreground text-center mb-8">Our Journey</h2>
            <div className="space-y-6 max-w-4xl mx-auto">
              {milestones.map((milestone, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center z-10 bg-background">
                      <milestone.icon className="w-5 h-5 text-accent" />
                    </div>
                    {index !== milestones.length - 1 && <div className="w-0.5 bg-border/40 flex-grow my-2"></div>}
                  </div>
                  <div className="pb-8 pt-1">
                    <div className="text-sm text-accent font-medium mb-1">{milestone.year} • {milestone.achievement}</div>
                    <h3 className="font-sans text-lg font-bold text-foreground mb-2">{milestone.title}</h3>
                    <p className="text-muted-foreground">{milestone.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div>
            <h2 className="font-serif text-3xl text-foreground text-center mb-8">Our Team</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {team.map((member, index) => (
                <Card key={index} className="border-2 border-border/40 bg-card overflow-hidden">
                  <div className="aspect-square bg-muted/20 flex items-center justify-center">
                    {member.image ? (
                      <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-16 h-16 text-muted-foreground/40" />
                    )}
                  </div>
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-bold text-accent uppercase tracking-wider mb-1">{member.expertise}</div>
                    <h3 className="font-serif text-lg font-bold text-foreground mb-1">{member.name}</h3>
                    <p className="text-sm font-medium text-muted-foreground mb-3">{member.role}</p>
                    <p className="text-xs text-muted-foreground line-clamp-3">{member.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Mission */}
          <Card className="border-2 border-accent/20 bg-accent/5 text-center">
            <CardContent className="p-12">
              <Target className="w-12 h-12 text-accent mx-auto mb-6" />
              <h2 className="font-serif text-3xl text-foreground mb-4">Our Mission</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                To be India's most trusted destination for quality tobacco products, where authenticity meets excellence, 
                and where every customer discovers products that reflect their refined taste.
              </p>
              <div className="flex justify-center gap-8 mt-8 text-accent text-sm font-medium">
                <span className="flex items-center gap-2"><Leaf className="w-4 h-4" /> Crafting Excellence</span>
                <span className="flex items-center gap-2"><Heart className="w-4 h-4" /> Since 2015</span>
                <span className="flex items-center gap-2"><Crown className="w-4 h-4" /> Premium Heritage</span>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}
