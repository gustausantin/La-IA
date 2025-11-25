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
      borderColor: 'border-l-purple-500',
      iconColor: 'text-purple-500'
    },
    EQUIPO: {
      icon: Users,
      borderColor: 'border-l-blue-500',
      iconColor: 'text-blue-500'
    },
    FACTURACION: {
      icon: DollarSign,
      borderColor: 'border-l-green-500',
      iconColor: 'text-green-500'
    },
    COMUNICACIONES: {
      icon: MessageSquare,
      borderColor: 'border-l-yellow-500',
      iconColor: 'text-yellow-500'
    },
    NOSHOWS: {
      icon: AlertTriangle,
      borderColor: 'border-l-red-500',
      iconColor: 'text-red-500'
    },
    CLIENTES: {
      icon: Star,
      borderColor: 'border-l-pink-500',
      iconColor: 'text-pink-500'
    }
  };

  const config = bloqueConfig[id] || bloqueConfig.RESERVAS;
  const IconComponent = config.icon;

  // Determinar si es urgente (prioridad 1 o 2) - borde más grueso
  const isUrgent = prioridad <= 2;
  const borderWidth = isUrgent ? 'border-l-4' : 'border-l-2';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: prioridad * 0.05 }}
      className="w-full"
    >
      {/* Header del "dossier" - Glassmorphism elegante */}
      <motion.div
        onClick={onToggle}
        whileHover={{ scale: 1.01, x: 3 }}
        whileTap={{ scale: 0.99 }}
        className={`
          bg-white/90 backdrop-blur-md
          ${borderWidth} ${config.borderColor}
          border-t border-r border-b border-gray-200
          cursor-pointer rounded-lg shadow-md hover:shadow-lg 
          transition-all duration-200 p-4
          ${isUrgent ? 'ring-1 ring-yellow-400/50' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
              <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                {titulo || id}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {textoColapsado}
              </p>
            </div>
          </div>
          
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-50 p-1.5 rounded-full border border-gray-200"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </motion.div>
        </div>
      </motion.div>

      {/* Contenido expandido - Glassmorphism más intenso */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className={`
              mt-2 p-4 rounded-lg 
              bg-white/95 backdrop-blur-lg
              ${borderWidth} ${config.borderColor}
              border-t border-r border-b border-gray-300
              shadow-lg
            `}>
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
      return (
        <div className="space-y-3">
          {data?.reservas?.proxima_cita && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-1">📅 Próxima cita</p>
              <p className="text-xs text-gray-600">
                <strong>{data.reservas.proxima_cita.cliente}</strong> - {data.reservas.proxima_cita.hora}
              </p>
              <p className="text-xs text-gray-500">
                En {data.reservas.proxima_cita.minutos_hasta} min • {data.reservas.proxima_cita.servicio}
              </p>
            </div>
          )}
          
          {data?.reservas?.conflictos > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-red-700">
                ⚠️ {data.reservas.conflictos} conflicto(s) detectado(s)
              </p>
            </div>
          )}
          
          {data?.reservas?.huecos_salvables > 0 && (
            <p className="text-xs text-gray-600">
              💡 {data.reservas.huecos_salvables} hueco(s) libre(s) en las próximas 2h
            </p>
          )}
        </div>
      );
    
    case 'EQUIPO':
      return (
        <div className="space-y-3">
          {data?.horarios?.ausentes_hoy?.length > 0 ? (
            data.horarios.ausentes_hoy.map((ausente, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700">👤 {ausente.empleado}</p>
                <p className="text-xs text-gray-600">{ausente.tipo_ausencia}: {ausente.razon}</p>
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ {ausente.citas_afectadas} cita(s) afectada(s)
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-green-600">✅ Todo el equipo disponible hoy</p>
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
      return (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-gray-700">💰 Total hoy</p>
              <p className="text-2xl font-bold text-green-600">
                {data?.facturacion?.total_hoy?.toFixed(2) || 0}€
              </p>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>✅ Completadas: {data?.facturacion?.citas_completadas || 0}</span>
              <span>⏳ Pendientes: {data?.facturacion?.citas_pendientes || 0}</span>
            </div>
          </div>
          
          {data?.facturacion?.promedio_diario > 0 && (
            <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 border border-gray-200">
              <p>📊 Promedio diario: {data.facturacion.promedio_diario.toFixed(2)}€</p>
              <p className={data.facturacion.porcentaje_vs_promedio >= 100 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {data.facturacion.porcentaje_vs_promedio >= 100 ? '📈' : '📉'} {data.facturacion.porcentaje_vs_promedio}% vs promedio
              </p>
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
