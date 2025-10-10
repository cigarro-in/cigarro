import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Package, 
  Heart, 
  Star, 
  Wallet, 
  Users, 
  MapPin, 
  Settings, 
  Shield, 
  FileText, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Crown,
  Sparkles,
  TrendingUp,
  Gift,
  Bell,
  CreditCard,
  Lock,
  Mail,
  Phone,
  Calendar,
  Award,
  Zap
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';

interface MembershipTier {
  name: string;
  icon: React.ReactNode;
  minSpend: number;
  color: string;
  bgColor: string;
  borderColor: string;
  benefits: string[];
}

const membershipTiers: MembershipTier[] = [
  {
    name: 'Bronze',
    icon: <Award className="w-5 h-5" />,
    minSpend: 0,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    benefits: ['Free shipping on orders above ₹2000', 'Birthday special discount']
  },
  {
    name: 'Silver',
    icon: <Star className="w-5 h-5" />,
    minSpend: 10000,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    benefits: ['Free shipping on all orders', 'Priority customer support', '5% cashback on all orders']
  },
  {
    name: 'Gold',
    icon: <Sparkles className="w-5 h-5" />,
    minSpend: 25000,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    benefits: ['All Silver benefits', 'Early access to new products', '10% cashback', 'Exclusive deals']
  },
  {
    name: 'Platinum',
    icon: <Crown className="w-5 h-5" />,
    minSpend: 50000,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    benefits: ['All Gold benefits', 'Dedicated account manager', '15% cashback', 'VIP events access']
  }
];

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [totalSpent, setTotalSpent] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    try {
      // Fetch total spent and orders count
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total, status')
        .eq('user_id', user!.id);

      if (!ordersError && orders) {
        const completedOrders = orders.filter(o => o.status === 'delivered');
        setTotalSpent(completedOrders.reduce((sum, order) => sum + order.total, 0));
        setOrdersCount(orders.length);
      }

      // Fetch wishlist count
      const { data: wishlist, error: wishlistError } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user!.id);

      if (!wishlistError && wishlist) {
        setWishlistCount(wishlist.length);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentTier = (): MembershipTier => {
    return [...membershipTiers]
      .reverse()
      .find(tier => totalSpent >= tier.minSpend) || membershipTiers[0];
  };

  const getNextTier = (): MembershipTier | null => {
    const currentTier = getCurrentTier();
    const currentIndex = membershipTiers.findIndex(t => t.name === currentTier.name);
    return currentIndex < membershipTiers.length - 1 ? membershipTiers[currentIndex + 1] : null;
  };

  const getProgressToNextTier = (): number => {
    const nextTier = getNextTier();
    if (!nextTier) return 100;
    const currentTier = getCurrentTier();
    const progress = ((totalSpent - currentTier.minSpend) / (nextTier.minSpend - currentTier.minSpend)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="border-2 border-border/40 bg-card shadow-md max-w-md w-full">
          <CardContent className="text-center p-8">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-serif text-2xl text-foreground mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your profile.
            </p>
            <Button 
              onClick={() => navigate('/')}
              className="bg-dark text-creme-light px-6 py-2.5 rounded-full font-medium text-sm uppercase tracking-wide transition-all duration-300 hover:bg-canyon"
            >
              Back to Store
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTier = getCurrentTier();
  const nextTier = getNextTier();
  const progress = getProgressToNextTier();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      {/* Header */}
      <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 sm:pb-4">
          <div className="text-center">
            <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
              My Account
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-lg h-32 animate-pulse border-2 border-border/30 shadow-md" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {/* Profile Header Card */}
            <Card className="border-2 border-border/40 bg-card overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-accent to-canyon flex items-center justify-center flex-shrink-0 shadow-lg">
                    <User className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-serif text-xl md:text-2xl text-foreground mb-1">
                      {user.email?.split('@')[0] || 'Guest User'}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-3">{user.email}</p>
                    
                    {/* Quick Stats */}
                    <div className="flex flex-wrap gap-3 md:gap-4">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs md:text-sm text-foreground">
                          <span className="font-semibold">{ordersCount}</span> Orders
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs md:text-sm text-foreground">
                          <span className="font-semibold">{wishlistCount}</span> Wishlist
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs md:text-sm text-foreground">
                          <span className="font-semibold">{formatINR(totalSpent)}</span> Spent
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Membership Status Card */}
            <Card className={`border-2 ${currentTier.borderColor} ${currentTier.bgColor} overflow-hidden shadow-md hover:shadow-lg transition-all duration-300`}>
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${currentTier.bgColor} border-2 ${currentTier.borderColor} flex items-center justify-center ${currentTier.color}`}>
                      {currentTier.icon}
                    </div>
                    <div>
                      <h3 className="font-serif text-xl md:text-2xl text-foreground mb-1">
                        {currentTier.name} Member
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Lifetime Spent: {formatINR(totalSpent)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Member since {new Date((user as any).created_at || new Date()).toLocaleDateString('en-IN', {
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${currentTier.color} ${currentTier.bgColor} border-2 ${currentTier.borderColor} px-3 py-1`}>
                    <Zap className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>

                {/* Progress to Next Tier */}
                {nextTier && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Progress to {nextTier.name}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatINR(nextTier.minSpend - totalSpent)} to go
                      </span>
                    </div>
                    <div className="w-full h-3 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-accent to-canyon transition-all duration-500 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Benefits */}
                <div className="mt-6">
                  <h4 className="font-sans font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                    Your Benefits
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {currentTier.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Section */}
            <Card className="border-2 border-border/40 bg-card overflow-hidden shadow-md">
              <CardContent className="p-6 md:p-8">
                <h3 className="font-serif text-xl text-foreground mb-6">Quick Actions</h3>
                <div className="space-y-3">
                  {/* My Orders */}
                  <button
                    onClick={() => navigate('/orders')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">My Orders</span>
                        {ordersCount > 0 && (
                          <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
                            {ordersCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* My Wishlist */}
                  <button
                    onClick={() => navigate('/wishlist')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">My Wishlist</span>
                        {wishlistCount > 0 && (
                          <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">
                            {wishlistCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* My Wallet */}
                  <button
                    onClick={() => toast.info('Wallet feature coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">My Wallet</span>
                        <Badge className="bg-green-50 text-green-600 border-green-200 text-xs">
                          ₹0.00
                        </Badge>
                      </div>
                    </div>
                    <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                      Coming Soon
                    </Badge>
                  </button>

                  {/* My Reviews */}
                  <button
                    onClick={() => toast.info('Reviews feature coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Star className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">My Reviews</span>
                    </div>
                    <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                      Coming Soon
                    </Badge>
                  </button>

                  {/* Refer & Earn */}
                  <button
                    onClick={() => toast.info('Referral program coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Refer & Earn</span>
                    </div>
                    <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                      Coming Soon
                    </Badge>
                  </button>

                  {/* My Addresses */}
                  <button
                    onClick={() => toast.info('Address management coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">My Addresses</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings Section */}
            <Card className="border-2 border-border/40 bg-card overflow-hidden shadow-md">
              <CardContent className="p-6 md:p-8">
                <h3 className="font-serif text-xl text-foreground mb-6">Account Settings</h3>
                <div className="space-y-3">
                  {/* Personal Information */}
                  <button
                    onClick={() => toast.info('Personal information editing coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Personal Information</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Email & Phone */}
                  <button
                    onClick={() => toast.info('Contact details editing coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Email & Phone</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Password & Security */}
                  <button
                    onClick={() => toast.info('Security settings coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Password & Security</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Notifications */}
                  <button
                    onClick={() => toast.info('Notification preferences coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Notifications</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Payment Methods */}
                  <button
                    onClick={() => toast.info('Payment methods coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Payment Methods</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Legal & Support Section */}
            <Card className="border-2 border-border/40 bg-card overflow-hidden shadow-md">
              <CardContent className="p-6 md:p-8">
                <h3 className="font-serif text-xl text-foreground mb-6">Legal & Support</h3>
                <div className="space-y-3">
                  {/* Help Center */}
                  <button
                    onClick={() => navigate('/contact')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Help Center</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Privacy Policy */}
                  <button
                    onClick={() => toast.info('Privacy policy coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Privacy Policy</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Terms & Conditions */}
                  <button
                    onClick={() => toast.info('Terms & conditions coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Terms & Conditions</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Return & Refund Policy */}
                  <button
                    onClick={() => toast.info('Return policy coming soon!')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">Return & Refund Policy</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Sign Out Button */}
            <div className="pt-4">
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full border border-red-300 hover:border-red-400 bg-background hover:bg-red-50 text-red-600 hover:text-red-700 transition-all duration-300 p-4 rounded-lg"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
