// =====================================================
// AUTO SLOT REGENERATION SERVICE
// Regeneración automática y silenciosa de slots
// =====================================================

import { supabase } from '../lib/supabase';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';

export class AutoSlotRegenerationService {
  
  /**
   * Validar requisitos previos antes de generar slots
   * @param {string} businessId - ID del negocio
   * @returns {Promise<{valid: boolean, errorCode: string, errorMessage: string, details: object}>}
   */
  static async validatePrerequisites(businessId) {
    try {
      const { data, error } = await supabase.rpc('validate_slot_generation_prerequisites', {
        p_business_id: businessId
      });

      if (error) {
        console.error('❌ Error validando requisitos previos:', error);
        return {
          valid: false,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'Error al validar requisitos previos',
          details: { error: error.message }
        };
      }

      const result = data?.[0];
      if (!result) {
        return {
          valid: false,
          errorCode: 'UNKNOWN_ERROR',
          errorMessage: 'Error desconocido en la validación',
          details: {}
        };
      }

      return {
        valid: result.is_valid,
        errorCode: result.error_code,
        errorMessage: result.error_message,
        details: result.details || {}
      };
    } catch (error) {
      console.error('❌ Excepción en validación:', error);
      return {
        valid: false,
        errorCode: 'EXCEPTION',
        errorMessage: error.message || 'Error inesperado en la validación',
        details: {}
      };
    }
  }

  /**
   * Obtener mensaje de error amigable según el código
   * @param {string} errorCode - Código de error
   * @param {object} details - Detalles adicionales del error
   * @returns {string}
   */
  static getErrorMessage(errorCode, details = {}) {
    const messages = {
      'BUSINESS_NOT_FOUND': 'El negocio no existe o no está activo. Por favor, verifica la configuración.',
      'NO_OPERATING_HOURS': 'No se han configurado horarios de apertura. Ve a Configuración > Horarios y configura los horarios del negocio.',
      'NO_ACTIVE_EMPLOYEES': `No hay empleados activos. Agrega al menos un empleado en la sección Equipo.`,
      'NO_EMPLOYEE_SCHEDULES': `Los empleados activos no tienen horarios configurados. Ve a Equipo y configura los horarios de trabajo.`,
      'NO_RESOURCES': 'No hay recursos disponibles (mesas, salones, etc.). Agrega recursos en la configuración.',
      'VALIDATION_ERROR': 'Error al validar los requisitos previos. Por favor, intenta nuevamente.',
      'UNKNOWN_ERROR': 'Error desconocido. Por favor, contacta al soporte.',
      'EXCEPTION': 'Error inesperado. Por favor, intenta nuevamente.'
    };

    let message = messages[errorCode] || messages['UNKNOWN_ERROR'];
    
    // Agregar detalles específicos si están disponibles
    if (details.solution) {
      message += ` ${details.solution}`;
    }

    return message;
  }

  /**
   * Regenerar slots automáticamente (SIN confirmación manual)
   * @param {string} businessId - ID del negocio
   * @param {string} reason - Motivo de la regeneración
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<{success: boolean, slotsUpdated: number, errorCode?: string, errorMessage?: string}>}
   */
  static async regenerate(businessId, reason = 'general', options = {}) {
    try {
      const {
        affectedDates = [], // Fechas específicas afectadas
        advanceDays = 30,   // Días adelantados por defecto
        silent = false,      // Si es true, no muestra toast
        skipValidation = false // Si es true, omite la validación previa
      } = options;

      console.log(`⚡ Regeneración automática iniciada - Motivo: ${reason}`);

      // 1. VALIDACIÓN PREVIA (a menos que se omita explícitamente)
      if (!skipValidation) {
        const validation = await this.validatePrerequisites(businessId);
        
        if (!validation.valid) {
          const errorMessage = this.getErrorMessage(validation.errorCode, validation.details);
          
          console.error(`❌ Validación fallida: ${validation.errorCode} - ${errorMessage}`);
          
          if (!silent) {
            toast.error(errorMessage, {
              duration: 5000,
              position: 'bottom-center'
            });
          }

          return {
            success: false,
            slotsUpdated: 0,
            errorCode: validation.errorCode,
            errorMessage: errorMessage,
            details: validation.details
          };
        }
        
        console.log('✅ Validación previa exitosa');
      }

      // 2. Obtener configuración actual del negocio PRIMERO (para verificar advanceDays)
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('settings, business_hours')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      // ✅ PRIORIDAD: Usar el valor pasado como parámetro, pero verificar que sea correcto
      // Si no se pasó advanceDays, intentar leerlo de la configuración guardada
      const savedAdvanceDays = business?.settings?.booking_settings?.advance_booking_days 
                             || business?.settings?.advance_booking_days;
      
      // Usar el valor pasado como parámetro si existe, sino el guardado, sino 30 por defecto
      const finalAdvanceDays = advanceDays !== 30 || savedAdvanceDays === undefined 
                              ? advanceDays 
                              : (savedAdvanceDays || 30);

      console.log('📋 Configuración del negocio obtenida');
      console.log('📊 Días de anticipación:', {
        pasadoComoParametro: advanceDays,
        guardadoEnBD: savedAdvanceDays,
        valorFinalUsado: finalAdvanceDays
      });

      // 3. Determinar rango de fechas usando el valor FINAL
      const today = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), finalAdvanceDays), 'yyyy-MM-dd');
      
      console.log('📅 Rango de fechas:', {
        desde: today,
        hasta: endDate,
        dias: finalAdvanceDays
      });

      // 4. Llamar a función de regeneración en Supabase
      // 🛡️ Usar función que protege reservas existentes
      let data, error;
      
      // ⭐ PRIORIDAD 1: Función employee-based que protege reservas
      // ✅ IMPORTANTE: Usar finalAdvanceDays (el valor correcto, no el por defecto)
      const result1 = await supabase.rpc('generate_availability_slots_employee_based', {
        p_business_id: businessId,
        p_start_date: today,
        p_days_ahead: finalAdvanceDays, // ✅ Usar el valor FINAL calculado
        p_regenerate: true // Regenerar slots existentes
      });

      // Si falla, intentar con función simple (fallback)
      if (result1.error && result1.error.code === 'PGRST202') {
        console.log('⚠️ RPC generate_availability_slots_employee_based no existe, intentando simple...');
        
        const result2 = await supabase.rpc('generate_availability_slots_simple', {
          p_business_id: businessId,
          p_start_date: today,
          p_end_date: endDate
        });

        data = result2.data;
        error = result2.error;

        // Si tampoco existe, operación silenciosa
        if (error && error.code === 'PGRST202') {
          console.log('ℹ️ RPCs de regeneración no disponibles - operación silenciosa');
          data = { total_slots_generated: 0 };
          error = null;
        }
      } else {
        data = result1.data;
        error = result1.error;
      }

      if (error) {
        console.error('❌ Error en regeneración:', error);
        
        // Manejar errores específicos
        let errorMessage = 'Error al generar slots de disponibilidad';
        let errorCode = 'GENERATION_ERROR';
        
        if (error.code === 'P0001' || error.message?.includes('NO_ACTIVE_EMPLOYEES')) {
          errorCode = 'NO_ACTIVE_EMPLOYEES';
          errorMessage = this.getErrorMessage('NO_ACTIVE_EMPLOYEES');
        } else if (error.message?.includes('NO_OPERATING_HOURS')) {
          errorCode = 'NO_OPERATING_HOURS';
          errorMessage = this.getErrorMessage('NO_OPERATING_HOURS');
        } else if (error.message?.includes('NO_RESOURCES')) {
          errorCode = 'NO_RESOURCES';
          errorMessage = this.getErrorMessage('NO_RESOURCES');
        } else {
          errorMessage = error.message || errorMessage;
        }
        
        if (!silent) {
          toast.error(errorMessage, {
            duration: 5000,
            position: 'bottom-center'
          });
        }
        
        return {
          success: false,
          slotsUpdated: 0,
          errorCode,
          errorMessage,
          error: error.message
        };
      }

      // Verificar si la función retornó un error
      const result = data?.[0];
      if (result?.error_code && result.error_code !== 'SUCCESS') {
        const errorMessage = this.getErrorMessage(result.error_code, result.details || {});
        
        console.error(`❌ Error en generación: ${result.error_code} - ${result.error_message}`);
        
        if (!silent) {
          toast.error(errorMessage, {
            duration: 5000,
            position: 'bottom-center'
          });
        }
        
        return {
          success: false,
          slotsUpdated: 0,
          errorCode: result.error_code,
          errorMessage: errorMessage,
          details: result.details
        };
      }

      const slotsUpdated = result?.total_slots_generated || data?.total_slots_generated || data?.affected_count || data?.slots_created || 0;

      console.log(`✅ Regeneración completada: ${slotsUpdated} slots actualizados`);

      // 🛡️ 4. Consultar reservas activas en el rango para informar al usuario
      let protectedReservations = [];
      try {
        // Primero obtener las reservas
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('appointments')
          .select('appointment_date, appointment_time, customer_name, resource_id')
          .eq('business_id', businessId)
          .gte('appointment_date', today)
          .lte('appointment_date', endDate)
          .not('status', 'in', '(cancelled,completed)')
          .order('appointment_date', { ascending: true });

        if (!reservationsError && reservationsData && reservationsData.length > 0) {
          // Obtener resource_ids únicos
          const resourceIds = [...new Set(reservationsData.map(r => r.resource_id).filter(Boolean))];
          let resourcesMap = {};
          
          // Si hay resource_ids, obtener los nombres de recursos
          if (resourceIds.length > 0) {
            const { data: resourcesData } = await supabase
              .from('resources')
              .select('id, name')
              .in('id', resourceIds);
            
            if (resourcesData) {
              resourcesMap = resourcesData.reduce((acc, r) => {
                acc[r.id] = r.name;
                return acc;
              }, {});
            }
          }
          
          // Mapear reservas con nombres de recursos
          protectedReservations = reservationsData.map(r => ({
            appointment_date: r.appointment_date,
            date: r.appointment_date, // Alias para compatibilidad
            appointment_time: r.appointment_time,
            customer_name: r.customer_name,
            resource_id: r.resource_id,
            resource_name: r.resource_id ? (resourcesMap[r.resource_id] || null) : null
          }));
          
          console.log(`🛡️ ${protectedReservations.length} reservas activas encontradas en el rango`);
        }
      } catch (error) {
        console.warn('⚠️ Error consultando reservas protegidas:', error);
        // No fallar si hay error consultando reservas
      }

      // 5. Toast informativo (no bloqueante)
      if (!silent) {
        toast.success(`⚡ ${slotsUpdated} slots actualizados`, {
          duration: 2000,
          position: 'bottom-center',
          icon: '✅'
        });
      }

      return {
        success: true,
        slotsUpdated,
        reason,
        protectedReservations // 🛡️ Información de reservas protegidas
      };

    } catch (error) {
      console.error('❌ Error en regeneración automática:', error);
      
      if (!options.silent) {
        toast.error('Error al actualizar disponibilidad');
      }

      return {
        success: false,
        slotsUpdated: 0,
        error: error.message
      };
    }
  }

  /**
   * Verificar si una acción requiere regeneración
   * @param {string} actionType - Tipo de acción realizada
   * @returns {boolean}
   */
  static requiresRegeneration(actionType) {
    const TRIGGERS = [
      'resource_blockage_created',
      'resource_blockage_removed',
      'business_hours_changed',
      'resource_created',
      'resource_deactivated',
      'service_duration_changed',
      'calendar_exception_created',
      'calendar_exception_removed',
      // ⭐ NUEVOS: Employee-based availability
      'employee_absence_created',
      'employee_absence_removed',
      'employee_schedule_changed',
      'employee_resource_assigned',
      'employee_activated',
      'employee_deactivated'
    ];

    return TRIGGERS.includes(actionType);
  }

  /**
   * Wrapper para regeneración después de cambios
   * @param {string} businessId
   * @param {string} actionType
   * @param {Object} actionData - Datos específicos de la acción
   */
  static async regenerateAfterAction(businessId, actionType, actionData = {}) {
    if (!this.requiresRegeneration(actionType)) {
      console.log(`ℹ️ Acción "${actionType}" no requiere regeneración`);
      return { success: true, skipped: true };
    }

    console.log(`🔄 Acción "${actionType}" requiere regeneración`);

    return await this.regenerate(businessId, actionType, {
      affectedDates: actionData.affectedDates || [],
      silent: actionData.silent || false
    });
  }
}

export default AutoSlotRegenerationService;

