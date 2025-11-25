import React from 'react';
import { motion } from 'framer-motion';

/**
 * Avatar SOLO en la zona izquierda
 * Sin bocadillo (se muestra fuera, en la zona derecha)
 */
export default function LuaAvatarLarge({ 
  avatarUrl, 
  agentName = "Lua", 
  mood = "neutral"
}) {
  // Colores según el mood
  const moodConfig = {
    zen: {
      accentColor: 'text-green-700',
    },
    happy: {
      accentColor: 'text-blue-700',
    },
    focused: {
      accentColor: 'text-purple-700',
    },
    serious: {
      accentColor: 'text-orange-700',
    },
    urgent: {
      accentColor: 'text-red-700',
    }
  };

  const config = moodConfig[mood] || moodConfig.zen;

  return (
    <div className="relative h-full overflow-hidden">
      
      {/* CONTENIDO: Solo el nombre del agente abajo */}
      <div className="relative z-10 h-full flex flex-col justify-end pb-8 px-6">
        
        {/* Nombre del agente (badge en la parte inferior) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-block bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border-2 border-gray-200">
            <p className="text-xs text-gray-500 font-medium">Tu Asistente Virtual</p>
            <p className={`text-xl font-bold ${config.accentColor}`}>{agentName}</p>
          </div>
        </motion.div>
      </div>

      {/* Indicador de "en línea" (esquina superior derecha) */}
      <div className="absolute top-6 right-6 z-20">
        <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border-2 border-green-200">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75"></div>
          </div>
          <span className="text-xs font-semibold text-green-700">En línea</span>
        </div>
      </div>
    </div>
  );
}
