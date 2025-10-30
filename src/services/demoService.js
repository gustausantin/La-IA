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

    // Llamar a la Edge Function
    const response = await supabase.functions.invoke('create-demo-session', {
      body: {
        vertical: config.vertical,
        businessName: config.businessName,
        assistantName: config.assistantName,
        assistantVoice: config.assistantVoice,
        serviceName: config.serviceName,
        serviceDuration: config.serviceDuration,
        slots: config.slots,
        whatsapp: config.whatsapp
      }
    });

    if (response.error) {
      log.error('❌ Error en Edge Function:', response.error);
      throw response.error;
    }

    const { data } = response;

    log.info('✅ Sesión de demo creada:', data.sessionId);

    return {
      success: true,
      demoPhone: data.demoPhone,
      sessionId: data.sessionId,
      expiresAt: data.expiresAt
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

