import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowRight, Clock, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  slug: string;
}

// Mock blog data - in real app, this would come from your CMS/database
const blogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'The Art of Cuban Cigar Rolling: A Master\'s Journey',
    excerpt: 'Discover the centuries-old traditions and meticulous craftsmanship that goes into creating the world\'s finest Cuban cigars.',
    image: '/images/inspiration/DSC07634-Edit_1.webp',
    author: 'Carlos Rodriguez',
    date: '2024-01-15',
    readTime: '8 min read',
    category: 'Craftsmanship',
    slug: 'art-of-cuban-cigar-rolling'
  },
  {
    id: '2',
    title: 'Understanding Tobacco Terroir: How Climate Shapes Flavor',
    excerpt: 'Explore how different growing regions around the world influence the unique characteristics and flavor profiles of premium tobacco.',
    image: '/images/inspiration/DSC04514-Edit_1.webp',
    author: 'Maria Santos',
    date: '2024-01-12',
    readTime: '6 min read',
    category: 'Education',
    slug: 'tobacco-terroir-climate-flavor'
  },
  {
    id: '3',
    title: 'The Perfect Pairing: Cigars and Fine Spirits',
    excerpt: 'Learn the art of pairing premium cigars with whiskey, rum, and other fine spirits to enhance your tasting experience.',
    image: '/images/inspiration/DSC05471_1.webp',
    author: 'James Mitchell',
    date: '2024-01-10',
    readTime: '5 min read',
    category: 'Lifestyle',
    slug: 'cigar-spirit-pairing-guide'
  },
  {
    id: '4',
    title: 'Vintage Tobacco: The Beauty of Aged Blends',
    excerpt: 'Delve into the world of aged tobacco and discover how time transforms flavor, creating some of the most sought-after blends.',
    image: '/images/inspiration/Eucalyptus_2025-05-29-142724_oydb_1.webp',
    author: 'Elena Vasquez',
    date: '2024-01-08',
    readTime: '7 min read',
    category: 'Heritage',
    slug: 'vintage-tobacco-aged-blends'
  }
];

export function BlogSection() {
  const featuredPost = blogPosts[0];
  const regularPosts = blogPosts.slice(1);

  return (
    <section className="py-12 bg-creme min-h-screen flex items-center">
      <div className="main-container w-full">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="main-title text-dark mb-6 max-w-4xl mx-auto">
            Stories of Craftsmanship & Heritage
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Featured Article - Large Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-2"
          >
            <Link 
              to={`/blog/${featuredPost.slug}`}
              className="group block h-full"
            >
              <article className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 group-hover:scale-[1.01] h-full">
                {/* Featured Image */}
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={featuredPost.image}
                    alt={featuredPost.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  
                  {/* Featured Badge */}
                  <div className="absolute top-6 left-6 bg-canyon text-creme-light px-4 py-2 rounded-full text-sm font-medium uppercase tracking-wider">
                    Featured
                  </div>

                  {/* Category Badge */}
                  <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm text-dark px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                    <Tag className="w-3 h-3" />
                    <span>{featuredPost.category}</span>
                  </div>

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Read More Button - Shows on Hover */}
                  <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                    <div className="bg-white rounded-full p-3 shadow-lg">
                      <ArrowRight className="w-5 h-5 text-canyon" />
                    </div>
                  </div>
                </div>

                {/* Article Content */}
                <div className="p-8">
                  {/* Meta Information */}
                  <div className="flex items-center space-x-4 text-dark/60 text-sm mb-4">
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>{featuredPost.author}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(featuredPost.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{featuredPost.readTime}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-2xl lg:text-3xl text-dark group-hover:text-canyon transition-colors leading-tight mb-4">
                    {featuredPost.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text text-dark/70 leading-relaxed line-clamp-3">
                    {featuredPost.excerpt}
                  </p>

                  {/* Read More Link */}
                  <div className="mt-6 pt-6 border-t border-coyote/20">
                    <div className="flex items-center justify-between">
                      <span className="text-canyon font-medium group-hover:translate-x-1 transition-transform duration-300">
                        Read Full Article
                      </span>
                      <ArrowRight className="w-5 h-5 text-canyon group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </motion.div>

          {/* Regular Articles - Right Side */}
          <div className="lg:col-span-1 space-y-8">
            {regularPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group"
              >
                <Link 
                  to={`/blog/${post.slug}`}
                  className="block h-full"
                >
                  <article className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 group-hover:scale-[1.02] h-full">
                    {/* Article Image */}
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      
                      {/* Category Badge */}
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-dark px-2 py-1 rounded-full text-xs font-medium">
                        {post.category}
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
                          <span>{post.author}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{post.readTime}</span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-medium text-dark group-hover:text-canyon transition-colors leading-tight mb-3 text-lg line-clamp-2">
                        {post.title}
                      </h3>

                      {/* Excerpt */}
                      <p className="text-dark/70 text-sm leading-relaxed line-clamp-3 mb-4">
                        {post.excerpt}
                      </p>

                      {/* Read More */}
                      <div className="flex items-center justify-between pt-3 border-t border-coyote/20">
                        <span className="text-canyon text-sm font-medium group-hover:translate-x-1 transition-transform duration-300">
                          Read More
                        </span>
                        <ArrowRight className="w-4 h-4 text-canyon group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </article>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* View All Blog Button */}
        <div className="text-center mt-16">
          <Link 
            to="/blog" 
            className="btn-primary inline-flex items-center text-xl px-12 py-4"
          >
            View All Articles
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
