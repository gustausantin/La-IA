import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Heart, Sparkles, Scissors, Dumbbell, Flower2, 
  Stethoscope, Brain, PawPrint, Activity, User, LogOut
} from 'lucide-react';

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
  const [selectedVertical, setSelectedVertical] = useState(null);
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

  const selectVertical = (verticalId) => {
    const vertical = VERTICALS.find(v => v.id === verticalId);
    setSelectedVertical(vertical);
    setBusinessData({
      ...businessData,
      vertical: verticalId,
      services: vertical.defaultServices,
      resources: vertical.defaultResources
    });
    setStep(2);
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
      
      console.log('✅ Usuario:', user.id);

      // 1. CREAR NEGOCIO DIRECTAMENTE EN SUPABASE
      const businessPayload = {
        name: businessData.name,
        vertical_type: businessData.vertical,
        phone: businessData.phone,
        email: businessData.email || user.email,
        address: businessData.address,
        city: businessData.city,
        postal_code: businessData.postalCode,
        active: true,
        settings: {
          schedule: {
            monday: { open: '09:00', close: '20:00', closed: false },
            tuesday: { open: '09:00', close: '20:00', closed: false },
            wednesday: { open: '09:00', close: '20:00', closed: false },
            thursday: { open: '09:00', close: '20:00', closed: false },
            friday: { open: '09:00', close: '20:00', closed: false },
            saturday: { open: '10:00', close: '14:00', closed: false },
            sunday: { open: '00:00', close: '00:00', closed: true }
          }
        }
      };

      console.log('📤 Insertando negocio...');
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert([businessPayload])
        .select()
        .single();

      if (businessError) {
        console.error('❌ Error creando negocio:', businessError);
        throw businessError;
      }

      console.log('✅ Negocio creado:', business.id);

      // 2. CREAR MAPPING
      console.log('📤 Creando mapping...');
      const { error: mappingError } = await supabase
        .from('user_business_mapping')
        .insert([{
          auth_user_id: user.id,
          business_id: business.id,
          role: 'owner',
          active: true
        }]);

      if (mappingError) {
        console.error('❌ Error creando mapping:', mappingError);
        throw mappingError;
      }

      console.log('✅ Mapping creado');

      // 3. CREAR SERVICIOS
      if (businessData.services.length > 0) {
        console.log('📤 Creando servicios...');
        const servicesData = businessData.services.map((serviceName, index) => ({
          business_id: business.id,
          name: serviceName,
          duration_minutes: 60,
          price: 0,
          is_available: true,
          display_order: index + 1
        }));

        const { error: servicesError } = await supabase
          .from('services')
          .insert(servicesData);

        if (servicesError) {
          console.warn('⚠️ Error creando servicios:', servicesError);
        } else {
          console.log('✅ Servicios creados');
        }
      }

      // 4. CREAR RECURSOS
      if (businessData.resources.length > 0) {
        console.log('📤 Creando recursos...');
        const resourcesData = businessData.resources.map((resourceName, index) => ({
          business_id: business.id,
          name: resourceName,
          type: 'room',
          capacity: 1,
          is_active: true,
          display_order: index + 1
        }));

        const { error: resourcesError } = await supabase
          .from('resources')
          .insert(resourcesData);

        if (resourcesError) {
          console.warn('⚠️ Error creando recursos:', resourcesError);
        } else {
          console.log('✅ Recursos creados');
        }
      }

      console.log('🎉 NEGOCIO CREADO EXITOSAMENTE');
      toast.success('¡Negocio creado exitosamente!');
      
      // 5. Recargar contexto y redirigir
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Botón de Logout */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ¡Bienvenido a La-IA! 🎉
          </h1>
          <p className="text-gray-600">
            Configuremos tu negocio en 3 simples pasos
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-purple-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-4 text-sm text-gray-600">
            <span>Tipo de negocio</span>
            <span>Información</span>
            <span>Confirmar</span>
          </div>
        </div>

        {/* Contenido según paso */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                ¿Qué tipo de negocio tienes?
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {VERTICALS.map((vertical) => {
                  const Icon = vertical.icon;
                  return (
                    <button
                      key={vertical.id}
                      onClick={() => selectVertical(vertical.id)}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all group"
                    >
                      <div className={`${vertical.color} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 text-center">
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Información de tu {selectedVertical?.name}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del negocio *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessData.name}
                    onChange={(e) => setBusinessData({...businessData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ej: Centro de Fisioterapia López"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      required
                      value={businessData.phone}
                      onChange={(e) => setBusinessData({...businessData, phone: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="+34 600 000 000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={businessData.email}
                      onChange={(e) => setBusinessData({...businessData, email: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="contacto@tunegocio.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessData.address}
                    onChange={(e) => setBusinessData({...businessData, address: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Calle Principal 123"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ciudad *
                    </label>
                    <input
                      type="text"
                      required
                      value={businessData.city}
                      onChange={(e) => setBusinessData({...businessData, city: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Madrid"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código Postal *
                    </label>
                    <input
                      type="text"
                      required
                      value={businessData.postalCode}
                      onChange={(e) => setBusinessData({...businessData, postalCode: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="28001"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium"
                >
                  Continuar
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Confirma tu configuración
              </h2>
              
              <div className="space-y-6">
                {/* Resumen del negocio */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Información del negocio</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Tipo:</span> <span className="font-medium">{selectedVertical?.name}</span></p>
                    <p><span className="text-gray-600">Nombre:</span> <span className="font-medium">{businessData.name}</span></p>
                    <p><span className="text-gray-600">Teléfono:</span> <span className="font-medium">{businessData.phone}</span></p>
                    <p><span className="text-gray-600">Dirección:</span> <span className="font-medium">{businessData.address}, {businessData.city} ({businessData.postalCode})</span></p>
                  </div>
                </div>

                {/* Servicios */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Servicios iniciales ({businessData.services.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {businessData.services.map((service, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                        {service}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Podrás agregar más servicios después</p>
                </div>

                {/* Recursos */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Recursos iniciales ({businessData.resources.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {businessData.resources.map((resource, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {resource}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Podrás agregar más recursos después</p>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
                >
                  Atrás
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creando...
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


