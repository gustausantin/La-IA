import { useState, useEffect } from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { DEMO_PACKAGES } from '../../../config/demoPackages';
import { createDemoSession } from '../../../services/demoService';
import { 
  Sparkles, 
  Lock, 
  CheckCircle2, 
  Phone, 
  MessageSquare,
  Clock,
  MapPin,
  HelpCircle,
  List,
  Loader2,
  Lightbulb,
  Rocket,
  Calendar,
  Settings,
  Shield,
  Users,
  Gift,
  ShoppingBag,
  Star,
  Percent,
  Activity,
  UserCheck,
  Heart,
  Building2
} from 'lucide-react';

/**
 * PASO 3: DEMO INTERACTIVA
 * Diseño profesional coherente con el resto de LA-IA
 */

export default function Step3DemoInteractiva() {
  const { 
    selectedVertical,
    businessName, 
    assistantName, 
    assistantVoice,
    whatsappNumber,
    setDemoConfig,
    setCurrentStep
  } = useOnboardingStore();

  // Extraer el ID del vertical
  const vertical = selectedVertical?.id;

  // Estado local
  const [selectedService, setSelectedService] = useState(null);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [demoActivated, setDemoActivated] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [demoPhoneNumber, setDemoPhoneNumber] = useState(null);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Cargar el paquete de demo según el vertical
  const demoPackage = DEMO_PACKAGES[vertical] || DEMO_PACKAGES.fisioterapia;

  // Debug: Mostrar el vertical actual
  useEffect(() => {
    console.log('🎯 Step3DemoInteractiva - Vertical actual:', vertical);
    console.log('📦 Demo package cargado:', demoPackage);
  }, [vertical, demoPackage]);

  // Inicializar servicio por defecto (se actualiza si cambia el vertical)
  useEffect(() => {
    if (demoPackage.services.length > 0) {
      setSelectedService(demoPackage.services[0]);
    }
  }, [vertical, demoPackage]);

  // Generar slots de tiempo (3 días)
  const generateTimeSlots = () => {
    const days = ['Lun', 'Mar', 'Mié'];
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00'];
    return { days, hours };
  };

  const { days, hours } = generateTimeSlots();

  // Toggle slot ocupado
  const toggleSlot = (day, hour) => {
    if (demoActivated) return;
    
    const slotKey = `${day}-${hour}`;
    setBlockedSlots(prev => 
      prev.includes(slotKey) 
        ? prev.filter(s => s !== slotKey)
        : [...prev, slotKey]
    );
  };

  // Activar demo (MODO VISUAL - SIN WEBHOOK)
  const handleActivateDemo = async () => {
    setIsActivating(true);
    
    // Simular un pequeño delay para feedback visual
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // TODO: Cuando esté listo el backend, descomentar esta línea y comentar el código de simulación
    /*
    try {
      const response = await createDemoSession({
        vertical,
        businessName,
        assistantName,
        assistantVoice,
        selectedService: {
          name: selectedService.name,
          duration: selectedService.duration,
          price: selectedService.price
        },
        blockedSlots: blockedSlots.map(slot => {
          const [day, hour] = slot.split('-');
          return { day, hour };
        }),
        whatsappNumber
      });

      if (response.success) {
        setDemoPhoneNumber(response.demoPhoneNumber);
        setDemoActivated(true);
        setDemoConfig({
          phoneNumber: response.demoPhoneNumber,
          service: selectedService.name,
          blockedCount: blockedSlots.length
        });
      }
    } catch (error) {
      console.error('Error activando demo:', error);
      alert('Error al activar la demo. Por favor, intenta de nuevo.');
    }
    */
    
    // SIMULACIÓN TEMPORAL (sin backend)
    const mockPhoneNumber = '+34 912 345 678';
    setDemoPhoneNumber(mockPhoneNumber);
    setDemoActivated(true);
    setDemoConfig({
      phoneNumber: mockPhoneNumber,
      service: selectedService.name,
      blockedCount: blockedSlots.length
    });
    
    setIsActivating(false);
  };

  // Función para omitir la demo (navegación al Paso 4)
  const handleSkipDemo = () => {
    // Aquí NO llamamos al backend, solo navegamos al siguiente paso
    // El backend se llamará en el Paso 4 cuando el usuario pulse "Ir a mi Panel"
    setCurrentStep(4);
  };

  return (
    <div className="space-y-4 relative">
      {/* Header con el estilo de LA-IA */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          ¡A probar! Reta a {assistantName}
        </h2>
        <p className="text-xs text-gray-600">
          Descubre cómo <span className="font-semibold text-purple-600">{assistantName}</span> transformará tu negocio
        </p>
      </div>

      {/* Instrucciones (3 pasos) - COPY MEJORADO */}
      <div className="grid grid-cols-3 gap-2 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-3 rounded-xl border border-purple-200/50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold rounded-full mb-1">1</div>
          <p className="text-xs text-gray-700 font-semibold">Tu Escenario</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Prepara tu prueba</p>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold rounded-full mb-1">2</div>
          <p className="text-xs text-gray-700 font-semibold">Activar IA</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Desbloquea la demo</p>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold rounded-full mb-1">3</div>
          <p className="text-xs text-gray-700 font-semibold">¡A Interactuar!</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Llama y pregunta</p>
        </div>
      </div>

      {/* Dos Paneles */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* PANEL IZQUIERDO: Configuración */}
        <div className={`lg:col-span-3 space-y-3 transition-opacity ${demoActivated ? 'opacity-60 pointer-events-none' : ''}`}>
          {/* Status Badge - SOLO cuando NO está activado (el verde va solo al panel derecho) */}
          {!demoActivated && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold w-fit ${
              blockedSlots.length > 0 
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
              {blockedSlots.length > 0 ? (
                <>
                  <Settings className="w-3.5 h-3.5 animate-spin" />
                  <span>{blockedSlots.length} horarios bloqueados. ¡Casi listo!</span>
                </>
              ) : (
                <>
                  <Settings className="w-3.5 h-3.5" />
                  <span>¡Manos a la obra! Configura tu demo</span>
                </>
              )}
            </div>
          )}

          {/* SECCIÓN 1: Selector de Servicio - COPY MEJORADO */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-900 mb-1">
              <List className="w-4 h-4 text-purple-600" />
              1. Elige tu servicio clave
            </label>
            <p className="text-[10px] text-gray-500 mb-2 ml-6">
              Con este servicio pondrás a {assistantName} a trabajar
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoPackage.services.map((service, idx) => (
                <button
                  key={idx}
                  onClick={() => !demoActivated && setSelectedService(service)}
                  disabled={demoActivated}
                  className={`group relative px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedService?.name === service.name
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-200'
                      : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  } ${demoActivated ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="font-semibold truncate">{service.name}</div>
                  <div className={`text-[10px] mt-0.5 ${selectedService?.name === service.name ? 'text-purple-100' : 'text-gray-500'}`}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    {service.duration}min
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* SECCIÓN 2: Calendario de Slots - COPY MEJORADO */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-3 shadow-xl border border-indigo-900/30">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-white">2. Bloquea tu agenda de prueba</h3>
            </div>
            <p className="text-[10px] text-indigo-200 font-medium text-center mb-3 bg-indigo-900/30 py-1.5 px-2 rounded-lg">
              Marca los huecos en rojo. {assistantName} sabrá que estás "ocupado" ahí
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {days.map(day => (
                <div key={day}>
                  <p className="font-bold text-purple-300 pb-2 text-[11px]">{day.substring(0, 3)}</p>
                  <div className="space-y-1.5">
                    {hours.map(hour => {
                      const slotKey = `${day}-${hour}`;
                      const isBlocked = blockedSlots.includes(slotKey);
                      return (
                        <button
                          key={hour}
                          onClick={() => toggleSlot(day, hour)}
                          disabled={demoActivated}
                          className={`w-full py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                            isBlocked
                              ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30 transform scale-105'
                              : 'bg-gradient-to-br from-slate-700/60 to-indigo-900/40 text-indigo-100 hover:from-slate-600 hover:to-indigo-800/50 hover:scale-105 border border-indigo-700/30 hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/20'
                          } ${demoActivated ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                        >
                          {hour}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-4 text-[10px] text-indigo-300/70">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-gradient-to-br from-slate-700/60 to-indigo-900/40 rounded border border-indigo-700/30"></span>
                Disponible
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-gradient-to-r from-red-500 to-rose-600 rounded"></span>
                Ocupado
              </span>
            </div>
          </div>

          {/* SECCIÓN 3: Botón Activar - COPY MEJORADO */}
          {!demoActivated && (
            <div className="space-y-2">
              <button
                onClick={handleActivateDemo}
                disabled={isActivating}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Activando...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span className="text-sm">Activar mi Demostración</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-500 text-center px-2">
                Esto creará tu asistente personal de IA con el escenario que acabas de definir
              </p>
            </div>
          )}
        </div>

        {/* PANEL DERECHO: Experiencia */}
        <div className="lg:col-span-2 space-y-3">
          {!demoActivated ? (
            /* Placeholder Bloqueado - COPY MEJORADO */
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center h-full flex flex-col justify-center items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-md mb-3">
                <Lock className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-700 mb-1">Panel de Experiencia</h3>
              <p className="text-xs text-gray-500">
                ¡Desbloquéalo! Aquí verás cómo interactuar con <span className="font-semibold text-purple-600">{assistantName}</span>
              </p>
            </div>
          ) : (
            /* Controles Desbloqueados - ORDEN INTUITIVO PERFECTO */
            <>
              {/* [1] EL LOGRO - Banner de Éxito */}
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold text-sm">✅ ¡{assistantName} está lista para atender!</span>
                </div>
                <h3 className="text-xs text-center text-emerald-50">
                  {selectedService?.name} • {blockedSlots.length} slots bloqueados
                </h3>
              </div>

              {/* [2] LA MISIÓN - Ideas para tu Prueba - REDISEÑADO */}
              <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-xl border border-purple-200/50 p-4 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-md">
                    <Lightbulb className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">¡IDEAS PARA TU PRUEBA!</h3>
                    <p className="text-[10px] text-gray-600">
                      Desafía a {assistantName} y descubre su potencial
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-purple-200/50 hover:border-purple-400 transition-all group">
                    <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-red-100 to-rose-100 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Clock className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed pt-0.5">
                      Intenta reservar en un horario que marcaste como <strong className="text-red-600">ocupado</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-purple-200/50 hover:border-purple-400 transition-all group">
                    <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                      <List className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed pt-0.5">
                      Abre <strong className="text-purple-600">[📋 Servicios]</strong>, elige uno que <strong>no sea el tuyo</strong> y pregúntale por su precio o en qué consiste
                    </p>
                  </div>
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-purple-200/50 hover:border-purple-400 transition-all group">
                    <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed pt-0.5">
                      Abre <strong className="text-blue-600">[❓ Info]</strong> e <strong>invéntate una pregunta</strong> sobre esos datos (ej: "¿Tenéis parking?", "¿Trabajáis con seguros?")
                    </p>
                  </div>
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-purple-200/50 hover:border-purple-400 transition-all group">
                    <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed pt-0.5">
                      ¡No olvides comprobar tu <strong className="text-green-600">WhatsApp</strong> al colgar para ver la confirmación de la reserva!
                    </p>
                  </div>
                </div>
              </div>

              {/* [3] LA "CHULETA" - Lo que Carlota ya sabe - REDISEÑADO */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-md">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
                    <HelpCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-sm font-bold text-gray-900">LO QUE {assistantName.toUpperCase()} YA SABE</h3>
                  </div>
                </div>
                <p className="text-xs text-gray-600 text-center mb-3">
                  Esta información es la que {assistantName} usará para responder. <strong>Haz clic para verla antes de llamar</strong> 👇
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowServicesModal(true)}
                    className="flex flex-col items-center gap-2 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 text-purple-700 font-semibold py-3 px-3 rounded-xl hover:border-purple-400 hover:shadow-md transition-all active:scale-95 group"
                  >
                    <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                      <List className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs">Servicios</span>
                  </button>
                  <button
                    onClick={() => setShowInfoModal(true)}
                    className="flex flex-col items-center gap-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 text-blue-700 font-semibold py-3 px-3 rounded-xl hover:border-blue-400 hover:shadow-md transition-all active:scale-95 group"
                  >
                    <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                      <HelpCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs">Info</span>
                  </button>
                </div>
              </div>

              {/* [4] LA ACCIÓN FINAL - Botones de Contacto - REDISEÑADO */}
              <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-xl border-2 border-purple-300 p-4 shadow-xl">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full shadow-lg animate-pulse">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-center text-gray-900 mb-1">¡Tu Línea de Prueba está Activa!</h3>
                <p className="text-xs text-gray-700 text-center mb-3 px-2">
                  <strong>Ahora que sabes la misión</strong>, llama o envía un WhatsApp y pon a {assistantName} a prueba
                </p>
                <div className="text-center mb-4 bg-white py-3 px-4 rounded-xl border-2 border-purple-200 shadow-md">
                  <p className="text-[9px] text-gray-500 mb-1 uppercase tracking-wide font-semibold">Número de Demo</p>
                  <div className="text-lg font-black bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {demoPhoneNumber || '+34 912 345 678'}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <a
                    href={`tel:${demoPhoneNumber}`}
                    className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-slate-700 via-gray-800 to-slate-900 text-white font-bold py-3.5 px-5 rounded-xl hover:shadow-2xl hover:shadow-slate-500/50 hover:-translate-y-0.5 transition-all active:scale-95 group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg group-hover:bg-white/30 transition-all">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="text-sm">Llamar Ahora</span>
                  </a>
                  <a
                    href={`https://wa.me/${demoPhoneNumber?.replace(/\D/g, '')}?text=Hola,%20quiero%20hacer%20una%20reserva`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-700 text-white font-bold py-3 px-5 rounded-xl hover:shadow-2xl hover:shadow-green-500/50 hover:-translate-y-0.5 transition-all active:scale-95 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-7 h-7 bg-white/20 rounded-lg group-hover:bg-white/30 transition-all">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <span className="text-sm">WhatsApp</span>
                    </div>
                    <span className="text-[10px] text-green-100 font-medium">(texto o audio)</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL: Servicios - COPY MEJORADO */}
      {showServicesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 relative shadow-2xl animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowServicesModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            >
              ×
            </button>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-2">
                <List className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">📋 Servicios de Prueba</h3>
              <p className="text-xs text-gray-500 mt-1">{assistantName} conoce estos servicios y puede hablar de ellos</p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {demoPackage.services.map((service, idx) => (
                <div key={idx} className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 hover:border-purple-300 transition-all">
                  <h4 className="font-bold text-gray-900 text-sm">{service.name}</h4>
                  <p className="text-xs text-gray-600 mt-1">{service.description}</p>
                  <div className="flex justify-between items-center mt-2 text-xs">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-3 h-3" />
                      {service.duration} min
                    </span>
                    <span className="font-bold text-purple-600">{service.price}€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Info de Contexto - La IA usa esta info para responder */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative shadow-2xl animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            >
              ×
            </button>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mb-2">
                <HelpCircle className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">❓ Información de Contexto</h3>
              <p className="text-xs text-gray-500 mt-1">Esta información es la que {assistantName} conoce. <strong>¡Invéntate preguntas sobre esto!</strong></p>
            </div>
            <div className="space-y-3">
              {demoPackage.info.map((item, idx) => {
                // Mapeo completo de iconos (solo iconos disponibles en Lucide React)
                const iconMap = {
                  'clock': Clock,
                  'map-marker-alt': MapPin,
                  'check-circle': CheckCircle2,
                  'user-md': Users,
                  'info-circle': HelpCircle,
                  'spa': Sparkles,
                  'gift': Gift,
                  'shopping-bag': ShoppingBag,
                  'lock': Lock,
                  'user-friends': Users,
                  'users': Users,
                  'tooth': Sparkles,
                  'percent': Percent,
                  'star': Star,
                  'calendar-check': Calendar,
                  'shield-alt': Shield,
                  'sparkles': Sparkles,
                  'om': Sparkles,
                  'user-check': UserCheck,
                  'dumbbell': Activity,
                  'ambulance': Heart,
                  'paw': Heart,
                  'hospital': Building2
                };
                const IconComponent = iconMap[item.icon] || HelpCircle;
                
                return (
                  <div key={idx} className="flex items-start gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex-shrink-0">
                      <IconComponent className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Botón "Omitir demo" - Visible y accesible (Fast-lane para power users) */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleSkipDemo}
          className="group flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg border border-gray-300 hover:border-gray-400 transition-all text-sm font-medium active:scale-95"
        >
          <span>Omitir demo</span>
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-500 text-center mt-2">
        Ya he visto cómo funciona, quiero ir directo a mi panel
      </p>
    </div>
  );
}
