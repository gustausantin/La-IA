import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { useAuthContext } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  CheckCircle2, 
  Calendar, 
  Package, 
  Phone, 
  Loader2,
  Sparkles,
  ArrowRight,
  Zap,
  Rocket
} from 'lucide-react';

/**
 * PASO 4: ¡VAMOS A POR ELLO!
 * Capitaliza el WOW y lanza al usuario al dashboard con expectativa correcta
 */
export default function Step4GoToApp() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const {
    businessName,
    assistantName,
    selectedVertical,
    assistantVoice,
    getAllData,
    reset: resetOnboarding
  } = useOnboardingStore();

  const [loading, setLoading] = useState(false);

  const handleGoToDashboard = async () => {
    setLoading(true);

    try {
      // Obtener todos los datos del onboarding
      const onboardingData = getAllData();

      console.log('📦 Payload para complete-onboarding:', {
        businessName,
        vertical: selectedVertical?.id,
        assistantName,
        assistantVoice,
        userEmail: user?.email,
        userId: user?.id
      });

      // Llamar a la Edge Function complete-onboarding
      const { supabase } = await import('../../../lib/supabase');
      
      const { data, error } = await supabase.functions.invoke('complete-onboarding', {
        body: {
          businessName,
          vertical: selectedVertical?.id,
          assistantName,
          assistantVoice,
          userEmail: user?.email,
          userId: user?.id
        }
      });

      if (error) {
        console.error('❌ Error en Edge Function:', error);
        throw error;
      }

      console.log('✅ Business creado:', data);
      toast.success(`¡${businessName} creado con éxito! 🎉`);

      // Limpiar el store de onboarding
      resetOnboarding();

      // Redirigir al dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creando el negocio:', error);
      toast.error('Hubo un error al crear tu espacio. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Título Principal - MÁS IMPACTANTE */}
      <div className="text-center relative">
        {/* Efecto de brillo de fondo */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 via-emerald-400/10 to-green-400/10 blur-3xl -z-10"></div>
        
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 via-emerald-500 to-green-600 rounded-full mb-4 shadow-2xl shadow-green-500/50 animate-pulse">
          <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 mb-2">
          ¡Ya has visto el poder de {assistantName}!
        </h2>
        <p className="text-gray-700 text-sm max-w-md mx-auto leading-relaxed">
          Acabas de crear tu asistente. Ahora, vamos a configurarlo para tu negocio real.{' '}
          <span className="font-bold text-purple-600">Te guiaremos paso a paso.</span>
        </p>
      </div>

      {/* Resumen Visual - REDISEÑADO CON GRADIENTES */}
      <div className="relative p-4 bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-100 border-2 border-purple-300 rounded-2xl shadow-xl overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${selectedVertical?.color || 'from-purple-500 to-blue-500'} shadow-lg`}>
              {selectedVertical?.icon && typeof selectedVertical.icon === 'function' ? (
                <selectedVertical.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
              ) : (
                <Sparkles className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <p className="text-xs text-purple-700 font-bold uppercase tracking-wide">Tu negocio:</p>
              <p className="text-base font-black text-gray-900">{businessName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3 border-t-2 border-purple-200">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <p className="text-xs text-purple-700 font-bold uppercase tracking-wide">Tu asistente:</p>
              <p className="text-sm font-black text-gray-900">{assistantName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Teaser del Copilot - REDISEÑADO CON IMPACTO */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border-2 border-gray-300 shadow-lg">
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 mb-2">
            <Rocket className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              TE ESPERAMOS DENTRO
            </h3>
            <Rocket className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xs text-gray-700 font-semibold">ESTE ES EL PLAN:</p>
        </div>

        <div className="space-y-3">
          {/* Paso 1: Horarios y Servicios - CON GRADIENTE */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-3 hover:shadow-lg transition-all cursor-pointer">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-400/20 to-purple-600/20 rounded-full blur-xl"></div>
            <div className="relative flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900 mb-1">
                  PASO 1: Configura tus Horarios y Servicios reales
                </p>
                <p className="text-xs text-gray-700">
                  Define cuándo trabajas y qué servicios ofreces
                </p>
              </div>
              <div className="text-2xl font-black text-purple-600">1</div>
            </div>
          </div>

          {/* Paso 2: Recursos - CON GRADIENTE */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-3 hover:shadow-lg transition-all cursor-pointer">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-blue-600/20 rounded-full blur-xl"></div>
            <div className="relative flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900 mb-1">
                  PASO 2: Define tus Recursos
                </p>
                <p className="text-xs text-gray-700">
                  Camillas, sillas, salas... gestionar citas paralelas
                </p>
              </div>
              <div className="text-2xl font-black text-blue-600">2</div>
            </div>
          </div>

          {/* Paso 3: Conexión - CON GRADIENTE */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-300 rounded-xl p-3 hover:shadow-lg transition-all cursor-pointer">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-400/20 to-emerald-600/20 rounded-full blur-xl"></div>
            <div className="relative flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Phone className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900 mb-1">
                  PASO 3: Conecta tu línea y Activa tu asistente
                </p>
                <p className="text-xs text-gray-700">
                  Desvío de llamadas y activar {assistantName}
                </p>
              </div>
              <div className="text-2xl font-black text-green-600">3</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje Motivacional - Punto medio perfecto */}
      <div className="relative overflow-hidden p-3.5 bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 border-2 border-orange-400 rounded-xl shadow-lg">
        <div className="absolute top-0 left-0 w-24 h-24 bg-orange-300/20 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-amber-300/20 rounded-full blur-2xl"></div>
        <div className="relative flex items-center justify-center gap-2.5">
          <Zap className="w-5 h-5 text-orange-600" />
          <p className="text-base text-gray-900 text-center font-bold">
            Proceso guiado, tendrás control total
          </p>
          <Zap className="w-5 h-5 text-orange-600" />
        </div>
      </div>

      {/* Botón de Acción - REDISEÑADO MÁS GRANDE E IMPACTANTE */}
      <button
        onClick={handleGoToDashboard}
        disabled={loading}
        className="relative w-full px-6 py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white font-black text-base rounded-xl hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl shadow-purple-500/50 hover:shadow-purple-600/60 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group overflow-hidden"
      >
        {/* Efecto de brillo animado */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer"></div>
        
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Creando tu espacio...</span>
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span>¡Vamos a por ello! Ir a mi Panel</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </>
        )}
      </button>
    </div>
  );
}

