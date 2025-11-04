import React, { useState, useEffect } from 'react';
import { SEOHead } from '../../components/seo/SEOHead';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowRight, Clock, Tag } from 'lucide-react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { getBlogImageUrl } from '../../utils/supabase/storage';
import { supabase } from '../../utils/supabase/client';
import type { BlogPost as BlogPostType } from '../../types/blog';



export function BlogsPage() {
  const location = useLocation();
  const [posts, setPosts] = useState<BlogPostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBlogPosts();
  }, []);

  const loadBlogPosts = async () => {
    try {
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
        .order('published_at', { ascending: false });

      if (error) throw error;

      const formattedPosts = data?.map(post => ({
        ...post,
        tags: post.tags?.map((t: any) => t.tag) || []
      })) || [];

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error loading blog posts:', error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
      <SEOHead
        title="Blog - Stories of Craftsmanship & Heritage"
        description="Explore our collection of stories about premium tobacco craftsmanship, heritage brands, and the art of fine cigarettes."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['tobacco blog', 'cigarette stories', 'tobacco heritage', 'smoking culture', 'premium tobacco articles']}
      />

      <div className="min-h-screen bg-creme pt-24 pb-12">
        <div className="main-container">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="main-title text-dark mb-6 max-w-4xl mx-auto">
              Stories of Craftsmanship & Heritage
            </h1>
          </div>



        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading blog posts...</p>
            </div>
          </div>
        ) : (
          /* Blog Posts Grid */
          posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post, index) => (
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
                        src={post.featured_image || getBlogImageUrl('placeholder.webp')}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      
                      {/* Category Badge */}
                      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-dark px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                        <Tag className="w-3 h-3" />
                        <span>{post.category?.name || 'Uncategorized'}</span>
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
                          <span>{post.author?.name || 'Unknown Author'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not published'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{post.reading_time ? `${post.reading_time} min read` : 'Unknown'}</span>
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
                        {post.tags?.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-creme-light text-dark text-xs rounded-full"
                          >
                            {tag.name}
                          </span>
                        ))}
                        {post.tags && post.tags.length > 3 && (
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
          )
        )}
      </div>
    </div>
    </>
  );
}

// Individual Blog Post Component
export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadBlogPost(slug);
    }
  }, [slug]);

  const loadBlogPost = async (postSlug: string) => {
    try {
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
        .eq('slug', postSlug)
        .eq('status', 'published')
        .single();

      if (error) throw error;

      const formattedPost = {
        ...data,
        tags: data.tags?.map((t: any) => t.tag) || []
      };

      setPost(formattedPost);

      // Load related posts
      if (data.category_id) {
        const { data: relatedData, error: relatedError } = await supabase
          .from('blog_posts')
          .select(`
            *,
            author:profiles(name, email),
            category:blog_categories(name, color),
            tags:blog_post_tags(
              tag:blog_tags(name, color)
            )
          `)
          .eq('category_id', data.category_id)
          .eq('status', 'published')
          .neq('id', data.id)
          .order('published_at', { ascending: false })
          .limit(3);

        if (!relatedError && relatedData) {
          const formattedRelated = relatedData.map(post => ({
            ...post,
            tags: post.tags?.map((t: any) => t.tag) || []
          }));
          setRelatedPosts(formattedRelated);
        }
      }
    } catch (error) {
      console.error('Error loading blog post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-creme pt-24 pb-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

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
    <>
      <SEOHead
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt}
        url={`https://cigarro.in/blog/${post.slug}`}
        type="article"
        author={post.author?.name || undefined}
        publishedTime={post.published_at || undefined}
        modifiedTime={post.updated_at || undefined}
        image={post.featured_image || undefined}
        keywords={post.tags?.map(t => t.name) || []}
        ogTitle={post.og_title || undefined}
        ogDescription={post.og_description || undefined}
        ogImage={post.og_image || undefined}
      />
      
      <div className="min-h-screen bg-creme pt-24 pb-12">
        <div className="main-container">

          {/* Article Header */}
          <div className="max-w-4xl mx-auto mb-8">
          {/* Category Badge */}
          <div className="flex items-center space-x-2 mb-4">
            <Tag className="w-4 h-4 text-canyon" />
            <span className="text-canyon font-medium uppercase tracking-wider text-sm">
              {post.category?.name || 'Uncategorized'}
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
              <span>{post.author?.name || 'Unknown Author'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not published'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>{post.reading_time ? `${post.reading_time} min read` : 'Unknown'}</span>
            </div>
          </div>

          {/* Featured Image */}
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl mb-8">
            <img
              src={post.featured_image || getBlogImageUrl('placeholder.webp')}
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
              {post.tags?.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-creme-light text-dark text-sm rounded-full"
                >
                  {tag.name}
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
                          src={relatedPost.featured_image || getBlogImageUrl('placeholder.webp')}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        
                        {/* Category Badge */}
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-dark px-2 py-1 rounded-full text-xs font-medium">
                          {relatedPost.category?.name || 'Uncategorized'}
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
                            <span>{relatedPost.author?.name || 'Unknown Author'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{relatedPost.published_at ? new Date(relatedPost.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not published'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{relatedPost.reading_time ? `${relatedPost.reading_time} min read` : 'Unknown'}</span>
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
    </>
  );
}
