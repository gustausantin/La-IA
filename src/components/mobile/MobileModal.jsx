// MobileModal.jsx - Wrapper de modal optimizado para móvil
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useResponsive } from '../../config/breakpoints';

/**
 * MobileModal - Modal que se adapta perfectamente a móvil y desktop
 * 
 * @param {Boolean} isOpen - Si el modal está abierto
 * @param {Function} onClose - Función para cerrar el modal
 * @param {ReactNode} children - Contenido del modal
 * @param {String} title - Título del modal (opcional)
 * @param {String} size - Tamaño: 'sm', 'md', 'lg', 'xl', 'full'
 * @param {Boolean} showCloseButton - Mostrar botón de cerrar
 * @param {Object} className - Clases adicionales
 */
export const MobileModal = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  showCloseButton = true,
  className = '',
  ...props
}) => {
  const { isMobile } = useResponsive();

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Tamaños del modal
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full'
  };

  // En móvil: modal desde abajo, en desktop: centrado
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`
          fixed z-50
          ${isMobile 
            ? 'bottom-0 left-0 right-0' 
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
          }
          ${isMobile 
            ? 'w-full max-h-[90vh] rounded-t-xl' 
            : `${sizeClasses[size]} w-full mx-4 max-h-[85vh] rounded-xl`
          }
          bg-white shadow-2xl
          flex flex-col
          safe-area-inset-bottom
          ${className}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        {...props}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
            {title && (
              <h2 
                id="modal-title"
                className="text-lg md:text-xl font-semibold text-gray-900 flex-1"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  ml-4 p-2 -mr-2
                  text-gray-400 hover:text-gray-600
                  hover:bg-gray-100 rounded-lg
                  transition-colors
                  touch-target
                "
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </div>
    </>
  );
};

export default MobileModal;

