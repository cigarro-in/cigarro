import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Star, Package, Calendar, MessageSquare, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  product_id: string;
  product: {
    name: string;
    slug: string;
    image_url: string;
  };
}

export function ReviewsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchReviews();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          product_id,
          product:products (
            name,
            slug,
            image_url
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type assertion since supabase types might not be fully generated
      setReviews(data as unknown as Review[] || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Reviews - Cigarro</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Header */}
        <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="font-serif text-2xl md:text-3xl">My Reviews</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-xl mb-2">No reviews yet</h3>
              <p className="text-muted-foreground mb-6">
                Share your thoughts on products you've purchased.
              </p>
              <Button onClick={() => navigate('/orders')} className="bg-dark text-creme-light hover:bg-canyon">
                Write a Review
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="border-2 border-border/40 hover:border-accent/30 transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Product Image */}
                      <div className="w-20 h-20 flex-shrink-0 bg-muted rounded-lg overflow-hidden border border-border/20">
                        {review.product?.image_url ? (
                          <img 
                            src={review.product.image_url} 
                            alt={review.product.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Review Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-lg mb-1">
                              <Link to={`/products/${review.product?.slug}`} className="hover:text-accent transition-colors">
                                {review.product?.name || 'Unknown Product'}
                              </Link>
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(review.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-full">
                            <Star className="w-4 h-4 text-accent fill-accent" />
                            <span className="font-bold text-accent">{review.rating}</span>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-4 bg-muted/30 rounded-lg border border-border/10">
                          <p className="text-foreground/90 leading-relaxed">
                            "{review.comment}"
                          </p>
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                            <Link to={`/products/${review.product?.slug}`} className="text-sm text-accent hover:text-accent-dark font-medium flex items-center gap-1">
                                View Product <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
