import React from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  DollarSign, 
  Users, 
  Calendar, 
  MessageSquare, 
  ArrowRight, 
  TrendingUp,
  Phone,
  Sparkles,
  RefreshCw
} from 'lucide-react';

/**
 * LuaHero V3.0 - "MI SOCIA INFORMÁNDOME"
 * 
 * Concepto: Lua ocupa 70% de la pantalla y te habla directamente.
 * Solo muestra tarjetas de las 5 cosas que te quitan el sueño (si aplican).
 */

// Tarjeta de Insight/Preocupación
const InsightCard = ({ type, title, value, subtext, action, onAction, color, urgent = false }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4 }}
    className={`
      bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-xl border-l-4 
      hover:scale-[1.02] hover:shadow-2xl transition-all cursor-pointer
      ${urgent ? 'animate-pulse' : ''}
    `}
    style={{ borderLeftColor: color }}
    onClick={onAction}
  >
    <div className="flex justify-between items-start mb-3">
      <div className="flex items-center gap-2">
        <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
          {type}
        </span>
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {value && (
        <span className="text-2xl font-extrabold text-slate-900">
          {value}
        </span>
      )}
    </div>
    
    <p className="text-sm text-slate-600 leading-relaxed mb-4">
      {subtext}
    </p>
    
    {action && (
      <button className="w-full py-3 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg">
        {action} <ArrowRight size={16} />
      </button>
    )}
  </motion.div>
);

const LuaHero = ({ snapshot, onAction, onRefresh, isRefreshing }) => {
  const { scenario, lua_message, actions, data } = snapshot || {};
  const stats = data?.stats || {};

  // Determinar estado visual
  const isCrisis = scenario === 'staff_crisis' || scenario === 'no_show_risk';
  const statusColor = isCrisis ? 'bg-red-500' : 'bg-emerald-500';
  const statusLabel = isCrisis ? 'ALERTA ACTIVA' : 'TODO CONTROLADO';

  // Construir las "preocupaciones" dinámicamente
  const concerns = [];

  // 1. 💰 CAJA (Siempre se muestra)
  const cash = stats.estimated_revenue || 0;
  const cashStatus = cash < 100 
    ? "Domingo flojo, normal. Mañana remontamos." 
    : cash < 300 
    ? "Ritmo tranquilo para ser domingo."
    : "¡Buen ritmo! Vas bien.";

  concerns.push({
    id: 'cash',
    type: <DollarSign size={18} />,
    color: cash < 100 ? '#F59E0B' : '#10B981',
    title: 'ESTADO DE CAJA',
    value: `${cash}€`,
    subtext: cashStatus,
    action: '💰 Ver desglose',
    onAction: () => onAction({ id: 'view_revenue_breakdown', payload: { route: '/reportes?view=revenue' } })
  });

  // 2. 🧨 URGENCIAS (Solo si hay problemas)
  if (scenario === 'no_show_risk' || stats.high_risk_no_shows > 0) {
    concerns.push({
      id: 'urgency',
      type: <AlertTriangle size={18} />,
      color: '#EF4444',
      title: 'URGENCIA: NO-SHOWS',
      value: `⚠️ ${stats.high_risk_no_shows || 0}`,
      subtext: stats.high_risk_no_shows > 0 
        ? `Tienes ${stats.high_risk_no_shows} clientes con alto riesgo de plantar. Confírmalos YA.`
        : "Un cliente no ha venido. Llámale o cobra fianza.",
      action: '📞 Llamar / Confirmar',
      urgent: true,
      onAction: () => onAction(actions?.find(a => a.id === 'call_customer') || { id: 'view_risks', payload: { route: '/clientes?filter=risk' } })
    });
  }

  // 3. 🔥 CRISIS DE PERSONAL (Solo si hay conflicto)
  if (scenario === 'staff_crisis') {
    concerns.push({
      id: 'staff_crisis',
      type: <Users size={18} />,
      color: '#DC2626',
      title: 'CRISIS DE PERSONAL',
      value: '🚨',
      subtext: lua_message || "Un empleado falta y tiene citas asignadas. Reasigna o cancela.",
      action: '🔀 Reasignar citas',
      urgent: true,
      onAction: () => onAction(actions?.[0] || { id: 'transfer_appointments' })
    });
  }

  // 4. 👥 EQUIPO Y AGENDA (Resumen del día)
  const teamSummary = data?.team_summary || 
    `Pol está de vacaciones. Andrew y Culebra cubren la tarde. ${stats.today_appointments || 0} citas hoy.`;

  concerns.push({
    id: 'team',
    type: <Users size={18} />,
    color: '#3B82F6',
    title: 'EQUIPO Y AGENDA',
    subtext: teamSummary,
    action: '📅 Ver agenda mañana',
    onAction: () => onAction({ id: 'view_tomorrow', payload: { route: '/reservas?date=tomorrow' } })
  });

  // 5. 💬 COMUNICACIONES (Si hay mensajes pendientes)
  if (stats.pending_communications > 0) {
    concerns.push({
      id: 'communications',
      type: <MessageSquare size={18} />,
      color: '#F59E0B',
      title: 'COMUNICACIONES',
      value: `${stats.pending_communications}`,
      subtext: `Tienes ${stats.pending_communications} WhatsApps sin contestar de clientes VIP preguntando por huecos.`,
      action: '💬 Responder con IA',
      onAction: () => onAction({ id: 'view_communications', payload: { route: '/comunicaciones' } })
    });
  }

  // 6. ✨ OPORTUNIDAD (Hueco libre próximo)
  if (scenario === 'dead_slot') {
    concerns.push({
      id: 'opportunity',
      type: <Sparkles size={18} />,
      color: '#8B5CF6',
      title: 'OPORTUNIDAD: HUECO LIBRE',
      value: '💡',
      subtext: "Se ha quedado libre un hueco en 2h. ¿Lanzamos oferta flash?",
      action: '✨ Generar oferta',
      onAction: () => onAction(actions?.find(a => a.id === 'generate_flash_offer') || { id: 'flash_offer' })
    });
  }

  return (
    <div className="relative w-full min-h-[85vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl">
      
      {/* ===================================== */}
      {/* 1. LUA (IMAGEN DE FONDO - 70% VISUAL) */}
      {/* ===================================== */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/lua_avatar.png"
          alt="Lua - Tu socia virtual" 
          className="w-full h-full object-cover opacity-40 md:opacity-70 object-center md:object-left scale-110"
          onError={(e) => {
            // Fallback: mostrar gradiente con inicial
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `
              <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
                <div class="text-white text-9xl font-bold opacity-50">L</div>
              </div>
            `;
          }}
        />
        {/* Gradiente overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/90 to-transparent md:via-slate-900/60"></div>
      </div>

      {/* ===================================== */}
      {/* 2. EL CEREBRO (Las Preocupaciones) */}
      {/* ===================================== */}
      <div className="relative z-10 w-full md:w-1/2 md:ml-auto p-6 md:p-10 flex flex-col justify-center h-full space-y-6">
        
        {/* Header: Estado del Socio */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold mb-4">
            <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></span>
            {statusLabel}
          </div>
          
          {/* Mensaje Principal (La Voz de Lua) */}
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-3 drop-shadow-2xl">
            {lua_message || "Buenas noches, Gustau. Todo controlado."}
          </h1>

          {/* Botón de actualizar */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-white/70 hover:text-white text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualizando...' : 'Actualizar estado'}
          </button>
        </motion.div>

        {/* Grid de Preocupaciones (Solo las que aplican) */}
        <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {concerns.map((concern, index) => (
            <motion.div
              key={concern.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <InsightCard {...concern} />
            </motion.div>
          ))}
        </div>

        {/* Footer: Hora actual */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-white/50 text-xs text-right"
        >
          Última actualización: {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </motion.div>

      </div>
    </div>
  );
};

export default LuaHero;
