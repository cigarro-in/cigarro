import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Award, Globe } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

interface HeritageItem {
  id: string;
  year: string;
  title: string;
  description: string;
  image: string;
  achievement: string;
  location: string;
}

export function HeritageGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Heritage timeline data
  const heritageItems: HeritageItem[] = [
    {
      id: '1',
      year: '1875',
      title: 'Foundation of Excellence',
      description: 'Our journey began in the heart of Virginia with a vision to create the finest tobacco products using traditional craftsmanship and premium ingredients.',
      image: 'https://images.unsplash.com/photo-1582374795014-9ed729788835?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW50YWdlJTIwdG9iYWNjbyUyMGZhcm0lMjBoZXJpdGFnZXxlbnwxfHx8fDE3NTc2MDIyMTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      achievement: 'First Premium Blend',
      location: 'Virginia, USA'
    },
    {
      id: '2',
      year: '1923',
      title: 'Master Craftsman Era',
      description: 'Three generations of master blenders perfected our signature techniques, establishing the gold standard for premium tobacco curation.',
      image: 'https://images.unsplash.com/photo-1582130298356-0e7a54688cbf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW50YWdlJTIwY3JhZnRzbWFuJTIwdG9iYWNjbyUyMGFydGlzYW58ZW58MXx8fHwxNzU3NjAyMjIzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      achievement: 'Master Blender Certification',
      location: 'North Carolina, USA'
    },
    {
      id: '3',
      year: '1954',
      title: 'International Recognition',
      description: 'Our exceptional quality earned us international acclaim, with exclusive partnerships established across Europe and Asia.',
      image: 'https://images.unsplash.com/photo-1740664651822-3a02ec12c121?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aW50YWdlJTIwaW50ZXJuYXRpb25hbCUyMHRyYWRlfGVufDF8fHx8MTc1NzYwMjIyN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      achievement: 'Global Excellence Award',
      location: 'London, UK'
    },
    {
      id: '4',
      year: '1978',
      title: 'Innovation & Tradition',
      description: 'Pioneering new aging techniques while preserving ancestral methods, we revolutionized the luxury tobacco experience.',
      image: 'https://images.unsplash.com/photo-1678081624395-6d57c224df42?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBpbm5vdmF0aW9uJTIwbW9kZXJuJTIwdmludGFnZXxlbnwxfHx8fDE3NTc2MDIyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      achievement: 'Innovation Excellence',
      location: 'Switzerland'
    },
    {
      id: '5',
      year: '2010',
      title: 'Digital Luxury Era',
      description: 'Embracing the digital age while maintaining our commitment to artisanal quality and personalized service.',
      image: 'https://images.unsplash.com/photo-1588426154611-f47651357c3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBkaWdpdGFsJTIwYWdlfGVufDF8fHx8MTc1NzYwMjIzNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      achievement: 'Digital Innovation Award',
      location: 'Global'
    }
  ];

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % heritageItems.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + heritageItems.length) % heritageItems.length);
  };

  const currentItem = heritageItems[currentIndex];

  return (
    <section className="py-20 bg-gradient-to-b from-background to-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-accent/20 text-accent hover:bg-accent/30">
            Heritage & Legacy
          </Badge>
          <h2 className="font-serif-premium text-4xl md:text-5xl text-foreground mb-6">
            150 Years of
            <span className="block text-accent">Excellence</span>
          </h2>
          <p className="font-sans-premium text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Discover the remarkable journey that has shaped our legacy of uncompromising quality, 
            traditional craftsmanship, and innovative excellence in luxury tobacco.
          </p>
        </div>

        {/* Heritage Timeline Carousel */}
        <div className="relative">
          <Card className="glass-card border-border/20 overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px]">
                {/* Image Section */}
                <div className="relative group">
                  <img 
                    src={currentItem.image}
                    alt={currentItem.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Year Badge */}
                  <div className="absolute top-6 left-6">
                    <div className="bg-accent text-accent-foreground px-4 py-2 rounded-full">
                      <span className="font-serif-premium text-2xl">{currentItem.year}</span>
                    </div>
                  </div>

                  {/* Navigation Arrows */}
                  <button 
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full transition-all duration-300 backdrop-blur-sm"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full transition-all duration-300 backdrop-blur-sm"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Content Section */}
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-serif-premium text-3xl text-foreground mb-4">
                        {currentItem.title}
                      </h3>
                      <p className="font-sans-premium text-lg text-muted-foreground leading-relaxed">
                        {currentItem.description}
                      </p>
                    </div>

                    {/* Achievement & Location */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-accent/20 rounded-full">
                          <Award className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-sans-premium text-sm text-muted-foreground">Achievement</p>
                          <p className="font-sans-premium text-foreground">{currentItem.achievement}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-accent/20 rounded-full">
                          <Globe className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-sans-premium text-sm text-muted-foreground">Location</p>
                          <p className="font-sans-premium text-foreground">{currentItem.location}</p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Progress */}
                    <div className="pt-6">
                      <div className="flex items-center space-x-2 mb-3">
                        <Calendar className="w-4 h-4 text-accent" />
                        <span className="font-sans-premium text-sm text-muted-foreground">
                          {currentIndex + 1} of {heritageItems.length} milestones
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-accent h-2 rounded-full transition-all duration-300"
                          style={{ width: `${((currentIndex + 1) / heritageItems.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dots Indicator */}
          <div className="flex justify-center space-x-3 mt-8">
            {heritageItems.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-accent scale-125' 
                    : 'bg-border hover:bg-accent/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <Button 
            size="lg" 
            className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-3"
          >
            Explore Our Legacy Collection
          </Button>
        </div>
      </div>
    </section>
  );
}
