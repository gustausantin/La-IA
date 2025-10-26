// hooks/usePerformance.js - Hook para monitoreo de performance en La-IA

import { useEffect, useRef, useCallback, useState } from 'react';
import logger from '../utils/logger';

export const usePerformance = (componentName, options = {}) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  const startTime = useRef(performance.now());
  const { 
    logRenders = false, 
    logSlowRenders = true, 
    slowRenderThreshold = 16, // 16ms = 60fps
    trackMemory = false 
  } = options;

  // Contador de renders
  useEffect(() => {
    renderCount.current += 1;
    const currentTime = performance.now();
    const renderTime = currentTime - lastRenderTime.current;
    
    if (logRenders) {
      logger.debug(`${componentName} render #${renderCount.current}`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        totalTime: `${(currentTime - startTime.current).toFixed(2)}ms`
      });
    }

    // Alertar renders lentos
    if (logSlowRenders && renderTime > slowRenderThreshold) {
      logger.warn(`${componentName} render lento detectado`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        threshold: `${slowRenderThreshold}ms`,
        renderCount: renderCount.current
      });
    }

    lastRenderTime.current = currentTime;
  });

  // Monitoreo de memoria (solo en desarrollo)
  useEffect(() => {
    if (trackMemory && process.env.NODE_ENV === 'development') {
      if ('memory' in performance) {
        const memory = performance.memory;
        logger.debug(`${componentName} uso de memoria`, {
          usedJSHeapSize: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          totalJSHeapSize: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          jsHeapSizeLimit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
        });
      }
    }
  });

  // Métricas de performance
  const getMetrics = useCallback(() => ({
    renderCount: renderCount.current,
    totalTime: performance.now() - startTime.current,
    averageRenderTime: renderCount.current > 0 
      ? (performance.now() - startTime.current) / renderCount.current 
      : 0
  }), []);

  // Reset de métricas
  const resetMetrics = useCallback(() => {
    renderCount.current = 0;
    startTime.current = performance.now();
    lastRenderTime.current = performance.now();
    logger.debug(`${componentName} métricas reseteadas`);
  }, [componentName]);

  // Log de métricas finales
  useEffect(() => {
    return () => {
      const metrics = getMetrics();
      logger.info(`${componentName} unmounting`, {
        totalRenders: metrics.renderCount,
        totalTime: `${metrics.totalTime.toFixed(2)}ms`,
        avgRenderTime: `${metrics.averageRenderTime.toFixed(2)}ms`
      });
    };
  }, [componentName, getMetrics]);

  return {
    renderCount: renderCount.current,
    getMetrics,
    resetMetrics
  };
};

// Hook para debounce de funciones
export const useDebounce = (func, delay) => {
  const timeoutRef = useRef();

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      func(...args);
    }, delay);
  }, [func, delay]);
};

// Hook para throttle de funciones
export const useThrottle = (func, limit) => {
  const inThrottle = useRef(false);
  
  return useCallback((...args) => {
    if (!inThrottle.current) {
      func(...args);
      inThrottle.current = true;
      setTimeout(() => inThrottle.current = false, limit);
    }
  }, [func, limit]);
};

// Hook para lazy loading de imágenes
export const useLazyImage = (src, placeholder = null) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setLoading(false);
      setError(false);
    };
    
    img.onerror = () => {
      setError(true);
      setLoading(false);
      logger.warn('Error cargando imagen', { src });
    };
    
    img.src = src;
  }, [src]);

  return { imageSrc, loading, error };
};

// Hook para intersection observer (lazy loading)
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [ref, setRef] = useState(null);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(ref);

    return () => {
      if (ref) {
        observer.unobserve(ref);
      }
    };
  }, [ref, options]);

  return [setRef, isIntersecting];
};
