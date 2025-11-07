// ====================================
// DASHBOARD NUEVO - FEED DE ACCIONES MÓVIL-FIRST
// El dashboard más intuitivo, limpio y profesional del mercado
// ====================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, isToday, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp,
  Calendar, Clock, Users, Phone, MessageSquare, Share2,
  TrendingUp, Sparkles, Bot, X, Plus, Ban, Edit3,
  Play, Volume2, Eye, CheckCheck, Zap, Shield, Filter,
  Bell, BellOff, ExternalLink, ArrowRight, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

// ====================================
// COMPONENTE PRINCIPAL
// ====================================
export default function DashboardNuevo() {
  const { business, user } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);

  // Estado de datos
  const [alerts, setAlerts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({ status: 'ok' });

  // Estado UI
  const [showFABMenu, setShowFABMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Vocabulario dinámico
  const vocab = business?.vocabulary || {
    client: 'cliente',
    resource: 'mesa',
    resource_plural: 'mesas'
  };

  const assistantName = business?.assistant_name || 'Tu asistente';

  // ====================================
  // CARGA DE DATOS
  // ====================================
  useEffect(() => {
    if (business?.id) {
      loadDashboardData();
    }
  }, [business?.id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAlerts(),
        loadTasks(),
        loadSummary(),
        loadNextAppointment(),
        loadAvailableSlots(),
        loadOnboardingProgress(),
        loadConnectionStatus()
      ]);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    // TODO: Implementar consulta real a Supabase
    // GET /api/alerts?status=pending
    setAlerts([
      // MOCK para testing
      // { id: 1, type: 'Queja de Cliente', summary: 'Llamada de Ana López...', audio_url: null }
    ]);
  };

  const loadTasks = async () => {
    // TODO: Implementar consulta real
    // GET /api/tasks?status=pending
    setTasks([
      // MOCK
      // { id: 1, type: 'ia', text: 'La IA no pudo confirmar la cita de Carlos Ruiz', completed: false }
    ]);
  };

  const loadSummary = async () => {
    // TODO: Implementar
    // GET /api/dashboard/summary?scope=today
    setSummary({
      newBookings: 3,
      spamFiltered: 8,
      totalCalls: 14
    });
  };

  const loadNextAppointment = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, customer:customers(name, phone)')
      .eq('business_id', business.id)
      .eq('status', 'confirmed')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    setNextAppointment(data);
  };

  const loadAvailableSlots = async () => {
    // TODO: Consumir el motor de "Slots Dinámicos"
    // GET /api/slots/available?scope=today&limit=3
    setAvailableSlots([
      // MOCK
      // { time: '17:00', available: true }
    ]);
  };

  const loadOnboardingProgress = async () => {
    // Si el onboarding está completo, no mostrar nada
    if (business?.onboarding_complete) {
      setOnboardingProgress(null);
      return;
    }

    setOnboardingProgress({
      current: 3,
      total: 7,
      nextStep: 'Añadir Servicios',
      nextStepUrl: '/configuracion/servicios'
    });
  };

  const loadConnectionStatus = async () => {
    // TODO: Implementar ping real
    setConnectionStatus({ status: 'ok' });
  };

  // ====================================
  // PULL-TO-REFRESH
  // ====================================
  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (pullStartY.current > 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - pullStartY.current;
      if (distance > 0 && distance < 120) {
        setPullDistance(distance);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setRefreshing(true);
      await loadDashboardData();
      setRefreshing(false);
    }
    pullStartY.current = 0;
    setPullDistance(0);
  };

  // ====================================
  // ACCIONES
  // ====================================
  const handleMarkAlertAsRead = async (alertId) => {
    try {
      // TODO: PATCH /api/alerts/:id
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alerta marcada como vista');
    } catch (error) {
      toast.error('Error al marcar alerta');
    }
  };

  const handleMarkTaskAsComplete = async (taskId) => {
    try {
      // Optimistic UI
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t));
      
      // TODO: PATCH /api/tasks/:id
      
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }, 500);
      
      toast.success('Tarea completada');
    } catch (error) {
      toast.error('Error al completar tarea');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: false } : t));
    }
  };

  const handleBlockTime = async (duration) => {
    try {
      // TODO: Crear bloqueo en calendario
      toast.success(`Bloqueado ${duration}`);
      setShowFABMenu(false);
      loadAvailableSlots(); // Recargar huecos
    } catch (error) {
      toast.error('Error al bloquear tiempo');
    }
  };

  // ====================================
  // RENDERIZADO
  // ====================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  const hasAnyData = alerts.length > 0 || tasks.length > 0 || nextAppointment || connectionStatus.status !== 'ok' || onboardingProgress;

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 pb-24 lg:pb-8"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 transition-all"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 80 }}
        >
          <div className="bg-white rounded-full p-3 shadow-lg">
            {refreshing ? (
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>
      )}

      {/* Header con Avatar y Saludo Personalizado */}
      <header className="bg-gradient-to-br from-purple-50 via-blue-50 to-white rounded-2xl shadow-sm border border-purple-100 mx-4 mt-4 mb-6">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Avatar del Agente */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                {business?.settings?.agent?.avatar_url ? (
                  <img 
                    src={business.settings.agent.avatar_url} 
                    alt="Avatar del asistente"
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                )}
              </div>
            </div>

            {/* Información y Saludo */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                {format(new Date(), 'HH') < 12 
                  ? 'Buenos días' 
                  : format(new Date(), 'HH') < 20 
                  ? 'Buenas tardes' 
                  : 'Buenas noches'}, {business?.settings?.contact_name || user?.email?.split('@')[0] || 'Jefe'}
              </h1>
              <p className="text-sm text-gray-600 mb-3">
                Aquí tienes lo más importante del día para {business?.name || 'tu negocio'}
              </p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-gray-700">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold capitalize">
                    {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold">{assistantName} activo</span>
                </div>
              </div>
            </div>

            {/* Botón de Actualizar (opcional) */}
            <div className="flex-shrink-0">
              <button
                onClick={loadDashboardData}
                disabled={refreshing}
                className="p-3 hover:bg-white/50 rounded-xl transition-colors"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Feed de Tarjetas */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        
        {/* 1. ERROR DE CONEXIÓN (solo si hay error) */}
        {connectionStatus.status === 'error' && (
          <ConnectionErrorCard 
            onVerify={() => loadConnectionStatus()}
          />
        )}

        {/* 2. PROGRESO DE ONBOARDING (solo si incompleto) */}
        {onboardingProgress && (
          <OnboardingProgressCard 
            progress={onboardingProgress}
            onContinue={() => navigate(onboardingProgress.nextStepUrl)}
          />
        )}

        {/* 3. ALERTAS URGENTES */}
        {alerts.length > 0 && (
          <AlertCard 
            alerts={alerts}
            onMarkAsRead={handleMarkAlertAsRead}
          />
        )}

        {/* 4. TAREAS PENDIENTES */}
        {tasks.length > 0 && (
          <TaskCard 
            tasks={tasks}
            onComplete={handleMarkTaskAsComplete}
          />
        )}

        {/* 5. RESUMEN DEL DÍA (siempre visible) */}
        {summary && (
          <SummaryCard 
            summary={summary}
            onViewAll={() => navigate('/comunicacion?filter=today')}
          />
        )}

        {/* 6. PRÓXIMA CITA */}
        <NextAppointmentCard 
          appointment={nextAppointment}
          vocab={vocab}
          onViewCalendar={() => navigate('/calendario')}
        />

        {/* 7. HUECOS DISPONIBLES */}
        <AvailableSlotsCard 
          slots={availableSlots}
          onShare={() => setShowShareModal(true)}
          onNewBooking={() => navigate('/reservas/nueva')}
        />

        {/* 8. ESTADO VACÍO (solo si no hay nada) */}
        {!hasAnyData && (
          <EmptyStateCard 
            assistantName={assistantName}
            onShare={() => setShowShareModal(true)}
          />
        )}
      </div>

      {/* FAB (Floating Action Button) - CENTRO DEL BOTTOM NAV */}
      <div className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={() => setShowFABMenu(!showFABMenu)}
          className="w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-xl hover:shadow-2xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center"
        >
          {showFABMenu ? (
            <X className="w-6 h-6" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </button>

        {/* Bottom Sheet de acciones */}
        {showFABMenu && (
          <>
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10"
              onClick={() => setShowFABMenu(false)}
            />

            {/* Menu */}
            <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 space-y-2 w-72 animate-in slide-in-from-bottom duration-300">
              <FABMenuItem
                icon={<Ban className="w-5 h-5" />}
                label="Bloquear 1h (Comida)"
                onClick={() => handleBlockTime('1 hora')}
              />
              <FABMenuItem
                icon={<Ban className="w-5 h-5" />}
                label="Bloquear esta Tarde"
                onClick={() => handleBlockTime('esta tarde')}
              />
              <FABMenuItem
                icon={<Ban className="w-5 h-5" />}
                label="Cerrar todo el Día"
                onClick={() => handleBlockTime('todo el día')}
              />
              <div className="border-t border-gray-200 my-2"></div>
              <FABMenuItem
                icon={<Calendar className="w-5 h-5" />}
                label="Crear Reserva Manual"
                onClick={() => {
                  setShowFABMenu(false);
                  navigate('/reservas/nueva');
                }}
                variant="primary"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal: Compartir Link */}
      {showShareModal && (
        <ShareLinkModal
          businessName={business?.name}
          shareableLink={`https://la-ia.app/booking/${business?.id}`}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

// ====================================
// COMPONENTES DE TARJETAS
// ====================================

// Tarjeta: Error de Conexión
function ConnectionErrorCard({ onVerify }) {
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    await onVerify();
    setVerifying(false);
  };

  return (
    <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-red-900 mb-1">
            ⚠️ Tu desvío no está activo
          </h3>
          <p className="text-xs text-red-700 mb-3">
            Las llamadas no están llegando a tu asistente IA. Verifica tu configuración.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Verificar Ahora
                </>
              )}
            </button>
            <button className="px-4 py-2 bg-white hover:bg-gray-50 text-red-700 text-xs font-semibold rounded-lg border border-red-300 transition-colors">
              Ver Instrucciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tarjeta: Progreso de Onboarding
function OnboardingProgressCard({ progress, onContinue }) {
  const percentage = Math.round((progress.current / progress.total) * 100);

  return (
    <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
            {progress.current}/{progress.total}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900 mb-2">
            📋 Completa tu configuración ({percentage}%)
          </h3>
          
          {/* Barra de progreso */}
          <div className="w-full h-2 bg-white/50 rounded-full mb-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="text-xs text-gray-700 mb-3">
            <span className="font-semibold">⏩ Siguiente:</span> {progress.nextStep}
          </p>

          <button
            onClick={onContinue}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
          >
            Continuar Configuración
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta: Alertas
function AlertCard({ alerts, onMarkAsRead }) {
  const [expanded, setExpanded] = useState(false);
  const displayAlerts = expanded ? alerts : alerts.slice(0, 2);

  return (
    <div className="bg-white border-2 border-red-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 border-b border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                🚨 Tienes {alerts.length} Alerta{alerts.length > 1 ? 's' : ''} Urgente{alerts.length > 1 ? 's' : ''}
              </h3>
              <p className="text-xs text-gray-600">Requieren tu atención inmediata</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {displayAlerts.map((alert) => (
          <div key={alert.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-700 mb-1">{alert.type}</p>
                <p className="text-sm text-gray-700">{alert.summary}</p>
              </div>
              <button
                onClick={() => onMarkAsRead(alert.id)}
                className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Marcar como visto"
              >
                <Eye className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            
            {alert.audio_url && (
              <button className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-colors">
                <Volume2 className="w-3.5 h-3.5" />
                Escuchar Audio
              </button>
            )}
          </div>
        ))}

        {alerts.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 transition-colors"
          >
            {expanded ? (
              <>
                Ver menos
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Ver {alerts.length - 2} más
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Tarjeta: Tareas
function TaskCard({ tasks, onComplete }) {
  const tasksByType = {
    ia: tasks.filter(t => t.type === 'ia'),
    system: tasks.filter(t => t.type === 'system'),
    user: tasks.filter(t => t.type === 'user')
  };

  const iconByType = {
    ia: <Bot className="w-4 h-4 text-purple-600" />,
    system: <Bell className="w-4 h-4 text-blue-600" />,
    user: <Edit3 className="w-4 h-4 text-gray-600" />
  };

  const labelByType = {
    ia: '🤖 La IA necesita tu ayuda',
    system: '🔔 Sistema',
    user: '📝 Tus tareas'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              📋 Tienes {tasks.length} Tarea{tasks.length > 1 ? 's' : ''} Pendiente{tasks.length > 1 ? 's' : ''}
            </h3>
            <p className="text-xs text-gray-600">Marca como completadas al terminar</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {Object.entries(tasksByType).map(([type, items]) => (
          items.length > 0 && (
            <div key={type} className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                {iconByType[type]}
                {labelByType[type]}
              </p>
              {items.map((task) => (
                <label
                  key={task.id}
                  className={`flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all ${
                    task.completed ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onComplete(task.id)}
                    className="mt-0.5 w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                  />
                  <span className={`text-sm text-gray-700 flex-1 ${task.completed ? 'line-through' : ''}`}>
                    {task.text}
                  </span>
                </label>
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// Tarjeta: Resumen del Día
function SummaryCard({ summary, onViewAll }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">📊 Resumen de Hoy</h3>
              <p className="text-xs text-gray-600">El valor que generaste</p>
            </div>
          </div>
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            Ver todo
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Nuevas Reservas */}
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-black text-gray-900 mb-1">{summary.newBookings}</p>
            <p className="text-xs text-gray-600 font-medium">Nuevas Reservas</p>
          </div>

          {/* Spam Filtrado */}
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <p className="text-2xl font-black text-gray-900 mb-1">{summary.spamFiltered}</p>
            <p className="text-xs text-gray-600 font-medium">Spam Filtrado</p>
          </div>

          {/* Total Llamadas */}
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-gray-900 mb-1">{summary.totalCalls}</p>
            <p className="text-xs text-gray-600 font-medium">Total Llamadas</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tarjeta: Próxima Cita
function NextAppointmentCard({ appointment, vocab, onViewCalendar }) {
  if (!appointment) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Siguiente Cita</h3>
            <p className="text-xs text-gray-600">No tienes más citas programadas hoy</p>
          </div>
          <button
            onClick={onViewCalendar}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Ver Agenda
          </button>
        </div>
      </div>
    );
  }

  const startTime = parseISO(appointment.start_time);

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-white/50 border-b border-indigo-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">🕐 Siguiente Cita</h3>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
              {format(startTime, 'HH:mm')}h
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">
              {appointment.customer?.name || 'Cliente'}
            </p>
            <p className="text-xs text-gray-600">
              {appointment.service_name || 'Servicio'}
            </p>
          </div>
          <button
            onClick={onViewCalendar}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-500/30 transition-all"
          >
            Ver Agenda
          </button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta: Huecos Disponibles
function AvailableSlotsCard({ slots, onShare, onNewBooking }) {
  if (slots.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Huecos Libres Hoy</h3>
            <p className="text-xs text-gray-600">No te quedan huecos libres hoy</p>
          </div>
        </div>
        <button
          onClick={onShare}
          className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
        >
          <Share2 className="w-4 h-4" />
          Compartir Link de Reserva
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">✨ Huecos Libres Hoy</h3>
            <p className="text-xs text-gray-600">Comparte para llenar tu agenda</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className="px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg text-sm font-semibold text-green-700"
            >
              {slot.time}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onShare}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Compartir Link
          </button>
          <button
            onClick={onNewBooking}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
          >
            + Reserva
          </button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta: Estado Vacío
function EmptyStateCard({ assistantName, onShare }) {
  return (
    <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 border border-purple-200 rounded-2xl shadow-lg p-6 text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        ✨ Todo listo para empezar
      </h3>
      
      <p className="text-sm text-gray-700 mb-4">
        Tu asistente <span className="font-semibold text-purple-600">{assistantName}</span> está activo 24/7.
        <br />
        Comparte tu link de reserva para recibir tu primera cita.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onShare}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
        >
          <Share2 className="w-5 h-5" />
          Compartir Link
        </button>
        <button className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl border border-gray-300 transition-all flex items-center justify-center gap-2">
          <Phone className="w-5 h-5" />
          Hacer Demo de Llamada
        </button>
      </div>
    </div>
  );
}

// ====================================
// COMPONENTES AUXILIARES
// ====================================

// Item del menú FAB
function FABMenuItem({ icon, label, onClick, variant = 'default' }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
        variant === 'primary'
          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30'
          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Modal: Compartir Link
function ShareLinkModal({ businessName, shareableLink, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    toast.success('¡Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">🔗 Comparte tu agenda</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Comparte este link con tus clientes para que puedan reservar directamente con tu asistente IA.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-gray-600 mb-1 font-medium">{businessName}</p>
          <p className="text-sm text-purple-600 font-mono break-all">{shareableLink}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <CheckCheck className="w-5 h-5" />
                ¡Copiado!
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Copiar Link
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

