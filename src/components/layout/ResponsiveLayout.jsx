import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  ChevronDown,
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  Home,
  MessageSquare,
  BarChart3,
  Calendar,
  Users,
  Utensils,
  Cog
} from 'lucide-react';

// Hook para detectar el tamaño de pantalla
const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState('lg');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) setBreakpoint('sm');
      else if (width < 768) setBreakpoint('md');
      else if (width < 1024) setBreakpoint('lg');
      else if (width < 1280) setBreakpoint('xl');
      else setBreakpoint('2xl');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};

// Sidebar responsivo
const ResponsiveSidebar = ({ isOpen, onClose, currentPath, navigation }) => {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'sm' || breakpoint === 'md';

  const sidebarVariants = {
    open: {
      x: 0,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    },
    closed: {
      x: isMobile ? '-100%' : '-280px',
      transition: { type: "spring", stiffness: 300, damping: 30 }
    }
  };

  const overlayVariants = {
    open: { opacity: 1, pointerEvents: 'auto' },
    closed: { opacity: 0, pointerEvents: 'none' }
  };

  return (
    <>
      {/* Overlay para móvil */}
      {isMobile && (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              variants={overlayVariants}
              initial="closed"
              animate="open"
              exit="closed"
              onClick={onClose}
            />
          )}
        </AnimatePresence>
      )}

      {/* Sidebar */}
      <motion.div
        className={`
          fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 z-50
          ${isMobile ? 'shadow-xl' : 'lg:relative lg:translate-x-0'}
        `}
        variants={sidebarVariants}
        initial="closed"
        animate={isOpen ? "open" : "closed"}
      >
        {/* Header del sidebar */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">LA</span>
            </div>
            <h1 className="text-base font-bold text-gray-900">La-IA</h1>
          </div>
          
          {isMobile && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>

        {/* Navegación */}
        <nav className="p-2 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            
            return (
              <motion.a
                key={item.path}
                href={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
                  ${isActive 
                    ? 'bg-purple-100 text-purple-700 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => isMobile && onClose()}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </motion.a>
            );
          })}
        </nav>

        {/* Footer del sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-gray-200">
          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                Admin User
              </p>
              <p className="text-xs text-gray-500 truncate">
                Restaurante Demo
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// Header responsivo
const ResponsiveHeader = ({ onMenuClick, title, actions }) => {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'sm' || breakpoint === 'md';

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          
          <div>
            <h1 className="text-lg lg:text-base font-semibold text-gray-900">
              {title}
            </h1>
            {!isMobile && (
              <p className="text-sm text-gray-600 mt-0.5">
                Gestiona tu restaurante de forma inteligente
              </p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Search - oculto en móvil */}
          {!isMobile && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
              />
            </div>
          )}

          {/* Notifications */}
          <motion.button
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </motion.button>

          {/* User menu */}
          <div className="relative">
            <motion.button
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              {!isMobile && (
                <>
                  <span className="text-sm font-medium text-gray-700">Admin</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </>
              )}
            </motion.button>
          </div>

          {/* Actions adicionales */}
          {actions}
        </div>
      </div>
    </header>
  );
};

// Contenido principal responsivo
const ResponsiveContent = ({ children, className = '' }) => {
  const breakpoint = useBreakpoint();
  
  return (
    <main className={`
      flex-1 overflow-auto bg-gray-50
      p-2 lg:p-6
      ${className}
    `}>
      <div className={`
        max-w-7xl mx-auto
        ${breakpoint === 'sm' ? 'space-y-4' : 'space-y-6'}
      `}>
        {children}
      </div>
    </main>
  );
};

// Layout principal responsivo
const ResponsiveLayout = ({ children, currentPath = '/', title = 'Dashboard' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const breakpoint = useBreakpoint();

  // Cerrar sidebar automáticamente en desktop
  useEffect(() => {
    if (breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl') {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [breakpoint]);

  const navigation = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/comunicacion', label: 'Comunicación', icon: MessageSquare, badge: '3' },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/reservas', label: 'Reservas', icon: Calendar },
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/mesas', label: 'Mesas', icon: Utensils },
    { path: '/configuracion', label: 'Configuración', icon: Cog },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <ResponsiveSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={currentPath}
        navigation={navigation}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <ResponsiveHeader
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
        />

        {/* Content */}
        <ResponsiveContent>
          {children}
        </ResponsiveContent>
      </div>
    </div>
  );
};

// Grid responsivo para métricas
const ResponsiveGrid = ({ children, cols = { sm: 1, md: 2, lg: 3, xl: 4 } }) => {
  return (
    <div className={`
      grid gap-4 lg:gap-6
      grid-cols-${cols.sm}
      md:grid-cols-${cols.md}
      lg:grid-cols-${cols.lg}
      xl:grid-cols-${cols.xl}
    `}>
      {children}
    </div>
  );
};

// Container responsivo
const ResponsiveContainer = ({ children, size = 'full' }) => {
  const sizes = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div className={`mx-auto px-4 lg:px-6 ${sizes[size]}`}>
      {children}
    </div>
  );
};

export default ResponsiveLayout;
export { 
  useBreakpoint, 
  ResponsiveSidebar, 
  ResponsiveHeader, 
  ResponsiveContent,
  ResponsiveGrid,
  ResponsiveContainer
};
