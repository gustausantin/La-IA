import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Context para configuración de accesibilidad
const AccessibilityContext = createContext({});

// Hook para usar el contexto de accesibilidad
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility debe usarse dentro de AccessibilityProvider');
  }
  return context;
};

// Provider de accesibilidad
export const AccessibilityProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    reducedMotion: false,
    highContrast: false,
    largeText: false,
    screenReaderOnly: false,
    keyboardNavigation: true,
    announcements: true,
  });

  const [announcements, setAnnouncements] = useState([]);

  // Detectar preferencias del sistema
  useEffect(() => {
    const mediaQueries = {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      highContrast: window.matchMedia('(prefers-contrast: high)'),
    };

    const updateSettings = () => {
      setSettings(prev => ({
        ...prev,
        reducedMotion: mediaQueries.reducedMotion.matches,
        highContrast: mediaQueries.highContrast.matches,
      }));
    };

    // Actualizar al cargar
    updateSettings();

    // Escuchar cambios
    Object.values(mediaQueries).forEach(mq => {
      mq.addEventListener('change', updateSettings);
    });

    return () => {
      Object.values(mediaQueries).forEach(mq => {
        mq.removeEventListener('change', updateSettings);
      });
    };
  }, []);

  // Aplicar configuraciones al DOM
  useEffect(() => {
    const root = document.documentElement;
    
    // Aplicar clases CSS basadas en configuraciones
    root.classList.toggle('reduce-motion', settings.reducedMotion);
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('large-text', settings.largeText);
    
    // Configurar atributos ARIA
    if (settings.screenReaderOnly) {
      root.setAttribute('aria-hidden', 'false');
    }
  }, [settings]);

  // Función para anunciar mensajes a lectores de pantalla
  const announce = (message, priority = 'polite') => {
    if (!settings.announcements) return;
    
    const id = Date.now().toString();
    const announcement = { id, message, priority };
    
    setAnnouncements(prev => [...prev, announcement]);
    
    // Remover el anuncio después de un tiempo
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 1000);
  };

  // Función para configurar ajustes
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const contextValue = {
    settings,
    updateSetting,
    announce,
    announcements,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
      
      {/* Región de anuncios para lectores de pantalla */}
      <div className="sr-only">
        {announcements.map(announcement => (
          <div
            key={announcement.id}
            aria-live={announcement.priority}
            aria-atomic="true"
          >
            {announcement.message}
          </div>
        ))}
      </div>
    </AccessibilityContext.Provider>
  );
};

// Componente Skip Link
export const SkipLink = ({ href = "#main-content", children = "Saltar al contenido principal" }) => (
  <a
    href={href}
    className="
      sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 
      bg-purple-600 text-white px-4 py-2 z-50 rounded-br-lg
      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
    "
  >
    {children}
  </a>
);

// Componente para navegación por teclado
export const KeyboardNavigation = ({ children, onActivate, ...props }) => {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate?.(event);
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="button"
      aria-pressed="false"
      className="focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded"
      {...props}
    >
      {children}
    </div>
  );
};

// Componente de región con landmark
export const LandmarkRegion = ({ 
  as: Component = 'div', 
  role, 
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  children,
  className = '',
  ...props 
}) => (
  <Component
    role={role}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledBy}
    className={className}
    {...props}
  >
    {children}
  </Component>
);

// Componente de botón accesible
export const AccessibleButton = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onClick,
  className = '',
  ...props
}) => {
  const { announce } = useAccessibility();

  const handleClick = (event) => {
    if (disabled || loading) return;
    
    onClick?.(event);
    
    // Anunciar acción para lectores de pantalla
    if (ariaLabel) {
      announce(`${ariaLabel} activado`);
    }
  };

  return (
    <motion.button
      className={`
        relative inline-flex items-center justify-center
        font-medium border rounded-lg transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variant === 'primary' ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 focus:ring-purple-500' : ''}
        ${variant === 'secondary' ? 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200 focus:ring-gray-500' : ''}
        ${size === 'sm' ? 'px-3 py-1.5 text-sm' : ''}
        ${size === 'md' ? 'px-4 py-2 text-sm' : ''}
        ${size === 'lg' ? 'px-6 py-3 text-base' : ''}
        ${className}
      `}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled || loading}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </span>
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </motion.button>
  );
};

// Componente de modal accesible
export const AccessibleModal = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  ...props
}) => {
  const { announce } = useAccessibility();

  // Gestión del foco
  useEffect(() => {
    if (isOpen) {
      // Mover foco al modal
      const modal = document.querySelector('[role="dialog"]');
      modal?.focus();
      
      // Anunciar apertura
      announce(`Modal ${title} abierto`);
      
      // Prevenir scroll del body
      document.body.style.overflow = 'hidden';
    } else {
      // Restaurar scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, title, announce]);

  // Manejar tecla Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
          aria-hidden="true"
        />
        
        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-2">
          <motion.div
            className={`
              relative bg-white rounded-lg shadow-xl max-w-md w-full
              focus:outline-none focus:ring-2 focus:ring-purple-500
              ${className}
            `}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            {...props}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            </div>
            
            {/* Content */}
            <div className="px-6 py-4">
              {children}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Componente de formulario accesible
export const AccessibleForm = ({ 
  children, 
  onSubmit, 
  className = '',
  'aria-label': ariaLabel,
  ...props 
}) => {
  const { announce } = useAccessibility();

  const handleSubmit = (event) => {
    event.preventDefault();
    
    // Validar formulario
    const form = event.target;
    const isValid = form.checkValidity();
    
    if (!isValid) {
      announce('Formulario contiene errores. Por favor, revise los campos marcados.');
      return;
    }
    
    onSubmit?.(event);
    announce('Formulario enviado correctamente.');
  };

  return (
    <form
      className={className}
      onSubmit={handleSubmit}
      aria-label={ariaLabel}
      noValidate
      {...props}
    >
      {children}
    </form>
  );
};

// Panel de configuración de accesibilidad
export const AccessibilityPanel = ({ isOpen, onClose }) => {
  const { settings, updateSetting } = useAccessibility();

  const toggleSetting = (key) => {
    updateSetting(key, !settings[key]);
  };

  return (
    <AccessibleModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Configuración de Accesibilidad"
      className="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Personaliza la experiencia de la aplicación según tus necesidades.
        </p>
        
        <div className="space-y-3">
          {[
            { key: 'reducedMotion', label: 'Reducir animaciones', description: 'Minimiza las animaciones y transiciones' },
            { key: 'highContrast', label: 'Alto contraste', description: 'Aumenta el contraste para mejor visibilidad' },
            { key: 'largeText', label: 'Texto grande', description: 'Aumenta el tamaño del texto' },
            { key: 'announcements', label: 'Anuncios de pantalla', description: 'Activa anuncios para lectores de pantalla' },
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-start justify-between">
              <div className="flex-1">
                <label htmlFor={key} className="text-sm font-medium text-gray-900">
                  {label}
                </label>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <button
                id={key}
                type="button"
                className={`
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                  ${settings[key] ? 'bg-purple-600' : 'bg-gray-200'}
                `}
                onClick={() => toggleSetting(key)}
                aria-checked={settings[key]}
                role="switch"
                aria-labelledby={key}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${settings[key] ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <AccessibleButton onClick={onClose}>
            Cerrar
          </AccessibleButton>
        </div>
      </div>
    </AccessibleModal>
  );
};
