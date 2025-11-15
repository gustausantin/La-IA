// breakpoints.js - Configuración unificada de breakpoints mobile-first
// Usar estos breakpoints en toda la aplicación para consistencia

import React from 'react';

/**
 * Breakpoints estándar mobile-first
 * Basados en Tailwind CSS pero unificados para toda la app
 */
export const BREAKPOINTS = {
  // Mobile: < 640px
  mobile: {
    min: 0,
    max: 639,
    name: 'mobile'
  },
  // Tablet: 640px - 1023px
  tablet: {
    min: 640,
    max: 1023,
    name: 'tablet'
  },
  // Desktop: >= 1024px
  desktop: {
    min: 1024,
    max: Infinity,
    name: 'desktop'
  }
};

/**
 * Tailwind breakpoint values (para referencia)
 */
export const TAILWIND_BREAKPOINTS = {
  sm: '640px',   // Mobile landscape / Small tablet
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape / Small desktop
  xl: '1280px',  // Desktop
  '2xl': '1536px' // Large desktop
};

/**
 * Hook para detectar tipo de dispositivo de forma consistente
 * @returns {Object} { isMobile, isTablet, isDesktop, width, breakpoint }
 */
export const useResponsive = () => {
  const [dimensions, setDimensions] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  });

  React.useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const { width } = dimensions;
  
  const isMobile = width < BREAKPOINTS.tablet.min;
  const isTablet = width >= BREAKPOINTS.tablet.min && width < BREAKPOINTS.desktop.min;
  const isDesktop = width >= BREAKPOINTS.desktop.min;
  
  let breakpoint = 'mobile';
  if (isDesktop) breakpoint = 'desktop';
  else if (isTablet) breakpoint = 'tablet';

  return {
    isMobile,
    isTablet,
    isDesktop,
    width,
    height: dimensions.height,
    breakpoint,
    // Helpers para clases Tailwind
    isSm: width >= 640,
    isMd: width >= 768,
    isLg: width >= 1024,
    isXl: width >= 1280,
    is2Xl: width >= 1536
  };
};

export default BREAKPOINTS;

