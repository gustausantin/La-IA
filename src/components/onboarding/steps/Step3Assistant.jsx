import React, { useState, useRef, useEffect } from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { Bot, Volume2, Play, Pause, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Configuración de voces disponibles
const VOICE_OPTIONS = [
  {
    id: 'female-1',
    gender: 'female',
    display_name: 'Voz Femenina 1',
    description: 'Profesional y cálida',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female%201%20Susi.mp3',
    elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL' // ID de ElevenLabs para producción
  },
  {
    id: 'female-2',
    gender: 'female',
    display_name: 'Voz Femenina 2',
    description: 'Joven y dinámica',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female%202%20Eva.mp3',
    elevenlabs_voice_id: 'ThT5KcBeYPX3keUQqHPh'
  },
  {
    id: 'male-1',
    gender: 'male',
    display_name: 'Voz Masculina 1',
    description: 'Amigable y cercano',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male%201%20Mark.mp3',
    elevenlabs_voice_id: 'TX3LPaxmHKxFdv7VOQHJ'
  },
  {
    id: 'male-2',
    gender: 'male',
    display_name: 'Voz Masculina 2',
    description: 'Seguro y profesional',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male%202%20Viraj.mp3',
    elevenlabs_voice_id: 'pNInz6obpgDQGcFmaJgB'
  }
];

export default function Step3Assistant() {
  const {
    assistantName,
    assistantVoice,
    setAssistantName,
    setAssistantVoice
  } = useOnboardingStore();

  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const audioRef = useRef(null);

  // Si ya hay una voz seleccionada en el store, cargarla
  useEffect(() => {
    if (assistantVoice) {
      const voice = VOICE_OPTIONS.find(v => v.elevenlabs_voice_id === assistantVoice);
      if (voice) {
        setSelectedVoice(voice);
      }
    }
  }, []);

  const handlePlayDemo = async (voice) => {
    try {
      // Si ya está sonando esta voz, pausar
      if (audioRef.current && currentPlayingId === voice.id && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setCurrentPlayingId(null);
        return;
      }

      // Parar audio anterior si existe
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Crear nuevo audio
      audioRef.current = new Audio(voice.audio_url);
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      };

      audioRef.current.onerror = (error) => {
        console.error('Error reproduciendo audio:', error);
        toast.error('No se pudo reproducir el audio. Verifica la configuración.');
        setIsPlaying(false);
        setCurrentPlayingId(null);
      };

      await audioRef.current.play();
      setIsPlaying(true);
      setCurrentPlayingId(voice.id);
      
    } catch (error) {
      console.error('Error playing demo:', error);
      toast.error('No se pudo reproducir la demo');
      setIsPlaying(false);
      setCurrentPlayingId(null);
    }
  };

  const handleSelectVoice = (voice) => {
    // Guardar la voz seleccionada
    setSelectedVoice(voice);
    setAssistantVoice(voice.elevenlabs_voice_id);
    
    // Reproducir automáticamente cuando se selecciona
    handlePlayDemo(voice);
  };

  // Limpiar audio al desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const femaleVoices = VOICE_OPTIONS.filter(v => v.gender === 'female');
  const maleVoices = VOICE_OPTIONS.filter(v => v.gender === 'male');

  return (
    <div>
      {/* Título */}
      <div className="text-center mb-4">
        <div className="inline-flex p-3 bg-purple-100 rounded-full mb-3">
          <Bot className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Elige y prueba tu asistente
        </h2>
        <p className="text-gray-600 text-xs">
          Personaliza la IA y experimenta el momento WOW
        </p>
      </div>

      {/* Nombre del asistente */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Nombre de tu IA
        </label>
        <input
          type="text"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="Ej: Alex, María, David..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
        />
      </div>

      {/* Selector de voces */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Selecciona la voz de tu asistente
        </h3>
        
        {/* Voces Femeninas */}
        <div>
          <p className="text-xs text-gray-600 mb-2 font-medium">Voces Femeninas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {femaleVoices.map((voice) => {
              const isSelected = selectedVoice?.id === voice.id;
              const isCurrentlyPlaying = currentPlayingId === voice.id && isPlaying;
              
              return (
                <button
                  key={voice.id}
                  onClick={() => handleSelectVoice(voice)}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {voice.display_name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{voice.description}</p>
                    </div>
                  </div>
                  
                  {/* Botón de reproducción */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayDemo(voice);
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isCurrentlyPlaying
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {isCurrentlyPlaying ? (
                      <>
                        <Pause className="w-3 h-3" />
                        Reproduciendo...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        Escuchar demo
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
          <p className="text-xs text-gray-600 mb-2 font-medium">Voces Masculinas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {maleVoices.map((voice) => {
              const isSelected = selectedVoice?.id === voice.id;
              const isCurrentlyPlaying = currentPlayingId === voice.id && isPlaying;
              
              return (
                <button
                  key={voice.id}
                  onClick={() => handleSelectVoice(voice)}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {voice.display_name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{voice.description}</p>
                    </div>
                  </div>
                  
                  {/* Botón de reproducción */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayDemo(voice);
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isCurrentlyPlaying
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {isCurrentlyPlaying ? (
                      <>
                        <Pause className="w-3 h-3" />
                        Reproduciendo...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        Escuchar demo
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mensaje de éxito cuando selecciona una voz */}
      {selectedVoice && (
        <div className="mt-4 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-800">
              <span className="font-semibold">¡Perfecto!</span> Has elegido <strong>{selectedVoice.display_name}</strong>. Esta será la voz de tu asistente <strong>{assistantName || 'IA'}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Microcopy informativo */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-gray-700 text-center">
          💡 <strong>Escucha cada voz</strong> y elige la que mejor represente a tu negocio. Esta voz atenderá todas las llamadas de tus clientes.
        </p>
      </div>
    </div>
  );
}
