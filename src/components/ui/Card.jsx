import React from 'react';
import { motion } from 'framer-motion';

const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  hover = true,
  className = '',
  onClick,
  ...props
}) => {
  const baseClasses = `
    card-base
    bg-white border border-gray-200 rounded-xl
    transition-all duration-200 ease-in-out
    ${className}
  `;

  const variants = {
    default: 'shadow-sm',
    elevated: 'shadow-md',
    premium: `
      bg-gradient-to-br from-white to-purple-50
      border-purple-200 shadow-lg
    `,
    glass: `
      bg-white/80 backdrop-blur-sm
      border-white/20 shadow-xl
    `,
    flat: 'shadow-none border-gray-100',
  };

  const paddings = {
    none: '',
    sm: 'p-2',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };

  const hoverEffects = hover ? `
    hover:shadow-md hover:-translate-y-1
    ${onClick ? 'cursor-pointer' : ''}
  ` : '';

  const classes = `
    ${baseClasses}
    ${variants[variant]}
    ${paddings[padding]}
    ${hoverEffects}
  `;

  const cardAnimation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: "easeOut" }
  };

  const CardComponent = onClick ? motion.button : motion.div;

  return (
    <CardComponent
      className={classes}
      onClick={onClick}
      {...cardAnimation}
      whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      {...props}
    >
      {children}
    </CardComponent>
  );
};

// Sub-componentes para estructura
Card.Header = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
);

Card.Body = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
);

Card.Footer = ({ children, className = '' }) => (
  <div className={`mt-4 pt-4 border-t border-gray-100 ${className}`}>
    {children}
  </div>
);

export default Card;
