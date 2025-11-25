import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Avatar GIGANTE como fondo de toda la zona izquierda
 * La imagen ocupa el 100% de la altura (full-screen)
 * El bocadillo flota sobre la imagen
 */
export default function LuaAvatarLarge({ 
  avatarUrl, 
  agentName = "Lua", 
  mensaje, 
  accion, 
  mood = "neutral",
  onActionClick 
}) {
  const [isTyping, setIsTyping] = useState(true);

  // Convertir avatar URL al formato "working mode" (Avatar_X.png -> Avatar_X.1.png)
  const getWorkingModeAvatar = (url) => {
    if (!url) return null;
    
    // Si ya es un avatar working mode (_X.1.png), devolverlo tal cual
    if (url.includes('_') && url.includes('.1.png')) {
      return url;
    }
    
    // Convertir Avatar_1.png a Avatar_1.1.png
    const match = url.match(/Avatar_(\d+)\.png/);
    if (match) {
      const number = match[1];
      return url.replace(`Avatar_${number}.png`, `Avatar_${number}.1.png`);
    }
    
    return url;
  };

  const workingModeUrl = getWorkingModeAvatar(avatarUrl);

  // Simular el efecto "escribiendo..." durante 2 segundos
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [mensaje]);

  // Colores según el mood
  const moodConfig = {
    zen: {
      bubbleBg: 'bg-white/95',
      borderColor: 'border-green-300',
      accentColor: 'text-green-700',
      buttonBg: 'bg-green-500 hover:bg-green-600'
    },
    happy: {
      bubbleBg: 'bg-white/95',
      borderColor: 'border-blue-300',
      accentColor: 'text-blue-700',
      buttonBg: 'bg-blue-500 hover:bg-blue-600'
    },
    focused: {
      bubbleBg: 'bg-white/95',
      borderColor: 'border-purple-300',
      accentColor: 'text-purple-700',
      buttonBg: 'bg-purple-500 hover:bg-purple-600'
    },
    serious: {
      bubbleBg: 'bg-white/95',
      borderColor: 'border-orange-300',
      accentColor: 'text-orange-700',
      buttonBg: 'bg-orange-500 hover:bg-orange-600'
    },
    urgent: {
      bubbleBg: 'bg-white/95',
      borderColor: 'border-red-400',
      accentColor: 'text-red-700',
      buttonBg: 'bg-red-500 hover:bg-red-600'
    }
  };

  const config = moodConfig[mood] || moodConfig.zen;

  return (
    <div className="relative h-full min-h-screen overflow-hidden">
      
      {/* FONDO: Imagen del avatar GIGANTE (ocupa toda la zona izquierda) */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: workingModeUrl ? `url(${workingModeUrl})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Overlay sutil para mejorar legibilidad del bocadillo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
      </div>

      {/* CONTENIDO: Bocadillo flotante + Nombre del agente */}
      <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-8 pb-12">
        
        {/* Bocadillo de texto (Speech Bubble) flotante */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6, type: "spring" }}
          className="w-full max-w-lg mx-auto mb-6"
        >
          {/* Punta del bocadillo (triángulo) */}
          <div className="relative">
            <div className="absolute -bottom-3 left-12 w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[20px] border-t-white/95"></div>
          </div>

          {/* Contenido del bocadillo con glassmorphism */}
          <div className={`
            ${config.bubbleBg} ${config.borderColor} 
            backdrop-blur-md border-2 rounded-3xl shadow-2xl p-6
          `}>
            
            {/* Animación de "escribiendo..." */}
            {isTyping ? (
              <div className="flex items-center justify-center space-x-2 py-4">
                <motion.div
                  className="w-3 h-3 bg-gray-400 rounded-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                />
                <motion.div
                  className="w-3 h-3 bg-gray-400 rounded-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                />
                <motion.div
                  className="w-3 h-3 bg-gray-400 rounded-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <p className={`text-base md:text-lg font-medium ${config.accentColor} leading-relaxed`}>
                  {mensaje}
                </p>
              </motion.div>
            )}

            {/* Botón de acción principal */}
            {accion && !isTyping && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onActionClick(accion)}
                className={`
                  mt-4 w-full py-3 px-6 rounded-xl font-semibold text-white
                  ${config.buttonBg}
                  shadow-lg transition-all duration-200
                `}
              >
                {accion.label || 'Acción'}
              </motion.button>
            )}
          </div>
        </motion.div>

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
