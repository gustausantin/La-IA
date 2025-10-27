// Design Tokens - Mobile-First para La-IA
// Sistema de diseño escalable y profesional

export const DESIGN_TOKENS = {
  // ========================================
  // COLORES - Basados en sistema actual pero optimizados
  // ========================================
  colors: {
    // Primary (Purple/Blue gradient - La-IA brand)
    primary: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',  // Main
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
    
    // Accent (Blue)
    accent: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',  // Main
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    
    // Success (Green)
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',  // Main
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    
    // Warning (Amber)
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',  // Main
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    
    // Error (Red)
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',  // Main
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    
    // Gray (Neutral)
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },
  
  // ========================================
  // TOUCH TARGETS - Áreas táctiles mínimas
  // ========================================
  touch: {
    // iOS Guidelines: 44x44pt minimum
    // Android: 48x48dp minimum
    minimum: '44px',      // Mínimo absoluto
    comfortable: '48px',  // Recomendado
    large: '56px',        // Para acciones principales
    extraLarge: '64px',   // Para FAB y principales
  },
  
  // ========================================
  // SPACING - Responsive por dispositivo
  // ========================================
  spacing: {
    mobile: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '40px',
    },
    tablet: {
      xs: '6px',
      sm: '12px',
      md: '20px',
      lg: '32px',
      xl: '48px',
      '2xl': '64px',
    },
    desktop: {
      xs: '8px',
      sm: '16px',
      md: '24px',
      lg: '40px',
      xl: '64px',
      '2xl': '96px',
    },
  },
  
  // ========================================
  // TYPOGRAPHY - Responsive y legible
  // ========================================
  fontSize: {
    mobile: {
      xs: '12px',    // Captions
      sm: '14px',    // Body small
      base: '16px',  // Body (default)
      lg: '18px',    // Subheadings
      xl: '20px',    // H3
      '2xl': '24px', // H2
      '3xl': '30px', // H1
    },
    tablet: {
      xs: '14px',
      sm: '16px',
      base: '18px',
      lg: '20px',
      xl: '24px',
      '2xl': '30px',
      '3xl': '36px',
    },
    desktop: {
      xs: '14px',
      sm: '16px',
      base: '18px',
      lg: '24px',
      xl: '30px',
      '2xl': '36px',
      '3xl': '48px',
    },
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // ========================================
  // BORDER RADIUS - Suave y moderno
  // ========================================
  borderRadius: {
    none: '0',
    sm: '4px',
    base: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px',
  },
  
  // ========================================
  // SHADOWS - Elevación material design
  // ========================================
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  
  // ========================================
  // Z-INDEX - Capas organizadas
  // ========================================
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    modalBackdrop: 40,
    modal: 50,
    popover: 60,
    tooltip: 70,
    toast: 80,
  },
  
  // ========================================
  // ANIMATIONS - Smooth y performantes
  // ========================================
  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slowest: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // ========================================
  // BREAKPOINTS - Mobile-first
  // ========================================
  breakpoints: {
    sm: '640px',   // Mobile landscape
    md: '768px',   // Tablet portrait
    lg: '1024px',  // Tablet landscape / Small desktop
    xl: '1280px',  // Desktop
    '2xl': '1536px', // Large desktop
  },
  
  // ========================================
  // GESTURES - Touch interaction
  // ========================================
  gestures: {
    swipeThreshold: 50,           // px para detectar swipe
    longPressDelay: 500,          // ms para long press
    doubleTapDelay: 300,          // ms entre taps
    pullToRefreshThreshold: 100,  // px para activar refresh
  },
};

// ========================================
// UTILITY: Get responsive value
// ========================================
export const getResponsiveValue = (values, device = 'mobile') => {
  return values[device] || values.mobile;
};

// ========================================
// UTILITY: Get color
// ========================================
export const getColor = (color, shade = 500) => {
  const [colorName, colorShade] = color.includes('-') 
    ? color.split('-') 
    : [color, shade];
  
  return DESIGN_TOKENS.colors[colorName]?.[colorShade] || color;
};

// ========================================
// UTILITY: Media queries
// ========================================
export const media = {
  sm: `@media (min-width: ${DESIGN_TOKENS.breakpoints.sm})`,
  md: `@media (min-width: ${DESIGN_TOKENS.breakpoints.md})`,
  lg: `@media (min-width: ${DESIGN_TOKENS.breakpoints.lg})`,
  xl: `@media (min-width: ${DESIGN_TOKENS.breakpoints.xl})`,
  '2xl': `@media (min-width: ${DESIGN_TOKENS.breakpoints['2xl']})`,
};

export default DESIGN_TOKENS;

