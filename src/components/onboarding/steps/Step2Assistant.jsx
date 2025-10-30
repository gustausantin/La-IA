import React, { useState, useRef, useEffect } from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { Bot, Play, Pause, CheckCircle2 } from 'lucide-react';

/**
 * PASO 2: PERSONALIDAD DEL ASISTENTE (VERSIÓN COMPACTA)
 * - Nombre del asistente
 * - Selección de voz con audio preview
 */

// 4 Voces (2 femeninas + 2 masculinas) - NOMBRES GENÉRICOS
// NOTA: Los nombres de archivo deben coincidir EXACTAMENTE con los de Supabase Storage
const VOICE_OPTIONS = [
  {
    id: 'Female 1 Susi.mp3',
    display_name: 'Femenina 1',
    description: 'Voz cálida y profesional',
    gender: 'female',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female%201%20Susi.mp3'
  },
  {
    id: 'Female 2 Eva.mp3',
    display_name: 'Femenina 2',
    description: 'Voz joven y dinámica',
    gender: 'female',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female%202%20Eva.mp3'
  },
  {
    id: 'Male 1 Mark.mp3',
    display_name: 'Masculina 1',
    description: 'Voz profesional y clara',
    gender: 'male',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male%201%20Mark.mp3'
  },
  {
    id: 'Male 2 Viraj.mp3',
    display_name: 'Masculina 2',
    description: 'Voz energética y cercana',
    gender: 'male',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male%202%20Viraj.mp3'
  }
];

export default function Step2AssistantCompact() {
  const { assistantName, assistantVoice, setAssistantName, setAssistantVoice } = useOnboardingStore();
  
  const [selectedVoice, setSelectedVoice] = useState(
    VOICE_OPTIONS.find(v => v.id === assistantVoice) || null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleSelectVoice = (voice) => {
    setSelectedVoice(voice);
    setAssistantVoice(voice.id);
  };

  const handlePlayDemo = (voice) => {
    if (currentPlayingId === voice.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setCurrentPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    audioRef.current = new Audio(voice.audio_url);
    audioRef.current.play();
    setIsPlaying(true);
    setCurrentPlayingId(voice.id);

    audioRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentPlayingId(null);
    };
  };

  const femaleVoices = VOICE_OPTIONS.filter(v => v.gender === 'female');
  const maleVoices = VOICE_OPTIONS.filter(v => v.gender === 'male');

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="text-center">
        <div className="inline-flex p-2 bg-purple-100 rounded-full mb-2">
          <Bot className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Elige la personalidad de tu asistente
        </h2>
        <p className="text-gray-600 text-xs">
          ¿Cómo quieres que se llame y suene en tu demo?
        </p>
      </div>

      {/* Nombre del asistente */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
          1. Elige un nombre para tu IA:
        </h3>
        <input
          type="text"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="Ej: Laia, Carlos, Ana..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
        />
      </div>

      {/* Selector de voces */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
          2. Elige su voz:
        </h3>
        
        {/* Voces Femeninas */}
        <div>
          <p className="text-[10px] text-gray-600 mb-1.5 font-medium">Voces Femeninas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {femaleVoices.map((voice) => {
              const isSelected = selectedVoice?.id === voice.id;
              const isCurrentlyPlaying = currentPlayingId === voice.id && isPlaying;
              
              return (
                <button
                  key={voice.id}
                  onClick={() => handleSelectVoice(voice)}
                  className={`p-2 border rounded-lg text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 shadow-sm'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-900">
                          {voice.display_name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3 h-3 text-purple-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 mt-0.5">{voice.description}</p>
                    </div>
                  </div>
                  
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayDemo(voice);
                    }}
                    className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      isCurrentlyPlaying
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {isCurrentlyPlaying ? (
                      <>
                        <Pause className="w-2.5 h-2.5" />
                        <span>Reproduciendo...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-2.5 h-2.5" />
                        <span>Escuchar</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voces Masculinas */}
        <div>
          <p className="text-[10px] text-gray-600 mb-1.5 font-medium">Voces Masculinas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {maleVoices.map((voice) => {
              const isSelected = selectedVoice?.id === voice.id;
              const isCurrentlyPlaying = currentPlayingId === voice.id && isPlaying;
              
              return (
                <button
                  key={voice.id}
                  onClick={() => handleSelectVoice(voice)}
                  className={`p-2 border rounded-lg text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 shadow-sm'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-900">
                          {voice.display_name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3 h-3 text-purple-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 mt-0.5">{voice.description}</p>
                    </div>
                  </div>
                  
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayDemo(voice);
                    }}
                    className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      isCurrentlyPlaying
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {isCurrentlyPlaying ? (
                      <>
                        <Pause className="w-2.5 h-2.5" />
                        <span>Reproduciendo...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-2.5 h-2.5" />
                        <span>Escuchar</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {selectedVoice && (
        <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
            <p className="text-[10px] text-green-800 font-medium">
              ¡Perfecto! Voz: <span className="font-bold">{selectedVoice.display_name}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

