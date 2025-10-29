// src/components/Layout.jsx - Versión COMPLETA con NotificationCenter
import { NavLink, Outlet } from "react-router-dom";
import { useAuthContext } from "../contexts/AuthContext";
import { useState } from "react";
import NotificationCenter from "./NotificationCenter"; // NUEVA IMPORTACIÓN
import EmergencyActions from "./EmergencyActions"; // NUEVA IMPORTACIÓN
import MobileWarning from "./MobileWarning"; // Para avisar en móviles pequeños
import {
    Home,
    Calendar,
    Users,
    Briefcase,
    BarChart2,
    Settings,
    Clock,
    MessageSquare,
    Bot,
    Brain,
    Bell,
    ChevronDown,
    LogOut,
    Phone,
    MessageCircle,
    Mail,
    Instagram,
    Facebook,
    Zap,
    Receipt,
    Activity,
    AlertTriangle, // Para No-Shows
    Circle, // NUEVO - para el estado del agente
    RefreshCw, // Importado para el botón de reiniciar
} from "lucide-react";

export default function Layout() {
    // console.log removed for production
// Obtener TODOS los datos necesarios del contexto global
    const {
        user,
        business: restaurant,
        signOut,
        restartApp, // NUEVO - función de reinicio
        forceLogout, // NUEVO - función de cierre forzado
        agentStatus, // NUEVO - del contexto
        notifications, // NUEVO - del contexto
        unreadCount, // NUEVO - del contexto
        markNotificationAsRead, // NUEVO - del contexto
        markAllNotificationsAsRead, // NUEVO - del contexto
    } = useAuthContext();

    // Protection against crashes
    const safeAgentStatus = agentStatus || {
        active: false,
        activeConversations: 0,
        pendingActions: 0,
        channels: {}
    };

    // Solo estados locales para UI
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    // Ya no necesitamos:
    // - useState para notifications (viene del contexto)
    // - useState para agentStatus (viene del contexto)
    // - useEffect para simular notificaciones (vienen del contexto real-time)

    const menuItems = [
        { name: "Dashboard", path: "/dashboard", icon: Home, badge: null },
        { name: "Reservas", path: "/reservas", icon: Calendar, badge: null },
        { name: "No-Shows", path: "/no-shows", icon: AlertTriangle, badge: null },
        {
            name: "Comunicación",
            path: "/comunicacion",
            icon: MessageSquare,
            badge: null, // TODO: Implementar contador de mensajes no leídos
        },
        {
            name: "Horarios y Calendario",
            path: "/calendario",
            icon: Calendar,
            badge: null,
        },
        { name: "Zonas y Mesas", path: "/mesas", icon: Briefcase, badge: null },
        { name: "Clientes", path: "/clientes", icon: Users, badge: null },
        {
            name: "CRM Inteligente",
            path: "/crm-inteligente",
            icon: Brain,
            badge: null,
        },
        {
            name: "Consumos",
            path: "/consumos",
            icon: Receipt,
            badge: null,
        },
        // { name: "Analytics", path: "/analytics", icon: BarChart2, badge: null }, // Deshabilitado temporalmente
        {
            name: "Configuración",
            path: "/configuracion",
            icon: Settings,
            badge: null, // TODO: Implementar contador de alertas del sistema
        },
    ];

    // Función helper para formatear tiempo de notificación
    const formatNotificationTime = (timestamp) => {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000 / 60); // minutos

        if (diff < 1) return "Ahora";
        if (diff < 60) return `${diff} min`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h`;
        return `${Math.floor(diff / 1440)}d`;
    };

    // Función helper para obtener el ícono de notificación
    const getNotificationIcon = (type) => {
        const icons = {
            reservation: Calendar,
            agent: Bot,
            system: Activity,
            alert: Bell,
        };
        return icons[type] || Bell;
    };

    // DATOS REALES O VACÍOS - NO MOCK
    const realStats = {
        activeConversations: 0,
        pendingReservations: 0,
        todayRevenue: 0
    };

    // Función para manejar el logout
    const handleLogout = async () => {
        try {
            // console.log removed for production
await signOut();
        } catch (error) {
            // Si el logout normal falla, usar forceLogout
            forceLogout();
        }
    };

    try {
        return (
            <>
                {/* Advertencia para móviles pequeños */}
                <MobileWarning />
                
                <div className="flex h-screen bg-gray-50">
                {/* Sidebar - Responsive */}
                <div className="w-64 lg:w-64 md:w-20 bg-white shadow-lg flex flex-col transition-all duration-200">
                    {/* Logo y Estado del Agente */}
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Bot className="w-8 h-8 text-purple-600" />
                                <h1 className="text-base font-bold text-gray-900 md:hidden lg:block">
                                    La-IA
                                </h1>
                            </div>
                            <span
                                className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                                    safeAgentStatus?.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                }`}
                            >
                                {safeAgentStatus?.active ? "Activo" : "Inactivo"}
                            </span>
                        </div>
                    </div>

                    {/* Info del Restaurante */}
                    <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900 truncate md:hidden lg:block">
                            {restaurant?.name || "Mi Restaurante"}
                        </h3>
                        <p className="text-sm text-gray-600 truncate mt-1 md:hidden lg:block">
                            {user?.email}
                        </p>
                    </div>

                    {/* Navegación */}
                    <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                className={({ isActive }) =>
                                    `w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 group ${
                                        isActive
                                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                                            : "text-gray-600 hover:bg-gray-100"
                                    }`
                                }
                            >
                                <div className="flex items-center space-x-3">
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium md:hidden lg:inline">{item.name}</span>
                                </div>
                                {item.badge && (
                                    <span className={`px-2 py-1 text-xs rounded-full font-bold ${item.badgeColor || 'bg-blue-100 text-blue-700'} text-white`}>
                                        {item.badge}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Acciones */}
                    <div className="p-2 border-t border-gray-200">
                        <button
                            onClick={forceLogout}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors font-medium"
                            title="Cerrar sesión forzado"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col">
                    {/* Top Bar */}
                    <header className="bg-white shadow-sm border-b border-gray-200">
                        <div className="flex items-center justify-between px-4 py-4">
                            <div className="flex items-center space-x-4">
                                <h2 className="text-base font-semibold text-gray-900">
                                    {menuItems.find((item) =>
                                        window.location.pathname.includes(
                                            item.path,
                                        ),
                                    )?.name || "Dashboard"}
                                </h2>
                            </div>

                            <div className="flex items-center space-x-4">
                                {/* Notificaciones - ahora del contexto global */}
                                {unreadCount > 0 && (
                                    <div className="relative">
                                        <button
                                            onClick={() =>
                                                setShowNotifications(!showNotifications)
                                            }
                                            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <Bell className="w-5 h-5" />
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                                {unreadCount}
                                            </span>
                                        </button>
                                    </div>
                                )}

                                {/* Menú de usuario */}
                                <div className="relative">
                                    <button
                                        onClick={() =>
                                            setShowUserMenu(!showUserMenu)
                                        }
                                        className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                                            <span className="text-white text-sm font-medium">
                                                {user?.email
                                                    ?.charAt(0)
                                                    .toUpperCase()}
                                            </span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-gray-600" />
                                    </button>

                                    {showUserMenu && (
                                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                                            <div className="p-2 border-b border-gray-200">
                                                <p className="font-semibold text-gray-900">
                                                    {restaurant?.name}
                                                </p>
                                                <p className="text-sm text-gray-600 truncate">
                                                    {user?.email}
                                                </p>
                                            </div>
                                            <div className="p-2">
                                                <NavLink
                                                    to="/configuracion"
                                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                                                    onClick={() =>
                                                        setShowUserMenu(false)
                                                    }
                                                >
                                                    <Settings className="w-4 h-4 inline mr-2" />
                                                    Configuración
                                                </NavLink>
                                                <button
                                                    onClick={() => {
                                                        setShowUserMenu(false);
                                                        handleLogout();
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
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

                    {/* Page Content */}
                    <main className="flex-1 overflow-y-auto bg-gray-50 p-2">
                        {// console.log removed for production
}
                        <Outlet />
                    </main>
                </div>

                {/* Centro de Notificaciones - COMPONENTE COMPLETO */}
                <NotificationCenter
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    restaurant={restaurant}
                />

                {/* Acciones de Emergencia - NUEVO */}
                <EmergencyActions />
            </div>
            </>
        );
    } catch (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50">
                <div className="text-center p-6">
                    <h1 className="text-base font-bold text-red-600 mb-4">Error en Layout</h1>
                    <p className="text-gray-600 mb-4">Ha ocurrido un error inesperado</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        Recargar página
                    </button>
                </div>
            </div>
        );
    }
};

