import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowRight, Clock, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBlogImageUrl } from '../../lib/images/urls';
import { BlogPost, BlogSectionConfig } from '../../types/home';


interface BlogSectionProps {
  posts?: BlogPost[];
  config?: BlogSectionConfig | null;
  isLoading?: boolean;
}

export function BlogSection({ posts = [], config, isLoading = false }: BlogSectionProps) {
  const sectionConfig = {
    title: config?.title || 'Blogs',
    subtitle: config?.subtitle || '',
    description: config?.description || ''
  };
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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

  return (
    <section className="py-[2rem] md:py-16 bg-creme">
      <div className="main-container w-full">
        {/* Section Header */}
        <div className="text-center mb-[1.5rem] md:mb-12">
          <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl md:mb-6 md:max-w-4xl md:mx-auto">
            {sectionConfig.title}
          </h2>
          {sectionConfig.description && (
            <p className="hidden md:block text-dark/70 max-w-2xl mx-auto">{sectionConfig.description}</p>
          )}
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
                        src={post.featured_image || getBlogImageUrl()}
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

            {/* Desktop: uniform 3-column grid, same posts as mobile */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {posts.slice(0, 6).map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (index % 3) * 0.1, duration: 0.6 }}
                  className="group h-full"
                >
                  <Link
                    to={`/blog/${post.slug}`}
                    className="block h-full"
                  >
                    <article className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 group-hover:-translate-y-1 h-full flex flex-col">
                      {/* Article Image */}
                      <div className="relative aspect-[16/10] overflow-hidden shrink-0">
                        <img
                          src={post.featured_image || getBlogImageUrl()}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {index === 0 && (
                          <div className="absolute top-3 left-3 bg-canyon text-creme-light px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider">
                            Featured
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-dark px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
                          <Tag className="w-3 h-3" />
                          <span>{post.category?.name || 'Uncategorized'}</span>
                        </div>
                      </div>

                      {/* Article Content */}
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center space-x-3 text-dark/60 text-xs mb-3">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{post.author?.name || 'Unknown Author'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not published'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{post.reading_time ? `${post.reading_time} min read` : 'Unknown'}</span>
                          </div>
                        </div>

                        <h3 className="font-serif text-xl text-dark group-hover:text-canyon transition-colors leading-snug mb-3 line-clamp-2">
                          {post.title}
                        </h3>

                        <p className="text-dark/70 text-sm leading-relaxed line-clamp-3 mb-4 flex-1">
                          {post.excerpt}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-coyote/20 mt-auto">
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
