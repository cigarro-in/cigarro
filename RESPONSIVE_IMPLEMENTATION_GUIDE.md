# Professional Responsive Implementation Guide

## Production-Ready Standards

### Tailwind Best Practices

#### 1. Use Standard Tailwind Classes (No Custom CSS)
```tsx
// ❌ BAD - Custom inline styles
<div style={{ padding: 'calc(100vw * 10 / 1440)' }}>

// ✅ GOOD - Standard Tailwind utilities
<div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
```

#### 2. Mobile-First Approach
```tsx
// ❌ BAD - Desktop-first with max-width
<div className="w-full md:max-w-screen-lg">

// ✅ GOOD - Mobile-first with min-width
<div className="w-full md:w-auto lg:max-w-screen-lg">
```

#### 3. Consistent Breakpoint Usage
```tsx
// Standard Tailwind breakpoints only
// sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px

<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
```

---

## Component Implementation Examples

### Header Component (Production Ready)
```tsx
// src/components/layout/ResponsiveHeader.tsx
import React from 'react';
import { Menu, Search, ShoppingBag, User, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ResponsiveHeader = () => {
  return (
    <>
      {/* Desktop Header - Hidden on mobile/tablet */}
      <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="bg-creme border border-coyote rounded-lg h-14 flex items-center justify-between px-6">
          {/* Menu Button */}
          <button className="flex items-center gap-3 px-4 py-2 hover:bg-creme-light rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
            <span className="text-base font-medium">Menu</span>
          </button>

          {/* Logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <h1 className="text-2xl font-serif uppercase tracking-tight">CIGARRO</h1>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="p-3 hover:bg-creme-light rounded-lg transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-3 hover:bg-creme-light rounded-lg transition-colors relative">
              <Heart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-dark text-creme-light text-xs w-5 h-5 rounded-full flex items-center justify-center">
                3
              </span>
            </button>
            <button className="p-3 hover:bg-creme-light rounded-lg transition-colors relative">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-dark text-creme-light text-xs w-5 h-5 rounded-full flex items-center justify-center">
                2
              </span>
            </button>
            <button className="p-3 hover:bg-creme-light rounded-lg transition-colors">
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile/Tablet Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 px-3 py-2 bg-creme">
        <div className="bg-creme border border-coyote rounded-lg h-12 sm:h-14 flex items-center justify-between">
          <button className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 border-r border-coyote">
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <Link to="/" className="flex-1 flex justify-center">
            <h1 className="text-lg sm:text-xl font-serif uppercase tracking-tight">CIGARRO</h1>
          </Link>
          
          <button className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 border-l border-coyote">
            <Search className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </header>
    </>
  );
};
```

### Product Card (Production Ready)
```tsx
// src/components/products/ResponsiveProductCard.tsx
import React from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    brand: string;
    price: number;
    image: string;
  };
  onAddToCart: (id: string) => void;
}

export const ResponsiveProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToCart 
}) => {
  return (
    <div className="group relative bg-creme-light rounded-lg border border-coyote/20 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      {/* Wishlist Button - Touch-friendly size */}
      <button 
        className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 
                   w-10 h-10 sm:w-11 sm:h-11 
                   flex items-center justify-center
                   bg-creme-light/90 backdrop-blur-sm rounded-full 
                   hover:bg-creme-light hover:scale-110 
                   transition-all duration-300"
        aria-label="Add to wishlist"
      >
        <Heart className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
      </button>

      <Link to={`/product/${product.slug}`}>
        {/* Product Image - Responsive aspect ratio */}
        <div className="relative aspect-square overflow-hidden bg-white">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>

        {/* Product Info - Responsive padding and text */}
        <div className="p-3 sm:p-4 md:p-5">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-canyon mb-1">
            {product.brand}
          </p>
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-dark mb-2 sm:mb-3 line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]">
            {product.name}
          </h3>
          
          <div className="flex items-center justify-between gap-2">
            <p className="text-base sm:text-lg md:text-xl font-bold text-dark">
              ₹{product.price.toLocaleString('en-IN')}
            </p>
            
            {/* Add to Cart - Touch-friendly button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                onAddToCart(product.id);
              }}
              className="bg-dark text-creme-light 
                         px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3
                         min-h-[44px] sm:min-h-[48px]
                         text-xs sm:text-sm md:text-base
                         font-medium uppercase tracking-wide
                         rounded-full
                         hover:bg-canyon 
                         active:scale-95
                         transition-all duration-300"
            >
              Add
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
};
```

### Product Grid (Production Ready)
```tsx
// src/components/products/ResponsiveProductGrid.tsx
import React from 'react';
import { ResponsiveProductCard } from './ResponsiveProductCard';

export const ResponsiveProductGrid = ({ products, onAddToCart }) => {
  return (
    <section className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-8 sm:py-12 md:py-16 lg:py-20">
      <div className="max-w-screen-2xl mx-auto">
        {/* Section Header */}
        <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif text-dark mb-2 sm:mb-3">
            Featured Products
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-dark/70 max-w-2xl">
            Discover our curated selection of premium tobacco products
          </p>
        </div>

        {/* Responsive Grid */}
        <div className="grid 
                        grid-cols-2 
                        sm:grid-cols-2 
                        md:grid-cols-3 
                        lg:grid-cols-4 
                        xl:grid-cols-5
                        gap-3 sm:gap-4 md:gap-5 lg:gap-6">
          {products.map((product) => (
            <ResponsiveProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
```

### Form Input (Production Ready)
```tsx
// src/components/forms/ResponsiveInput.tsx
import React from 'react';

interface ResponsiveInputProps {
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}

export const ResponsiveInput: React.FC<ResponsiveInputProps> = ({
  label,
  type = 'text',
  placeholder,
  error,
  required = false,
  ...props
}) => {
  return (
    <div className="w-full">
      <label className="block text-sm sm:text-base md:text-lg font-medium text-dark mb-2">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      
      <input
        type={type}
        placeholder={placeholder}
        className="w-full 
                   px-4 py-3 sm:px-5 sm:py-3.5 md:px-6 md:py-4
                   min-h-[44px] sm:min-h-[48px]
                   text-base sm:text-lg
                   bg-creme-light border border-coyote
                   rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-canyon focus:border-transparent
                   placeholder:text-coyote/50
                   transition-all duration-200"
        {...props}
      />
      
      {error && (
        <p className="mt-1.5 text-xs sm:text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};
```

### Button Component (Production Ready)
```tsx
// src/components/ui/ResponsiveButton.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ResponsiveButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  onClick,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium uppercase tracking-wide rounded-full transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-dark text-creme-light hover:bg-canyon',
    secondary: 'bg-creme-light text-dark hover:bg-coyote',
    outline: 'bg-transparent border-2 border-dark text-dark hover:bg-dark hover:text-creme-light'
  };
  
  const sizeClasses = {
    sm: 'px-4 py-2 sm:px-5 sm:py-2.5 min-h-[40px] sm:min-h-[44px] text-xs sm:text-sm',
    md: 'px-5 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 min-h-[44px] sm:min-h-[48px] text-sm sm:text-base',
    lg: 'px-6 py-3 sm:px-8 sm:py-4 md:px-10 md:py-5 min-h-[48px] sm:min-h-[52px] text-base sm:text-lg'
  };
  
  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : 'w-full sm:w-auto'}
      `}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />}
      {children}
    </button>
  );
};
```

---

## Tailwind Configuration (Production Ready)

### tailwind.config.js
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        creme: {
          DEFAULT: '#e8e0d2',
          light: '#fff7e9',
        },
        coyote: '#c3af9f',
        canyon: '#8c4630',
        dark: '#433c35',
        sunflower: '#dea138',
      },
      fontFamily: {
        sans: ['DM-Sans', 'system-ui', 'sans-serif'],
        serif: ['PP-Editorial-New', 'Georgia', 'serif'],
      },
      screens: {
        'xs': '475px',
        '3xl': '1920px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      minHeight: {
        'touch': '44px',
        'touch-comfortable': '48px',
      },
      minWidth: {
        'touch': '44px',
        'touch-comfortable': '48px',
      },
    },
  },
  plugins: [],
}
```

---

## Professional Code Standards

### 1. Component Structure
```tsx
// ✅ GOOD - Clean, organized structure
import React from 'react';
import { ComponentProps } from './types';

export const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks
  const [state, setState] = useState();
  
  // Event handlers
  const handleClick = () => {};
  
  // Render
  return <div>...</div>;
};
```

### 2. Responsive Class Organization
```tsx
// ✅ GOOD - Organized by property type
<div className="
  // Layout
  flex items-center justify-between
  // Spacing
  px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5
  // Sizing
  w-full h-auto
  // Typography
  text-base sm:text-lg md:text-xl
  // Colors
  bg-creme text-dark
  // Borders
  border border-coyote rounded-lg
  // Effects
  hover:shadow-lg transition-all duration-300
">
```

### 3. Accessibility Standards
```tsx
// ✅ GOOD - Accessible and semantic
<button
  type="button"
  aria-label="Add to cart"
  className="min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-canyon"
>
  <ShoppingCart className="w-5 h-5" aria-hidden="true" />
</button>
```

### 4. Performance Optimization
```tsx
// ✅ GOOD - Lazy loading and code splitting
import { lazy, Suspense } from 'react';

const ProductPage = lazy(() => import('./pages/ProductPage'));

<Suspense fallback={<LoadingSpinner />}>
  <ProductPage />
</Suspense>
```

---

## Testing Checklist

- [ ] All touch targets minimum 44x44px
- [ ] Text readable at all breakpoints
- [ ] No horizontal scroll on any device
- [ ] Images load properly on slow connections
- [ ] Forms work on mobile keyboards
- [ ] Hover states don't interfere with touch
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Works in portrait and landscape
- [ ] Tested on real devices

---

**Status:** Ready for Implementation  
**Last Updated:** October 14, 2025
