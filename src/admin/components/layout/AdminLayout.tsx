import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { AdminTopNav } from './AdminTopNav';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminLayout({ children, activeSection, onSectionChange }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-creme font-sans">
      {/* Header with Top Navigation */}
      <header className="bg-dark border-b border-coyote sticky top-0 z-50">
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
