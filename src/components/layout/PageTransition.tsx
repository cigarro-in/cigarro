import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20
  },
  in: {
    opacity: 1,
    y: 0
  },
  out: {
    opacity: 0,
    y: -20
  }
};

const pageTransition = {
  type: "tween",
  ease: [0.25, 0.46, 0.45, 0.94],
  duration: 0.4
};

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        className="w-full overflow-x-hidden"
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
