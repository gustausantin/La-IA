import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { useAuthContext } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, Loader2, Sparkles, Building2, Clock, Mic2, Phone, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Step5Confirmation() {
  const navigate = useNavigate();
  const { user, fetchBusinessInfo } = useAuthContext();
  const {
    getAllData,
    setConfirmationComplete,
    setCurrentStep,
    reset
  } = useOnboardingStore();

  const [isSaving, setIsSaving] = useState(false);
  const data = getAllData();

  const handleEdit = (step) => {
    setCurrentStep(step);
  };

  // Helper para formatear horarios
  const formatSchedule = () => {
    const days = {
      monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
      thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo'
    };
    
    const grouped = {};
    Object.entries(data.businessHours).forEach(([dayKey, hours]) => {
      if (!hours.isOpen) return;
      const blocks = hours.timeBlocks || [];
      const schedule = blocks.map(b => `${b.openTime} - ${b.closeTime}`).join(', ');
      if (!grouped[schedule]) grouped[schedule] = [];
      grouped[schedule].push(days[dayKey]);
    });

    return Object.entries(grouped).map(([schedule, daysList]) => (
      <p key={schedule} className="text-sm text-gray-700">
        <strong>{daysList.join(', ')}</strong>: {schedule}
      </p>
    ));
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    toast.loading('Creando tu negocio...', { id: 'save' });

    try {
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      // 1. Crear el negocio en businesses
      const businessPayload = {
        name: data.businessName,
        vertical_type: data.vertical,
        phone: data.businessPhone,
        assigned_phone: data.assignedPhone, // Número del pool asignado
        email: user.email,
        active: true,
        onboarding_completed: true,
        onboarding_step: 5, // Ahora son 5 pasos
        agent_config: {
          assistant_name: data.assistantName,
          voice_type: data.assistantVoice
        },
        business_hours: data.businessHours,
        settings: {}
      };

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert([businessPayload])
        .select()
        .single();

      if (businessError) throw businessError;

      console.log('✅ Negocio creado:', business.id);

      // 1.5. Reasignar el número telefónico al business_id real
      if (data.assignedPhone) {
        const { error: phoneUpdateError } = await supabase
          .from('inventario_telefonos')
          .update({
            id_negocio_asignado: business.id
          })
          .eq('numero_telefono', data.assignedPhone);

        if (phoneUpdateError) {
          console.warn('⚠️ Error actualizando inventario telefónico:', phoneUpdateError);
          // No es crítico, continuamos
        } else {
          console.log('✅ Número telefónico reasignado al negocio real');
        }
      }

      // 2. Crear mapping usuario-negocio
      const { error: mappingError } = await supabase
        .from('user_business_mapping')
        .insert([{
          auth_user_id: user.id,
          business_id: business.id,
          role: 'owner',
          active: true
        }]);

      if (mappingError) throw mappingError;

      // 3. Crear servicios
      if (data.services && data.services.length > 0) {
        const servicesData = data.services.map((service, index) => ({
          business_id: business.id,
          name: service.name,
          duration_minutes: service.duration_minutes || 60,
          price: service.suggested_price || 0,
          is_available: true,
          display_order: index + 1
        }));

        const { error: servicesError } = await supabase
          .from('services')
          .insert(servicesData);

        if (servicesError) console.warn('⚠️ Error creando servicios:', servicesError);
      }

      // 4. Crear recursos
      if (data.resourceCount > 0) {
        const resourcesData = Array.from({ length: data.resourceCount }, (_, i) => ({
          business_id: business.id,
          name: `${data.resourceName} ${i + 1}`,
          capacity: 1,
          is_active: true,
          display_order: i + 1
        }));

        const { error: resourcesError } = await supabase
          .from('resources')
          .insert(resourcesData);

        if (resourcesError) console.warn('⚠️ Error creando recursos:', resourcesError);
      }

      // 5. Crear horarios de operación
      const daysMap = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
      };

      const hoursData = Object.entries(data.businessHours).map(([day, hours]) => ({
        business_id: business.id,
        day_of_week: daysMap[day],
        is_open: hours.isOpen,
        open_time: hours.openTime || '09:00:00',
        close_time: hours.closeTime || '20:00:00'
      }));

      const { error: hoursError } = await supabase
        .from('business_operating_hours')
        .insert(hoursData);

      if (hoursError) console.warn('⚠️ Error creando horarios:', hoursError);

      // 6. Guardar credenciales de WhatsApp si las hay
      if (data.whatsappNumber) {
        const { error: channelError } = await supabase
          .from('channel_credentials')
          .insert([{
            business_id: business.id,
            channel: 'whatsapp',
            is_active: false, // Se activará después
            credentials: { phone: data.whatsappNumber },
            config: {}
          }]);

        if (channelError) console.warn('⚠️ Error guardando WhatsApp:', channelError);
      }

      setConfirmationComplete(true);
      toast.success('¡Negocio creado exitosamente!', { id: 'save' });

      // Recargar contexto y redirigir
      await fetchBusinessInfo(user.id, true);
      
      setTimeout(() => {
        reset(); // Limpiar el estado del onboarding
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('💥 ERROR:', error);
      toast.error(`Error: ${error.message}`, { id: 'save' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center mb-4">
        <div className="inline-flex p-4 bg-green-100 rounded-full mb-3">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          ¡Tu Recepcionista IA está lista!
        </h2>
        <p className="text-gray-600 text-sm">
          Revisa tu configuración final. Podrás editar todo más tarde desde tu panel.
        </p>
      </div>

      {/* Tarjetas de configuración */}
      <div className="space-y-3">
        {/* Tarjeta 1: Tu Negocio */}
        <div className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-300 transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">Tu Negocio</h3>
            </div>
            <button
              onClick={() => handleEdit(1)}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              <Edit2 className="w-3 h-3" />
              Editar
            </button>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-gray-900 font-semibold text-base">{data.businessName}</p>
            <p className="text-gray-600">
              Sector: <span className="font-medium text-gray-900">{data.selectedVertical?.name || data.vertical}</span>
            </p>
            <p className="text-gray-600">
              Teléfono: <span className="font-medium text-gray-900">{data.businessPhone}</span>
            </p>
          </div>
        </div>

        {/* Tarjeta 2: Horario Base */}
        <div className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Horario Configurado</h3>
            </div>
            <button
              onClick={() => handleEdit(2)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Edit2 className="w-3 h-3" />
              Editar
            </button>
          </div>
          <div className="space-y-1.5">
            {formatSchedule()}
            {Object.values(data.businessHours).some(h => !h.isOpen) && (
              <p className="text-sm text-gray-600 mt-2">
                <strong>Cerrado</strong>: {Object.entries(data.businessHours)
                  .filter(([_, h]) => !h.isOpen)
                  .map(([day]) => ({ 
                    sunday: 'Domingo', monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
                    thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado'
                  }[day]))
                  .join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Tarjeta 3: Asistente IA */}
        <div className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-pink-300 transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-pink-600" />
              <h3 className="font-bold text-gray-900">Tu Asistente IA</h3>
            </div>
            <button
              onClick={() => handleEdit(3)}
              className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 font-medium"
            >
              <Edit2 className="w-3 h-3" />
              Editar
            </button>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">
              Nombre: <span className="font-semibold text-gray-900">{data.assistantName}</span>
            </p>
            <p className="text-gray-600">
              Voz: <span className="font-medium text-gray-900">
                {data.assistantVoice === 'female' || data.assistantVoice?.includes('Female') ? 'Femenina' : 'Masculina'}
              </span>
            </p>
          </div>
        </div>

        {/* Tarjeta 4: Conexiones Activas */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-700" />
              <h3 className="font-bold text-green-900">Conexiones Activas</h3>
            </div>
            <button
              onClick={() => handleEdit(4)}
              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium"
            >
              <Edit2 className="w-3 h-3" />
              Editar
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {data.connectionVerified && (
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Desvío de llamadas: <strong>Verificado</strong></span>
              </div>
            )}
            {data.whatsappNumber && (
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Alertas WhatsApp: <strong>{data.whatsappNumber}</strong></span>
              </div>
            )}
            {!data.connectionVerified && !data.whatsappNumber && (
              <p className="text-sm text-gray-600">Sin conexiones configuradas</p>
            )}
          </div>
        </div>
      </div>

      {/* Botón de Acción Principal */}
      <button
        onClick={handleConfirm}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-base font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creando tu negocio...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            ¡Finalizar e ir a mi panel de control!
          </>
        )}
      </button>

      {/* Texto final */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-900 text-center leading-relaxed">
          🎉 <strong>¡Enhorabuena!</strong> LA-IA ya está lista para filtrar tus llamadas.
          <br className="hidden sm:block" />
          Ahora te guiaremos en tu panel principal para configurar tus servicios y espacios y empezar a recibir reservas.
        </p>
      </div>
    </div>
  );
}

