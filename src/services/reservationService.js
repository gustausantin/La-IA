/**
 * =====================================================
 * RESERVATION SERVICE - SERVICIO CENTRALIZADO
 * =====================================================
 * Servicio centralizado para gestionar reservas usando
 * los nuevos RPCs que incluyen datos de customers automáticamente
 */

import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export class ReservationService {
  
  /**
   * Obtener una reserva con datos del customer incluidos
   * @param {string} reservationId - ID de la reserva
   * @returns {Promise<Object>} Reserva con datos del customer
   */
  static async getReservationWithCustomer(reservationId) {
    try {
      const { data, error } = await supabase
        .rpc('get_reservation_with_customer', {
          p_reservation_id: reservationId
        });
      
      if (error) throw error;
      
      return {
        success: true,
        reservation: data
      };
    } catch (error) {
      console.error('❌ Error obteniendo reserva:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener reservas de un restaurante con datos de customers incluidos
   * @param {string} businessId - ID del restaurante
   * @param {string} startDate - Fecha inicio (YYYY-MM-DD)
   * @param {string} endDate - Fecha fin (YYYY-MM-DD)
   * @returns {Promise<Array>} Lista de reservas con datos de customers
   */
  static async getReservationsWithCustomers(businessId, startDate = null, endDate = null) {
    try {
      const { data, error } = await supabase
        .rpc('get_reservations_with_customers', {
          p_business_id: businessId,
          p_start_date: startDate,
          p_end_date: endDate
        });
      
      if (error) throw error;
      
      return {
        success: true,
        reservations: data || []
      };
    } catch (error) {
      console.error('❌ Error obteniendo reservas:', error);
      return {
        success: false,
        error: error.message,
        reservations: []
      };
    }
  }

  /**
   * Obtener reservas de hoy con datos de customers
   * @param {string} businessId - ID del restaurante
   * @returns {Promise<Array>} Reservas de hoy
   */
  static async getTodayReservationsWithCustomers(businessId) {
    const today = format(new Date(), 'yyyy-MM-dd');
    return this.getReservationsWithCustomers(businessId, today, today);
  }

  /**
   * Crear una reserva (el trigger sincronizará el customer automáticamente)
   * @param {Object} reservationData - Datos de la reserva
   * @returns {Promise<Object>} Resultado de la creación
   */
  static async createReservation(reservationData) {
    try {
      // El trigger sync_customer_on_reservation_change se encargará de:
      // 1. Crear/encontrar el customer basándose en customer_name/email/phone
      // 2. Asignar customer_id automáticamente
      
      const { data, error } = await supabase
        .from('appointments')
        .insert([reservationData])
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        success: true,
        reservation: data
      };
    } catch (error) {
      console.error('❌ Error creando reserva:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizar una reserva
   * @param {string} reservationId - ID de la reserva
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  static async updateReservation(reservationId, updates) {
    try {
      // Si se actualizan datos del customer (nombre, email, phone),
      // el trigger se encargará de sincronizar con la tabla customers
      
      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', reservationId)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        success: true,
        reservation: data
      };
    } catch (error) {
      console.error('❌ Error actualizando reserva:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar una reserva
   * @param {string} reservationId - ID de la reserva
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  static async deleteReservation(reservationId) {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', reservationId);
      
      if (error) throw error;
      
      return {
        success: true
      };
    } catch (error) {
      console.error('❌ Error eliminando reserva:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * MÉTODO LEGACY: Obtener reservas con JOIN manual (para compatibilidad)
   * @deprecated Usar getReservationsWithCustomers() en su lugar
   */
  static async getReservationsLegacy(businessId, filters = {}) {
    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            email,
            phone,
            segment_auto,
            visits_count
          ),
          tables (
            id,
            table_number,
            name,
            capacity,
            zone
          )
        `)
        .eq('business_id', businessId);
      
      // Aplicar filtros
      if (filters.date) {
        query = query.eq('reservation_date', filters.date);
      }
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.startDate && filters.endDate) {
        query = query.gte('reservation_date', filters.startDate)
                     .lte('reservation_date', filters.endDate);
      }
      
      query = query.order('reservation_date', { ascending: true })
                   .order('reservation_time', { ascending: true });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transformar para compatibilidad (copiar datos de customer a nivel de reserva)
      const reservations = (data || []).map(r => ({
        ...r,
        customer_name: r.customer?.name || r.customer_name,
        customer_email: r.customer?.email || r.customer_email,
        customer_phone: r.customer?.phone || r.customer_phone
      }));
      
      return {
        success: true,
        reservations
      };
    } catch (error) {
      console.error('❌ Error obteniendo reservas (legacy):', error);
      return {
        success: false,
        error: error.message,
        reservations: []
      };
    }
  }
}

export default ReservationService;


