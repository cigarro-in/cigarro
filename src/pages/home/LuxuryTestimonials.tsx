import { useState, useEffect } from 'react';
import { Quote, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';

interface Testimonial {
  id: string;
  name: string;
  title: string;
  location: string;
  quote: string;
  rating: number;
  image: string;
  verifiedPurchase: boolean;
}

export function LuxuryTestimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  const testimonials: Testimonial[] = [
    {
      id: '1',
      name: 'Alexander Rothschild',
      title: 'Investment Banking Director',
      location: 'London, UK',
      quote: 'The craftsmanship and attention to detail in every product is unparalleled. This is more than just a purchase – it\'s an investment in heritage and quality that speaks to the discerning connoisseur.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
      verifiedPurchase: true
    },
    {
      id: '2',
      name: 'Victoria Pemberton',
      title: 'Art Gallery Owner',
      location: 'New York, USA',
      quote: 'Each piece tells a story of tradition and excellence. The sophisticated packaging and presentation match the premium quality of the products themselves. Truly exceptional.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1494790108755-2616b612b631?w=300&h=300&fit=crop&crop=face',
      verifiedPurchase: true
    },
    {
      id: '3',
      name: 'Constantin Dubois',
      title: 'Luxury Hotel Executive',
      location: 'Monaco',
      quote: 'The exclusivity and refinement of this collection aligns perfectly with our clientele\'s expectations. Premium quality that consistently exceeds the highest standards.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face',
      verifiedPurchase: true
    },
    {
      id: '4',
      name: 'Isabella Rodriguez',
      title: 'Wine & Spirits Curator',
      location: 'Barcelona, Spain',
      quote: 'As someone who appreciates the finest things in life, I can confidently say this represents the pinnacle of luxury craftsmanship. The heritage and quality are immediately evident.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face',
      verifiedPurchase: true
    },
    {
      id: '5',
      name: 'James Wellington III',
      title: 'Private Equity Partner',
      location: 'Singapore',
      quote: 'The attention to detail and commitment to excellence is remarkable. This is what true luxury should be – understated, sophisticated, and absolutely uncompromising in quality.',
      rating: 5,
      image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&crop=face',
      verifiedPurchase: true
    }
  ];

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlay) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlay, testimonials.length]);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setIsAutoPlay(false);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setIsAutoPlay(false);
  };

  const goToTestimonial = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlay(false);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="py-20 bg-gradient-to-b from-secondary/30 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-accent/20 text-accent hover:bg-accent/30">
            Client Testimonials
          </Badge>
          <h2 className="font-serif-premium text-4xl md:text-5xl text-foreground mb-6">
            What Our Clients
            <span className="block text-accent">Say About Us</span>
          </h2>
          <p className="font-sans-premium text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Discover why discerning connoisseurs and industry leaders choose our curated collection 
            for their most important moments and sophisticated experiences.
          </p>
        </div>

        {/* Main Testimonial Display */}
        <div className="relative max-w-5xl mx-auto">
          <Card className="glass-card border-border/20 overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Image Section */}
                <div className="lg:col-span-1 relative">
                  <div className="aspect-square lg:aspect-auto lg:h-full relative group">
                    <ImageWithFallback 
                      src={currentTestimonial.image}
                      alt={currentTestimonial.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    
                    {/* Verified Badge */}
                    {currentTestimonial.verifiedPurchase && (
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-accent/90 text-accent-foreground">
                          Verified Purchase
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="lg:col-span-2 p-8 lg:p-12 flex flex-col justify-center">
                  <div className="space-y-6">
                    {/* Quote Icon */}
                    <div className="text-accent">
                      <Quote className="w-12 h-12" />
                    </div>

                    {/* Testimonial Text */}
                    <blockquote className="font-sans-premium text-xl lg:text-2xl text-foreground leading-relaxed">
                      "{currentTestimonial.quote}"
                    </blockquote>

                    {/* Rating */}
                    <div className="flex items-center space-x-2">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i}
                          className={`w-5 h-5 ${
                            i < currentTestimonial.rating 
                              ? 'text-accent fill-accent' 
                              : 'text-border'
                          }`}
                        />
                      ))}
                      <span className="font-sans-premium text-sm text-muted-foreground ml-2">
                        5.0 out of 5
                      </span>
                    </div>

                    {/* Author Info */}
                    <div className="space-y-1">
                      <h4 className="font-serif-premium text-xl text-foreground">
                        {currentTestimonial.name}
                      </h4>
                      <p className="font-sans-premium text-accent">
                        {currentTestimonial.title}
                      </p>
                      <p className="font-sans-premium text-sm text-muted-foreground">
                        {currentTestimonial.location}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Arrows */}
          <button 
            onClick={prevTestimonial}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-background/80 hover:bg-background border border-border/20 text-foreground p-3 rounded-full transition-all duration-300 backdrop-blur-sm glow-on-hover"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={nextTestimonial}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-background/80 hover:bg-background border border-border/20 text-foreground p-3 rounded-full transition-all duration-300 backdrop-blur-sm glow-on-hover"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Testimonial Navigation Dots */}
        <div className="flex justify-center space-x-3 mt-8">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToTestimonial(index)}
              className={`transition-all duration-300 ${
                index === currentIndex 
                  ? 'w-8 h-3 bg-accent rounded-full' 
                  : 'w-3 h-3 bg-border hover:bg-accent/50 rounded-full'
              }`}
            />
          ))}
        </div>

        {/* Additional Testimonials Preview */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <Card 
              key={testimonial.id}
              className="glass-card border-border/20 hover:border-accent/30 transition-all duration-300 cursor-pointer"
              onClick={() => goToTestimonial(index)}
            >
              <CardContent className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <img 
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="font-sans-premium text-foreground">{testimonial.name}</h4>
                    <p className="font-sans-premium text-sm text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
                <p className="font-sans-premium text-sm text-muted-foreground line-clamp-3">
                  "{testimonial.quote.substring(0, 120)}..."
                </p>
                <div className="flex items-center space-x-1 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i}
                      className="w-4 h-4 text-accent fill-accent"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
