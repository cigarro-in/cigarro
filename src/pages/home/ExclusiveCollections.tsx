import { useState } from 'react';
import { Crown, Sparkles, Calendar, ArrowRight, Lock, Eye } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

interface Collection {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  image: string;
  price: string;
  limited: boolean;
  available: number;
  total: number;
  features: string[];
  exclusivityLevel: 'rare' | 'limited' | 'heritage' | 'vintage';
  releaseDate: string;
}

export function ExclusiveCollections() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const collections: Collection[] = [
    {
      id: '1',
      name: 'Heritage Reserve 1875',
      subtitle: 'Founder\'s Original Blend',
      description: 'A meticulously crafted tribute to our founder\'s original 1875 blend, aged using traditional methods passed down through five generations. Each piece represents 150 years of uncompromising excellence.',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=600&fit=crop&crop=center',
      price: 'From $2,850',
      limited: true,
      available: 7,
      total: 50,
      features: ['Hand-selected finest leaves', '18-month aging process', 'Artisan craftsmanship', 'Collector\'s certificate', 'Heritage presentation box'],
      exclusivityLevel: 'heritage',
      releaseDate: 'Limited Time'
    },
    {
      id: '2',
      name: 'Platinum Collection',
      subtitle: 'Contemporary Luxury',
      description: 'Our most sophisticated modern interpretation, featuring innovative techniques while honoring traditional craftsmanship. Perfect for the contemporary connoisseur.',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop&crop=center',
      price: 'From $1,450',
      limited: true,
      available: 23,
      total: 100,
      features: ['Platinum-infused elements', 'Modern presentation', 'Limited edition numbering', 'Platinum member privileges', 'Exclusive access events'],
      exclusivityLevel: 'limited',
      releaseDate: 'Available Now'
    },
    {
      id: '3',
      name: 'Master\'s Choice Vintage',
      subtitle: 'Rare Vintage Selection',
      description: 'Curated by our master craftsmen, this rare vintage selection represents the pinnacle of luxury and sophistication. Only for the most discerning collectors.',
      image: 'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=600&fit=crop&crop=center',
      price: 'From $4,200',
      limited: true,
      available: 3,
      total: 25,
      features: ['Master craftsman selection', 'Vintage aging process', 'Ultra-rare materials', 'Personal consultation', 'Lifetime authenticity guarantee'],
      exclusivityLevel: 'rare',
      releaseDate: 'By Invitation Only'
    },
    {
      id: '4',
      name: 'Anniversary Edition 2024',
      subtitle: 'Commemorative Release',
      description: 'Celebrating our 149th anniversary with this special commemorative edition. A perfect blend of heritage, innovation, and exclusive luxury.',
      image: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=800&h=600&fit=crop&crop=center',
      price: 'From $950',
      limited: true,
      available: 45,
      total: 149,
      features: ['Anniversary edition design', 'Commemorative packaging', 'Special edition numbering', 'Anniversary certificate', 'Collector value guarantee'],
      exclusivityLevel: 'vintage',
      releaseDate: 'Limited Release'
    }
  ];

  const getExclusivityColor = (level: string) => {
    switch (level) {
      case 'rare': return 'text-red-400 bg-red-400/20';
      case 'limited': return 'text-blue-400 bg-blue-400/20';
      case 'heritage': return 'text-accent bg-accent/20';
      case 'vintage': return 'text-purple-400 bg-purple-400/20';
      default: return 'text-accent bg-accent/20';
    }
  };

  const getExclusivityIcon = (level: string) => {
    switch (level) {
      case 'rare': return <Crown className="w-4 h-4" />;
      case 'limited': return <Sparkles className="w-4 h-4" />;
      case 'heritage': return <Calendar className="w-4 h-4" />;
      case 'vintage': return <Lock className="w-4 h-4" />;
      default: return <Crown className="w-4 h-4" />;
    }
  };

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-accent/20 text-accent hover:bg-accent/30">
            Exclusive Collections
          </Badge>
          <h2 className="font-serif-premium text-4xl md:text-5xl text-foreground mb-6">
            Curated for the
            <span className="block text-accent">Distinguished Few</span>
          </h2>
          <p className="font-sans-premium text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Explore our most exclusive collections, each representing the pinnacle of luxury craftsmanship 
            and available only to our most valued collectors and connoisseurs.
          </p>
        </div>

        {/* Collections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {collections.map((collection) => (
            <Card 
              key={collection.id}
              className={`glass-card border-border/20 overflow-hidden group cursor-pointer transition-all duration-500 hover:border-accent/30 ${
                selectedCollection === collection.id ? 'ring-2 ring-accent/50' : ''
              }`}
              onClick={() => setSelectedCollection(selectedCollection === collection.id ? null : collection.id)}
            >
              <CardContent className="p-0">
                <div className="relative">
                  <img 
                    src={collection.image}
                    alt={collection.name}
                    className="w-full h-64 object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Exclusivity Badge */}
                  <div className="absolute top-4 left-4">
                    <Badge className={`${getExclusivityColor(collection.exclusivityLevel)} border-0`}>
                      <div className="flex items-center space-x-1">
                        {getExclusivityIcon(collection.exclusivityLevel)}
                        <span className="capitalize">{collection.exclusivityLevel}</span>
                      </div>
                    </Badge>
                  </div>

                  {/* Availability Badge */}
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-background/90 text-foreground border-border/20">
                      {collection.available} of {collection.total} available
                    </Badge>
                  </div>

                  {/* Price Overlay */}
                  <div className="absolute bottom-4 left-4">
                    <div className="text-white">
                      <p className="font-serif-premium text-2xl">{collection.price}</p>
                      <p className="font-sans-premium text-sm opacity-90">{collection.releaseDate}</p>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-serif-premium text-xl text-foreground group-hover:text-accent transition-colors">
                        {collection.name}
                      </h3>
                      <p className="font-sans-premium text-sm text-accent">{collection.subtitle}</p>
                    </div>

                    <p className="font-sans-premium text-muted-foreground leading-relaxed">
                      {collection.description}
                    </p>

                    {/* Availability Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-sans-premium text-muted-foreground">Availability</span>
                        <span className="font-sans-premium text-foreground">
                          {Math.round((collection.available / collection.total) * 100)}% remaining
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-accent h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(collection.available / collection.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed View */}
        {selectedCollection && (
          <Card className="glass-card border-border/20 overflow-hidden">
            <CardContent className="p-8">
              {(() => {
                const collection = collections.find(c => c.id === selectedCollection);
                if (!collection) return null;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <img 
                        src={collection.image}
                        alt={collection.name}
                        className="w-full h-80 object-cover rounded-lg"
                      />
                    </div>
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center space-x-3 mb-3">
                          <Badge className={`${getExclusivityColor(collection.exclusivityLevel)} border-0`}>
                            <div className="flex items-center space-x-1">
                              {getExclusivityIcon(collection.exclusivityLevel)}
                              <span className="capitalize">{collection.exclusivityLevel}</span>
                            </div>
                          </Badge>
                          <Badge className="bg-accent/20 text-accent">
                            {collection.available} remaining
                          </Badge>
                        </div>
                        <h3 className="font-serif-premium text-3xl text-foreground mb-2">
                          {collection.name}
                        </h3>
                        <p className="font-sans-premium text-lg text-accent mb-4">{collection.subtitle}</p>
                        <p className="font-sans-premium text-muted-foreground leading-relaxed">
                          {collection.description}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-serif-premium text-xl text-foreground mb-3">Exclusive Features</h4>
                        <ul className="space-y-2">
                          {collection.features.map((feature, index) => (
                            <li key={index} className="flex items-center space-x-3">
                              <div className="w-2 h-2 bg-accent rounded-full" />
                              <span className="font-sans-premium text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-4 border-t border-border/20">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-serif-premium text-2xl text-accent">{collection.price}</span>
                          <span className="font-sans-premium text-sm text-muted-foreground">{collection.releaseDate}</span>
                        </div>
                        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 py-3">
                          Request Exclusive Access
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Call to Action */}
        <div className="text-center mt-16">
          <div className="max-w-2xl mx-auto">
            <h3 className="font-serif-premium text-2xl text-foreground mb-4">
              Become a Valued Member
            </h3>
            <p className="font-sans-premium text-muted-foreground mb-6">
              Gain exclusive access to limited collections, private events, and personalized consultations 
              with our master craftsmen.
            </p>
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-3">
              Join Valued Club
              <Crown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
