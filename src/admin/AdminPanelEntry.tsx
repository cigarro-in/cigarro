import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { AdminDashboard } from '../AdminDashboard';

interface SecurityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export default function AdminPanelEntry() {
  const navigate = useNavigate();
  const { user, adminProfile, isAdmin, hasAccess: authHasAccess, signOut, checkAdminAccess } = useAdminAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [localHasAccess, setLocalHasAccess] = useState(false);
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    performSecurityChecks();
  }, [user]);

  // Redirect to home if user is not authenticated (prevents back button access after logout)
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const performSecurityChecks = async () => {
    setIsLoading(true);
    const checks: SecurityCheck[] = [];

    try {
      // Check 1: User authentication
      if (!user) {
        checks.push({
          name: 'User Authentication',
          status: 'fail',
          message: 'User is not authenticated'
        });
        setSecurityChecks(checks);
        setIsLoading(false);
        return;
      }

      checks.push({
        name: 'User Authentication',
        status: 'pass',
        message: 'User is authenticated'
      });

      // Check 2: Admin privileges  
      const currentHasAccess = await checkAdminAccess();
      
      if (!adminProfile) {
        checks.push({
          name: 'Admin Profile Check',
          status: 'fail',
          message: 'Could not verify admin profile'
        });
      } else if (!adminProfile.is_admin) {
        checks.push({
          name: 'Admin Privileges',
          status: 'fail',
          message: 'User does not have admin privileges'
        });
      } else if (!adminProfile.is_active) {
        checks.push({
          name: 'Account Status',
          status: 'fail',
          message: 'Admin account is not active'
        });
      } else {
        checks.push({
          name: 'Admin Privileges',
          status: 'pass',
          message: 'User has admin privileges'
        });
        checks.push({
          name: 'Account Status',
          status: 'pass',
          message: 'Admin account is active'
        });
      }

      // Check 3: Database connectivity
      try {
        const { error: dbError } = await supabase
          .from('products')
          .select('id')
          .limit(1);

        if (dbError) {
          checks.push({
            name: 'Database Connectivity',
            status: 'warning',
            message: `Database connection issue: ${dbError.message}`
          });
        } else {
          checks.push({
            name: 'Database Connectivity',
            status: 'pass',
            message: 'Database is accessible'
          });
        }
      } catch (error) {
        checks.push({
          name: 'Database Connectivity',
          status: 'fail',
          message: 'Database connection failed'
        });
      }

      // Check 4: Required tables exist
      const requiredTables = ['products', 'categories', 'brands', 'orders'];
      let tableCheckPassed = true;

      for (const table of requiredTables) {
        try {
          const { error } = await supabase
            .from(table)
            .select('id')
            .limit(1);

          if (error) {
            tableCheckPassed = false;
            break;
          }
        } catch {
          tableCheckPassed = false;
          break;
        }
      }

      if (tableCheckPassed) {
        checks.push({
          name: 'Database Schema',
          status: 'pass',
          message: 'All required tables are present'
        });
      } else {
        checks.push({
          name: 'Database Schema',
          status: 'warning',
          message: 'Some required tables may be missing'
        });
      }

      // Determine overall access
      const hasFailures = checks.some(check => check.status === 'fail');
      const hasAdminAccess = currentHasAccess && !hasFailures;

      setLocalHasAccess(hasAdminAccess);
      setSecurityChecks(checks);

    } catch (error) {
      console.error('Security check error:', error);
      checks.push({
        name: 'Security Check',
        status: 'fail',
        message: 'Security validation failed'
      });
      setSecurityChecks(checks);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleEnterAdminPanel = () => {
    setShowAdminPanel(true);
  };

  const handleStatsUpdate = () => {
    // This will be passed to admin components that need to update stats
    console.log('Stats updated');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Verifying Access</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              Performing security checks...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showAdminPanel && localHasAccess) {
    return <AdminDashboard />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">
                Secure administrative access
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Security Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Verification
              </CardTitle>
              <CardDescription>
                Checking admin access permissions and system status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {securityChecks.map((check, index) => (
                <div key={index} className="flex items-center gap-3">
                  {check.status === 'pass' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {check.status === 'warning' && (
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  )}
                  {check.status === 'fail' && (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Access Status */}
          {localHasAccess ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>All security checks passed. You have admin access.</span>
                  <Button onClick={handleEnterAdminPanel} className="ml-4">
                    Enter Admin Panel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Access denied. Please contact your system administrator if you believe this is an error.
              </AlertDescription>
            </Alert>
          )}

          {/* User Info */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                  <div>
                    <p className="font-medium">User ID</p>
                    <p className="text-muted-foreground font-mono text-xs">{user.id}</p>
                  </div>
                  <div>
                    <p className="font-medium">Access Level</p>
                    <p className="text-muted-foreground">
                      {localHasAccess ? 'Administrator' : 'Standard User'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Last Sign In</p>
                    <p className="text-muted-foreground">
                      {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>If you're having trouble accessing the admin panel:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Ensure you have been granted admin privileges</li>
                  <li>Check that your account is active</li>
                  <li>Try refreshing the page</li>
                  <li>Contact your system administrator</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
