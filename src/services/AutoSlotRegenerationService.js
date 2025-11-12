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
      let data, error;
      
      // ⭐ NUEVO: Intentar primero con función employee-based
      const result1 = await supabase.rpc('generate_employee_slots', {
        p_business_id: businessId,
        p_start_date: today,
        p_days_ahead: advanceDays
      });

      // Si falla, intentar con función legacy (resource-based)
      if (result1.error && result1.error.code === 'PGRST202') {
        console.log('⚠️ RPC generate_employee_slots no existe, intentando legacy...');
        
        const result2 = await supabase.rpc('generate_availability_slots_simple', {
          p_business_id: businessId,
          p_start_date: today,
          p_end_date: endDate
        });

        data = result2.data;
        error = result2.error;

        // Si tampoco existe el legacy, operación silenciosa
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

      // 4. Toast informativo (no bloqueante)
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
        reason
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

