// BottomNavigation.jsx - Navegación inferior para móvil
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  Users, 
  Plus,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { DESIGN_TOKENS } from '../../styles/tokens';

const NavigationItem = ({ icon: Icon, label, path, isActive, onClick, isPrimary = false }) => {
  if (isPrimary) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center relative -top-4"
        style={{
          minWidth: DESIGN_TOKENS.touch.extraLarge,
          minHeight: DESIGN_TOKENS.touch.extraLarge,
        }}
      >
        <div 
          className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{
            width: DESIGN_TOKENS.touch.large,
            height: DESIGN_TOKENS.touch.large,
          }}
        >
          <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-xs font-medium text-gray-700 mt-1">{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center flex-1 
        transition-colors active:bg-gray-100 rounded-lg
        ${isActive ? 'text-purple-600' : 'text-gray-500'}
      `}
      style={{
        minHeight: DESIGN_TOKENS.touch.comfortable,
        paddingTop: DESIGN_TOKENS.spacing.mobile.sm,
        paddingBottom: DESIGN_TOKENS.spacing.mobile.sm,
      }}
    >
      <Icon 
        className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`}
      />
      <span className={`text-xs font-medium mt-1 ${isActive ? 'font-semibold' : ''}`}>
        {label}
      </span>
      {isActive && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-purple-600 rounded-full" />
      )}
    </button>
  );
};

const BottomNavigation = ({ onNewReservation }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { 
      icon: Home, 
      label: 'Inicio', 
      path: '/dashboard',
      action: () => navigate('/dashboard')
    },
    { 
      icon: Calendar, 
      label: 'Reservas', 
      path: '/reservas',
      action: () => navigate('/reservas')
    },
    { 
      icon: Plus, 
      label: 'Nueva', 
      path: null,
      isPrimary: true,
      action: onNewReservation || (() => navigate('/reservas?new=true'))
    },
    { 
      icon: Users, 
      label: 'Clientes', 
      path: '/clientes',
      action: () => navigate('/clientes')
    },
    { 
      icon: BarChart3, 
      label: 'Stats', 
      path: '/analytics',
      action: () => navigate('/dashboard') // Por ahora al dashboard
    },
  ];

  return (
    <>
      {/* Spacer para que el contenido no quede detrás de la nav */}
      <div style={{ height: '80px' }} />
      
      {/* Bottom Navigation Fixed */}
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)', // iOS notch
        }}
      >
        <div className="flex items-center justify-around max-w-screen-xl mx-auto">
          {navigationItems.map((item, index) => (
            <NavigationItem
              key={index}
              icon={item.icon}
              label={item.label}
              path={item.path}
              isActive={item.path && location.pathname === item.path}
              onClick={item.action}
              isPrimary={item.isPrimary}
            />
          ))}
        </div>
      </nav>
    </>
  );
};

export default BottomNavigation;

