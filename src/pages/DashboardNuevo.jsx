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
import CopilotBanner from '../components/copilot/CopilotBanner';

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
  const [activityFeed, setActivityFeed] = useState([]); // 🆕 Feed de actividad
  const [nextAppointment, setNextAppointment] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]); // 🆕 Para mini-calendario
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [copilotStep, setCopilotStep] = useState(0); // 🆕 Paso del Copilot (0-3)
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
        loadActivityFeed(), // 🆕
        loadNextAppointment(),
        loadTodayAppointments(), // 🆕
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
    // ✅ DATOS REALES: Conversaciones con escalation_needed o sentiment negative
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('business_id', business.id)
        .gte('created_at', today.toISOString())
        .or('sentiment.eq.negative,metadata->>escalation_needed.eq.true')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Mapear a formato de alertas
      const mappedAlerts = (data || []).map(conv => ({
        id: conv.id,
        type: conv.interaction_type === 'complaint' ? 'Queja de Cliente' : 'Atención Requerida',
        summary: `Llamada de ${conv.customer_name || 'Cliente'} - ${conv.interaction_type}`,
        audio_url: conv.metadata?.audio_url || null,
        created_at: conv.created_at
      }));

      setAlerts(mappedAlerts);
    } catch (error) {
      console.error('Error cargando alertas:', error);
      setAlerts([]);
    }
  };

  const loadTasks = async () => {
    // ✅ DATOS REALES: Conversaciones con status='active' que llevan > 24h sin resolver
    try {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data, error } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'active')
        .lt('created_at', yesterday.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Mapear a formato de tareas
      const mappedTasks = (data || []).map(conv => ({
        id: conv.id,
        type: 'ia',
        text: `Conversación pendiente con ${conv.customer_name || conv.customer_phone} desde hace más de 24h`,
        completed: false,
        created_at: conv.created_at
      }));

      setTasks(mappedTasks);
    } catch (error) {
      console.error('Error cargando tareas:', error);
      setTasks([]);
    }
  };

  const loadSummary = async () => {
    // ✅ DATOS REALES: Calcular desde agent_conversations y appointments de HOY
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Nuevas reservas HOY
      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('id')
        .eq('business_id', business.id)
        .gte('created_at', today.toISOString())
        .eq('source', 'agent_whatsapp');

      if (apptError) throw apptError;

      // 2. Conversaciones HOY
      const { data: conversations, error: convError } = await supabase
        .from('agent_conversations')
        .select('interaction_type')
        .eq('business_id', business.id)
        .gte('created_at', today.toISOString());

      if (convError) throw convError;

      // 3. Calcular spam filtrado (interaction_type que empiece con 'noise_')
      const spamCount = (conversations || []).filter(c => 
        c.interaction_type?.startsWith('noise_') || 
        c.interaction_type === 'other'
      ).length;

      setSummary({
        newBookings: appointments?.length || 0,
        spamFiltered: spamCount,
        totalCalls: conversations?.length || 0
      });
    } catch (error) {
      console.error('Error cargando resumen:', error);
      setSummary({
        newBookings: 0,
        spamFiltered: 0,
        totalCalls: 0
      });
    }
  };

  const loadNextAppointment = async () => {
    try {
      // ✅ Sin .single() para evitar 406 cuando no hay datos
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(1);

      setNextAppointment(data?.[0] || null);
    } catch (error) {
      console.log('⚠️ No hay próxima cita');
      setNextAppointment(null);
    }
  };

  const loadActivityFeed = async () => {
    // ✅ DATOS REALES: Últimas 10 acciones del asistente HOY
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('agent_conversations')
        .select('id, customer_name, customer_phone, interaction_type, outcome, created_at, source_channel')
        .eq('business_id', business.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setActivityFeed(data || []);
    } catch (error) {
      console.error('Error cargando feed de actividad:', error);
      setActivityFeed([]);
    }
  };

  const loadTodayAppointments = async () => {
    // ✅ DATOS REALES: Todas las citas de HOY para el mini-calendario
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('business_id', business.id)
        .eq('appointment_date', todayStr)
        .neq('status', 'cancelled')
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      setTodayAppointments(data || []);
    } catch (error) {
      console.error('Error cargando citas de hoy:', error);
      setTodayAppointments([]);
    }
  };

  const loadAvailableSlots = async () => {
    // ✅ DATOS REALES: Huecos libres de HOY
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // Obtener todas las citas de hoy
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('appointment_time, duration_minutes')
        .eq('business_id', business.id)
        .eq('appointment_date', todayStr)
        .neq('status', 'cancelled');

      if (error) throw error;

      // Generar horario del día (9:00 - 20:00, intervalos de 30min)
      const allSlots = [];
      for (let hour = 9; hour < 20; hour++) {
        for (let minute of [0, 30]) {
          const slotTime = new Date(today);
          slotTime.setHours(hour, minute, 0, 0);
          
          // Solo slots futuros (después de ahora)
          if (slotTime > new Date()) {
            allSlots.push({
              time: format(slotTime, 'HH:mm'),
              datetime: slotTime
            });
          }
        }
      }

      // Filtrar slots ocupados
      const occupiedSlots = (appointments || []).map(apt => {
        return apt.appointment_time?.slice(0, 5) || '00:00'; // "09:00" format
      });

      const freeSlots = allSlots
        .filter(slot => !occupiedSlots.includes(slot.time))
        .slice(0, 5); // Primeros 5 huecos libres

      setAvailableSlots(freeSlots);
    } catch (error) {
      console.error('Error cargando slots:', error);
      setAvailableSlots([]);
    }
  };

  const loadOnboardingProgress = async () => {
    // Cargar paso del Copilot desde el negocio
    const step = business?.copilot_step || 0;
    setCopilotStep(step);
    
    // Si el Copilot está completo, no mostrar onboarding legacy
    if (business?.copilot_completed || step >= 3) {
      setOnboardingProgress(null);
      setCopilotStep(3); // Completado
      return;
    }

    // Si el onboarding inicial está completo pero el Copilot no, no mostrar onboarding legacy
    if (business?.onboarding_completed) {
      setOnboardingProgress(null);
    }
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

        {/* 2. COPILOT - Configuración Guiada (DESHABILITADO - Lo haremos al final) */}
        {/* {copilotStep < 3 && (
          <CopilotBanner 
            currentStep={copilotStep}
            onContinue={(step) => navigate(step.url)}
          />
        )} */}

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

        {/* 6. FEED DE ACTIVIDAD (El "Qué") */}
        {activityFeed.length > 0 && (
          <ActivityFeedCard 
            activities={activityFeed}
            assistantName={assistantName}
            onViewAll={() => navigate('/comunicacion')}
          />
        )}

        {/* 7. MINI-CALENDARIO DE HOY */}
        <TodayCalendarCard
          appointments={todayAppointments}
          onViewCalendar={() => navigate('/calendario')}
        />

        {/* 8. PRÓXIMA CITA (deprecado, reemplazado por mini-calendario) */}
        {/* <NextAppointmentCard 
          appointment={nextAppointment}
          vocab={vocab}
          onViewCalendar={() => navigate('/calendario')}
        />

        {/* 9. HUECOS DISPONIBLES */}
        {/* <AvailableSlotsCard 
          slots={availableSlots}
          onShare={() => setShowShareModal(true)}
          onNewBooking={() => navigate('/reservas/nueva')}
        />

        {/* 10. ESTADO VACÍO (solo si no hay nada) */}
        {!hasAnyData && todayAppointments.length === 0 && activityFeed.length === 0 && (
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

// 🆕 Tarjeta: Feed de Actividad (El "QUÉ" ha hecho el asistente)
function ActivityFeedCard({ activities, assistantName, onViewAll }) {
  const getActivityIcon = (type) => {
    if (type?.startsWith('client_') || type === 'reservation') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (type?.startsWith('noise_') || type === 'other') return <Shield className="w-4 h-4 text-orange-600" />;
    if (type?.startsWith('provider_')) return <Users className="w-4 h-4 text-yellow-600" />;
    if (type?.startsWith('incident_')) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    return <MessageSquare className="w-4 h-4 text-blue-600" />;
  };

  const getActivityLabel = (type) => {
    if (type === 'reservation' || type === 'client_reservation') return 'Reserva confirmada';
    if (type === 'cancellation' || type === 'client_cancel') return 'Cancelación gestionada';
    if (type?.startsWith('noise_')) return 'Spam filtrado';
    if (type === 'inquiry' || type === 'client_info') return 'Consulta respondida';
    if (type?.startsWith('provider_')) return 'Llamada comercial';
    if (type?.startsWith('incident_')) return 'Incidencia detectada';
    return 'Mensaje recibido';
  };

  const getActivityColor = (type) => {
    if (type?.startsWith('client_') || type === 'reservation') return 'bg-green-50 border-green-200';
    if (type?.startsWith('noise_')) return 'bg-orange-50 border-orange-200';
    if (type?.startsWith('provider_')) return 'bg-yellow-50 border-yellow-200';
    if (type?.startsWith('incident_')) return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">🤖 Última Actividad de {assistantName}</h3>
              <p className="text-xs text-gray-600">Esto es lo que ha hecho hoy</p>
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

      {/* Lista de actividades */}
      <div className="p-4 space-y-2">
        {activities.slice(0, 5).map((activity) => {
          const time = format(parseISO(activity.created_at), 'HH:mm');
          
          return (
            <div
              key={activity.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${getActivityColor(activity.interaction_type)} transition-all hover:shadow-sm`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.interaction_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-gray-500">{time}:</span>
                  <span className="text-xs font-semibold text-gray-900">
                    {getActivityLabel(activity.interaction_type)}
                  </span>
                </div>
                <p className="text-xs text-gray-700">
                  {activity.customer_name || activity.customer_phone}
                  {activity.outcome && ` • ${activity.outcome}`}
                </p>
              </div>
            </div>
          );
        })}

        {activities.length > 5 && (
          <button
            onClick={onViewAll}
            className="w-full py-2 text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1 transition-colors"
          >
            Ver {activities.length - 5} más actividades
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// 🆕 Tarjeta: Mini-Calendario de HOY (Reemplaza "Siguiente Cita")
function TodayCalendarCard({ appointments, onViewCalendar }) {
  // Generar slots de 9:00 a 21:00 (intervalos de 30min)
  const generateDaySlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 20; hour++) {
      for (let minute of [0, 30]) {
        slots.push({
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          hour,
          minute
        });
      }
    }
    return slots;
  };

  const daySlots = generateDaySlots();

  // Mapear citas a slots
  const getSlotStatus = (slotTime) => {
    const appointment = appointments.find(apt => {
      const aptTime = apt.appointment_time?.slice(0, 5) || '00:00'; // "09:00" format
      return aptTime === slotTime;
    });

    if (appointment) {
      return {
        status: 'occupied',
        label: appointment.customer_name || 'Cliente',
        appointment
      };
    }

    // Verificar si es hora pasada
    const now = new Date();
    const [h, m] = slotTime.split(':');
    const slotDateTime = new Date();
    slotDateTime.setHours(parseInt(h), parseInt(m), 0, 0);

    if (slotDateTime < now) {
      return { status: 'past', label: null };
    }

    return { status: 'free', label: null };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">📅 Tu Día de Hoy</h3>
              <p className="text-xs text-gray-600">Vista rápida de tu agenda</p>
            </div>
          </div>
          <button
            onClick={onViewCalendar}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            Ver agenda completa
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Mini-calendario (columna única) */}
      <div className="p-4">
        {appointments.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-500">No tienes citas programadas hoy</p>
            <p className="text-xs text-gray-400 mt-1">Tu agenda está libre</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {daySlots.map((slot) => {
              const slotStatus = getSlotStatus(slot.time);

              if (slotStatus.status === 'past') {
                // No mostrar slots pasados
                return null;
              }

              if (slotStatus.status === 'occupied') {
                // Cita ocupada
                return (
                  <div
                    key={slot.time}
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-xl hover:shadow-md transition-all cursor-pointer"
                    onClick={onViewCalendar}
                  >
                    <div className="flex-shrink-0 w-16 text-center">
                      <p className="text-base font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {slot.time}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {slotStatus.label}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {slotStatus.appointment.service_name || 'Servicio'}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                );
              }

              // Hueco libre - solo mostrar los primeros 3
              const freeSlotsBefore = daySlots
                .slice(0, daySlots.indexOf(slot))
                .filter(s => getSlotStatus(s.time).status === 'free').length;

              if (freeSlotsBefore >= 3) {
                return null;
              }

              return (
                <div
                  key={slot.time}
                  className="flex items-center gap-3 p-2.5 bg-green-50/50 border border-green-200 rounded-lg hover:bg-green-100 transition-all cursor-pointer"
                  onClick={onViewCalendar}
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <p className="text-sm font-bold text-green-700">
                      {slot.time}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-600">✨ LIBRE</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Tarjeta: Resumen del Día (VERSIÓN HERO - MÁS GRANDE Y VISUAL)
function SummaryCard({ summary, onViewAll }) {
  return (
    <div className="bg-white border-2 border-purple-200 rounded-2xl shadow-lg overflow-hidden">
      {/* Header con título hero */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">📊 Resumen de Hoy</h3>
              <p className="text-xs text-purple-100">El valor que está generando tu IA</p>
            </div>
          </div>
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-white/90 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
          >
            Ver todo
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Stats GRANDES y visuales */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Nuevas Reservas - HERO */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5 text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <p className="text-5xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              {summary.newBookings}
            </p>
            <p className="text-sm text-gray-700 font-bold">Nuevas Reservas</p>
            <p className="text-xs text-gray-500 mt-1">💰 Tu asistente está vendiendo</p>
          </div>

          {/* Spam Filtrado - HERO */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-5 text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <p className="text-5xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
              {summary.spamFiltered}
            </p>
            <p className="text-sm text-gray-700 font-bold">Spam Filtrado</p>
            <p className="text-xs text-gray-500 mt-1">🛡️ Te está protegiendo</p>
          </div>

          {/* Total Llamadas - HERO */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5 text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <p className="text-5xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              {summary.totalCalls}
            </p>
            <p className="text-sm text-gray-700 font-bold">Total Llamadas</p>
            <p className="text-xs text-gray-500 mt-1">📞 Atendidas 24/7</p>
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

