import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowRight, Clock, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBlogImageUrl } from '../../utils/supabase/storage';
import { supabase } from '../../utils/supabase/client';
import { BlogPost } from '../../types/blog';


export function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [sectionConfig, setSectionConfig] = useState({
    title: 'Blogs',
    subtitle: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    loadBlogData();
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [posts]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const targetScroll = direction === 'left' 
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  const loadBlogData = async () => {
    try {
      // Load section configuration
      const { data: configData, error: configError } = await supabase
        .from('section_configurations')
        .select('*')
        .eq('section_name', 'blog_section')
        .single();

      if (!configError && configData) {
        setSectionConfig({
          title: configData.title || 'Blogs',
          subtitle: '',
          description: ''
        });
      }

      // Load blog posts
      const { data, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          author:profiles(name, email),
          category:blog_categories(name, color),
          tags:blog_post_tags(
            tag:blog_tags(name, color)
          )
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      const formattedPosts = data?.map(post => ({
        ...post,
        tags: post.tags?.map((t: any) => t.tag) || []
      })) || [];

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error loading blog data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const featuredPost = posts[0];
  const regularPosts = posts.slice(1);

  return (
    <section className="py-[2rem] md:py-16 bg-creme md:min-h-screen md:flex md:items-center">
      <div className="main-container w-full">
        {/* Section Header */}
        <div className="text-center mb-[1.5rem] md:mb-12">
          <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl md:main-title md:mb-6 md:max-w-4xl md:mx-auto">
            {sectionConfig.title}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading blog posts...</p>
            </div>
          </div>
        ) : posts.length > 0 ? (
          <>
            {/* Mobile: Horizontal Carousel */}
            <div className="md:hidden relative">
              {/* Navigation Arrows */}
              <button
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg transition-all duration-300 ${
                  canScrollLeft 
                    ? 'opacity-100 hover:bg-canyon hover:text-white' 
                    : 'opacity-0 pointer-events-none'
                }`}
                aria-label="Previous blog post"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg transition-all duration-300 ${
                  canScrollRight 
                    ? 'opacity-100 hover:bg-canyon hover:text-white' 
                    : 'opacity-0 pointer-events-none'
                }`}
                aria-label="Next blog post"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Scrollable Container */}
              <div 
                ref={scrollContainerRef}
                className="flex gap-[1rem] overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-[0.5rem] px-1"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="flex-shrink-0 w-[70%] sm:w-[45%] snap-center"
                >
                <Link 
                  to={`/blog/${post.slug}`}
                  className="block h-full"
                >
                  <article className="bg-white rounded-[0.75rem] overflow-hidden shadow-md hover:shadow-lg transition-all duration-500 hover:scale-[1.02] h-full">
                    {/* Article Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={post.featured_image || getBlogImageUrl('placeholder.webp')}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                      />
                      
                      {/* Category Badge */}
                      <div className="absolute top-[0.5rem] right-[0.5rem] bg-white/95 backdrop-blur-sm text-dark px-[0.4rem] py-[0.15rem] rounded-full text-[0.65rem] font-medium">
                        {post.category?.name || 'Uncategorized'}
                      </div>
                    </div>

                    {/* Article Content */}
                    <div className="p-[0.75rem]">
                      {/* Meta Information */}
                      <div className="flex items-center space-x-[0.5rem] text-dark/60 text-[0.65rem] mb-[0.5rem]">
                        <div className="flex items-center space-x-[0.2rem]">
                          <Calendar className="w-[0.65rem] h-[0.65rem]" />
                          <span>{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not published'}</span>
                        </div>
                        <div className="flex items-center space-x-[0.2rem]">
                          <Clock className="w-[0.65rem] h-[0.65rem]" />
                          <span>{post.reading_time ? `${post.reading_time} min` : 'Unknown'}</span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-medium text-dark hover:text-canyon transition-colors leading-tight mb-[0.5rem] text-sm line-clamp-2">
                        {post.title}
                      </h3>

                      {/* Excerpt */}
                      <p className="text-dark/70 text-xs leading-relaxed line-clamp-2 mb-[0.6rem]">
                        {post.excerpt}
                      </p>

                      {/* Read More */}
                      <div className="flex items-center justify-between pt-[0.5rem] border-t border-coyote/20">
                        <span className="text-canyon text-xs font-medium hover:translate-x-1 transition-transform duration-300">
                          Read More
                        </span>
                        <ArrowRight className="w-[0.85rem] h-[0.85rem] text-canyon hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </article>
                </Link>
              </motion.div>
                ))}
              </div>

              {/* Scroll Indicators */}
              <div className="flex justify-center gap-2 mt-4">
                {posts.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      const container = scrollContainerRef.current;
                      if (!container) return;
                      const cardWidth = container.clientWidth * 0.70;
                      container.scrollTo({
                        left: index * (cardWidth + 16),
                        behavior: 'smooth'
                      });
                    }}
                    className="w-2 h-2 rounded-full bg-coyote/30 hover:bg-canyon transition-colors"
                    aria-label={`Go to blog post ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop: Grid Layout */}
            <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
              {/* Featured Article - Large Left */}
              {featuredPost && (
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
                          src={featuredPost.featured_image || getBlogImageUrl('placeholder.webp')}
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
                          <span>{featuredPost.category?.name || 'Uncategorized'}</span>
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
                            <span>{featuredPost.author?.name || 'Unknown Author'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{featuredPost.published_at ? new Date(featuredPost.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not published'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{featuredPost.reading_time ? `${featuredPost.reading_time} min read` : 'Unknown'}</span>
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
              )}

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
                            src={post.featured_image || getBlogImageUrl('placeholder.webp')}
                            alt={post.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          
                          {/* Category Badge */}
                          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-dark px-2 py-1 rounded-full text-xs font-medium">
                            {post.category?.name || 'Uncategorized'}
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
                              <span>{post.author?.name || 'Unknown Author'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not published'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{post.reading_time ? `${post.reading_time} min read` : 'Unknown'}</span>
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
          </>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-2xl font-serif text-dark mb-4">No blog posts available</h3>
            <p className="text-dark/70 mb-8">
              Check back later for new articles and insights.
            </p>
          </div>
        )}

        {/* View All Blog Button */}
        <div className="text-center mt-[2rem]">
          <Link 
            to="/blog" 
            className="btn-primary inline-flex items-center text-base px-[3rem] py-[1rem]"
          >
            View All
            <ArrowRight className="ml-[0.5rem] w-[1.25rem] h-[1.25rem]" />
          </Link>
        </div>
      </div>
    </section>
  );
}
