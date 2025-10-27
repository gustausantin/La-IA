// TouchButton.jsx - Botón optimizado para touch
import React from 'react';
import { DESIGN_TOKENS } from '../../styles/tokens';

const VARIANTS = {
  primary: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md active:shadow-lg',
  secondary: 'bg-gray-100 text-gray-900 active:bg-gray-200',
  outline: 'border-2 border-purple-600 text-purple-600 active:bg-purple-50',
  ghost: 'text-gray-700 active:bg-gray-100',
  danger: 'bg-red-600 text-white active:bg-red-700',
  success: 'bg-green-600 text-white active:bg-green-700',
};

const SIZES = {
  sm: {
    height: DESIGN_TOKENS.touch.minimum,
    padding: `${DESIGN_TOKENS.spacing.mobile.sm} ${DESIGN_TOKENS.spacing.mobile.md}`,
    fontSize: DESIGN_TOKENS.fontSize.mobile.sm,
    iconSize: 'w-4 h-4',
  },
  md: {
    height: DESIGN_TOKENS.touch.comfortable,
    padding: `${DESIGN_TOKENS.spacing.mobile.md} ${DESIGN_TOKENS.spacing.mobile.lg}`,
    fontSize: DESIGN_TOKENS.fontSize.mobile.base,
    iconSize: 'w-5 h-5',
  },
  lg: {
    height: DESIGN_TOKENS.touch.large,
    padding: `${DESIGN_TOKENS.spacing.mobile.md} ${DESIGN_TOKENS.spacing.mobile.xl}`,
    fontSize: DESIGN_TOKENS.fontSize.mobile.lg,
    iconSize: 'w-6 h-6',
  },
};

const TouchButton = ({
  children,
  icon: Icon,
  iconPosition = 'left',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const sizeConfig = SIZES[size];
  const variantClass = VARIANTS[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variantClass}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
        flex items-center justify-center gap-2
        font-medium rounded-lg
        transition-all duration-150
        ${className}
      `}
      style={{
        minHeight: sizeConfig.height,
        padding: sizeConfig.padding,
        fontSize: sizeConfig.fontSize,
      }}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className={`${sizeConfig.iconSize} border-2 border-current border-t-transparent rounded-full animate-spin`} />
          <span>Cargando...</span>
        </div>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className={sizeConfig.iconSize} strokeWidth={2.5} />
          )}
          {children && <span>{children}</span>}
          {Icon && iconPosition === 'right' && (
            <Icon className={sizeConfig.iconSize} strokeWidth={2.5} />
          )}
        </>
      )}
    </button>
  );
};

// Floating Action Button (FAB)
export const FAB = ({ 
  icon: Icon, 
  onClick, 
  position = 'bottom-right',
  className = '' 
}) => {
  const positions = {
    'bottom-right': 'bottom-20 right-4',
    'bottom-left': 'bottom-20 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <button
      onClick={onClick}
      className={`
        fixed ${positions[position]} z-40
        bg-gradient-to-br from-purple-600 to-blue-600
        text-white rounded-full shadow-lg
        active:scale-95 transition-transform
        flex items-center justify-center
        ${className}
      `}
      style={{
        width: DESIGN_TOKENS.touch.extraLarge,
        height: DESIGN_TOKENS.touch.extraLarge,
      }}
    >
      <Icon className="w-7 h-7" strokeWidth={2.5} />
    </button>
  );
};

// Icon Button (solo icono, táctil)
export const IconButton = ({ 
  icon: Icon, 
  onClick, 
  variant = 'ghost',
  size = 'md',
  className = '' 
}) => {
  const sizeConfig = SIZES[size];
  const variantClass = VARIANTS[variant];

  return (
    <button
      onClick={onClick}
      className={`
        ${variantClass}
        rounded-full flex items-center justify-center
        active:scale-95 transition-all
        ${className}
      `}
      style={{
        width: sizeConfig.height,
        height: sizeConfig.height,
      }}
    >
      <Icon className={sizeConfig.iconSize} strokeWidth={2.5} />
    </button>
  );
};

export default TouchButton;

