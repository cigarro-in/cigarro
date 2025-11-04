// =====================================================
// REFERRAL PAGE - USER REFERRAL DASHBOARD
// =====================================================

import { useState, useEffect } from 'react';
import { useReferral } from '../../hooks/useReferral';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { 
  Copy, 
  Share2, 
  Users, 
  CheckCircle, 
  Clock, 
  Gift,
  TrendingUp,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralPage() {
  const { stats, referredUsers, wasReferred, loading, copyLink, shareLink } = useReferral();
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Debug: Log the data
  useEffect(() => {
    console.log('Referral Page - Loading:', loading);
    console.log('Referral Page - Stats:', stats);
    console.log('Referral Page - Referred Users:', referredUsers);
  }, [loading, stats, referredUsers]);

  const handleCopyLink = async () => {
    setCopying(true);
    const success = await copyLink();
    if (success) {
      toast.success('Referral link copied to clipboard!');
    } else {
      toast.error('Failed to copy link');
    }
    setCopying(false);
  };

  const handleShareLink = async () => {
    setSharing(true);
    const success = await shareLink();
    if (success) {
      toast.success('Shared successfully!');
    } else {
      toast.error('Failed to share');
    }
    setSharing(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-canyon mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading referral data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dark mb-2">Referral Program</h1>
        <p className="text-muted-foreground">
          Share Cigarro with friends and earn ₹100 for each successful referral
        </p>
      </div>

      {/* If user was referred, show "Referred By" section */}
      {wasReferred.was_referred && (
        <Card className="mb-6 border-2 border-canyon/30 bg-gradient-to-br from-canyon/10 to-accent/5 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-canyon">
              <Gift className="h-6 w-6" />
              Referred By
            </CardTitle>
            <CardDescription>
              You joined Cigarro through a referral
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg border border-canyon/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-canyon/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-canyon" />
                  </div>
                  <div>
                    <p className="font-semibold text-dark text-lg">
                      {wasReferred.referrer_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Your referrer
                    </p>
                  </div>
                </div>
                <Badge className="bg-canyon/10 text-canyon border-canyon/30 px-3 py-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </div>

              {/* Reward Status */}
              {wasReferred.reward_pending && wasReferred.reward_pending > 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">
                        ₹{wasReferred.reward_pending} Reward Pending
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Complete your first order to unlock your referral bonus!
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">
                        ₹100 Reward Claimed!
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        Your referral bonus has been credited to your wallet.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold text-dark">{stats?.total_referrals || 0}</p>
              </div>
              <Users className="h-8 w-8 text-canyon/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-dark">{stats?.successful_referrals || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-dark">{stats?.pending_referrals || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold text-dark">₹{stats?.total_rewards_earned || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-canyon/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Referral Code</CardTitle>
          <CardDescription>
            Share this code with friends to earn ₹100 when they complete their first order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Referral Code Display */}
            <div className="flex items-center gap-4 p-4 bg-creme-light rounded-lg border border-coyote">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Your Code</p>
                <p className="text-3xl font-bold text-dark tracking-wider font-mono">
                  {stats?.referral_code || 'LOADING'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCopyLink}
                  disabled={copying || !stats?.referral_code}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copying ? 'Copying...' : 'Copy Link'}
                </Button>
                <Button
                  size="lg"
                  onClick={handleShareLink}
                  disabled={sharing || !stats?.referral_code}
                  className="bg-canyon hover:bg-canyon/90"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  {sharing ? 'Sharing...' : 'Share'}
                </Button>
              </div>
            </div>

            {/* Referral Link */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Your Referral Link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-background px-3 py-2 rounded border">
                  {stats?.referral_link || 'Loading...'}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  disabled={copying}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* How it Works */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="w-12 h-12 bg-canyon/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6 text-canyon" />
                </div>
                <h4 className="font-semibold text-dark mb-1">1. Share</h4>
                <p className="text-sm text-muted-foreground">
                  Share your code with friends
                </p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="w-12 h-12 bg-canyon/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-canyon" />
                </div>
                <h4 className="font-semibold text-dark mb-1">2. They Join</h4>
                <p className="text-sm text-muted-foreground">
                  Friends sign up using your code
                </p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="w-12 h-12 bg-canyon/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Gift className="h-6 w-6 text-canyon" />
                </div>
                <h4 className="font-semibold text-dark mb-1">3. Earn ₹100</h4>
                <p className="text-sm text-muted-foreground">
                  Both get ₹100 after first order
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referred Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
          <CardDescription>
            People who joined using your referral code
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No referrals yet</p>
              <p className="text-sm text-muted-foreground">
                Share your code to start earning rewards!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {referredUsers.map((user, index) => (
                <div key={user.referred_user_id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-canyon/10 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-canyon" />
                      </div>
                      <div>
                        <p className="font-medium text-dark">
                          {user.referred_user_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.referred_user_email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {new Date(user.signup_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {user.first_order_completed ? (
                        <div>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                          <p className="text-sm font-semibold text-green-600 mt-1">
                            +₹{user.reward_earned}
                          </p>
                          {user.first_order_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(user.first_order_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Order
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card className="mt-8 border-muted">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-dark mb-3">Terms & Conditions</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Both referrer and referred user receive ₹100 after the referred user completes their first order</li>
            <li>• Rewards are credited automatically after order confirmation</li>
            <li>• Self-referrals are not allowed</li>
            <li>• Each user can only be referred once</li>
            <li>• Cigarro reserves the right to modify or cancel the referral program at any time</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
