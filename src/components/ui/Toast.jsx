import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Info, 
  X,
  Loader2 
} from 'lucide-react';

const Toast = ({ 
  id,
  type = 'info', 
  title, 
  message, 
  duration = 4000,
  onClose,
  action,
  loading = false,
  icon: CustomIcon
}) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(id), 300);
  };

  const variants = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      messageColor: 'text-green-700',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      messageColor: 'text-red-700',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
      messageColor: 'text-yellow-700',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      messageColor: 'text-blue-700',
    },
    loading: {
      icon: Loader2,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      iconColor: 'text-purple-600',
      titleColor: 'text-purple-900',
      messageColor: 'text-purple-700',
    },
  };

  const config = variants[loading ? 'loading' : type];
  const IconComponent = CustomIcon || config.icon;

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`
        relative max-w-sm w-full
        ${config.bgColor} ${config.borderColor}
        border rounded-lg shadow-lg
        p-2 pointer-events-auto
        ring-1 ring-black ring-opacity-5
      `}
    >
      {/* Progress bar para duración */}
      {duration && duration > 0 && (
        <motion.div
          className={`absolute top-0 left-0 h-1 ${config.iconColor.replace('text-', 'bg-')} rounded-t-lg`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
        />
      )}

      <div className="flex">
        <div className="flex-shrink-0">
          <IconComponent 
            className={`w-5 h-5 ${config.iconColor} ${loading ? 'animate-spin' : ''}`} 
          />
        </div>
        
        <div className="ml-3 w-0 flex-1">
          {title && (
            <p className={`text-sm font-medium ${config.titleColor}`}>
              {title}
            </p>
          )}
          {message && (
            <p className={`text-sm ${config.messageColor} ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
          )}
          
          {action && (
            <div className="mt-3">
              <button
                onClick={action.onClick}
                className={`
                  text-sm font-medium ${config.iconColor} 
                  hover:${config.iconColor.replace('600', '500')}
                  focus:outline-none focus:underline
                `}
              >
                {action.label}
              </button>
            </div>
          )}
        </div>
        
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={handleClose}
            className={`
              rounded-md inline-flex ${config.iconColor}
              hover:${config.iconColor.replace('600', '500')}
              focus:outline-none focus:ring-2 focus:ring-offset-2
              focus:ring-${config.iconColor.split('-')[1]}-500
            `}
          >
            <span className="sr-only">Cerrar</span>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Container para múltiples toasts
const ToastContainer = ({ toasts = [], onRemoveToast }) => {
  return (
    <div className="fixed top-0 right-0 z-50 w-full sm:w-96 p-2 space-y-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={onRemoveToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook para gestionar toasts
const useToast = () => {
  const [toasts, setToasts] = React.useState([]);

  const addToast = React.useCallback((toast) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = React.useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const toast = React.useMemo(() => ({
    success: (title, message, options = {}) => 
      addToast({ type: 'success', title, message, ...options }),
    
    error: (title, message, options = {}) => 
      addToast({ type: 'error', title, message, ...options }),
    
    warning: (title, message, options = {}) => 
      addToast({ type: 'warning', title, message, ...options }),
    
    info: (title, message, options = {}) => 
      addToast({ type: 'info', title, message, ...options }),
    
    loading: (title, message, options = {}) => 
      addToast({ type: 'loading', title, message, duration: 0, ...options }),
    
    custom: (options) => addToast(options),
    
    dismiss: removeToast,
    
    promise: async (promise, { loading, success, error }) => {
      const id = addToast({ 
        type: 'loading', 
        title: loading.title || 'Cargando...', 
        message: loading.message,
        duration: 0 
      });
      
      try {
        const result = await promise;
        removeToast(id);
        addToast({ 
          type: 'success', 
          title: success.title || 'Completado', 
          message: success.message 
        });
        return result;
      } catch (err) {
        removeToast(id);
        addToast({ 
          type: 'error', 
          title: error.title || 'Error', 
          message: error.message || err.message 
        });
        throw err;
      }
    }
  }), [addToast, removeToast]);

  return { toast, toasts, removeToast };
};

export default Toast;
export { ToastContainer, useToast };
