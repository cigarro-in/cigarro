import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowRight, Clock, Tag } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  slug: string;
  tags: string[];
}

// Mock blog data - in real app, this would come from your CMS/database
const blogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'The Art of Cuban Cigar Rolling: A Master\'s Journey',
    excerpt: 'Discover the centuries-old traditions and meticulous craftsmanship that goes into creating the world\'s finest Cuban cigars.',
    content: `
      <p>The art of Cuban cigar rolling is a tradition that has been passed down through generations, combining centuries of knowledge with the skilled hands of master torcedores. In the heart of Havana, where the humid air carries the sweet aroma of aging tobacco, these artisans continue to create some of the world's most sought-after cigars.</p>
      
      <p>Each cigar is a testament to the torcedor's expertise, requiring years of training to master the delicate balance of wrapper, binder, and filler leaves. The process begins with the selection of premium tobacco leaves, each chosen for its specific characteristics and flavor profile.</p>
      
      <p>The rolling technique itself is a dance of precision and artistry. The torcedor must maintain consistent pressure while rolling, ensuring the cigar has the perfect draw and burn characteristics. This attention to detail is what sets Cuban cigars apart from all others.</p>
      
      <p>From the initial leaf selection to the final quality inspection, every step in the Cuban cigar-making process reflects a commitment to excellence that has made these cigars legendary among connoisseurs worldwide.</p>
    `,
    image: '/images/inspiration/DSC07634-Edit_1.webp',
    author: 'Carlos Rodriguez',
    date: '2024-01-15',
    readTime: '8 min read',
    category: 'Craftsmanship',
    slug: 'art-of-cuban-cigar-rolling',
    tags: ['Cuban', 'Craftsmanship', 'Tradition', 'Cigars']
  },
  {
    id: '2',
    title: 'Understanding Tobacco Terroir: How Climate Shapes Flavor',
    excerpt: 'Explore how different growing regions around the world influence the unique characteristics and flavor profiles of premium tobacco.',
    content: `
      <p>Just as wine grapes reflect their terroir, tobacco plants absorb the unique characteristics of their growing environment. The soil composition, climate, altitude, and even the angle of sunlight all contribute to the final flavor profile of premium tobacco.</p>
      
      <p>In the Dominican Republic, the rich volcanic soil and consistent tropical climate produce tobacco with bold, earthy notes. Nicaraguan tobacco, grown in the shadow of active volcanoes, develops a distinctive peppery spice that has become highly prized among cigar enthusiasts.</p>
      
      <p>Connecticut's broadleaf tobacco, grown under shade cloths, develops the smooth, creamy characteristics that make it perfect for premium cigar wrappers. Meanwhile, the high-altitude regions of Ecuador produce wrapper leaves with exceptional elasticity and subtle sweetness.</p>
      
      <p>Understanding these regional differences allows us to appreciate the complexity and diversity of tobacco flavors, and helps explain why certain growing regions have become synonymous with specific taste profiles.</p>
    `,
    image: '/images/inspiration/DSC04514-Edit_1.webp',
    author: 'Maria Santos',
    date: '2024-01-12',
    readTime: '6 min read',
    category: 'Education',
    slug: 'tobacco-terroir-climate-flavor',
    tags: ['Terroir', 'Climate', 'Flavor', 'Education']
  },
  {
    id: '3',
    title: 'The Perfect Pairing: Cigars and Fine Spirits',
    excerpt: 'Learn the art of pairing premium cigars with whiskey, rum, and other fine spirits to enhance your tasting experience.',
    content: `
      <p>The art of pairing cigars with spirits is about finding complementary flavors that enhance both the cigar and the drink. The key is understanding how different spirits interact with tobacco's natural oils and flavors.</p>
      
      <p>Single malt Scotch whiskies, with their smoky, peaty characteristics, pair beautifully with full-bodied cigars. The smoke from both creates a harmonious blend that intensifies the experience. Aged rums, with their caramel and vanilla notes, complement medium-bodied cigars with natural sweetness.</p>
      
      <p>Cognac and brandy offer a different approach, with their fruity, floral notes providing a counterpoint to the earthiness of tobacco. The high alcohol content helps cleanse the palate between draws, allowing you to fully appreciate the cigar's evolving flavors.</p>
      
      <p>When pairing, consider the strength of both the cigar and the spirit. A delicate Connecticut-wrapped cigar might be overwhelmed by a powerful Islay Scotch, while a full-bodied Nicaraguan cigar could overpower a light, floral gin.</p>
    `,
    image: '/images/inspiration/DSC05471_1.webp',
    author: 'James Mitchell',
    date: '2024-01-10',
    readTime: '5 min read',
    category: 'Lifestyle',
    slug: 'cigar-spirit-pairing-guide',
    tags: ['Pairing', 'Spirits', 'Lifestyle', 'Whiskey']
  },
  {
    id: '4',
    title: 'Vintage Tobacco: The Beauty of Aged Blends',
    excerpt: 'Delve into the world of aged tobacco and discover how time transforms flavor, creating some of the most sought-after blends.',
    content: `
      <p>Aging tobacco is an art form that requires patience, expertise, and the perfect conditions. Like fine wine, tobacco improves with age, developing complex flavors and smoother characteristics that cannot be achieved through any other process.</p>
      
      <p>The aging process begins immediately after harvest, as the tobacco leaves undergo fermentation. This natural process breaks down harsh compounds and develops the rich, complex flavors that define premium tobacco. The leaves are carefully monitored and rotated to ensure even aging.</p>
      
      <p>Temperature and humidity control are crucial during aging. Too much moisture can lead to mold, while too little can cause the leaves to become brittle. The ideal conditions allow the tobacco to slowly transform, developing the smooth, mellow characteristics that connoisseurs prize.</p>
      
      <p>Some of the most sought-after cigars are made with tobacco that has been aged for five, ten, or even twenty years. These vintage blends offer a smoking experience that cannot be replicated, with flavors that have been refined and perfected over decades.</p>
    `,
    image: '/images/inspiration/Eucalyptus_2025-05-29-142724_oydb_1.webp',
    author: 'Elena Vasquez',
    date: '2024-01-08',
    readTime: '7 min read',
    category: 'Heritage',
    slug: 'vintage-tobacco-aged-blends',
    tags: ['Vintage', 'Aging', 'Heritage', 'Blends']
  },
  {
    id: '5',
    title: 'The Science of Cigar Storage: Creating the Perfect Environment',
    excerpt: 'Learn the essential principles of cigar storage to maintain optimal flavor, humidity, and aging conditions for your collection.',
    content: `
      <p>Proper cigar storage is essential for maintaining the quality and flavor of your collection. The key factors are temperature, humidity, and air circulation, all of which must be carefully balanced to create the perfect aging environment.</p>
      
      <p>Ideal storage conditions maintain a temperature between 65-70°F (18-21°C) and relative humidity between 65-70%. These conditions allow the tobacco to age gracefully while preventing mold growth and maintaining the cigar's structural integrity.</p>
      
      <p>Humidors are the traditional choice for cigar storage, using Spanish cedar to help regulate humidity and impart subtle flavors. Modern electric humidors offer precise climate control, while coolers can be converted into effective storage solutions for larger collections.</p>
      
      <p>Regular monitoring and maintenance are crucial. Use calibrated hygrometers to track humidity levels, and rotate your cigars regularly to ensure even aging. With proper care, your cigars will continue to improve over time, developing the complex flavors that make premium tobacco so special.</p>
    `,
    image: '/images/inspiration/Primer-LA_Escalier_Pivoine_B-1_1.webp',
    author: 'David Chen',
    date: '2024-01-05',
    readTime: '6 min read',
    category: 'Education',
    slug: 'cigar-storage-perfect-environment',
    tags: ['Storage', 'Humidity', 'Education', 'Collection']
  },
  {
    id: '6',
    title: 'The History of Premium Cigars: From Columbus to Today',
    excerpt: 'Trace the fascinating journey of cigars from their discovery by Christopher Columbus to their current status as symbols of luxury and sophistication.',
    content: `
      <p>The story of premium cigars begins with Christopher Columbus's arrival in the New World in 1492. The explorer and his crew were the first Europeans to encounter tobacco, observing the native peoples smoking rolled tobacco leaves in a practice that would eventually spread across the globe.</p>
      
      <p>By the 16th century, tobacco had reached Europe, where it quickly gained popularity among the aristocracy. The first cigar factories were established in Spain, using tobacco imported from the Caribbean colonies. These early cigars were crude by today's standards, but they established the foundation for the industry.</p>
      
      <p>The 19th century saw the golden age of cigar making, with Cuba emerging as the world's premier producer. The island's unique climate and soil conditions, combined with generations of expertise, created cigars of unparalleled quality that became symbols of luxury and sophistication.</p>
      
      <p>Today, premium cigars continue to be handcrafted using traditional methods, with master torcedores passing their skills down through generations. The industry has expanded globally, but the commitment to quality and craftsmanship remains unchanged, ensuring that each cigar represents the pinnacle of the tobacco art.</p>
    `,
    image: '/images/inspiration/DSC01551-2_1.webp',
    author: 'Isabella Martinez',
    date: '2024-01-03',
    readTime: '9 min read',
    category: 'Heritage',
    slug: 'history-premium-cigars-columbus-today',
    tags: ['History', 'Heritage', 'Cuba', 'Tradition']
  }
];


export function BlogsPage() {
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>(blogPosts);


  return (
    <div className="min-h-screen bg-creme pt-24 pb-12">
      <div className="main-container">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="main-title text-dark mb-6 max-w-4xl mx-auto">
            Stories of Craftsmanship & Heritage
          </h1>
        </div>



        {/* Blog Posts Grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group"
              >
                <Link 
                  to={`/blog/${post.slug}`}
                  className="block h-full"
                >
                  <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 group-hover:scale-[1.02] h-full">
                    {/* Article Image */}
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      
                      {/* Category Badge */}
                      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-dark px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                        <Tag className="w-3 h-3" />
                        <span>{post.category}</span>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="bg-white rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                          <ArrowRight className="w-5 h-5 text-canyon" />
                        </div>
                      </div>
                    </div>

                    {/* Article Content */}
                    <div className="p-6">
                      {/* Meta Information */}
                      <div className="flex items-center space-x-4 text-dark/60 text-sm mb-4">
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>{post.author}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{post.readTime}</span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-serif text-xl text-dark group-hover:text-canyon transition-colors leading-tight mb-3 line-clamp-2">
                        {post.title}
                      </h3>

                      {/* Excerpt */}
                      <p className="text-dark/70 leading-relaxed line-clamp-3 mb-4">
                        {post.excerpt}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {post.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-creme-light text-dark text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {post.tags.length > 3 && (
                          <span className="px-2 py-1 bg-creme-light text-dark text-xs rounded-full">
                            +{post.tags.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Read More */}
                      <div className="flex items-center justify-between pt-4 border-t border-coyote/20">
                        <span className="text-canyon font-medium group-hover:translate-x-1 transition-transform duration-300">
                          Read Article
                        </span>
                        <ArrowRight className="w-4 h-4 text-canyon group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-2xl font-serif text-dark mb-4">No articles found</h3>
            <p className="text-dark/70 mb-8">
              No blog articles are available at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Individual Blog Post Component
export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    const foundPost = blogPosts.find(p => p.slug === slug);
    if (foundPost) {
      setPost(foundPost);
      // Find related posts (same category, excluding current post)
      const related = blogPosts
        .filter(p => p.category === foundPost.category && p.id !== foundPost.id)
        .slice(0, 3);
      setRelatedPosts(related);
    }
  }, [slug]);

  if (!post) {
    return (
      <div className="min-h-screen bg-creme pt-24 pb-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-serif text-dark mb-4">Article not found</h1>
          <Link to="/blog" className="btn-primary">
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creme pt-24 pb-12">
      <div className="main-container">

        {/* Article Header */}
        <div className="max-w-4xl mx-auto mb-8">
          {/* Category Badge */}
          <div className="flex items-center space-x-2 mb-4">
            <Tag className="w-4 h-4 text-canyon" />
            <span className="text-canyon font-medium uppercase tracking-wider text-sm">
              {post.category}
            </span>
          </div>

          {/* Title */}
          <h1 className="main-title text-dark mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta Information */}
          <div className="flex items-center space-x-6 text-dark/60 text-sm mb-8">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>{post.author}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>{post.readTime}</span>
            </div>
          </div>

          {/* Featured Image */}
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl mb-8">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Article Content */}
        <div className="max-w-3xl mx-auto">
          <div 
            className="prose prose-lg max-w-none text-dark leading-relaxed"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-coyote/20">
            <h3 className="text-dark font-medium mb-4">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-creme-light text-dark text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <div className="max-w-6xl mx-auto mt-16">
            <h2 className="medium-title text-dark mb-8 text-center">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedPosts.map((relatedPost, index) => (
                <motion.article
                  key={relatedPost.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="group"
                >
                  <Link 
                    to={`/blog/${relatedPost.slug}`}
                    className="block h-full"
                  >
                    <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 group-hover:scale-[1.02] h-full">
                      {/* Article Image */}
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <img
                          src={relatedPost.image}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        
                        {/* Category Badge */}
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-dark px-2 py-1 rounded-full text-xs font-medium">
                          {relatedPost.category}
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="bg-white rounded-full p-2 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                            <ArrowRight className="w-4 h-4 text-canyon" />
                          </div>
                        </div>
                      </div>

                      {/* Article Content */}
                      <div className="p-6">
                        {/* Meta Information */}
                        <div className="flex items-center space-x-3 text-dark/60 text-xs mb-3">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{relatedPost.author}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(relatedPost.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{relatedPost.readTime}</span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="font-medium text-dark group-hover:text-canyon transition-colors leading-tight mb-3 text-lg line-clamp-2">
                          {relatedPost.title}
                        </h3>

                        {/* Excerpt */}
                        <p className="text-dark/70 text-sm leading-relaxed line-clamp-3 mb-4">
                          {relatedPost.excerpt}
                        </p>

                        {/* Read More */}
                        <div className="flex items-center justify-between pt-3 border-t border-coyote/20">
                          <span className="text-canyon text-sm font-medium group-hover:translate-x-1 transition-transform duration-300">
                            Read More
                          </span>
                          <ArrowRight className="w-4 h-4 text-canyon group-hover:translate-x-1 transition-transform duration-300" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
