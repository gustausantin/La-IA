import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  MessageSquare, 
  AlertTriangle, 
  Star,
  ChevronRight
} from 'lucide-react';

/**
 * Componente "Dossier Profesional" con Glassmorphism
 * Estilo elegante con fondo blanco/gris y bordes de color
 */
export default function BloqueAcordeon({ 
  id, 
  titulo, 
  textoColapsado, 
  prioridad, 
  data, 
  isExpanded = false,
  onToggle 
}) {
  
  // Configuración visual según tipo de bloque
  // SOLO usamos el color para el borde izquierdo, NO para el fondo
  const bloqueConfig = {
    RESERVAS: {
      icon: Calendar,
      borderColor: '#a855f7', // purple-500 MÁS BRILLANTE
      iconColor: 'text-purple-600',
      bgColor: 'rgba(147, 51, 234, 0.06)',
      bgGradient: 'linear-gradient(to right, rgba(168, 85, 247, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%)'
    },
    EQUIPO: {
      icon: Users,
      borderColor: '#3b82f6', // blue-500 MÁS BRILLANTE
      iconColor: 'text-blue-600',
      bgColor: 'rgba(37, 99, 235, 0.06)',
      bgGradient: 'linear-gradient(to right, rgba(59, 130, 246, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%)'
    },
    FACTURACION: {
      icon: DollarSign,
      borderColor: '#22c55e', // green-500 MÁS BRILLANTE
      iconColor: 'text-green-600',
      bgColor: 'rgba(22, 163, 74, 0.06)',
      bgGradient: 'linear-gradient(to right, rgba(34, 197, 94, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%)'
    },
    COMUNICACIONES: {
      icon: MessageSquare,
      borderColor: '#eab308', // yellow-500 MÁS BRILLANTE
      iconColor: 'text-yellow-600',
      bgColor: 'rgba(202, 138, 4, 0.06)',
      bgGradient: 'linear-gradient(to right, rgba(234, 179, 8, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%)'
    },
    NOSHOWS: {
      icon: AlertTriangle,
      borderColor: '#ef4444', // red-500 MÁS BRILLANTE
      iconColor: 'text-red-600',
      bgColor: 'rgba(220, 38, 38, 0.06)',
      bgGradient: 'linear-gradient(to right, rgba(239, 68, 68, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%)'
    },
    CLIENTES: {
      icon: Star,
      borderColor: '#ec4899', // pink-500 MÁS BRILLANTE
      iconColor: 'text-pink-600',
      bgColor: 'rgba(219, 39, 119, 0.06)',
      bgGradient: 'linear-gradient(to right, rgba(236, 72, 153, 0.05) 0%, rgba(255, 255, 255, 0.98) 100%)'
    }
  };

  const config = bloqueConfig[id] || bloqueConfig.RESERVAS;
  const IconComponent = config.icon;

  // Determinar si es urgente (prioridad 1 o 2) - borde más grueso
  const isUrgent = prioridad <= 2;
  const borderWidth = isUrgent ? 'border-l-4' : 'border-l-2';

  // ===== FUNCIÓN CLAVE: Generar el MICRO-DATO visual =====
  const getMicroDato = () => {
    switch(id) {
      case 'RESERVAS':
        const conflictos = data?.reservas?.conflictos || 0;
        const huecos = data?.reservas?.huecos_salvables || 0;
        if (conflictos > 0) {
          return { emoji: '🔴', text: `${conflictos} conflicto${conflictos > 1 ? 's' : ''}`, color: 'bg-red-100 text-red-700 border-red-300' };
        }
        if (huecos > 0) {
          return { emoji: '🟡', text: `${huecos} hueco${huecos > 1 ? 's' : ''} libre${huecos > 1 ? 's' : ''}`, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
        }
        return { emoji: '✅', text: 'Sin conflictos', color: 'bg-green-100 text-green-700 border-green-300' };
      
      case 'EQUIPO':
        const ausentes = data?.horarios?.ausentes_hoy?.length || 0;
        if (ausentes > 0) {
          return { emoji: '⚠️', text: `${ausentes} ausente${ausentes > 1 ? 's' : ''}`, color: 'bg-orange-100 text-orange-700 border-orange-300' };
        }
        return { emoji: '✅', text: 'Todos activos', color: 'bg-green-100 text-green-700 border-green-300' };
      
      case 'FACTURACION':
        const total = data?.facturacion?.total_hoy || 0;
        const promedio = data?.facturacion?.promedio_diario || 0;
        const porcentaje = promedio > 0 ? (total / promedio) * 100 : 100;
        if (total === 0 || porcentaje < 70) {
          return { emoji: '🔴', text: `${total.toFixed(0)}€`, color: 'bg-red-100 text-red-700 border-red-300' };
        }
        if (porcentaje < 90) {
          return { emoji: '🟡', text: `${total.toFixed(0)}€`, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
        }
        return { emoji: '🟢', text: `${total.toFixed(0)}€`, color: 'bg-green-100 text-green-700 border-green-300' };
      
      case 'NOSHOWS':
        const enRiesgo = data?.noshows?.en_riesgo_hoy?.length || 0;
        if (enRiesgo > 0) {
          return { emoji: '🔴', text: `${enRiesgo} riesgo${enRiesgo > 1 ? 's' : ''}`, color: 'bg-red-100 text-red-700 border-red-300' };
        }
        return { emoji: '✅', text: 'Sin riesgos', color: 'bg-green-100 text-green-700 border-green-300' };
      
      case 'COMUNICACIONES':
        const sinLeer = data?.comunicaciones?.mensajes_sin_leer || 0;
        const urgentes = data?.comunicaciones?.incidencias_urgentes?.length || 0;
        if (urgentes > 0) {
          return { emoji: '🔴', text: `${urgentes} incidencia${urgentes > 1 ? 's' : ''}`, color: 'bg-red-100 text-red-700 border-red-300' };
        }
        if (sinLeer > 0) {
          return { emoji: '🟡', text: `${sinLeer} sin leer`, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
        }
        return { emoji: '✅', text: 'Todo leído', color: 'bg-green-100 text-green-700 border-green-300' };
      
      case 'CLIENTES':
        const especiales = data?.clientes?.especiales_hoy?.length || 0;
        if (especiales > 0) {
          return { emoji: '⭐', text: `${especiales} especial${especiales > 1 ? 'es' : ''}`, color: 'bg-purple-100 text-purple-700 border-purple-300' };
        }
        return { emoji: '✅', text: 'Sin VIP hoy', color: 'bg-green-100 text-green-700 border-green-300' };
      
      default:
        return { emoji: '📊', text: 'Ver datos', color: 'bg-gray-100 text-gray-600 border-gray-300' };
    }
  };

  const microDato = getMicroDato();
  
  // Determinar si hay alerta urgente (para fondo rojo suave)
  const tieneAlerta = () => {
    switch(id) {
      case 'RESERVAS':
        return (data?.reservas?.conflictos || 0) > 0;
      case 'EQUIPO':
        return (data?.horarios?.ausentes_hoy?.length || 0) > 0;
      case 'FACTURACION':
        const total = data?.facturacion?.total_hoy || 0;
        return total === 0 || total < 50;
      case 'NOSHOWS':
        return (data?.noshows?.en_riesgo_hoy?.length || 0) > 0;
      case 'COMUNICACIONES':
        return (data?.comunicaciones?.incidencias_urgentes?.length || 0) > 0;
      default:
        return false;
    }
  };
  
  const hayAlerta = tieneAlerta();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: prioridad * 0.05 }}
      className="w-full"
    >
      {/* Header del "dossier" - Con alerta visual si hay problemas */}
      <motion.div
        onClick={onToggle}
        whileHover={{ scale: 1.005, y: -1 }}
        whileTap={{ scale: 0.995 }}
        style={{
          background: hayAlerta 
            ? 'linear-gradient(to right, rgba(254, 202, 202, 0.4) 0%, rgba(255, 255, 255, 0.98) 100%)'
            : config.bgGradient,
          backdropFilter: 'blur(10px)',
          borderLeft: `4px solid ${config.borderColor}`,
          boxShadow: hayAlerta 
            ? '0 2px 8px rgba(239, 68, 68, 0.15)' 
            : '0 1px 3px rgba(0, 0, 0, 0.06)'
        }}
        className={`
          cursor-pointer rounded-lg 
          transition-all duration-200 p-3
          ${hayAlerta ? 'border-2 border-red-200' : 'border border-gray-200/80'}
          ${hayAlerta ? 'ring-1 ring-red-300/50' : isUrgent ? 'ring-1 ring-yellow-400/40' : 'hover:shadow-sm hover:border-gray-300'}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div 
              className="p-2 rounded-lg flex-shrink-0"
              style={{
                background: `${config.bgColor}`,
                border: `1.5px solid ${config.borderColor}30`
              }}
            >
              <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 tracking-tight truncate">
                {titulo || id}
              </p>
              {/* MICRO-DATO: El badge visual que resume el estado */}
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border-2 shadow-sm mt-0.5 ${microDato.color}`}>
                <span className="text-sm leading-none">{microDato.emoji}</span>
                <span className="leading-none">{microDato.text}</span>
              </div>
            </div>
          </div>
          
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.3 }}
            className="p-1.5 rounded-lg bg-white/60 backdrop-blur-sm shadow-sm flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </motion.div>
        </div>
      </motion.div>

      {/* Contenido expandido - Limpio y profesional */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div 
              className="mt-2 p-4 rounded-lg shadow-sm border border-gray-200"
              style={{
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                borderLeft: `3px solid ${config.borderColor}`
              }}
            >
              {renderContenidoExpandido(id, data, config)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Renderiza el contenido detallado según el tipo de bloque
 */
function renderContenidoExpandido(id, data, config) {
  
  switch(id) {
    
    case 'RESERVAS':
      const sinConflictos = !data?.reservas?.conflictos || data.reservas.conflictos === 0;
      const hayHuecos = data?.reservas?.huecos_salvables > 0;
      
      return (
        <div className="space-y-3">
          {/* Semáforo de estado */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-4 h-4 rounded-full ${sinConflictos ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse' : 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse'}`}></div>
            <span className={`text-sm font-bold ${sinConflictos ? 'text-green-700' : 'text-red-700'}`}>
              {sinConflictos ? '✓ Sin conflictos' : `⚠ ${data.reservas.conflictos} conflicto(s)`}
            </span>
            {hayHuecos && (
              <>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
                <span className="text-sm font-bold text-blue-700">
                  {data.reservas.huecos_salvables} hueco(s) libres
                </span>
              </>
            )}
          </div>

          {data?.reservas?.proxima_cita && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border-2 border-purple-200 shadow-md">
              <p className="text-sm font-bold text-purple-700 mb-2">📅 Próxima cita</p>
              <p className="text-base font-black text-gray-900">
                {data.reservas.proxima_cita.cliente}
              </p>
              <p className="text-sm text-gray-700 font-semibold">
                🕐 {data.reservas.proxima_cita.hora} · En {data.reservas.proxima_cita.minutos_hasta} min
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {data.reservas.proxima_cita.servicio}
              </p>
            </div>
          )}
        </div>
      );
    
    case 'EQUIPO':
      const todoEquipoOK = !data?.horarios?.ausentes_hoy || data.horarios.ausentes_hoy.length === 0;
      
      return (
        <div className="space-y-3">
          {/* Semáforo de estado */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-4 h-4 rounded-full ${todoEquipoOK ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse' : 'bg-orange-500 shadow-lg shadow-orange-500/50 animate-pulse'}`}></div>
            <span className={`text-sm font-bold ${todoEquipoOK ? 'text-green-700' : 'text-orange-700'}`}>
              {todoEquipoOK ? '✓ Equipo completo' : `⚠ ${data.horarios.ausentes_hoy.length} ausencia(s)`}
            </span>
          </div>

          {data?.horarios?.ausentes_hoy?.length > 0 ? (
            data.horarios.ausentes_hoy.map((ausente, idx) => (
              <div key={idx} className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border-2 border-orange-200 shadow-md">
                <p className="text-base font-black text-gray-900">👤 {ausente.empleado}</p>
                <p className="text-sm text-gray-700 font-semibold">{ausente.tipo_ausencia}: {ausente.razon}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-bold text-red-700">
                    {ausente.citas_afectadas} cita(s) afectada(s)
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm font-bold text-green-700">Todo el equipo disponible</p>
            </div>
          )}
        </div>
      );
    
    case 'NOSHOWS':
      return (
        <div className="space-y-3">
          {data?.noshows?.en_riesgo_hoy?.length > 0 ? (
            data.noshows.en_riesgo_hoy.map((cliente, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{cliente.cliente}</p>
                    <p className="text-xs text-gray-600">{cliente.hora} • {cliente.servicio}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
                    {cliente.risk_score}%
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 text-xs py-1.5 px-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                    📞 Llamar
                  </button>
                  <button className="flex-1 text-xs py-1.5 px-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                    💬 WhatsApp
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-green-600">✅ No hay clientes en riesgo hoy</p>
          )}
        </div>
      );
    
    case 'FACTURACION':
      const porObjetivo = data?.facturacion?.porcentaje_vs_promedio || 0;
      const enObjetivo = porObjetivo >= 90;
      
      return (
        <div className="space-y-3">
          {/* Semáforo de estado */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-4 h-4 rounded-full ${enObjetivo ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse' : 'bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse'}`}></div>
            <span className={`text-sm font-bold ${enObjetivo ? 'text-green-700' : 'text-yellow-700'}`}>
              {enObjetivo ? '✓ En objetivo' : '⚠ Por debajo del promedio'}
            </span>
          </div>

          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-xl p-5 border-2 border-green-200 shadow-lg">
            <p className="text-sm font-bold text-green-700 mb-2">💰 Facturación hoy</p>
            <p className="text-4xl font-black text-green-600 mb-3">
              {data?.facturacion?.total_hoy?.toFixed(2) || 0}€
            </p>
            <div className="flex gap-4 text-sm">
              <div>
                <div className="w-3 h-3 bg-green-500 rounded-full inline-block mr-1"></div>
                <span className="font-bold text-gray-700">{data?.facturacion?.citas_completadas || 0}</span>
                <span className="text-gray-600"> completadas</span>
              </div>
              <div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full inline-block mr-1"></div>
                <span className="font-bold text-gray-700">{data?.facturacion?.citas_pendientes || 0}</span>
                <span className="text-gray-600"> pendientes</span>
              </div>
            </div>
          </div>
          
          {data?.facturacion?.promedio_diario > 0 && (
            <div className="flex items-center justify-between bg-white/60 rounded-lg p-3 border border-gray-200">
              <span className="text-sm font-semibold text-gray-700">📊 vs Promedio</span>
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${porObjetivo >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {porObjetivo >= 100 ? '📈' : '📉'}
                </span>
                <span className={`text-lg font-black ${porObjetivo >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {porObjetivo}%
                </span>
              </div>
            </div>
          )}
        </div>
      );
    
    case 'CLIENTES':
      return (
        <div className="space-y-3">
          {data?.clientes?.especiales_hoy?.length > 0 ? (
            data.clientes.especiales_hoy.map((cliente, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{cliente.cliente}</p>
                    <p className="text-xs text-gray-600">🕐 {cliente.hora_cita}</p>
                  </div>
                  <span className={`
                    px-2 py-1 text-xs rounded-full font-semibold
                    ${cliente.segmento === 'vip' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${cliente.segmento === 'nuevo' ? 'bg-blue-100 text-blue-700' : ''}
                    ${cliente.segmento === 'en_riesgo' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {cliente.segmento === 'vip' ? '⭐ VIP' : ''}
                    {cliente.segmento === 'nuevo' ? '🆕 NUEVO' : ''}
                    {cliente.segmento === 'en_riesgo' ? '⚠️ RIESGO' : ''}
                  </span>
                </div>
                {cliente.notas && (
                  <p className="text-xs text-gray-500 mt-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                    📝 {cliente.notas}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">Sin clientes especiales hoy</p>
          )}
        </div>
      );
    
    case 'COMUNICACIONES':
      return (
        <div className="space-y-3">
          {data?.comunicaciones?.mensajes_sin_leer > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-blue-700">
                📬 {data.comunicaciones.mensajes_sin_leer} mensaje(s) sin leer
              </p>
            </div>
          )}
          
          {data?.comunicaciones?.incidencias_urgentes?.length > 0 ? (
            data.comunicaciones.incidencias_urgentes.map((inc, idx) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">
                  ⚠️ {inc.customer_phone}
                </p>
                <p className="text-xs text-gray-600">{inc.message_text}</p>
                <p className="text-xs text-gray-500 mt-1">🕐 Hace {inc.hace_horas}h</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-green-600">✅ Sin incidencias urgentes</p>
          )}
        </div>
      );
    
    default:
      return <p className="text-sm text-gray-500">Sin datos disponibles</p>;
  }
}

