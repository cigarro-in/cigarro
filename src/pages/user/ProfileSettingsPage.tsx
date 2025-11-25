import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Bell, Save, Shield } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      const metadata = (user as any).user_metadata || {};
      setFormData({
        fullName: metadata.full_name || metadata.name || '',
        email: user.email || '',
        phone: metadata.phone || (user as any).phone || ''
      });
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: formData.fullName,
          phone: formData.phone
        }
      });

      if (error) throw error;
      
      // Also update profiles table if it exists/is used
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user!.id,
          full_name: formData.fullName,
          phone: formData.phone,
          updated_at: new Date().toISOString()
        });

        // Ignore profile error if table doesn't exist or RLS issues, primary is auth
        if (profileError) console.warn('Profile table update warning:', profileError);

      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error: any) {
      toast.error('Failed to send reset email');
    }
  };

  return (
    <>
      <Helmet>
        <title>Account Settings - Cigarro</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <div className="border-b border-border/20 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="font-serif text-2xl md:text-3xl">Account Settings</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          
          {/* Personal Information */}
          <Card className="border-2 border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="pl-9"
                    />
                </div>
                <p className="text-xs text-muted-foreground">Used for shipping and order updates.</p>
              </div>
              <Button 
                onClick={handleUpdateProfile} 
                disabled={isLoading}
                className="bg-dark text-creme-light hover:bg-canyon"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card className="border-2 border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Login & Security
              </CardTitle>
              <CardDescription>Manage your email and password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="email"
                    value={formData.email}
                    disabled
                    className="bg-muted pl-9"
                    />
                </div>
                <p className="text-xs text-muted-foreground">To change email, please contact support.</p>
              </div>

              <div className="border-t border-border/20 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-muted-foreground">Protect your account with a strong password.</p>
                  </div>
                  <Button variant="outline" onClick={handlePasswordReset}>
                    <Lock className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-2 border-border/40 opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>Manage how we communicate with you (Coming Soon).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="font-medium">Order Updates</h4>
                  <p className="text-sm text-muted-foreground">Receive emails about your order status.</p>
                </div>
                <Switch disabled checked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="font-medium">Promotional Emails</h4>
                  <p className="text-sm text-muted-foreground">Receive offers and news.</p>
                </div>
                <Switch disabled checked />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}
