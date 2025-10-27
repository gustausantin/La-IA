// Input.jsx - Input optimizado para móvil
import React, { forwardRef } from 'react';
import { DESIGN_TOKENS } from '../../styles/tokens';

const Input = forwardRef(({
  label,
  error,
  hint,
  icon: Icon,
  iconPosition = 'left',
  type = 'text',
  fullWidth = true,
  disabled = false,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {Icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-5 h-5 text-gray-400" />
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={`
            w-full rounded-lg border
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-purple-500 focus:ring-purple-500'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${Icon && iconPosition === 'left' ? 'pl-10' : 'pl-3'}
            ${Icon && iconPosition === 'right' ? 'pr-10' : 'pr-3'}
            py-3 text-base
            transition-colors
            focus:outline-none focus:ring-2
            ${className}
          `}
          style={{
            minHeight: DESIGN_TOKENS.touch.comfortable,
            fontSize: '16px', // Prevent zoom on iOS
          }}
          {...props}
        />
        
        {Icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      
      {hint && !error && (
        <p className="mt-2 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Textarea
export const Textarea = forwardRef(({
  label,
  error,
  hint,
  rows = 4,
  fullWidth = true,
  disabled = false,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={`
          w-full rounded-lg border px-3 py-3
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-purple-500 focus:ring-purple-500'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          transition-colors
          focus:outline-none focus:ring-2
          resize-none
          ${className}
        `}
        style={{
          fontSize: '16px', // Prevent zoom on iOS
        }}
        {...props}
      />
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      
      {hint && !error && (
        <p className="mt-2 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

// Select
export const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder = 'Seleccionar...',
  fullWidth = true,
  disabled = false,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <select
        ref={ref}
        disabled={disabled}
        className={`
          w-full rounded-lg border px-3 py-3
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-purple-500 focus:ring-purple-500'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          transition-colors
          focus:outline-none focus:ring-2
          appearance-none
          ${className}
        `}
        style={{
          minHeight: DESIGN_TOKENS.touch.comfortable,
          fontSize: '16px', // Prevent zoom on iOS
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
          paddingRight: '2.5rem',
        }}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      
      {hint && !error && (
        <p className="mt-2 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

// Search Input
export const SearchInput = forwardRef(({
  placeholder = 'Buscar...',
  onClear,
  value,
  ...props
}, ref) => {
  return (
    <div className="relative">
      <Input
        ref={ref}
        type="search"
        placeholder={placeholder}
        value={value}
        icon={require('lucide-react').Search}
        iconPosition="left"
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <require('lucide-react').X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default Input;

