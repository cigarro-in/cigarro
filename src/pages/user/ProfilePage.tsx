import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
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
  ChevronLeft,
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
import { supabase } from '../../lib/supabase/client';
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
    benefits: [
      'Free shipping on orders above ₹999',
      'Birthday special: 10% off',
      'Access to seasonal sales'
    ]
  },
  {
    name: 'Silver',
    icon: <Star className="w-5 h-5" />,
    minSpend: 5000,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    benefits: [
      'All Bronze benefits',
      'Free shipping on all orders',
      '3% cashback on every purchase',
      'Priority customer support',
      'Early access to new arrivals',
      'Exclusive member-only deals'
    ]
  },
  {
    name: 'Gold',
    icon: <Sparkles className="w-5 h-5" />,
    minSpend: 15000,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    benefits: [
      'All Silver benefits',
      '5% cashback on every purchase',
      'Free express shipping',
      'Birthday gift: Premium product',
      'Exclusive Gold-only products',
      'Personal shopping assistance',
      'Extended return window (30 days)'
    ]
  },
  {
    name: 'Platinum',
    icon: <Crown className="w-5 h-5" />,
    minSpend: 35000,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    benefits: [
      'All Gold benefits',
      '8% cashback on every purchase',
      'Dedicated account manager',
      'VIP access to exclusive events',
      'First access to limited editions',
      'Complimentary gift wrapping',
      'Priority processing & shipping',
      'Lifetime warranty on select items'
    ]
  }
];

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [totalSpent, setTotalSpent] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTierIndex, setActiveTierIndex] = useState(0);

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
        // Count valid orders (not cancelled)
        const validOrders = orders.filter(o => o.status !== 'cancelled');
        setOrdersCount(validOrders.length);

        // Calculate total spent from confirmed orders
        // Includes: processing, shipped, delivered, completed
        const confirmedStatuses = ['processing', 'shipped', 'delivered', 'completed'];
        const spentOrders = orders.filter(o => confirmedStatuses.includes(o.status));
        setTotalSpent(spentOrders.reduce((sum, order) => sum + order.total, 0));
      }

      // Fetch wishlist count
      const { data: wishlist, error: wishlistError } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user!.id);

      if (!wishlistError && wishlist) {
        setWishlistCount(wishlist.length);
      }

      // Fetch wallet balance
      const { data: balance, error: walletError } = await supabase.rpc('get_wallet_balance', {
        p_user_id: user!.id
      });

      if (!walletError) {
        setWalletBalance(balance || 0);
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

  // Keep carousel in sync with current tier whenever spend changes
  useEffect(() => {
    const currentTier = getCurrentTier();
    const idx = membershipTiers.findIndex(t => t.name === currentTier.name);
    if (idx !== -1) {
      setActiveTierIndex(idx);
    }
  }, [totalSpent]);

  const handlePrevTier = () => {
    setActiveTierIndex(prev => (prev - 1 + membershipTiers.length) % membershipTiers.length);
  };

  const handleNextTier = () => {
    setActiveTierIndex(prev => (prev + 1) % membershipTiers.length);
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
    <>
      <Helmet>
        <title>My Profile - Cigarro</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

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
                      {(user as any).user_metadata?.full_name || (user as any).user_metadata?.name || user.email?.split('@')[0] || 'Guest User'}
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

            {/* Membership strip: current tier summary + all tiers in one row */}
            <div className="mt-4">
              <div className="overflow-x-auto pb-2 snap-x snap-mandatory">
                <div className="flex flex-nowrap gap-4 min-w-max">
                  {/* First card: detailed current tier summary */}
                  <div
                    className={`flex-shrink-0 w-[90vw] max-w-xl px-4 py-4 md:px-5 md:py-4 rounded-2xl border-2 snap-start ${currentTier.borderColor} ${currentTier.bgColor}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full ${currentTier.bgColor} border-2 ${currentTier.borderColor} flex items-center justify-center ${currentTier.color}`}>
                          {currentTier.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-serif text-lg text-foreground">
                              {currentTier.name} Member
                            </h4>
                            <Badge className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent border-accent/30 uppercase tracking-wide">
                              Current Tier
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Member since {new Date((user as any).created_at || new Date()).toLocaleDateString('en-IN', {
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-1">Lifetime Spent</p>
                      <p className="text-2xl font-serif font-semibold text-foreground">{formatINR(totalSpent)}</p>
                    </div>

                    {nextTier && (
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Next: {nextTier.name}
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatINR(nextTier.minSpend - totalSpent)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent to-canyon transition-all duration-500 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <h5 className="font-sans font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Your Benefits
                      </h5>
                      <div className="flex flex-col gap-1.5">
                        {currentTier.benefits.map((benefit, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-foreground">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Subsequent cards: upcoming and other tiers (exclude current) */}
                  {membershipTiers
                    .filter(tier => tier.name !== currentTier.name)
                    .map(tier => {
                      const next = getNextTier();
                      const isCurrent = false;
                      const isNext = tier.name === next?.name;
                      const isUnlocked = totalSpent >= tier.minSpend;

                    return (
                      <div
                        key={tier.name}
                        className={`flex-shrink-0 w-[90vw] max-w-xl px-4 py-3 rounded-2xl border-2 snap-start transition-all ${
                          isUnlocked
                            ? 'border-green-100 bg-gradient-to-br from-green-50/80 to-background'
                            : 'border-border/30 bg-gradient-to-br from-muted/40 to-background'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                              isUnlocked ? 'bg-green-100 border-green-200 text-green-700' : 'bg-muted border-border/40 text-muted-foreground'
                            }`}>
                              {tier.icon}
                            </div>
                            <div>
                              <h5 className={`font-serif font-semibold text-sm leading-tight ${
                                isUnlocked ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {tier.name}
                              </h5>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Spend {formatINR(tier.minSpend)}+
                              </p>
                            </div>
                          </div>

                          {isNext && (
                            <Badge className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 border-blue-200">
                              Next Goal
                            </Badge>
                          )}
                          {!isNext && isUnlocked && (
                            <Badge className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 border-green-200">
                              ✓ Unlocked
                            </Badge>
                          )}
                          {!isUnlocked && !isNext && (
                            <Badge className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground border-border/40">
                              Locked
                            </Badge>
                          )}
                        </div>

                        <div className="h-px bg-border/30 mb-2" />

                        <div className="space-y-1.5">
                          {tier.benefits.map((benefit, i) => (
                            <p key={i} className="text-[11px] text-foreground/80">
                              • {benefit}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

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
                    onClick={() => navigate('/wallet')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">My Wallet</span>
                        <Badge className="bg-green-50 text-green-600 border-green-200 text-xs">
                          {formatINR(walletBalance)}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* My Reviews */}
                  <button
                    onClick={() => navigate('/reviews')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Star className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <span className="text-sm font-medium text-foreground">My Reviews</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* Refer & Earn */}
                  <button
                    onClick={() => navigate('/referrals')}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-muted/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">Refer & Earn</span>
                        <Badge className="bg-green-50 text-green-600 border-green-200 text-xs">
                          Get ₹100
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>

                  {/* My Addresses */}
                  <button
                    onClick={() => navigate('/addresses')}
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
                    onClick={() => navigate('/profile/settings')}
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
                    onClick={() => navigate('/profile/settings')}
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
                    onClick={() => navigate('/profile/settings')}
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
                    onClick={() => navigate('/profile/settings')}
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
                    onClick={() => navigate('/privacy')}
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
                    onClick={() => navigate('/terms')}
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
                    onClick={() => navigate('/legal')}
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
    </>
  );
}
