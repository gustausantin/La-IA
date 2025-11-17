// onboardingService.js - Servicio para gestión del onboarding dinámico
import { supabase } from '../lib/supabase';

/**
 * Obtiene la configuración dinámica del onboarding según el vertical seleccionado
 * Llama a la Edge Function que consulta business_verticals y service_templates
 * 
 * @param {string} verticalType - Código del vertical (ej: 'fisioterapia', 'clinica_dental')
 * @returns {Promise<Object>} Configuración del vertical con nombres de recursos y servicios sugeridos
 */
export async function getVerticalOnboardingConfig(verticalType) {
  try {
    console.log('📞 [OnboardingService] Llamando Edge Function para vertical:', verticalType);
    
    // Llamar a la Edge Function
    const { data, error } = await supabase.functions.invoke('get-vertical-onboarding-config', {
      body: { vertical_type: verticalType }
    });

    if (error) {
      console.error('❌ [OnboardingService] Error en Edge Function:', error);
      throw error;
    }

    if (!data || !data.success) {
      throw new Error(data?.error || 'No se pudo obtener la configuración del vertical');
    }

    console.log('✅ [OnboardingService] Configuración obtenida:', data);

    return {
      success: true,
      config: {
        verticalType: data.vertical_type,
        resourceNameSingular: data.resource_name_singular || 'Recurso',
        resourceNamePlural: data.resource_name_plural || 'Recursos',
        appointmentName: data.appointment_name || 'Cita',
        defaultDurationMinutes: data.default_duration_minutes || 60,
        suggestedServices: data.suggested_services || []
      }
    };

  } catch (error) {
    console.error('❌ [OnboardingService] Error obteniendo configuración:', error);
    
    // Fallback: retornar configuración por defecto
    return {
      success: false,
      error: error.message,
      config: getFallbackConfig(verticalType)
    };
  }
}

/**
 * Configuración de fallback si la Edge Function falla
 * Usa datos estáticos basados en el esquema
 */
function getFallbackConfig(verticalType) {
  const fallbacks = {
    fisioterapia: {
      resourceNameSingular: 'Box',
      resourceNamePlural: 'Boxes',
      appointmentName: 'Sesión',
      defaultDurationMinutes: 45,
      suggestedServices: [
        { name: 'Sesión Fisioterapia', duration_minutes: 45, suggested_price: 40.00 },
        { name: 'Fisioterapia Deportiva', duration_minutes: 45, suggested_price: 45.00 },
        { name: 'Punción Seca', duration_minutes: 30, suggested_price: 35.00 }
      ]
    },
    masajes_osteopatia: {
      resourceNameSingular: 'Camilla',
      resourceNamePlural: 'Camillas',
      appointmentName: 'Sesión',
      defaultDurationMinutes: 60,
      suggestedServices: [
        { name: 'Masaje Relajante 60min', duration_minutes: 60, suggested_price: 50.00 },
        { name: 'Masaje Deportivo', duration_minutes: 45, suggested_price: 45.00 },
        { name: 'Osteopatía Estructural', duration_minutes: 60, suggested_price: 60.00 }
      ]
    },
    clinica_dental: {
      resourceNameSingular: 'Consultorio',
      resourceNamePlural: 'Consultorios',
      appointmentName: 'Consulta',
      defaultDurationMinutes: 30,
      suggestedServices: [
        { name: 'Revisión General', duration_minutes: 30, suggested_price: 40.00 },
        { name: 'Limpieza Dental', duration_minutes: 45, suggested_price: 60.00 },
        { name: 'Empaste', duration_minutes: 60, suggested_price: 80.00 }
      ]
    },
    psicologia_coaching: {
      resourceNameSingular: 'Despacho',
      resourceNamePlural: 'Despachos',
      appointmentName: 'Sesión',
      defaultDurationMinutes: 60,
      suggestedServices: [
        { name: 'Primera Consulta', duration_minutes: 90, suggested_price: 80.00 },
        { name: 'Sesión Individual', duration_minutes: 60, suggested_price: 60.00 },
        { name: 'Sesión de Pareja', duration_minutes: 90, suggested_price: 90.00 }
      ]
    },
    centro_estetica: {
      resourceNameSingular: 'Cabina',
      resourceNamePlural: 'Cabinas',
      appointmentName: 'Cita',
      defaultDurationMinutes: 45,
      suggestedServices: [
        { name: 'Depilación Láser', duration_minutes: 30, suggested_price: 40.00 },
        { name: 'Limpieza Facial', duration_minutes: 60, suggested_price: 45.00 },
        { name: 'Extensiones de Pestañas', duration_minutes: 90, suggested_price: 60.00 }
      ]
    },
    peluqueria_barberia: {
      resourceNameSingular: 'Silla',
      resourceNamePlural: 'Sillas',
      appointmentName: 'Cita',
      defaultDurationMinutes: 45,
      suggestedServices: [
        { name: 'Corte y Peinado', duration_minutes: 30, suggested_price: 25.00 },
        { name: 'Corte + Barba', duration_minutes: 45, suggested_price: 30.00 },
        { name: 'Tinte Completo', duration_minutes: 90, suggested_price: 50.00 }
      ]
    },
    centro_unas: {
      resourceNameSingular: 'Mesa',
      resourceNamePlural: 'Mesas',
      appointmentName: 'Cita',
      defaultDurationMinutes: 60,
      suggestedServices: [
        { name: 'Manicura', duration_minutes: 30, suggested_price: 20.00 },
        { name: 'Pedicura', duration_minutes: 45, suggested_price: 25.00 },
        { name: 'Uñas de Gel', duration_minutes: 60, suggested_price: 35.00 }
      ]
    },
    entrenador_personal: {
      resourceNameSingular: 'Sala',
      resourceNamePlural: 'Salas',
      appointmentName: 'Sesión',
      defaultDurationMinutes: 60,
      suggestedServices: [
        { name: 'Sesión Personal', duration_minutes: 60, suggested_price: 40.00 },
        { name: 'Valoración Inicial', duration_minutes: 90, suggested_price: 60.00 },
        { name: 'Sesión Pareja', duration_minutes: 60, suggested_price: 60.00 }
      ]
    },
    yoga_pilates: {
      resourceNameSingular: 'Sala',
      resourceNamePlural: 'Salas',
      appointmentName: 'Clase',
      defaultDurationMinutes: 60,
      suggestedServices: [
        { name: 'Clase de Yoga', duration_minutes: 60, suggested_price: 15.00 },
        { name: 'Clase de Pilates', duration_minutes: 60, suggested_price: 15.00 },
        { name: 'Yoga Privado', duration_minutes: 60, suggested_price: 50.00 }
      ]
    },
    veterinario: {
      resourceNameSingular: 'Consultorio',
      resourceNamePlural: 'Consultorios',
      appointmentName: 'Consulta',
      defaultDurationMinutes: 30,
      suggestedServices: [
        { name: 'Consulta General', duration_minutes: 30, suggested_price: 35.00 },
        { name: 'Vacunación', duration_minutes: 20, suggested_price: 40.00 },
        { name: 'Revisión Anual', duration_minutes: 45, suggested_price: 50.00 }
      ]
    }
  };

  return fallbacks[verticalType] || {
    resourceNameSingular: 'Recurso',
    resourceNamePlural: 'Recursos',
    appointmentName: 'Cita',
    defaultDurationMinutes: 60,
    suggestedServices: []
  };
}

/**
 * Crea el negocio con toda la configuración del onboarding
 */
export async function createBusinessWithOnboarding(businessData, verticalConfig) {
  try {
    console.log('📝 [OnboardingService] Creando negocio:', businessData);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Preparar payload del negocio
    const businessPayload = {
      name: businessData.name,
      vertical_type: businessData.vertical,
      phone: businessData.phone,
      email: businessData.email || user.email,
      address: businessData.address,
      city: businessData.city,
      postal_code: businessData.postalCode,
      active: true,
      onboarding_completed: true,
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

    // 1. Crear negocio
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert([businessPayload])
      .select()
      .single();

    if (businessError) throw businessError;

    console.log('✅ Negocio creado:', business.id);

    // 2. Crear mapping
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
    if (businessData.services && businessData.services.length > 0) {
      const servicesData = businessData.services.map((service, index) => ({
        business_id: business.id,
        name: service.name || service,
        duration_minutes: service.duration_minutes || verticalConfig.defaultDurationMinutes || 60,
        suggested_price: service.suggested_price || 0,
        is_active: true,
        position_order: index + 1
      }));

      const { error: servicesError } = await supabase
        .from('business_services')
        .insert(servicesData);

      if (servicesError) console.warn('⚠️ Error creando servicios:', servicesError);
    }

    // 4. Crear recursos
    if (businessData.resources && businessData.resources.length > 0) {
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

      if (resourcesError) console.warn('⚠️ Error creando recursos:', resourcesError);
    }

    console.log('🎉 [OnboardingService] Negocio creado exitosamente');

    return {
      success: true,
      business: business
    };

  } catch (error) {
    console.error('❌ [OnboardingService] Error creando negocio:', error);
    throw error;
  }
}

