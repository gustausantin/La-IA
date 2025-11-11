// ====================================
// SELECTOR DE AVATARES PREDEFINIDOS
// Grid visual con preview y configuración
// ====================================

import React, { useState } from 'react';
import { AVATARS_PREDEFINIDOS } from '../../config/avatars';
import { Play, Check, Sparkles, Bot } from 'lucide-react';

export default function AvatarSelector({ 
  selectedAvatarId, 
  onSelectAvatar,
  agentName,
  agentRole,
  agentBio,
  onUpdateName,
  onUpdateRole,
  onUpdateBio
}) {
  const [playingVoice, setPlayingVoice] = useState(null);
  
  const selectedAvatar = AVATARS_PREDEFINIDOS.find(a => a.id === selectedAvatarId) || AVATARS_PREDEFINIDOS[0];

  const handlePlayVoice = (voiceId) => {
    // TODO: Implementar reproducción de audio desde Supabase Storage
    setPlayingVoice(voiceId);
    setTimeout(() => setPlayingVoice(null), 2000);
  };

  return (
    <div className="space-y-4">
      
      {/* HEADER - MÁS COMPACTO */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Elige tu Asistente Virtual
        </h2>
        <p className="text-sm text-gray-600">
          Cada asistente tiene su propia personalidad, voz y estilo
        </p>
      </div>

      {/* GRID DE AVATARES - MÁS COMPACTO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {AVATARS_PREDEFINIDOS.map((avatar) => {
          const isSelected = selectedAvatarId === avatar.id;
          const colorClasses = avatar.color;
          
          return (
            <button
              key={avatar.id}
              onClick={() => onSelectAvatar(avatar.id)}
              className={`relative group cursor-pointer transition-all duration-300 ${
                isSelected ? 'scale-105' : 'hover:scale-105'
              }`}
            >
              {/* Card del avatar */}
              <div className={`relative bg-white rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ${
                isSelected 
                  ? `ring-4 ${colorClasses.border} ring-opacity-60 shadow-2xl` 
                  : 'hover:shadow-xl'
              }`}>
                
                {/* Avatar */}
                <div className={`relative aspect-[3/4] bg-gradient-to-br ${colorClasses.from} ${colorClasses.to} overflow-hidden`}>
                  <img 
                    src={avatar.avatar_url}
                    alt={avatar.name}
                    className="w-full h-full object-cover absolute inset-0"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error(`Error cargando imagen de ${avatar.name}:`, avatar.avatar_url);
                      e.target.style.display = 'none';
                    }}
                  />
                  
                  {/* Fallback cuando la imagen no carga */}
                  <div className="absolute inset-0 flex items-center justify-center text-white z-0">
                    <div className="text-center p-4">
                      <Bot className="w-16 h-16 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-semibold">{avatar.name}</p>
                    </div>
                  </div>
                  
                  {/* Overlay con check si está seleccionado */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl">
                        <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info del avatar - MÁS COMPACTA */}
                <div className={`p-3 ${isSelected ? colorClasses.bg : 'bg-white'}`}>
                  <h3 className="text-base font-bold text-gray-900 mb-0.5">
                    {avatar.name}
                  </h3>
                  
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-gray-600">
                      🎙️ {avatar.voice_label}
                    </span>
                  </div>

                  {/* Botón para escuchar voz - MÁS PEQUEÑO */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayVoice(avatar.voice_id);
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
                      playingVoice === avatar.voice_id
                        ? 'bg-purple-600 text-white'
                        : `bg-gradient-to-r ${colorClasses.from} ${colorClasses.to} text-white hover:opacity-90`
                    }`}
                  >
                    {playingVoice === avatar.voice_id ? (
                      <>
                        <Sparkles className="w-3 h-3 animate-pulse" />
                        <span className="text-xs font-semibold">Reproduciendo...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span className="text-xs font-semibold">Escuchar voz</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* PREVIEW COMPACTO + CONFIGURACIÓN */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        
        {/* Header con color del avatar - MÁS COMPACTO */}
        <div className={`bg-gradient-to-r ${selectedAvatar.color.from} ${selectedAvatar.color.to} p-3 text-white`}>
          <div className="flex items-center gap-3">
            {/* Avatar circular - MÁS PEQUEÑO */}
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-lg bg-white flex-shrink-0 relative">
              <img 
                src={selectedAvatar.avatar_url}
                alt={selectedAvatar.name}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
                onError={(e) => e.target.style.display = 'none'}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Bot className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold">
                Configuración de {selectedAvatar.name}
              </h3>
              <p className="text-white/90 text-xs truncate">
                {selectedAvatar.voice_description}
              </p>
            </div>
          </div>
        </div>

        {/* Configuración editable - MÁS COMPACTA */}
        <div className="p-4 space-y-3">
          
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nombre del Agente
            </label>
            <input
              type="text"
              value={agentName || selectedAvatar.name}
              onChange={(e) => onUpdateName(e.target.value)}
              placeholder={selectedAvatar.name}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
            />
          </div>

          {/* Puesto/Rol */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Puesto / Rol
            </label>
            <input
              type="text"
              value={agentRole || selectedAvatar.default_role}
              onChange={(e) => onUpdateRole(e.target.value)}
              placeholder={selectedAvatar.default_role}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
            />
          </div>

          {/* Descripción/Bio */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Descripción de la Personalidad
            </label>
            <textarea
              value={agentBio || selectedAvatar.default_description}
              onChange={(e) => onUpdateBio(e.target.value)}
              placeholder={selectedAvatar.default_description}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all resize-none"
            />
          </div>

          {/* Info adicional - MÁS COMPACTA */}
          <div className={`${selectedAvatar.color.bg} border ${selectedAvatar.color.border} rounded-lg p-2`}>
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${selectedAvatar.color.text} flex-shrink-0`} />
              <div>
                <p className="text-xs font-semibold text-gray-900">
                  Voz: {selectedAvatar.voice_label}
                </p>
                <p className="text-xs text-gray-600">
                  No se puede cambiar
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}


