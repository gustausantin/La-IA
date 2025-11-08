// =====================================================
// BLOCKAGE SERVICE - Gestión de Bloqueos de Recursos
// Fecha: 2025-11-08
// =====================================================

import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export class BlockageService {
  
  /**
   * Validar si se puede crear un bloqueo (sin conflictos con reservas)
   * @returns {Promise<{valid: boolean, conflicts: Array, message: string}>}
   */
  static async validateBlockage(resourceId, blockedDate, startTime, endTime) {
    try {
      console.log('🔍 Validando bloqueo:', { resourceId, blockedDate, startTime, endTime });

      // Buscar citas confirmadas en el mismo recurso, fecha y rango horario
      const { data: conflicts, error } = await supabase
        .from('appointments')
        .select('id, customer_name, appointment_time, end_time, service_id, services(name)')
        .eq('resource_id', resourceId)
        .eq('appointment_date', blockedDate)
        .in('status', ['confirmed', 'pending'])
        .or(`appointment_time.gte.${startTime},appointment_time.lt.${endTime}`);

      if (error) throw error;

      const hasConflicts = conflicts && conflicts.length > 0;

      if (hasConflicts) {
        return {
          valid: false,
          conflicts: conflicts,
          message: `❌ Hay ${conflicts.length} cita(s) confirmada(s) en este horario`
        };
      }

      return {
        valid: true,
        conflicts: [],
        message: '✅ No hay conflictos, puedes bloquear'
      };

    } catch (error) {
      console.error('❌ Error validando bloqueo:', error);
      return {
        valid: false,
        conflicts: [],
        message: 'Error al validar disponibilidad'
      };
    }
  }

  /**
   * Crear un bloqueo de recurso
   */
  static async createBlockage(blockageData) {
    try {
      const { businessId, resourceId, blockedDate, startTime, endTime, reason } = blockageData;

      console.log('🚫 Creando bloqueo:', blockageData);

      // 1. Validar ANTES de crear
      const validation = await this.validateBlockage(resourceId, blockedDate, startTime, endTime);
      
      if (!validation.valid) {
        toast.error(validation.message);
        return { success: false, conflicts: validation.conflicts };
      }

      // 2. Crear bloqueo en BD
      const { data, error } = await supabase
        .from('resource_blockages')
        .insert({
          business_id: businessId,
          resource_id: resourceId,
          blocked_date: blockedDate,
          start_time: startTime,
          end_time: endTime,
          reason: reason || null
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando bloqueo:', error);
        throw error;
      }

      console.log('✅ Bloqueo creado:', data);

      return { success: true, data, conflicts: [] };

    } catch (error) {
      console.error('❌ Error en createBlockage:', error);
      
      // Si el error viene del trigger de validación
      if (error.message?.includes('No se puede bloquear')) {
        toast.error(error.message);
        return { success: false, conflicts: [], error: error.message };
      }

      toast.error('Error al crear el bloqueo');
      return { success: false, conflicts: [], error: error.message };
    }
  }

  /**
   * Eliminar un bloqueo
   */
  static async removeBlockage(blockageId, businessId) {
    try {
      console.log('🗑️ Eliminando bloqueo:', blockageId);

      const { error } = await supabase
        .from('resource_blockages')
        .delete()
        .eq('id', blockageId)
        .eq('business_id', businessId);

      if (error) throw error;

      console.log('✅ Bloqueo eliminado');
      toast.success('✅ Bloqueo eliminado. Disponibilidad actualizada.');

      return { success: true };

    } catch (error) {
      console.error('❌ Error eliminando bloqueo:', error);
      toast.error('Error al eliminar el bloqueo');
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener bloqueos de un recurso en un rango de fechas
   */
  static async getBlockages(resourceId, startDate, endDate) {
    try {
      let query = supabase
        .from('resource_blockages')
        .select('*')
        .eq('resource_id', resourceId)
        .order('blocked_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (startDate) {
        query = query.gte('blocked_date', startDate);
      }

      if (endDate) {
        query = query.lte('blocked_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };

    } catch (error) {
      console.error('❌ Error obteniendo bloqueos:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * Obtener todos los bloqueos de un negocio en una fecha
   */
  static async getBlockagesByDate(businessId, date) {
    try {
      const { data, error } = await supabase
        .from('resource_blockages')
        .select('*, resources(name, resource_number)')
        .eq('business_id', businessId)
        .eq('blocked_date', date)
        .order('start_time', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };

    } catch (error) {
      console.error('❌ Error obteniendo bloqueos:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * Verificar si un slot específico está bloqueado
   */
  static async isSlotBlocked(resourceId, date, time) {
    try {
      const { data, error } = await supabase
        .from('resource_blockages')
        .select('id, reason')
        .eq('resource_id', resourceId)
        .eq('blocked_date', date)
        .lte('start_time', time)
        .gt('end_time', time)
        .limit(1);

      if (error) throw error;

      return { 
        blocked: data && data.length > 0, 
        blockage: data?.[0] || null 
      };

    } catch (error) {
      console.error('❌ Error verificando bloqueo:', error);
      return { blocked: false, blockage: null };
    }
  }

  /**
   * Actualizar motivo de un bloqueo
   */
  static async updateBlockageReason(blockageId, businessId, newReason) {
    try {
      const { error } = await supabase
        .from('resource_blockages')
        .update({ reason: newReason, updated_at: new Date().toISOString() })
        .eq('id', blockageId)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Motivo actualizado');
      return { success: true };

    } catch (error) {
      console.error('❌ Error actualizando motivo:', error);
      toast.error('Error al actualizar');
      return { success: false, error: error.message };
    }
  }
}

export default BlockageService;



