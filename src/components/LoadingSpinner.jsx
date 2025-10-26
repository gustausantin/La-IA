// components/LoadingSpinner.jsx - Spinner optimizado para La-IA

import React from 'react';
import { RefreshCw, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const LoadingSpinner = ({ 
  variant = 'default', 
  size = 'md', 
  text = '', 
  className = '',
  showSuccess = false,
  showError = false,
  progress = null // 0-100
}) => {
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6', 
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-base'
  };

  const variants = {
    default: {
      icon: RefreshCw,
      iconClass: 'text-purple-600',
      bgClass: 'bg-purple-100',
      textClass: 'text-purple-700'
    },
    primary: {
      icon: Loader2,
      iconClass: 'text-blue-600',
      bgClass: 'bg-blue-100',
      textClass: 'text-blue-700'
    },
    success: {
      icon: CheckCircle2,
      iconClass: 'text-green-600',
      bgClass: 'bg-green-100',
      textClass: 'text-green-700'
    },
    warning: {
      icon: Clock,
      iconClass: 'text-yellow-600',
      bgClass: 'bg-yellow-100',
      textClass: 'text-yellow-700'
    },
    error: {
      icon: AlertCircle,
      iconClass: 'text-red-600',
      bgClass: 'bg-red-100',
      textClass: 'text-red-700'
    }
  };

  const currentVariant = variants[variant];
  const IconComponent = currentVariant.icon;

  // Si hay progreso, mostrar barra de progreso
  if (progress !== null) {
    return (
      <div className={clsx('flex flex-col items-center gap-3', className)}>
        <div className="relative">
          <div className={clsx(
            'rounded-full border-4 border-gray-200',
            sizeClasses[size]
          )}>
            <div 
              className={clsx(
                'rounded-full border-4 border-transparent border-t-current transition-all duration-300',
                currentVariant.iconClass,
                sizeClasses[size]
              )}
              style={{
                transform: `rotate(${progress * 3.6}deg)`
              }}
            />
          </div>
          <div className={clsx(
            'absolute inset-0 flex items-center justify-center text-xs font-bold',
            currentVariant.textClass
          )}>
            {Math.round(progress)}%
          </div>
        </div>
        {text && (
          <p className={clsx('text-center font-medium', textSizes[size], currentVariant.textClass)}>
            {text}
          </p>
        )}
      </div>
    );
  }

  // Spinner normal
  return (
    <div className={clsx('flex flex-col items-center gap-3', className)}>
      <div className={clsx(
        'rounded-full p-2',
        currentVariant.bgClass
      )}>
        <IconComponent 
          className={clsx(
            'animate-spin',
            sizeClasses[size],
            currentVariant.iconClass
          )}
        />
      </div>
      
      {text && (
        <p className={clsx(
          'text-center font-medium',
          textSizes[size],
          currentVariant.textClass
        )}>
          {text}
        </p>
      )}

      {/* Estados de éxito/error */}
      {showSuccess && (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">¡Completado!</span>
        </div>
      )}

      {showError && (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Error</span>
        </div>
      )}
    </div>
  );
};

// Variantes predefinidas para casos comunes
export const DashboardSpinner = ({ text = 'Cargando dashboard...' }) => (
  <LoadingSpinner 
    variant="default" 
    size="lg" 
    text={text}
    className="min-h-[400px] justify-center"
  />
);

export const PageSpinner = ({ text = 'Cargando página...' }) => (
  <LoadingSpinner 
    variant="primary" 
    size="md" 
    text={text}
    className="min-h-[200px] justify-center"
  />
);

export const ButtonSpinner = ({ size = 'sm', className = '' }) => (
  <LoadingSpinner 
    variant="default" 
    size={size}
    className={className}
  />
);

export const InlineSpinner = ({ size = 'xs', className = '' }) => (
  <LoadingSpinner 
    variant="default" 
    size={size}
    className={className}
  />
);

export default LoadingSpinner;
