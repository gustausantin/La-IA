// Layout.jsx - VERSIÓN MOBILE-FIRST PROFESIONAL
import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthContext } from "../contexts/AuthContext";
import { useVertical } from "../hooks/useVertical";
import { getVerticalIcon } from "./icons/VerticalIcons";
import NotificationCenter from "./NotificationCenter";
import EmergencyActions from "./EmergencyActions";
import {
    Home,
    Calendar,
    Users,
    Briefcase,
    BarChart2,
    Settings,
    MessageSquare,
    Bot,
    Brain,
    Bell,
    ChevronDown,
    LogOut,
    Receipt,
    AlertTriangle,
    Menu,
    X,
    Zap,
    Sparkles,
} from "lucide-react";

export default function Layout() {
    const location = useLocation();
    const {
        user,
        business,
        signOut,
        forceLogout,
        agentStatus,
        notifications,
        unreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
    } = useAuthContext();
    
    const { config: verticalConfig } = useVertical();
    
    // Emojis realistas y visuales (mismo estilo que Dashboard)
    const verticalEmojis = {
        'peluqueria_barberia': '💈',  // Poste de barbero (MÁS realista que tijeras)
        'fisioterapia': '⚕️',
        'masajes_osteopatia': '💆',
        'clinica_dental': '🦷',
        'psicologia_coaching': '🧠',
        'centro_estetica': '💄',
        'centro_unas': '💅',
        'entrenador_personal': '🏋️',
        'yoga_pilates': '🧘',
        'veterinaria': '🐾'
    };
    
    const verticalEmoji = verticalEmojis[business?.vertical_type] || '✨';

    const safeAgentStatus = agentStatus || {
        active: false,
        activeConversations: 0,
        pendingActions: 0,
        channels: {}
    };

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Menú principal - OPTIMIZADO PARA MÓVIL
    // Orden basado en frecuencia de uso diario para dueño de peluquería
    const menuItems = [
        // 🏠 Nivel 1: Visión general (siempre primero)
        { name: "Dashboard", path: "/dashboard", icon: Home, showInBottom: true },
        
        // 📅 Nivel 2: Operaciones diarias (más usadas)
        { name: "Reservas", path: "/reservas", icon: Calendar, showInBottom: true },
        { name: "Horario/Calendario", path: "/calendario", icon: Calendar, showInBottom: true },
        { name: "Clientes", path: "/clientes", icon: Users, showInBottom: true },
        
        // 💬 Nivel 3: Comunicación y gestión
        { name: "Comunicación", path: "/comunicacion", icon: MessageSquare, showInBottom: false },
        { name: "Tu Equipo", path: "/equipo", icon: Users, showInBottom: false },
        
        // ⚠️ Nivel 4: Revisión y control
        { name: "No-Shows", path: "/no-shows", icon: AlertTriangle, showInBottom: false },
        { name: "Facturación", path: "/consumos", icon: Receipt, showInBottom: false },
        
        // ⚙️ Nivel 5: Configuración (al final)
        { name: "Configuración", path: "/configuracion", icon: Settings, showInBottom: true },
        
        // 🧪 TEMPORAL - Se eliminará cuando se confíe en la lógica
        { name: "Disponibilidad", path: "/disponibilidad", icon: Zap, showInBottom: false }, // ⚠️ TEMPORAL - Para verificar lógica y métricas
    ];

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            forceLogout();
        }
    };

    // Items para navegación inferior móvil (solo los más importantes)
    const bottomNavItems = menuItems.filter(item => item.showInBottom);

    const currentPage = menuItems.find((item) =>
        location.pathname.includes(item.path)
    )?.name || "Dashboard";

    try {
        return (
            <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
                {/* ========================================
                    HEADER MÓVIL/DESKTOP - MODERNIZADO
                ======================================== */}
                <header className="bg-white shadow-md border-b-2 border-purple-100 flex-shrink-0 z-30">
                    <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
                        {/* Logo + Menú móvil */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Botón menú móvil (solo visible en móvil) */}
                            <button
                                onClick={() => setShowMobileMenu(!showMobileMenu)}
                                className="lg:hidden p-2 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 rounded-xl transition-all"
                            >
                                {showMobileMenu ? (
                                    <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                                ) : (
                                    <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                                )}
                            </button>

                            {/* Logo LA-IA - Compacto final */}
                            <img 
                                src="https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Logo%20La-IA/LA-IA%20Tech%20Logo1.png" 
                                alt="LA-IA"
                                className="h-5 sm:h-6 md:h-7 w-auto object-contain"
                                style={{ maxWidth: '120px' }}
                            />
                        </div>

                        {/* Acciones derecha */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Estado del agente */}
                            <span
                                className={`hidden sm:flex px-2 sm:px-3 py-1 text-xs font-medium rounded-full ${
                                    safeAgentStatus?.active
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-700"
                                }`}
                            >
                                {safeAgentStatus?.active ? "Activo" : "Inactivo"}
                            </span>

                            {/* Notificaciones */}
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Bell className="w-5 h-5" />
                                    <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                        {unreadCount}
                                    </span>
                                </button>
                            )}

                            {/* Menú usuario */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs sm:text-sm font-medium">
                                            {user?.email?.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-gray-600 hidden sm:block" />
                                </button>

                                {showUserMenu && (
                                    <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                                        <div className="p-3 border-b border-gray-200">
                                            <p className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                                                {business?.name}
                                            </p>
                                            <p className="text-xs sm:text-sm text-gray-600 truncate">
                                                {user?.email}
                                            </p>
                                        </div>
                                        <div className="p-2">
                                            <NavLink
                                                to="/configuracion"
                                                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <Settings className="w-4 h-4 inline mr-2" />
                                                Configuración
                                            </NavLink>
                                            <button
                                                onClick={() => {
                                                    setShowUserMenu(false);
                                                    handleLogout();
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg"
                                            >
                                                <LogOut className="w-4 h-4 inline mr-2" />
                                                Cerrar Sesión
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* ========================================
                    LAYOUT PRINCIPAL - FLEX RESPONSIVE
                ======================================== */}
                <div className="flex flex-1 overflow-hidden">
                    {/* ========================================
                        SIDEBAR DESKTOP (solo visible en lg+)
                    ======================================== */}
                    <aside className="hidden lg:flex lg:w-64 bg-gray-50 shadow-lg flex-col border-r border-gray-200">
                        {/* Info del negocio - Compacto y profesional */}
                        <div className="px-4 py-4 bg-gray-50 border-b-2 border-gray-200">
                            <div className="flex gap-3">
                                {/* Emoji */}
                                <div className="text-3xl flex-shrink-0">
                                    {verticalEmoji}
                                </div>
                                
                                {/* Texto alineado (nombre + email) */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black bg-gradient-to-r from-purple-700 via-blue-600 to-purple-700 bg-clip-text text-transparent text-lg leading-tight mb-1">
                                        {business?.name || "Mi Negocio"}
                                    </h3>
                                    <p className="text-xs text-gray-800 truncate font-semibold">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Navegación completa desktop */}
                        <nav className="flex-1 p-4 space-y-2 overflow-y-auto bg-gray-50">
                            {menuItems.map((item) => (
                                <NavLink
                                    key={item.name}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                                            isActive
                                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`
                                    }
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    <span className="font-medium text-sm">{item.name}</span>
                                </NavLink>
                            ))}
                        </nav>

                        {/* Logout desktop */}
                        <div className="p-3 border-t border-gray-200">
                            <button
                                onClick={forceLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors font-medium text-sm"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Cerrar Sesión</span>
                            </button>
                        </div>
                    </aside>

                    {/* ========================================
                        MENÚ MÓVIL SLIDE-IN (lg:hidden)
                    ======================================== */}
                    {showMobileMenu && (
                        <>
                            {/* Overlay */}
                            <div
                                className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                                onClick={() => setShowMobileMenu(false)}
                            />

                            {/* Menú slide-in profesional */}
                            <div className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-50 flex flex-col">
                                {/* Header del menú - Compacto */}
                                <div className="px-4 py-4 bg-gray-50 border-b-2 border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-black text-gray-800">Menú</h2>
                                        <button
                                            onClick={() => setShowMobileMenu(false)}
                                            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                                        >
                                            <X className="w-5 h-5 text-gray-700" />
                                        </button>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                        {/* Emoji */}
                                        <div className="text-3xl flex-shrink-0">
                                            {verticalEmoji}
                                        </div>
                                        
                                        {/* Texto alineado (nombre + email) */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-lg bg-gradient-to-r from-purple-700 via-blue-600 to-purple-700 bg-clip-text text-transparent truncate mb-1">
                                                {business?.name || "Mi Negocio"}
                                            </p>
                                            <p className="text-xs text-gray-800 truncate font-semibold">
                                                {user?.email}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Navegación completa móvil */}
                                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                                    {menuItems.map((item) => (
                                        <NavLink
                                            key={item.name}
                                            to={item.path}
                                            onClick={() => setShowMobileMenu(false)}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                                                    isActive
                                                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                }`
                                            }
                                        >
                                            <item.icon className="w-5 h-5 flex-shrink-0" />
                                            <span className="font-medium">{item.name}</span>
                                        </NavLink>
                                    ))}
                                </nav>

                                {/* Logout móvil */}
                                <div className="p-3 border-t border-gray-200">
                                    <button
                                        onClick={forceLogout}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors font-medium"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Cerrar Sesión</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ========================================
                        CONTENIDO PRINCIPAL - RESPONSIVE
                    ======================================== */}
                    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F3F4F6' }}>
                        <div className="p-3 sm:p-4 md:p-6 pb-20 lg:pb-6">
                            <Outlet />
                        </div>
                    </main>
                </div>

                {/* ========================================
                    NAVEGACIÓN INFERIOR MÓVIL (solo móvil/tablet)
                ======================================== */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30 safe-area-inset-bottom">
                    <div className="flex items-center justify-around px-2 py-2">
                        {bottomNavItems.map((item) => {
                            const isActive = location.pathname.includes(item.path);
                            return (
                                <NavLink
                                    key={item.name}
                                    to={item.path}
                                    className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-all duration-200 min-w-0 ${
                                        isActive
                                            ? "text-purple-600 bg-purple-50"
                                            : "text-gray-600 hover:bg-gray-100"
                                    }`}
                                >
                                    <item.icon
                                        className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${
                                            isActive ? "stroke-2" : ""
                                        }`}
                                    />
                                    <span className={`text-xs mt-1 truncate w-full text-center ${
                                        isActive ? "font-semibold" : "font-medium"
                                    }`}>
                                        {item.name}
                                    </span>
                                </NavLink>
                            );
                        })}
                    </div>
                </nav>

                {/* ========================================
                    COMPONENTES GLOBALES
                ======================================== */}
                <NotificationCenter
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    business={business}
                />

                <EmergencyActions />
            </div>
        );
    } catch (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
                <div className="text-center max-w-md">
                    <h1 className="text-lg sm:text-xl font-bold text-red-600 mb-4">
                        Error en Layout
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 mb-4">
                        Ha ocurrido un error inesperado
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base"
                    >
                        Recargar página
                    </button>
                </div>
            </div>
        );
    }
}

