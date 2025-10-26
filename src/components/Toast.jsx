// components/Toast.jsx - Sistema de notificaciones personalizado para La-IA

import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Bot
} from 'lucide-react';
import { clsx } from 'clsx';

const TOAST_TYPES = {
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600'
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-600'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600'
  },
  default: {
    icon: Bot,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    iconColor: 'text-purple-600'
  }
};

const Toast = ({ 
  id, 
  type = 'default', 
  title, 
  message, 
  duration = 5000, 
  onClose, 
  showProgress = true 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);
  
  const toastConfig = TOAST_TYPES[type] || TOAST_TYPES.default;
  const IconComponent = toastConfig.icon;

  useEffect(() => {
    if (duration === Infinity) return;

    const startTime = Date.now();
    const endTime = startTime + duration;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const newProgress = (remaining / duration) * 100;
      
      setProgress(newProgress);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    requestAnimationFrame(updateProgress);

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose?.(id);
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div className={clsx(
      'relative overflow-hidden rounded-lg border shadow-lg transition-all duration-300 ease-in-out',
      'transform translate-x-0 opacity-100',
      toastConfig.bgColor,
      toastConfig.borderColor
    )}>
      {/* Barra de progreso */}
      {showProgress && duration !== Infinity && (
        <div className="absolute top-0 left-0 h-1 bg-gray-200 w-full">
          <div 
            className={clsx('h-full transition-all duration-100', toastConfig.iconColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-start gap-3 p-2">
        {/* Icono */}
        <div className="flex-shrink-0">
          <IconComponent className={clsx('w-5 h-5', toastConfig.iconColor)} />
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={clsx('font-semibold text-sm mb-1', toastConfig.textColor)}>
              {title}
            </h4>
          )}
          {message && (
            <p className={clsx('text-sm', toastConfig.textColor)}>
              {message}
            </p>
          )}
        </div>

        {/* Botón de cerrar */}
        <button
          onClick={handleClose}
          className={clsx(
            'flex-shrink-0 p-1 rounded-full hover:bg-white/50 transition-colors',
            toastConfig.textColor
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
export { TOAST_TYPES };
