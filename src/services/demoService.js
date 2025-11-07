import { supabase } from '../lib/supabase';
import { log } from '../utils/logger';

/**
 * Servicio para gestión de demos interactivas
 * Maneja la creación, gestión y verificación de sesiones de demo
 */

/**
 * Crea una sesión de demo temporal en la base de datos
 * @param {Object} config - Configuración de la demo
 * @param {string} config.vertical - ID del vertical (ej: 'peluqueria_barberia')
 * @param {string} config.businessName - Nombre del negocio
 * @param {string} config.assistantName - Nombre del asistente
 * @param {string} config.assistantVoice - ID de la voz de ElevenLabs
 * @param {string} config.serviceName - Nombre del servicio de prueba
 * @param {number} config.serviceDuration - Duración en minutos
 * @param {Object} config.slots - Objeto con slots { "10:00": "libre", "10:45": "ocupado", ... }
 * @param {string} config.whatsapp - Número de WhatsApp del usuario
 * @returns {Promise<Object>} - Sesión creada con demoPhone y sessionId
 */
export async function createDemoSession(config) {
  try {
    log.info('📞 Creando sesión de demo:', config);

    // Llamar al webhook de N8N directamente
    const N8N_WEBHOOK_URL = 'https://gustausantin.app.n8n.cloud/webhook/39f89f4c-b3d4-428c-b6c7-79a121b15034';
    
    // Generar session_id temporal
    const sessionId = `${config.assistantName.toUpperCase()}-${Date.now()}`;
    
    // Construir blockedSlots como objeto
    const blockedSlotsObj = {};
    config.blockedSlots.forEach(slot => {
      const key = `${slot.day}-${slot.hour}`;
      blockedSlotsObj[key] = 'ocupado';
    });

    // Extraer solo el Voice ID de ElevenLabs (última parte después del último _)
    // Ej: "Male_2_Danny_wnKyx1zkUEUnfURKiuaP" → "wnKyx1zkUEUnfURKiuaP"
    const extractVoiceId = (fullId) => {
      if (!fullId) return 'RgXx32WYOGrd7gFNifSf'; // Default Female 1
      const parts = fullId.split('_');
      return parts[parts.length - 1]; // Última parte
    };

    const payload = {
      is_active: true,
      session_id_temporal: sessionId,
      vertical: config.vertical,
      business_name: config.businessName,
      assistant_name: config.assistantName,
      assistant_voice_id: extractVoiceId(config.assistantVoice), // ✅ Solo el Voice ID
      demo_config: {
        selectedService: {
          name: config.selectedService.name,
          duration: config.selectedService.duration,
          price: config.selectedService.price || 0
        },
        blockedSlots: blockedSlotsObj
      },
      demo_whatsapp_contact: config.whatsappNumber || '+34000000000'
    };

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    log.info('✅ Sesión de demo creada:', sessionId);

    return {
      success: true,
      demoPhoneNumber: '+34 931 204 462',  // Número fijo de demo
      sessionId: sessionId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()  // 30 min
    };
  } catch (error) {
    log.error('❌ Error creando sesión de demo:', error);
    throw new Error('No se pudo crear la sesión de demo');
  }
}

/**
 * Verifica si una llamada de demo se ha completado
 * @param {string} sessionId - ID de la sesión de demo
 * @returns {Promise<Object>} - Estado de la llamada
 */
export async function checkDemoCallStatus(sessionId) {
  try {
    log.info('🔍 Verificando estado de llamada:', sessionId);

    // TODO: Consultar el estado de la sesión en la BD
    // const { data, error } = await supabase
    //   .from('demo_sessions')
    //   .select('status, call_completed, call_transcript')
    //   .eq('session_id', sessionId)
    //   .single();

    // if (error) throw error;

    // Por ahora, simulamos que NO se ha completado
    return {
      completed: false,
      status: 'waiting',
      transcript: null
    };
  } catch (error) {
    log.error('❌ Error verificando llamada:', error);
    return {
      completed: false,
      status: 'error',
      transcript: null
    };
  }
}

/**
 * Marca una sesión de demo como completada
 * @param {string} sessionId - ID de la sesión
 * @param {string} transcript - Transcripción de la llamada (opcional)
 * @returns {Promise<boolean>}
 */
export async function completeDemoSession(sessionId, transcript = null) {
  try {
    log.info('✅ Marcando demo como completada:', sessionId);

    // TODO: Actualizar la sesión en la BD
    // const { error } = await supabase
    //   .from('demo_sessions')
    //   .update({
    //     status: 'completed',
    //     call_completed: true,
    //     call_transcript: transcript,
    //     completed_at: new Date().toISOString()
    //   })
    //   .eq('session_id', sessionId);

    // if (error) throw error;

    return true;
  } catch (error) {
    log.error('❌ Error completando sesión de demo:', error);
    return false;
  }
}

/**
 * Limpia sesiones de demo antiguas (>24h)
 * Esto normalmente se ejecutaría en un cron job
 * @returns {Promise<number>} - Número de sesiones eliminadas
 */
export async function cleanupOldDemoSessions() {
  try {
    log.info('🧹 Limpiando sesiones de demo antiguas...');

    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // TODO: Eliminar sesiones antiguas
    // const { data, error } = await supabase
    //   .from('demo_sessions')
    //   .delete()
    //   .lt('created_at', yesterday.toISOString())
    //   .select('session_id');

    // if (error) throw error;

    // log.info(`✅ ${data?.length || 0} sesiones eliminadas`);
    // return data?.length || 0;

    return 0;
  } catch (error) {
    log.error('❌ Error limpiando sesiones:', error);
    return 0;
  }
}

/**
 * Obtiene el estado completo de una sesión de demo
 * @param {string} sessionId - ID de la sesión
 * @returns {Promise<Object|null>} - Datos de la sesión
 */
export async function getDemoSession(sessionId) {
  try {
    // TODO: Consultar la sesión completa
    // const { data, error } = await supabase
    //   .from('demo_sessions')
    //   .select('*')
    //   .eq('session_id', sessionId)
    //   .single();

    // if (error) throw error;
    // return data;

    return null;
  } catch (error) {
    log.error('❌ Error obteniendo sesión:', error);
    return null;
  }
}

