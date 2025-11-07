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
  const { user, fetchBusinessInfo } = useAuthContext();
  const {
    businessName,
    assistantName,
    selectedVertical,
    assistantVoice,
    reset: resetOnboarding
  } = useOnboardingStore();

  const [loading, setLoading] = useState(false);

  const handleGoToDashboard = async () => {
    setLoading(true);

    try {
      // Validaciones
      if (!businessName || !selectedVertical?.id || !assistantName || !user?.id) {
        throw new Error('Faltan datos requeridos para crear el negocio');
      }

      const extractVoiceId = (fullId) => {
        if (!fullId) return 'EXAVITQu4vr4xnSDxMaL';
        const parts = fullId.split('_');
        return parts[parts.length - 1];
      };

      const voiceId = extractVoiceId(assistantVoice);

      const payloadLog = {
        businessName,
        vertical: selectedVertical?.id,
        assistantName,
        assistantVoice: voiceId,
        userEmail: user?.email || '',
        userId: user?.id
      };

      console.log('💾 CREANDO BUSINESS vía API interna');
      console.log('📦 Datos preparados:', payloadLog);
      
      const vertical = selectedVertical?.id;
      const userEmail = user?.email || '';
      const userId = user?.id;
      
      // ==========================================
      // 1. PREPARAR PAYLOAD PARA API BACKEND
      // ==========================================
      const businessDataForApi = {
        name: businessName,
        vertical_type: vertical,
        email: userEmail,
        owner_id: userId,
        onboarding_completed: true,
        onboarding_step: 4,
        agent_status: 'OFF',
        copilot_step: 0,
        copilot_completed: false,
        agent_config: {
          assistant_name: assistantName,
          voice_id: voiceId,
          prompt_version: `${vertical}_v1`,
        }
      };
      
      // Defaults para servicios y recursos según vertical
      const defaultServiceMap = {
        fisioterapia: { name: 'Sesión Fisioterapia', duration: 45, price: 40 },
        masajes_osteopatia: { name: 'Masaje Relajante', duration: 60, price: 50 },
        clinica_dental: { name: 'Revisión General', duration: 30, price: 40 },
        psicologia_coaching: { name: 'Primera Sesión', duration: 60, price: 80 },
        centro_estetica: { name: 'Limpieza Facial', duration: 60, price: 45 },
        peluqueria_barberia: { name: 'Corte y Peinado', duration: 30, price: 25 },
        centro_unas: { name: 'Manicura', duration: 30, price: 20 },
        entrenador_personal: { name: 'Sesión Personal', duration: 60, price: 40 },
        yoga_pilates: { name: 'Clase de Yoga', duration: 60, price: 15 },
        veterinario: { name: 'Consulta General', duration: 30, price: 35 },
      };
      
      const defaultResourceMap = {
        fisioterapia: { name: 'Camilla 1', singular: 'camilla' },
        masajes_osteopatia: { name: 'Camilla 1', singular: 'camilla' },
        clinica_dental: { name: 'Sillón 1', singular: 'sillón' },
        psicologia_coaching: { name: 'Despacho 1', singular: 'despacho' },
        centro_estetica: { name: 'Cabina 1', singular: 'cabina' },
        peluqueria_barberia: { name: 'Silla 1', singular: 'silla' },
        centro_unas: { name: 'Puesto 1', singular: 'puesto' },
        entrenador_personal: { name: 'Slot 1', singular: 'slot' },
        yoga_pilates: { name: 'Plaza 1', singular: 'plaza' },
        veterinario: { name: 'Box 1', singular: 'box' },
      };
      
      const defaultService = defaultServiceMap[vertical] || null;
      const defaultResource = defaultResourceMap[vertical] || null;
      
      const apiPayload = {
        businessData: {
          ...businessDataForApi,
          defaultService,
          defaultResource
        },
        userId
      };
      
      // Usar el mismo origen (proxy de Vite redirige /api a backend)
      const API_BASE_URL = '';
      console.log('🌐 Llamando a API interna vía proxy:', `/api/create-business`);
      console.log('📨 Payload API:', apiPayload);
      
      const response = await fetch(`${API_BASE_URL}/api/create-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiPayload)
      });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('❌ Error HTTP al crear negocio:', response.status, errorBody);
        throw new Error(errorBody?.error || 'No se pudo crear el negocio');
      }
      
      const result = await response.json();
      const businessId = result?.business?.id;
      
      if (!businessId) {
        console.error('❌ Respuesta inesperada de la API:', result);
        throw new Error('La API no devolvió un negocio válido');
      }
      
      console.log('✅ Business creado vía API:', businessId);
      
      const data = { success: true, businessId };

      console.log('✅ Business creado:', data);
      toast.success(`¡${businessName} creado con éxito! 🎉`);

      // ✅ SOLUCIÓN AUTOMÁTICA: Recargar la página completa para que cargue el negocio
      console.log('🔄 Recargando aplicación...');
      
      // Limpiar el store de onboarding
      resetOnboarding();
      
      // Esperar un segundo para que Supabase confirme todo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Redirigiendo al dashboard...');
      
      // Forzar recarga COMPLETA de la aplicación
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Error creando el negocio:', error);
      toast.error('Hubo un error al crear tu espacio. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Título Principal */}
      <div className="text-center relative">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-3">
          <CheckCircle2 className="w-8 h-8 text-purple-600" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
          ¡Ya has visto el poder de {assistantName}!
        </h2>
        <p className="text-gray-700 text-sm max-w-md mx-auto leading-relaxed">
          Acabas de crear tu asistente. Ahora, vamos a configurarlo para tu negocio real.{' '}
          <span className="font-bold text-purple-600">Te guiaremos paso a paso.</span>
        </p>
      </div>

      {/* Resumen Visual */}
      <div className="bg-white p-4 border-2 border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600">
            {selectedVertical?.icon && typeof selectedVertical.icon === 'function' ? (
              <selectedVertical.icon className="w-5 h-5 text-white" strokeWidth={2} />
            ) : (
              <Sparkles className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Tu negocio:</p>
            <p className="text-base font-bold text-gray-900">{businessName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
            <span className="text-base">🤖</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Tu asistente:</p>
            <p className="text-sm font-bold text-gray-900">{assistantName}</p>
          </div>
        </div>
      </div>

      {/* Plan de configuración */}
      <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
        <div className="text-center mb-4">
          <h3 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-1">
            TE ESPERAMOS DENTRO
          </h3>
          <p className="text-xs text-gray-600 font-semibold">ESTE ES EL PLAN:</p>
        </div>

        <div className="space-y-3">
          {/* Paso 1: Horarios y Servicios */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 mb-0.5">
                  PASO 1: Configura tus Horarios y Servicios reales
                </p>
                <p className="text-xs text-gray-600">
                  Define cuándo trabajas y qué servicios ofreces
                </p>
              </div>
              <div className="text-xl font-bold text-gray-400">1</div>
            </div>
          </div>

          {/* Paso 2: Recursos */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 mb-0.5">
                  PASO 2: Define tus Recursos
                </p>
                <p className="text-xs text-gray-600">
                  Camillas, sillas, salas... gestionar citas paralelas
                </p>
              </div>
              <div className="text-xl font-bold text-gray-400">2</div>
            </div>
          </div>

          {/* Paso 3: Conexión */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 mb-0.5">
                  PASO 3: Conecta tu línea y Activa tu asistente
                </p>
                <p className="text-xs text-gray-600">
                  Desvío de llamadas y activar {assistantName}
                </p>
              </div>
              <div className="text-xl font-bold text-gray-400">3</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje Motivacional */}
      <div className="p-3.5 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl">
        <div className="flex items-center justify-center gap-2.5">
          <Zap className="w-4 h-4 text-purple-600" />
          <p className="text-sm text-gray-900 text-center font-bold">
            Proceso guiado, tendrás control total
          </p>
          <Zap className="w-4 h-4 text-purple-600" />
        </div>
      </div>

      {/* Botón de Acción */}
      <button
        onClick={handleGoToDashboard}
        disabled={loading}
        className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-base rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Creando tu espacio...</span>
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            <span>¡Vamos a por ello! Ir a mi Panel</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}

