import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  backUrl?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}

export function PageHeader({ title, description, children, backUrl, search }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-20 bg-[var(--color-creme)] border-b border-[var(--color-coyote)]">
      <div className="w-full px-6 py-4 flex items-center justify-between gap-4">
        {/* Left Section: Navigation & Title */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            {backUrl && (
              <Button variant="ghost" size="icon" onClick={() => navigate(backUrl)} className="-ml-2 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-[var(--color-dark)] leading-none truncate">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-gray-600 mt-1 hidden sm:block truncate">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {children}
        </div>

        {/* Search Section (Right Most) */}
        {search && (
          <div className="w-[300px] hidden md:block">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={search.placeholder || "Search..."}
                className="pl-9 bg-[var(--color-creme-light)] border-[var(--color-coyote)]/50 focus:border-[var(--color-canyon)] transition-colors"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
