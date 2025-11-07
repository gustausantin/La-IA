import { useState, useEffect } from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { DEMO_PACKAGES } from '../../../config/demoPackages';
import { createDemoSession } from '../../../services/demoService';
import { supabase } from '../../../lib/supabase';
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
  Building2,
  ArrowRight
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
    demo,
    setDemoConfig,
    setDemoCompleted: setDemoCompletedStore,
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
  const [sessionId, setSessionId] = useState(null);
  const [checkingCompletion, setCheckingCompletion] = useState(false);
  
  // ✅ Usar el estado del store para demoCompleted
  const demoCompleted = demo.completed;

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
    const hours = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'];
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

  // Activar demo (MODO REAL - CON WEBHOOK N8N)
  const handleActivateDemo = async () => {
    setIsActivating(true);
    
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
        setSessionId(response.sessionId);
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
    } finally {
      setIsActivating(false);
    }
    
    /*
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
    */
  };

  // Función para omitir la demo (navegación al Paso 4)
  const handleSkipDemo = () => {
    // Aquí NO llamamos al backend, solo navegamos al siguiente paso
    // El backend se llamará en el Paso 4 cuando el usuario pulse "Ir a mi Panel"
    setCurrentStep(4);
  };

  // Función para marcar demo como completada manualmente
  const handleDemoCompleted = () => {
    setDemoCompletedStore(true);
  };

  // Polling: Verificar automáticamente si se completó la demo
  useEffect(() => {
    if (!demoActivated || demoCompleted || !demoPhoneNumber) return;

    const checkDemoCompletion = async () => {
      try {
        setCheckingCompletion(true);
        
        // Buscar reservas creadas desde este teléfono de demo
        const { data, error } = await supabase
          .from('reservations')
          .select('id, created_at')
          .eq('source', 'agent_whatsapp_demo')
          .or(`phone.eq.${demoPhoneNumber},metadata->>demo_phone.eq.${demoPhoneNumber}`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error verificando demo:', error);
          return;
        }

        if (data && data.length > 0) {
          console.log('✅ Demo completada automáticamente detectada:', data[0]);
          setDemoCompletedStore(true);
        }
      } catch (err) {
        console.error('Error en polling:', err);
      } finally {
        setCheckingCompletion(false);
      }
    };

    // Verificar cada 10 segundos
    const interval = setInterval(checkDemoCompletion, 10000);
    
    // Primera verificación inmediata
    checkDemoCompletion();

    return () => clearInterval(interval);
  }, [demoActivated, demoCompleted, demoPhoneNumber]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 relative">
      {/* Header con el estilo de LA-IA */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-3">
          <Sparkles className="w-7 h-7 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          ¡Prueba a {assistantName}!
        </h2>
        <p className="text-sm text-gray-600">
          Configura tu demo en 4 pasos y descubre cómo <span className="font-semibold text-purple-600">{assistantName}</span> transformará tu negocio
        </p>
      </div>

      {/* ========== PASO 1: SERVICIO ========== */}
      <div className={`bg-white rounded-xl border border-gray-200 p-3 shadow-sm ${demoActivated ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-bold rounded-full shadow-md">
            1
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Elige tu servicio clave</h3>
            <p className="text-[10px] text-gray-600">Con este servicio pondrás a {assistantName} a trabajar</p>
          </div>
        </div>
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
                {service.duration}min • {service.price}€
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ========== PASO 2: AGENDA ========== */}
      <div className={`bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-3 shadow-xl border border-indigo-900/30 ${demoActivated ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-bold rounded-full shadow-md">
            2
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Bloquea tu agenda de prueba</h3>
            <p className="text-[10px] text-indigo-200">Marca los huecos en rojo. {assistantName} sabrá que estás "ocupado" ahí</p>
          </div>
        </div>
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
                          : 'bg-gradient-to-br from-slate-700/60 to-indigo-900/40 text-indigo-100 hover:from-slate-600 hover:to-indigo-800/50 hover:scale-105 border border-indigo-700/30'
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

      {/* ========== PASO 3: ACTIVAR ========== */}
      {!demoActivated ? (
        <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-xl border border-purple-200/50 p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-bold rounded-full shadow-md">
              3
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Activa tu demo</h3>
              <p className="text-[10px] text-gray-600">Crea tu asistente IA</p>
            </div>
          </div>
          <button
            onClick={handleActivateDemo}
            disabled={isActivating}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isActivating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Activando...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span className="text-sm">🚀 Activar Demostración</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* ========== PASO 3: LO QUE {ASISTENTE} SABE ========== */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-full shadow-md">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Lo que {assistantName} ya sabe</h3>
                <p className="text-[10px] text-gray-600">Revisa antes de llamar</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowServicesModal(true)}
                className="flex flex-col items-center gap-1.5 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 text-purple-700 font-semibold py-2.5 px-2 rounded-lg hover:border-purple-400 hover:shadow-md transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                  <List className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px]">📋 Servicios</span>
              </button>
              <button
                onClick={() => setShowInfoModal(true)}
                className="flex flex-col items-center gap-1.5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 font-semibold py-2.5 px-2 rounded-lg hover:border-blue-400 hover:shadow-md transition-all active:scale-95 group"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                  <HelpCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px]">❓ Info</span>
              </button>
            </div>

            {/* Ideas para la prueba - DENTRO del paso 3 */}
            <div className="mt-2 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200/50 p-2">
              <div className="flex items-center gap-1 mb-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-orange-600" />
                <h4 className="text-[10px] font-bold text-gray-900">💡 IDEAS PARA TU PRUEBA</h4>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1 text-[9px] text-gray-700 leading-snug">
                  <span className="text-red-600 font-bold">•</span>
                  <p>Intenta reservar en un horario <strong className="text-red-600">ocupado</strong></p>
                </div>
                <div className="flex items-start gap-1 text-[9px] text-gray-700 leading-snug">
                  <span className="text-purple-600 font-bold">•</span>
                  <p>Pregúntale por un servicio que <strong>no sea el tuyo</strong></p>
                </div>
                <div className="flex items-start gap-1 text-[9px] text-gray-700 leading-snug">
                  <span className="text-blue-600 font-bold">•</span>
                  <p><strong>Invéntate una pregunta</strong> sobre la info</p>
                </div>
                <div className="flex items-start gap-1 text-[9px] text-gray-700 leading-snug">
                  <span className="text-green-600 font-bold">•</span>
                  <p>¡Comprueba tu <strong className="text-green-600">WhatsApp</strong> después!</p>
                </div>
              </div>
            </div>
          </div>

          {/* ========== PASO 4: ¡A LLAMAR! ========== */}
          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 rounded-xl border border-green-200 p-3 shadow-sm">
            <div className="flex items-center justify-center gap-1 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[10px] font-bold text-green-700">✅ {assistantName} está lista!</span>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-green-600 to-emerald-600 text-white text-sm font-bold rounded-full shadow-md animate-pulse">
                4
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">¡A interactuar!</h3>
                <p className="text-[10px] text-gray-700">Llama o envía WhatsApp</p>
              </div>
            </div>

            <div className="text-center mb-2 bg-white py-2 px-3 rounded-lg border border-green-200 shadow-sm">
              <p className="text-[9px] text-gray-500 mb-0.5 uppercase tracking-wide font-semibold">📞 Número de Demo</p>
              <div className="text-base font-black bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {demoPhoneNumber || '+34 912 345 678'}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <a
                href={`tel:${demoPhoneNumber}`}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 via-gray-900 to-slate-800 text-white font-bold py-2.5 px-3 rounded-lg hover:shadow-lg hover:shadow-slate-600/30 hover:-translate-y-0.5 transition-all active:scale-95"
              >
                <Phone className="w-4 h-4" />
                <span className="text-xs">📞 Llamar Ahora</span>
              </a>
              <a
                href={`https://wa.me/${demoPhoneNumber?.replace(/\D/g, '')}?text=Hola,%20quiero%20hacer%20una%20reserva`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-0.5 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 text-white font-bold py-2.5 px-3 rounded-lg hover:shadow-lg hover:shadow-green-600/30 hover:-translate-y-0.5 transition-all active:scale-95"
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-xs">💬 WhatsApp</span>
                </div>
                <span className="text-[9px] text-green-100 font-medium">(texto o audio)</span>
              </a>
            </div>
          </div>
        </>
      )}

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

      {/* Botones de Navegación */}
      <div className="mt-8 space-y-3">
        {demoActivated && !demoCompleted && (
          <>
            {/* Botón: Ya completé la demo */}
            <button
              onClick={handleDemoCompleted}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transform hover:-translate-y-0.5 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>✅ Ya completé la demo y recibí el WhatsApp</span>
            </button>
            
            {checkingCompletion && (
              <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Verificando automáticamente si completaste la demo...
              </p>
            )}
          </>
        )}

        {demoCompleted && (
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
            <p className="text-sm text-green-700 font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              ¡Demo completada! Ya puedes continuar al siguiente paso
            </p>
          </div>
        )}

        {!demoActivated && (
          <>
            {/* Botón: Omitir demo (solo si NO ha activado) */}
            <div className="flex justify-center">
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
            <p className="text-xs text-gray-500 text-center">
              Ya he visto cómo funciona, quiero ir directo a mi panel
            </p>
          </>
        )}
      </div>
    </div>
  );
}
