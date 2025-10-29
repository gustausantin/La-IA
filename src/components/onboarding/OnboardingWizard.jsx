import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Heart, Sparkles, Scissors, Dumbbell, Flower2, 
  Stethoscope, Brain, PawPrint, Activity, User, LogOut
} from 'lucide-react';
import { getVerticalOnboardingConfig, createBusinessWithOnboarding } from '../../services/onboardingService';

// 🔟 Verticales para autónomos profesionales
const VERTICALS = [
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    icon: Activity,
    color: 'bg-blue-500',
    description: 'Sesiones de fisioterapia y rehabilitación',
    defaultServices: ['Sesión individual', 'Masaje deportivo', 'Rehabilitación'],
    defaultResources: ['Camilla 1', 'Camilla 2', 'Sala grupal']
  },
  {
    id: 'masajes_osteopatia',
    name: 'Masajes / Osteopatía',
    icon: Sparkles,
    color: 'bg-purple-500',
    description: 'Masajes terapéuticos y osteopatía',
    defaultServices: ['Masaje relajante', 'Osteopatía', 'Masaje deportivo'],
    defaultResources: ['Camilla 1', 'Camilla 2']
  },
  {
    id: 'clinica_dental',
    name: 'Clínica Dental',
    icon: User,
    color: 'bg-cyan-500',
    description: 'Servicios odontológicos',
    defaultServices: ['Limpieza dental', 'Revisión', 'Empaste', 'Ortodoncia'],
    defaultResources: ['Sillón 1', 'Sillón 2', 'Sala rayos X']
  },
  {
    id: 'psicologia_coaching',
    name: 'Psicología / Coaching',
    icon: Brain,
    color: 'bg-indigo-500',
    description: 'Terapia psicológica y coaching',
    defaultServices: ['Sesión individual', 'Terapia de pareja', 'Coaching'],
    defaultResources: ['Consulta 1', 'Consulta 2']
  },
  {
    id: 'centro_estetica',
    name: 'Centro de Estética',
    icon: Flower2,
    color: 'bg-pink-500',
    description: 'Tratamientos estéticos y belleza',
    defaultServices: ['Limpieza facial', 'Depilación', 'Tratamiento corporal'],
    defaultResources: ['Cabina 1', 'Cabina 2']
  },
  {
    id: 'peluqueria_barberia',
    name: 'Peluquería / Barbería',
    icon: Scissors,
    color: 'bg-orange-500',
    description: 'Cortes y peinados',
    defaultServices: ['Corte', 'Tinte', 'Barba', 'Peinado'],
    defaultResources: ['Sillón 1', 'Sillón 2', 'Sillón 3']
  },
  {
    id: 'centro_unas',
    name: 'Centro de Uñas',
    icon: Heart,
    color: 'bg-red-500',
    description: 'Manicura y pedicura',
    defaultServices: ['Manicura', 'Pedicura', 'Uñas acrílicas'],
    defaultResources: ['Mesa 1', 'Mesa 2']
  },
  {
    id: 'entrenador_personal',
    name: 'Entrenador Personal',
    icon: Dumbbell,
    color: 'bg-green-500',
    description: 'Entrenamiento personalizado',
    defaultServices: ['Sesión 1 hora', 'Sesión 30 min', 'Plan mensual'],
    defaultResources: ['Zona funcional', 'Zona cardio']
  },
  {
    id: 'yoga_pilates',
    name: 'Yoga / Pilates',
    icon: Activity,
    color: 'bg-teal-500',
    description: 'Clases de yoga y pilates',
    defaultServices: ['Clase grupal', 'Clase privada', 'Paquete 10 clases'],
    defaultResources: ['Sala principal', 'Sala privada']
  },
  {
    id: 'veterinario',
    name: 'Veterinario',
    icon: PawPrint,
    color: 'bg-amber-500',
    description: 'Cuidado veterinario',
    defaultServices: ['Consulta general', 'Vacunación', 'Cirugía'],
    defaultResources: ['Consulta 1', 'Quirófano']
  }
];

export default function OnboardingWizard({ onComplete }) {
  const navigate = useNavigate();
  const { user, fetchBusinessInfo } = useAuthContext();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [selectedVertical, setSelectedVertical] = useState(null);
  const [verticalConfig, setVerticalConfig] = useState(null);
  const [businessData, setBusinessData] = useState({
    name: '',
    phone: '',
    email: user?.email || '',
    address: '',
    city: '',
    postalCode: '',
    vertical: '',
    services: [],
    resources: []
  });

  const selectVertical = async (verticalId) => {
    const vertical = VERTICALS.find(v => v.id === verticalId);
    setSelectedVertical(vertical);
    setLoadingConfig(true);
    
    try {
      // Obtener configuración dinámica desde Supabase
      const { success, config, error } = await getVerticalOnboardingConfig(verticalId);
      
      if (success && config) {
        setVerticalConfig(config);
        
        // Usar servicios sugeridos de la base de datos
        const suggestedServiceNames = config.suggestedServices
          .filter(s => s.is_popular) // Solo los populares por defecto
          .slice(0, 3) // Máximo 3
          .map(s => ({
            name: s.name,
            duration_minutes: s.duration_minutes,
            suggested_price: s.suggested_price
          }));
        
        // Generar nombres de recursos por defecto
        const resourceCount = vertical.defaultResources.length;
        const defaultResources = Array.from({ length: resourceCount }, (_, i) => 
          `${config.resourceNameSingular} ${i + 1}`
        );
        
        setBusinessData({
          ...businessData,
          vertical: verticalId,
          services: suggestedServiceNames.length > 0 ? suggestedServiceNames : vertical.defaultServices,
          resources: defaultResources
        });
      } else {
        // Fallback a configuración estática
        console.warn('⚠️ Usando configuración estática como fallback:', error);
        setBusinessData({
          ...businessData,
          vertical: verticalId,
          services: vertical.defaultServices,
          resources: vertical.defaultResources
        });
      }
      
      setStep(2);
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      toast.error('Error al cargar la configuración. Usando valores por defecto.');
      
      // Fallback
      setBusinessData({
        ...businessData,
        vertical: verticalId,
        services: vertical.defaultServices,
        resources: vertical.defaultResources
      });
      setStep(2);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleBusinessInfo = (e) => {
    e.preventDefault();
    setStep(3);
  };

  const handleComplete = async () => {
    setLoading(true);
    console.log('🟢 INICIANDO CREACIÓN DE NEGOCIO');
    
    try {
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }
      
      // Usar el servicio centralizado para crear el negocio
      const { success, business } = await createBusinessWithOnboarding(businessData, verticalConfig);
      
      if (!success || !business) {
        throw new Error('No se pudo crear el negocio');
      }

      console.log('🎉 NEGOCIO CREADO EXITOSAMENTE');
      toast.success('¡Negocio creado exitosamente!');
      
      // Recargar contexto y redirigir
      await fetchBusinessInfo(user.id, true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error) {
      console.error('💥 ERROR FATAL:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="max-w-4xl w-full">
        {/* Botón de Logout */}
        <div className="flex justify-end mb-2 sm:mb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all"
          >
            <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
        
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6 md:mb-8 px-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            ¡Bienvenido a La-IA! 🎉
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Configuremos tu negocio en 3 simples pasos
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-4 sm:mb-6 md:mb-8 px-2">
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base ${
                  step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-8 sm:w-12 md:w-16 h-1 ${step > s ? 'bg-purple-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-600">
            <span className="text-center flex-1">Tipo</span>
            <span className="text-center flex-1">Información</span>
            <span className="text-center flex-1">Confirmar</span>
          </div>
        </div>

        {/* Contenido según paso */}
        <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8">
          {loadingConfig && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm sm:text-base text-gray-600">Cargando configuración...</p>
            </div>
          )}

          {!loadingConfig && step === 1 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
                ¿Qué tipo de negocio tienes?
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {VERTICALS.map((vertical) => {
                  const Icon = vertical.icon;
                  return (
                    <button
                      key={vertical.id}
                      onClick={() => selectVertical(vertical.id)}
                      disabled={loadingConfig}
                      className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      <div className={`${vertical.color} p-2 sm:p-3 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-gray-900 text-center leading-tight">
                        {vertical.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleBusinessInfo}>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                Información de tu {selectedVertical?.name}
              </h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Nombre del negocio *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessData.name}
                    onChange={(e) => setBusinessData({...businessData, name: e.target.value})}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ej: Centro de Fisioterapia López"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      required
                      value={businessData.phone}
                      onChange={(e) => setBusinessData({...businessData, phone: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="+34 600 000 000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={businessData.email}
                      onChange={(e) => setBusinessData({...businessData, email: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="contacto@tunegocio.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Dirección *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessData.address}
                    onChange={(e) => setBusinessData({...businessData, address: e.target.value})}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Calle Principal 123"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Ciudad *
                    </label>
                    <input
                      type="text"
                      required
                      value={businessData.city}
                      onChange={(e) => setBusinessData({...businessData, city: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Madrid"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Código Postal *
                    </label>
                    <input
                      type="text"
                      required
                      value={businessData.postalCode}
                      onChange={(e) => setBusinessData({...businessData, postalCode: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="28001"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 font-medium active:scale-95 transition-transform"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-lg hover:bg-purple-700 font-medium active:scale-95 transition-transform"
                >
                  Continuar
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                Confirma tu configuración
              </h2>
              
              <div className="space-y-4 sm:space-y-6">
                {/* Resumen del negocio */}
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">Información del negocio</h3>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <p><span className="text-gray-600">Tipo:</span> <span className="font-medium">{selectedVertical?.name}</span></p>
                    <p><span className="text-gray-600">Nombre:</span> <span className="font-medium">{businessData.name}</span></p>
                    <p><span className="text-gray-600">Teléfono:</span> <span className="font-medium">{businessData.phone}</span></p>
                    <p className="break-words"><span className="text-gray-600">Dirección:</span> <span className="font-medium">{businessData.address}, {businessData.city} ({businessData.postalCode})</span></p>
                  </div>
                </div>

                {/* Servicios */}
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">Servicios iniciales ({businessData.services.length})</h3>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {businessData.services.map((service, idx) => (
                      <span key={idx} className="px-2 sm:px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs sm:text-sm">
                        {service.name || service}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Podrás agregar más servicios después</p>
                </div>

                {/* Recursos */}
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">
                    {verticalConfig?.resourceNamePlural || 'Recursos'} iniciales ({businessData.resources.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {businessData.resources.map((resource, idx) => (
                      <span key={idx} className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm">
                        {resource}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Podrás agregar más {verticalConfig?.resourceNamePlural?.toLowerCase() || 'recursos'} después
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 active:scale-95 transition-transform"
                >
                  Atrás
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    '¡Crear mi negocio!'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


