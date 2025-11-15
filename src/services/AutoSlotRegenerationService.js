// =====================================================
// AUTO SLOT REGENERATION SERVICE
// Regeneración automática y silenciosa de slots
// =====================================================

import { supabase } from '../lib/supabase';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';

export class AutoSlotRegenerationService {
  
  /**
   * Regenerar slots automáticamente (SIN confirmación manual)
   * @param {string} businessId - ID del negocio
   * @param {string} reason - Motivo de la regeneración
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<{success: boolean, slotsUpdated: number}>}
   */
  static async regenerate(businessId, reason = 'general', options = {}) {
    try {
      const {
        affectedDates = [], // Fechas específicas afectadas
        advanceDays = 30,   // Días adelantados por defecto
        silent = false       // Si es true, no muestra toast
      } = options;

      console.log(`⚡ Regeneración automática iniciada - Motivo: ${reason}`);

      // 1. Determinar rango de fechas
      const today = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');

      // 2. Obtener configuración actual del negocio
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('settings, business_hours')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      console.log('📋 Configuración del negocio obtenida');

      // 3. Llamar a función de regeneración en Supabase
      // 🛡️ Usar función que protege reservas existentes
      let data, error;
      
      // ⭐ PRIORIDAD 1: Función employee-based que protege reservas
      const result1 = await supabase.rpc('generate_availability_slots_employee_based', {
        p_business_id: businessId,
        p_start_date: today,
        p_days_ahead: advanceDays,
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
        throw error;
      }

      const slotsUpdated = data?.total_slots_generated || data?.affected_count || data?.slots_created || 0;

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

