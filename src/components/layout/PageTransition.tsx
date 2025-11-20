import React from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { SmoothScrollToTop } from './SmoothScrollToTop';

interface PageTransitionProps {
  children: React.ReactNode;
}

// Optimized variants for cross-dissolve feel
const pageVariants = {
  initial: {
    opacity: 0,
    // Remove Y translation to prevent scrolling issues
    // y: 20
  },
  in: {
    opacity: 1,
    // y: 0,
    transition: {
      duration: 0.4, // Slightly longer for smoothness
      ease: [0.25, 1, 0.5, 1] // "Quint" ease out - starts fast, slows down gently
    }
  },
  out: {
    opacity: 0,
    // y: -20,
    transition: {
      duration: 0.2, // Fast exit to clear the way
      ease: [0.25, 1, 0.5, 1]
    }
  }
};

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <>
      <SmoothScrollToTop />
      <LayoutGroup>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            className="w-full"
            style={{ 
              // Ensure the layout doesn't break during "popLayout" absolute positioning
              width: '100%',
              position: 'relative'
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>
    </>
  );
}

// Loading overlay for smooth transitions
export function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-creme z-50 flex items-center justify-center"
    >
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-canyon/20 border-t-canyon rounded-full animate-spin mb-4"></div>
        <p className="text-dark font-medium">Loading...</p>
      </div>
    </motion.div>
  );
}
