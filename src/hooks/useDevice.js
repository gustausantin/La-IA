// useDevice.js - Hook para detectar tipo de dispositivo y características
import { useState, useEffect } from 'react';

export const DEVICE_TYPES = {
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
};

export const useDevice = () => {
  const [device, setDevice] = useState({
    type: DEVICE_TYPES.MOBILE,
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    orientation: 'portrait',
    isTouch: false,
    isSafari: false,
    isIOS: false,
    isAndroid: false,
  });

  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detect device type
      let type = DEVICE_TYPES.DESKTOP;
      if (width < 640) {
        type = DEVICE_TYPES.MOBILE;
      } else if (width < 1024) {
        type = DEVICE_TYPES.TABLET;
      }
      
      // Detect orientation
      const orientation = width > height ? 'landscape' : 'portrait';
      
      // Detect touch capability
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Detect browser/OS
      const ua = navigator.userAgent;
      const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isAndroid = /android/i.test(ua);
      
      setDevice({
        type,
        isMobile: type === DEVICE_TYPES.MOBILE,
        isTablet: type === DEVICE_TYPES.TABLET,
        isDesktop: type === DEVICE_TYPES.DESKTOP,
        width,
        height,
        orientation,
        isTouch,
        isSafari,
        isIOS,
        isAndroid,
      });
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    window.addEventListener('orientationchange', detectDevice);

    return () => {
      window.removeEventListener('resize', detectDevice);
      window.removeEventListener('orientationchange', detectDevice);
    };
  }, []);

  return device;
};

// Hook para características específicas del dispositivo
export const useDeviceFeatures = () => {
  const device = useDevice();
  
  return {
    ...device,
    // Safe area insets (para notch de iPhone)
    safeAreaTop: device.isIOS ? 'env(safe-area-inset-top)' : '0px',
    safeAreaBottom: device.isIOS ? 'env(safe-area-inset-bottom)' : '0px',
    
    // Viewport height (iOS fix)
    viewportHeight: device.isIOS ? '100dvh' : '100vh',
    
    // Recommended touch target
    touchTarget: device.isMobile ? '48px' : '44px',
    
    // Should use bottom navigation
    useBottomNav: device.isMobile,
    
    // Should use side drawer
    useSideDrawer: device.isTablet || device.isDesktop,
    
    // Should show condensed UI
    condensedUI: device.isMobile,
    
    // Grid columns
    gridColumns: device.isMobile ? 1 : device.isTablet ? 2 : 3,
  };
};

export default useDevice;

