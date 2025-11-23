import React from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle, 
  Brain, 
  Calendar, 
  DollarSign, 
  Phone, 
  MessageSquare, 
  ArrowRight,
  Send,
  XCircle
} from 'lucide-react';

/**
 * LuaAvatar - El "Cerebro" del Dashboard
 * 
 * Versión CORRECTA: Avatar tamaño normal + Mensaje inteligente + Botones mágicos
 * SIN cambios de layout, la magia va por dentro (OpenAI + acciones)
 */
const LuaAvatar = ({ snapshot, onAction, executing }) => {
  const { scenario, lua_message, actions, data } = snapshot || {};

  // Mapeo de escenarios a configuración visual
  const stateConfig = {
    staff_crisis: { 
      color: 'bg-red-100 border-red-500 text-red-700', 
      icon: AlertTriangle, 
      ring: 'ring-red-500', 
      avatarBg: 'from-red-600 via-red-500 to-red-700',
      pulse: true
    },
    no_show_risk: { 
      color: 'bg-orange-100 border-orange-500 text-orange-800', 
      icon: AlertTriangle, 
      ring: 'ring-orange-400', 
      avatarBg: 'from-orange-600 via-orange-500 to-orange-700',
      pulse: true
    },
    dead_slot: { 
      color: 'bg-blue-100 border-blue-500 text-blue-800', 
      icon: Sparkles, 
      ring: 'ring-blue-400', 
      avatarBg: 'from-blue-600 via-blue-500 to-blue-700',
      pulse: false
    },
    pat_on_back: { 
      color: 'bg-green-50 border-green-500 text-green-800', 
      icon: CheckCircle, 
      ring: 'ring-green-400', 
      avatarBg: 'from-green-600 via-green-500 to-green-700',
      pulse: false
    },
    ERROR: { 
      color: 'bg-gray-100 border-gray-500 text-gray-700', 
      icon: AlertTriangle, 
      ring: 'ring-gray-400', 
      avatarBg: 'from-gray-600 via-gray-500 to-gray-700',
      pulse: false
    },
  };

  const current = stateConfig[scenario] || stateConfig.ERROR;
  const Icon = current.icon;

  // Mapeo de iconos para acciones
  const getActionIcon = (actionId) => {
    const iconMap = {
      transfer_appointments: Send,
      cancel_and_reschedule: XCircle,
      call_customer: Phone,
      send_whatsapp: MessageSquare,
      generate_flash_offer: Sparkles,
      view_tomorrow: Calendar,
      view_revenue_breakdown: DollarSign
    };
    const IconComponent = iconMap[actionId] || ArrowRight;
    return <IconComponent size={16} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col sm:flex-row items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100"
    >
      {/* ===================================== */}
      {/* AVATAR TAMAÑO NORMAL (Como original) */}
      {/* ===================================== */}
      <div className="relative flex-shrink-0">
        <motion.div
          className={`w-16 h-16 rounded-full overflow-hidden border-2 p-1 ${current.ring} transition-all duration-500 bg-gradient-to-br ${current.avatarBg} flex items-center justify-center`}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          <img
            src="/lua_avatar.png"
            alt="Lua AI"
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              // Fallback: inicial "L"
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white text-2xl font-bold">L</div>';
            }}
          />
        </motion.div>
        
        {/* Indicador de estado (esquina) */}
        <motion.div
          className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 border shadow-sm"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 15 }}
        >
          <Icon size={16} className={current.ring.replace('ring-', 'text-')} />
        </motion.div>

        {/* Pulso si hay alerta */}
        {current.pulse && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          />
        )}
      </div>

      {/* ===================================== */}
      {/* BOCADILLO INTELIGENTE + BOTONES MÁGICOS */}
      {/* ===================================== */}
      <div className="flex-1 w-full">
        <motion.div
          className={`relative p-4 rounded-2xl rounded-tl-none ${current.color} border transition-colors duration-300`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {/* Mensaje Inteligente (desde OpenAI) */}
          <p className="font-medium text-sm sm:text-base mb-3 leading-relaxed">
            {lua_message || "Analizando el salón..."}
          </p>

          {/* Botones Mágicos (Acciones Contextuales) */}
          {actions && actions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {actions.map((action) => (
                <motion.button
                  key={action.id}
                  onClick={() => onAction(action)}
                  disabled={executing}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg shadow-sm 
                    transition-all hover:shadow-md active:scale-95 disabled:opacity-50
                    ${action.type === 'destructive' 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : action.type === 'safe'
                      ? 'bg-white/80 hover:bg-white text-gray-800 border border-gray-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }
                  `}
                >
                  {getActionIcon(action.id)}
                  <span>{action.label}</span>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LuaAvatar;
