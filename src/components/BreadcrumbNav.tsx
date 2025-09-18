import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';

interface BreadcrumbNavProps {
  customBreadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export function BreadcrumbNav({ customBreadcrumbs }: BreadcrumbNavProps) {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Don't show breadcrumbs on homepage
  if (location.pathname === '/') {
    return null;
  }

  // Use custom breadcrumbs if provided
  if (customBreadcrumbs) {
    return (
      <div className="bg-creme border-b border-coyote/20">
        <div className="main-container">
          <div className="py-4">
            <Breadcrumb>
              <BreadcrumbList className="text-dark/70">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/" className="flex items-center hover:text-canyon transition-colors">
                      <Home className="w-4 h-4 mr-1" />
                      Home
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                
                {customBreadcrumbs.map((crumb, index) => (
                  <React.Fragment key={index}>
                    <BreadcrumbSeparator>
                      <ChevronRight className="w-4 h-4" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href} className="hover:text-canyon transition-colors">
                            {crumb.label}
                          </Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="text-dark font-medium">
                          {crumb.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
      </div>
    );
  }

  // Generate breadcrumbs from URL path
  const generateBreadcrumbs = () => {
    const breadcrumbs = [];
    
    pathnames.forEach((name, index) => {
      const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
      const isLast = index === pathnames.length - 1;
      
      // Format the name for display
      let displayName = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Handle special cases
      switch (name) {
        case 'products':
          displayName = 'All Products';
          break;
        case 'category':
          displayName = 'Category';
          break;
        case 'product':
          displayName = 'Product';
          break;
        case 'cart':
          displayName = 'Shopping Cart';
          break;
        case 'checkout':
          displayName = 'Checkout';
          break;
        case 'orders':
          displayName = 'My Orders';
          break;
        case 'admin':
          displayName = 'Admin Dashboard';
          break;
      }

      breadcrumbs.push({
        name: displayName,
        href: isLast ? undefined : routeTo,
        isLast
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="bg-creme border-b border-coyote/20">
      <div className="main-container">
        <div className="py-4">
          <Breadcrumb>
            <BreadcrumbList className="text-dark/70">
              {/* Home Link */}
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="flex items-center hover:text-canyon transition-colors">
                    <Home className="w-4 h-4 mr-1" />
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>

              {/* Dynamic Breadcrumbs */}
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbSeparator>
                    <ChevronRight className="w-4 h-4" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {crumb.isLast ? (
                      <BreadcrumbPage className="text-dark font-medium">
                        {crumb.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.href!} className="hover:text-canyon transition-colors">
                          {crumb.name}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
    </div>
  );
}

// Helper component for pages that need custom breadcrumbs
export function useBreadcrumbs(breadcrumbs: Array<{ label: string; href?: string }>) {
  return breadcrumbs;
}
