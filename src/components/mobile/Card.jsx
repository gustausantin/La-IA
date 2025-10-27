// Card.jsx - Card component mobile-optimized
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { DESIGN_TOKENS } from '../../styles/tokens';
import { useSwipe } from '../../hooks/useGestures';

const Card = ({
  children,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  className = '',
  interactive = false,
  showArrow = false,
  padding = 'md',
}) => {
  const swipeHandlers = useSwipe({
    onSwipeLeft,
    onSwipeRight,
  });

  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-sm border border-gray-100
        ${interactive ? 'active:scale-98 active:shadow-md transition-all cursor-pointer' : ''}
        ${paddingClasses[padding]}
        ${className}
      `}
      {...(onSwipeLeft || onSwipeRight ? swipeHandlers : {})}
    >
      <div className="flex items-center">
        <div className="flex-1 min-w-0">
          {children}
        </div>
        {showArrow && (
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
        )}
      </div>
    </div>
  );
};

// Card Section (para contenido dentro del card)
export const CardSection = ({ children, className = '' }) => (
  <div className={`py-3 ${className}`}>
    {children}
  </div>
);

// Card Header
export const CardHeader = ({ 
  title, 
  subtitle, 
  action,
  icon: Icon,
  className = '' 
}) => (
  <div className={`flex items-start justify-between mb-3 ${className}`}>
    <div className="flex items-start gap-3 flex-1 min-w-0">
      {Icon && (
        <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
          <Icon className="w-5 h-5 text-purple-600" strokeWidth={2.5} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-gray-900 truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && (
      <div className="flex-shrink-0 ml-3">
        {action}
      </div>
    )}
  </div>
);

// Card Footer
export const CardFooter = ({ children, className = '' }) => (
  <div className={`flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 ${className}`}>
    {children}
  </div>
);

// Stats Card (para métricas)
export const StatsCard = ({ 
  label, 
  value, 
  icon: Icon,
  trend,
  trendValue,
  color = 'purple',
  onClick 
}) => {
  const colors = {
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <Card 
      onClick={onClick} 
      interactive={!!onClick}
      padding="md"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{trend === 'up' ? '↑' : '↓'}</span>
              <span className="font-medium">{trendValue}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-6 h-6" strokeWidth={2.5} />
          </div>
        )}
      </div>
    </Card>
  );
};

// List Card (para listas de items)
export const ListCard = ({ items, renderItem, emptyMessage = 'No hay elementos' }) => {
  if (!items || items.length === 0) {
    return (
      <Card padding="lg">
        <p className="text-center text-gray-500">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <div 
            key={item.id || index}
            style={{
              padding: DESIGN_TOKENS.spacing.mobile.md,
              minHeight: DESIGN_TOKENS.touch.comfortable,
            }}
            className="flex items-center active:bg-gray-50 transition-colors"
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default Card;

