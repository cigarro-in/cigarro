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
    <header className="sticky top-12 z-20 border-b bg-background md:top-0">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          {backUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Go back"
              onClick={() => navigate(backUrl)}
            >
              <ArrowLeft aria-hidden />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{title}</h1>
            {description && <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>}
          </div>
        </div>

        {children && <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>}

        {search && (
          <div className="relative order-last w-full md:order-none md:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label={search.placeholder || 'Search'}
              placeholder={search.placeholder || 'Search'}
              className="pl-9"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
            />
          </div>
        )}
      </div>
    </header>
  );
}
