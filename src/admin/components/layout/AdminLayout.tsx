import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, User as UserIcon } from 'lucide-react';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Button } from '../../../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { AdminTopNav } from './AdminTopNav';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminLayout({ children, activeSection, onSectionChange }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, adminProfile, signOut } = useAdminAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      // No need to navigate - signOut handles full page reload
    } catch (error) {
      console.error('Error signing out:', error);
      // Even on error, try to navigate away
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-creme font-sans">
      {/* Header with Top Navigation */}
      <header className="bg-dark border-b border-coyote sticky top-0 z-50">
        {/* Top Bar with User Menu */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-creme hover:text-creme/80 hover:bg-canyon/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Site
            </Button>
            <h1 className="text-xl font-semibold text-creme">Admin Dashboard</h1>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="relative h-10 w-10 rounded-full hover:bg-canyon/20 transition-all duration-200 ring-2 ring-transparent hover:ring-canyon/30"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-canyon text-creme font-semibold">
                    {adminProfile?.full_name 
                      ? adminProfile.full_name.charAt(0).toUpperCase()
                      : user?.email?.charAt(0).toUpperCase() || 'A'
                    }
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-creme-light border-coyote" align="end" forceMount>
              <DropdownMenuLabel className="font-normal pb-3">
                <div className="flex flex-col space-y-2">
                  <p className="text-sm font-semibold leading-none text-dark">
                    {adminProfile?.full_name || 'Admin User'}
                  </p>
                  <p className="text-xs leading-none text-dark/60">
                    {user?.email}
                  </p>
                  {adminProfile?.is_admin && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-canyon/10 text-canyon text-xs font-medium w-fit">
                      Administrator
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-coyote/30" />
              <DropdownMenuItem 
                onClick={handleSignOut} 
                className="cursor-pointer text-dark hover:bg-canyon/10 hover:text-canyon focus:bg-canyon/10 focus:text-canyon transition-colors duration-150 py-2.5"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span className="font-medium">Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Top Navigation */}
        <AdminTopNav 
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
