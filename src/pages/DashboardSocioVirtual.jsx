// ====================================
// DASHBOARD SOCIO VIRTUAL - Diseño "Lua Grande"
// Basado en: image_4a2497.jpg (Avatar grande + 3 tarjetas derecha)
// ====================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { 
  DollarSign, 
  Calendar, 
  AlertTriangle,
  Users,
  Phone,
  Lock,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Send
} from 'lucide-react';

// Hooks personalizados
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot';
import { useActionExecutor } from '../hooks/useActionExecutor';

export default function DashboardSocioVirtual() {
    const { business, user } = useAuthContext();
    const navigate = useNavigate();
    
    const { snapshot, loading, refresh } = useDashboardSnapshot(business?.id);
    const { executeAction, executing } = useActionExecutor();

    const [chatMessage, setChatMessage] = React.useState('');

    // Handler de acciones
    const handleAction = async (action) => {
        if (action.payload?.route) {
            navigate(action.payload.route);
            return;
        }
        const result = await executeAction(action);
        if (result?.success) {
            setTimeout(refresh, 2000);
        }
    };

    // Botones rápidos
    const quickActions = [
        { icon: Calendar, label: '¿Qué tengo hoy?', action: () => navigate('/reservas') },
        { icon: DollarSign, label: '¿Cómo va la caja?', action: () => navigate('/reportes') },
        { icon: Lock, label: 'Bloquear agenda', action: () => {} },
        { icon: Phone, label: 'Última llamada', action: () => navigate('/comunicaciones') }
    ];

    const stats = snapshot?.data?.stats || {};
    const teamSummary = snapshot?.data?.team_summary || '';

    // Redirigir si no hay negocio
    React.useEffect(() => {
        if (user && business === null && !loading) {
            navigate('/onboarding', { replace: true });
        }
    }, [user, business, loading, navigate]);

    if (loading && !snapshot) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-700 font-semibold">Cargando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* ============================================ */}
                {/* ZONA IZQUIERDA: LUA (LA PROTAGONISTA) */}
                {/* ============================================ */}
                <div className="flex flex-col space-y-6">
                    
                    {/* Avatar Grande + Estado */}
                    <div className="bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center relative overflow-hidden">
                        {/* Decoración fondo */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full blur-3xl opacity-30 -mr-32 -mt-32"></div>
                        
                        {/* Avatar */}
                        <div className="relative z-10 mb-6">
                            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600 p-2 shadow-2xl">
                                <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                                    <img
                                        src="/lua_avatar.png"
                                        alt="Lua"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-6xl font-bold">L</div>';
                                        }}
                                    />
                                </div>
                            </div>
                            {/* Badge "Activa" */}
                            <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                Activa
                            </div>
                        </div>

                        {/* Nombre */}
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Lua</h2>
                        <p className="text-sm text-gray-500 mb-6">Tu socia virtual</p>

                        {/* Bocadillo Inteligente */}
                        <div className="w-full bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200 relative">
                            {/* Pico del bocadillo */}
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-gradient-to-br from-blue-50 to-purple-50 border-l-2 border-t-2 border-blue-200 rotate-45"></div>
                            
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xl">💬</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-gray-800 leading-relaxed font-medium">
                                        {snapshot?.lua_message || "¡Hola! Analizando tu negocio..."}
                                    </p>
                                </div>
                            </div>

                            {/* Botones Mágicos (si hay acciones) */}
                            {snapshot?.actions && snapshot.actions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {snapshot.actions.map((action) => (
                                        <button
                                            key={action.id}
                                            onClick={() => handleAction(action)}
                                            disabled={executing}
                                            className={`
                                                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                                                transition-all shadow-md hover:shadow-lg active:scale-95
                                                ${action.type === 'destructive' 
                                                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                                                    : 'bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200'
                                                }
                                            `}
                                        >
                                            {action.type === 'destructive' ? <XCircle size={16} /> : <Send size={16} />}
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sección: ¿Necesitas algo? */}
                    <div className="bg-white rounded-3xl shadow-xl p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">¿Necesitas algo?</h3>
                        
                        {/* Botones Rápidos */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {quickActions.map((qa, idx) => (
                                <button
                                    key={idx}
                                    onClick={qa.action}
                                    className="flex items-center gap-2 px-4 py-3 bg-gradient-to-br from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 rounded-xl border-2 border-purple-200 text-sm font-semibold text-gray-700 transition-all"
                                >
                                    <qa.icon size={18} className="text-purple-600" />
                                    {qa.label}
                                </button>
                            ))}
                        </div>

                        {/* Input de chat */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                placeholder="Escribe tu pregunta..."
                                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                            />
                            <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all">
                                Enviar
                            </button>
                        </div>
                    </div>

                </div>

                {/* ============================================ */}
                {/* ZONA DERECHA: EL NEGOCIO (3 TARJETAS) */}
                {/* ============================================ */}
                <div className="flex flex-col space-y-6">
                    
                    {/* Tarjeta 1: Así va tu negocio hoy (CON SEMÁFORO) */}
                    <div className="bg-white rounded-3xl shadow-xl p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-purple-600" />
                            Así va tu negocio hoy
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            {/* Facturación */}
                            <div className={`text-center p-4 rounded-xl ${stats.estimated_revenue > 100 ? 'bg-green-50' : 'bg-red-50'}`}>
                                <DollarSign className={`w-6 h-6 mx-auto mb-2 ${stats.estimated_revenue > 100 ? 'text-green-600' : 'text-red-600'}`} />
                                <div className={`text-2xl font-bold ${stats.estimated_revenue > 100 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stats.estimated_revenue || 0}€
                                </div>
                                <div className="text-xs text-gray-600 mt-1">Facturado hoy</div>
                            </div>

                            {/* Huecos libres */}
                            <div className="text-center p-4 rounded-xl bg-blue-50">
                                <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-blue-600">
                                    {stats.today_appointments || 0}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">Huecos libres</div>
                            </div>

                            {/* En riesgo */}
                            <div className={`text-center p-4 rounded-xl ${stats.high_risk_no_shows > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                                <AlertTriangle className={`w-6 h-6 mx-auto mb-2 ${stats.high_risk_no_shows > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
                                <div className={`text-2xl font-bold ${stats.high_risk_no_shows > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                    {stats.high_risk_no_shows || 0}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">En riesgo</div>
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta 2: Siguiente en entrar (PRÓXIMAS CITAS) */}
                    <div className="bg-white rounded-3xl shadow-xl p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock size={20} className="text-purple-600" />
                            Siguiente en entrar
                        </h3>
                        <div className="space-y-3">
                            {/* Aquí irían las próximas citas */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                                        10:00
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">Próxima cita</div>
                                        <div className="text-sm text-gray-600">Hoy no hay citas programadas</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta 3: Tu equipo hoy (CON ALERTAS) */}
                    <div className="bg-white rounded-3xl shadow-xl p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Users size={20} className="text-purple-600" />
                            Tu equipo hoy
                        </h3>
                        <div className="space-y-3">
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <p className="text-sm text-gray-600">{teamSummary || "Cargando estado del equipo..."}</p>
                            </div>
                            
                            {/* Botón para ver detalle */}
                            <button
                                onClick={() => navigate('/equipo')}
                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
                            >
                                Ver equipo completo
                            </button>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
