import React, { Suspense, lazy, memo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 🚀 LAZY COMPONENT LOADER ULTRA AVANZADO
 * Sistema de carga inteligente con prioridades y preload
 */

// Skeleton personalizado para diferentes tipos de componentes
const ComponentSkeleton = ({ type = 'default', height = 200, className = '' }) => {
  const skeletonVariants = {
    default: (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className={`bg-gray-200 rounded`} style={{ height: height - 60 }}></div>
        </div>
      </div>
    ),
    chart: (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-5 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="relative">
            <div className="h-64 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg flex items-end justify-between p-2">
              {[...Array(7)].map((_, i) => (
                <div 
                  key={i}
                  className="bg-gray-300 rounded-t"
                  style={{ 
                    height: `${Math.random() * 150 + 50}px`,
                    width: '20px'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    stats: (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-8 w-8 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    ),
    table: (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
        <div className="p-6 border-b border-gray-100">
          <div className="animate-pulse h-6 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-2 animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  };

  return skeletonVariants[type] || skeletonVariants.default;
};

// Hook para detectar visibilidad y preload inteligente
const useIntersectionObserver = (ref, options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting && !hasBeenVisible) {
        setHasBeenVisible(true);
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [ref, hasBeenVisible]);

  return { isIntersecting, hasBeenVisible };
};

// Componente principal de lazy loading
const LazyComponentLoader = memo(({
  children,
  fallback,
  type = 'default',
  height = 200,
  className = '',
  priority = 'normal', // 'high', 'normal', 'low'
  preload = false,
  errorBoundary = true,
  animateIn = true,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef();
  const { isIntersecting, hasBeenVisible } = useIntersectionObserver(containerRef, {
    rootMargin: priority === 'high' ? '200px' : priority === 'low' ? '0px' : '100px'
  });

  const shouldLoad = preload || hasBeenVisible;

  useEffect(() => {
    if (shouldLoad && !isLoaded) {
      const timer = setTimeout(() => {
        setIsLoaded(true);
        onLoad?.();
      }, priority === 'high' ? 0 : priority === 'low' ? 500 : 200);

      return () => clearTimeout(timer);
    }
  }, [shouldLoad, isLoaded, priority, onLoad]);

  const handleError = useCallback((error) => {
    console.error('LazyComponentLoader error:', error);
    setHasError(true);
    onError?.(error);
  }, [onError]);

  const ErrorFallback = () => (
    <div className={`bg-red-50 border border-red-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-center space-x-3">
        <div className="h-6 w-6 text-red-500">⚠️</div>
        <div>
          <h3 className="text-red-800 font-medium">Error cargando componente</h3>
          <p className="text-red-600 text-sm">Intenta refrescar la página</p>
        </div>
      </div>
    </div>
  );

  const LoadingFallback = fallback || (
    <ComponentSkeleton 
      type={type} 
      height={height} 
      className={className}
    />
  );

  if (hasError && errorBoundary) {
    return <ErrorFallback />;
  }

  const content = shouldLoad && isLoaded ? (
    <Suspense fallback={LoadingFallback}>
      {errorBoundary ? (
        <ErrorBoundary onError={handleError}>
          {children}
        </ErrorBoundary>
      ) : (
        children
      )}
    </Suspense>
  ) : (
    LoadingFallback
  );

  if (!animateIn) {
    return (
      <div ref={containerRef}>
        {content}
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <AnimatePresence mode="wait">
        {shouldLoad && isLoaded ? (
          <motion.div
            key="loaded"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ 
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            {content}
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {LoadingFallback}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Error Boundary simple
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800">Algo salió mal cargando este componente.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC para hacer cualquier componente lazy
export const withLazyLoading = (Component, options = {}) => {
  return memo((props) => (
    <LazyComponentLoader {...options}>
      <Component {...props} />
    </LazyComponentLoader>
  ));
};

// Hook para preload manual
export const usePreloadComponent = (importFn, condition = true) => {
  useEffect(() => {
    if (condition) {
      const timer = setTimeout(() => {
        importFn();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [importFn, condition]);
};

export default LazyComponentLoader;
