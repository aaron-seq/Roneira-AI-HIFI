/**
 * useReducedMotion Hook
 * 
 * Detects and respects user's prefers-reduced-motion preference.
 * 
 * @author Roneira AI
 * @version 2026
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect if user prefers reduced motion
 * @returns boolean - true if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // Legacy browsers
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation variants based on reduced motion preference
 */
export function getMotionVariants(prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.01 },
    };
  }

  return {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.98 },
    transition: {
      type: 'spring',
      stiffness: 180,
      damping: 12,
    },
  };
}

/**
 * Hook to get appropriate animation config based on motion preference
 */
export function useAnimationConfig() {
  const prefersReducedMotion = useReducedMotion();

  return {
    prefersReducedMotion,
    // Spring config for subtle animations
    springConfig: prefersReducedMotion
      ? { duration: 0.01 }
      : { type: 'spring', stiffness: 180, damping: 12 },
    // Fade config for simple transitions
    fadeConfig: prefersReducedMotion
      ? { duration: 0.01 }
      : { duration: 0.3 },
    // Entrance animation variants
    entranceVariants: getMotionVariants(prefersReducedMotion),
  };
}

export default useReducedMotion;
