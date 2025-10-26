import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const baseClasses = `
    btn-base
    inline-flex items-center justify-center gap-2
    font-medium text-center border
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `;

  const variants = {
    primary: `
      bg-purple-600 text-white border-purple-600
      hover:bg-purple-700 hover:border-purple-700
      focus:ring-purple-500
      active:bg-purple-800
    `,
    secondary: `
      bg-gray-100 text-gray-900 border-gray-300
      hover:bg-gray-200 hover:border-gray-400
      focus:ring-gray-500
      active:bg-gray-300
    `,
    outline: `
      bg-transparent text-purple-600 border-purple-600
      hover:bg-purple-50 hover:text-purple-700
      focus:ring-purple-500
      active:bg-purple-100
    `,
    ghost: `
      bg-transparent text-gray-700 border-transparent
      hover:bg-gray-100 hover:text-gray-900
      focus:ring-gray-500
      active:bg-gray-200
    `,
    success: `
      bg-green-600 text-white border-green-600
      hover:bg-green-700 hover:border-green-700
      focus:ring-green-500
      active:bg-green-800
    `,
    warning: `
      bg-yellow-600 text-white border-yellow-600
      hover:bg-yellow-700 hover:border-yellow-700
      focus:ring-yellow-500
      active:bg-yellow-800
    `,
    danger: `
      bg-red-600 text-white border-red-600
      hover:bg-red-700 hover:border-red-700
      focus:ring-red-500
      active:bg-red-800
    `,
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs rounded',
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-lg',
    xl: 'px-8 py-4 text-lg rounded-xl',
  };

  const classes = `
    ${baseClasses}
    ${variants[variant]}
    ${sizes[size]}
  `;

  const iconSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
  };

  const renderIcon = () => {
    if (loading) {
      return <Loader2 className="animate-spin" size={iconSize[size]} />;
    }
    if (icon) {
      const IconComponent = icon;
      return <IconComponent size={iconSize[size]} />;
    }
    return null;
  };

  return (
    <motion.button
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {iconPosition === 'left' && renderIcon()}
      {children}
      {iconPosition === 'right' && renderIcon()}
    </motion.button>
  );
};

export default Button;
